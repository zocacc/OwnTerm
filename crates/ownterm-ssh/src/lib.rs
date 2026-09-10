#![forbid(unsafe_code)]

//! Adapter SSH interativo sobre russh, sem persistência ou APIs de UI.

use ownterm_application::ssh::{ResolvedSshAuth, ResolvedSshHost};
use ownterm_domain::{SessionDescriptor, SessionId, SessionKind, SessionStatus};
use russh::client;
use russh::keys::{HashAlg, PrivateKeyWithHashAlg, load_secret_key};
use russh::{ChannelMsg, Disconnect};
use std::collections::HashMap;
use std::fmt;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex, mpsc};
use std::thread;
use std::time::Duration;
use tokio::sync::mpsc as async_mpsc;

const CONNECT_TIMEOUT: Duration = Duration::from_secs(15);
const PROMPT_TIMEOUT: Duration = Duration::from_secs(300);
const MAX_DIMENSION: u16 = 1_000;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum TrustAssessment {
    Trusted,
    ConfirmFirstUse,
    Changed,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum CredentialKind {
    Password,
    Passphrase,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum SshEvent {
    Output {
        session_id: SessionId,
        data: Vec<u8>,
    },
    Status {
        session_id: SessionId,
        status: SessionStatus,
        reason: Option<String>,
    },
    Exit {
        session_id: SessionId,
        exit_code: Option<u32>,
    },
    TrustRequired {
        session_id: SessionId,
        destination: String,
        port: u16,
        algorithm: String,
        fingerprint: String,
    },
    CredentialRequired {
        session_id: SessionId,
        kind: CredentialKind,
    },
}

pub trait SshEventSink: Send + Sync + 'static {
    fn emit(&self, event: SshEvent);
}

pub trait SshTrustStore: Send + Sync + 'static {
    fn assess(
        &self,
        destination: &str,
        port: u16,
        algorithm: &str,
        fingerprint: &str,
    ) -> Result<TrustAssessment, SshError>;
    fn accept(
        &self,
        destination: &str,
        port: u16,
        algorithm: &str,
        fingerprint: &str,
    ) -> Result<(), SshError>;
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum SshError {
    InvalidSize,
    SessionNotFound,
    ConnectionFailed,
    ConnectionTimedOut,
    HostKeyChanged,
    TrustRejected,
    TrustTimedOut,
    CredentialRequired,
    CredentialTimedOut,
    AuthenticationFailed,
    KeyUnavailable,
    ChannelFailed,
    StateUnavailable,
}

impl fmt::Display for SshError {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        formatter.write_str(match self {
            Self::InvalidSize => "terminal dimensions are invalid",
            Self::SessionNotFound => "SSH session was not found",
            Self::ConnectionFailed => "SSH connection failed",
            Self::ConnectionTimedOut => "SSH connection timed out",
            Self::HostKeyChanged => {
                "SSH host identity changed; review Known Hosts before reconnecting"
            }
            Self::TrustRejected => "SSH host identity was rejected",
            Self::TrustTimedOut => "SSH host identity confirmation timed out",
            Self::CredentialRequired => "SSH credential is required",
            Self::CredentialTimedOut => "SSH credential prompt timed out",
            Self::AuthenticationFailed => "SSH authentication failed",
            Self::KeyUnavailable => "SSH private key could not be loaded",
            Self::ChannelFailed => "SSH terminal channel failed",
            Self::StateUnavailable => "SSH session state is unavailable",
        })
    }
}

impl std::error::Error for SshError {}

enum SessionCommand {
    Write(Vec<u8>),
    Resize { rows: u16, columns: u16 },
    Close,
}

struct RuntimeSession {
    commands: async_mpsc::UnboundedSender<SessionCommand>,
    trust_reply: Arc<Mutex<Option<mpsc::Sender<bool>>>>,
    credential_reply: Arc<Mutex<Option<mpsc::Sender<Option<String>>>>>,
    active: Arc<AtomicBool>,
}

#[derive(Default)]
pub struct SshSessionBackend {
    sessions: Arc<Mutex<HashMap<SessionId, RuntimeSession>>>,
}

impl fmt::Debug for SshSessionBackend {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        formatter
            .debug_struct("SshSessionBackend")
            .field("active_sessions", &self.active_session_count())
            .finish()
    }
}

impl SshSessionBackend {
    pub fn start(
        &self,
        target: ResolvedSshHost,
        rows: u16,
        columns: u16,
        trust_store: Arc<dyn SshTrustStore>,
        sink: Arc<dyn SshEventSink>,
    ) -> Result<SessionDescriptor, SshError> {
        validate_size(rows, columns)?;
        let host_id = target.host_id.ok_or(SshError::ConnectionFailed)?;
        let descriptor = SessionDescriptor::new(
            SessionKind::Ssh { host_id },
            &target.title,
            SessionStatus::Starting,
        )
        .map_err(|_| SshError::ConnectionFailed)?;
        self.start_runtime(descriptor.clone(), target, rows, columns, trust_store, sink)?;
        Ok(descriptor)
    }

    pub fn start_quick_connect(
        &self,
        target: ResolvedSshHost,
        rows: u16,
        columns: u16,
        trust_store: Arc<dyn SshTrustStore>,
        sink: Arc<dyn SshEventSink>,
    ) -> Result<SessionDescriptor, SshError> {
        validate_size(rows, columns)?;
        let descriptor = SessionDescriptor::new(
            SessionKind::Ssh {
                host_id: ownterm_domain::HostId::new(),
            },
            &target.title,
            SessionStatus::Starting,
        )
        .map_err(|_| SshError::ConnectionFailed)?;
        self.start_runtime(descriptor.clone(), target, rows, columns, trust_store, sink)?;
        Ok(descriptor)
    }

    fn start_runtime(
        &self,
        descriptor: SessionDescriptor,
        target: ResolvedSshHost,
        rows: u16,
        columns: u16,
        trust_store: Arc<dyn SshTrustStore>,
        sink: Arc<dyn SshEventSink>,
    ) -> Result<(), SshError> {
        let session_id = descriptor.id;
        let (commands, receiver) = async_mpsc::unbounded_channel();
        let trust_reply = Arc::new(Mutex::new(None));
        let credential_reply = Arc::new(Mutex::new(None));
        let active = Arc::new(AtomicBool::new(true));
        self.sessions
            .lock()
            .map_err(|_| SshError::StateUnavailable)?
            .insert(
                session_id,
                RuntimeSession {
                    commands,
                    trust_reply: Arc::clone(&trust_reply),
                    credential_reply: Arc::clone(&credential_reply),
                    active: Arc::clone(&active),
                },
            );
        let sessions = Arc::clone(&self.sessions);
        thread::spawn(move || {
            let result = tokio::runtime::Builder::new_current_thread()
                .enable_all()
                .build()
                .map_err(|_| SshError::ConnectionFailed)
                .and_then(|runtime| {
                    runtime.block_on(run_session(SessionContext {
                        session_id,
                        target,
                        rows,
                        columns,
                        trust_store,
                        sink: Arc::clone(&sink),
                        trust_reply,
                        credential_reply,
                        active: Arc::clone(&active),
                        receiver,
                    }))
                });
            sessions
                .lock()
                .ok()
                .and_then(|mut values| values.remove(&session_id));
            if active.swap(false, Ordering::AcqRel) {
                match result {
                    Ok(exit_code) => {
                        sink.emit(SshEvent::Exit {
                            session_id,
                            exit_code,
                        });
                        sink.emit(SshEvent::Status {
                            session_id,
                            status: SessionStatus::Disconnected,
                            reason: None,
                        });
                    }
                    Err(error) => sink.emit(SshEvent::Status {
                        session_id,
                        status: SessionStatus::Failed,
                        reason: Some(error.to_string()),
                    }),
                }
            }
        });
        Ok(())
    }

    pub fn confirm_trust(&self, session_id: SessionId, accept: bool) -> Result<(), SshError> {
        let sessions = self
            .sessions
            .lock()
            .map_err(|_| SshError::StateUnavailable)?;
        let runtime = sessions.get(&session_id).ok_or(SshError::SessionNotFound)?;
        runtime
            .trust_reply
            .lock()
            .map_err(|_| SshError::StateUnavailable)?
            .take()
            .ok_or(SshError::SessionNotFound)?
            .send(accept)
            .map_err(|_| SshError::SessionNotFound)
    }

    pub fn provide_credential(
        &self,
        session_id: SessionId,
        secret: Option<String>,
    ) -> Result<(), SshError> {
        let sessions = self
            .sessions
            .lock()
            .map_err(|_| SshError::StateUnavailable)?;
        let runtime = sessions.get(&session_id).ok_or(SshError::SessionNotFound)?;
        runtime
            .credential_reply
            .lock()
            .map_err(|_| SshError::StateUnavailable)?
            .take()
            .ok_or(SshError::SessionNotFound)?
            .send(secret)
            .map_err(|_| SshError::SessionNotFound)
    }

    pub fn write(&self, session_id: SessionId, data: &[u8]) -> Result<(), SshError> {
        self.send(session_id, SessionCommand::Write(data.to_vec()))
    }

    pub fn resize(&self, session_id: SessionId, rows: u16, columns: u16) -> Result<(), SshError> {
        validate_size(rows, columns)?;
        self.send(session_id, SessionCommand::Resize { rows, columns })
    }

    pub fn close(&self, session_id: SessionId) -> Result<(), SshError> {
        let runtime = self
            .sessions
            .lock()
            .map_err(|_| SshError::StateUnavailable)?
            .remove(&session_id);
        let Some(runtime) = runtime else {
            return Ok(());
        };
        runtime.active.store(false, Ordering::Release);
        if let Ok(mut reply) = runtime.trust_reply.lock()
            && let Some(sender) = reply.take()
        {
            let _ = sender.send(false);
        }
        if let Ok(mut reply) = runtime.credential_reply.lock()
            && let Some(sender) = reply.take()
        {
            let _ = sender.send(None);
        }
        let _ = runtime.commands.send(SessionCommand::Close);
        Ok(())
    }

    pub fn contains(&self, session_id: SessionId) -> bool {
        self.sessions
            .lock()
            .is_ok_and(|sessions| sessions.contains_key(&session_id))
    }

    pub fn active_session_count(&self) -> usize {
        self.sessions
            .lock()
            .map(|sessions| sessions.len())
            .unwrap_or_default()
    }

    fn send(&self, session_id: SessionId, command: SessionCommand) -> Result<(), SshError> {
        self.sessions
            .lock()
            .map_err(|_| SshError::StateUnavailable)?
            .get(&session_id)
            .ok_or(SshError::SessionNotFound)?
            .commands
            .send(command)
            .map_err(|_| SshError::SessionNotFound)
    }
}

struct SessionContext {
    session_id: SessionId,
    target: ResolvedSshHost,
    rows: u16,
    columns: u16,
    trust_store: Arc<dyn SshTrustStore>,
    sink: Arc<dyn SshEventSink>,
    trust_reply: Arc<Mutex<Option<mpsc::Sender<bool>>>>,
    credential_reply: Arc<Mutex<Option<mpsc::Sender<Option<String>>>>>,
    active: Arc<AtomicBool>,
    receiver: async_mpsc::UnboundedReceiver<SessionCommand>,
}

struct ClientHandler {
    session_id: SessionId,
    destination: String,
    port: u16,
    trust_store: Arc<dyn SshTrustStore>,
    sink: Arc<dyn SshEventSink>,
    trust_reply: Arc<Mutex<Option<mpsc::Sender<bool>>>>,
    active: Arc<AtomicBool>,
}

impl client::Handler for ClientHandler {
    type Error = russh::Error;

    async fn check_server_key(
        &mut self,
        server_key: &russh::keys::PublicKeyOrCertificate,
    ) -> Result<bool, Self::Error> {
        let public_key = server_key.public_key();
        let algorithm = public_key.algorithm().to_string();
        let fingerprint = public_key.fingerprint(HashAlg::Sha256).to_string();
        match self
            .trust_store
            .assess(&self.destination, self.port, &algorithm, &fingerprint)
        {
            Ok(TrustAssessment::Trusted) => Ok(true),
            Ok(TrustAssessment::Changed) => {
                self.active.store(false, Ordering::Release);
                self.sink.emit(SshEvent::Status {
                    session_id: self.session_id,
                    status: SessionStatus::Failed,
                    reason: Some(SshError::HostKeyChanged.to_string()),
                });
                Ok(false)
            }
            Ok(TrustAssessment::ConfirmFirstUse) => {
                let (sender, receiver) = mpsc::channel();
                *self
                    .trust_reply
                    .lock()
                    .map_err(|_| russh::Error::Disconnect)? = Some(sender);
                self.sink.emit(SshEvent::Status {
                    session_id: self.session_id,
                    status: SessionStatus::AwaitingTrust,
                    reason: None,
                });
                self.sink.emit(SshEvent::TrustRequired {
                    session_id: self.session_id,
                    destination: self.destination.clone(),
                    port: self.port,
                    algorithm: algorithm.clone(),
                    fingerprint: fingerprint.clone(),
                });
                match receiver.recv_timeout(PROMPT_TIMEOUT) {
                    Ok(true) if self.active.load(Ordering::Acquire) => self
                        .trust_store
                        .accept(&self.destination, self.port, &algorithm, &fingerprint)
                        .map(|_| true)
                        .map_err(|_| russh::Error::Disconnect),
                    Ok(false) if self.active.swap(false, Ordering::AcqRel) => {
                        self.sink.emit(SshEvent::Status {
                            session_id: self.session_id,
                            status: SessionStatus::Failed,
                            reason: Some(SshError::TrustRejected.to_string()),
                        });
                        Ok(false)
                    }
                    Err(mpsc::RecvTimeoutError::Timeout)
                        if self.active.swap(false, Ordering::AcqRel) =>
                    {
                        self.sink.emit(SshEvent::Status {
                            session_id: self.session_id,
                            status: SessionStatus::Failed,
                            reason: Some(SshError::TrustTimedOut.to_string()),
                        });
                        Ok(false)
                    }
                    _ => Ok(false),
                }
            }
            Err(_) => Ok(false),
        }
    }
}

async fn run_session(mut context: SessionContext) -> Result<Option<u32>, SshError> {
    let config = Arc::new(client::Config {
        inactivity_timeout: Some(CONNECT_TIMEOUT),
        ..Default::default()
    });
    let handler = ClientHandler {
        session_id: context.session_id,
        destination: context.target.address.clone(),
        port: context.target.port,
        trust_store: Arc::clone(&context.trust_store),
        sink: Arc::clone(&context.sink),
        trust_reply: Arc::clone(&context.trust_reply),
        active: Arc::clone(&context.active),
    };
    let address = (context.target.address.clone(), context.target.port);
    let mut session =
        tokio::time::timeout(CONNECT_TIMEOUT, client::connect(config, address, handler))
            .await
            .map_err(|_| SshError::ConnectionTimedOut)?
            .map_err(|_| SshError::ConnectionFailed)?;
    if !context.active.load(Ordering::Acquire) {
        return Err(SshError::TrustRejected);
    }

    let authenticated = match context.target.auth {
        ResolvedSshAuth::Password { secret } => {
            let secret = match secret {
                Some(value) => value.expose().to_owned(),
                None => request_credential(
                    context.session_id,
                    &context.active,
                    &context.sink,
                    &context.credential_reply,
                    CredentialKind::Password,
                )?,
            };
            session
                .authenticate_password(&context.target.username, secret)
                .await
                .map_err(|_| SshError::AuthenticationFailed)?
                .success()
        }
        ResolvedSshAuth::PrivateKey {
            path,
            passphrase,
            needs_passphrase,
        } => {
            let passphrase = match (passphrase, needs_passphrase) {
                (Some(value), _) => Some(value.expose().to_owned()),
                (None, true) => Some(request_credential(
                    context.session_id,
                    &context.active,
                    &context.sink,
                    &context.credential_reply,
                    CredentialKind::Passphrase,
                )?),
                (None, false) => None,
            };
            let key = load_secret_key(path, passphrase.as_deref())
                .map_err(|_| SshError::KeyUnavailable)?;
            let hash = session
                .best_supported_rsa_hash()
                .await
                .map_err(|_| SshError::AuthenticationFailed)?
                .flatten();
            session
                .authenticate_publickey(
                    &context.target.username,
                    PrivateKeyWithHashAlg::new(Arc::new(key), hash),
                )
                .await
                .map_err(|_| SshError::AuthenticationFailed)?
                .success()
        }
    };
    if !authenticated {
        return Err(SshError::AuthenticationFailed);
    }
    let mut channel = session
        .channel_open_session()
        .await
        .map_err(|_| SshError::ChannelFailed)?;
    channel
        .request_pty(
            true,
            "xterm-256color",
            u32::from(context.columns),
            u32::from(context.rows),
            0,
            0,
            &[],
        )
        .await
        .map_err(|_| SshError::ChannelFailed)?;
    channel
        .request_shell(true)
        .await
        .map_err(|_| SshError::ChannelFailed)?;
    context.sink.emit(SshEvent::Status {
        session_id: context.session_id,
        status: SessionStatus::Connected,
        reason: None,
    });

    let mut exit_code = None;
    loop {
        tokio::select! {
            command = context.receiver.recv() => match command {
                Some(SessionCommand::Write(data)) => channel.data_bytes(data).await.map_err(|_| SshError::ChannelFailed)?,
                Some(SessionCommand::Resize { rows, columns }) => channel.window_change(u32::from(columns), u32::from(rows), 0, 0).await.map_err(|_| SshError::ChannelFailed)?,
                Some(SessionCommand::Close) | None => { let _ = channel.close().await; let _ = session.disconnect(Disconnect::ByApplication, "", "en").await; break; }
            },
            message = channel.wait() => match message {
                Some(ChannelMsg::Data { data }) | Some(ChannelMsg::ExtendedData { data, .. }) => context.sink.emit(SshEvent::Output { session_id: context.session_id, data: data.to_vec() }),
                Some(ChannelMsg::ExitStatus { exit_status }) => exit_code = Some(exit_status),
                Some(ChannelMsg::Eof | ChannelMsg::Close) | None => break,
                _ => {}
            }
        }
    }
    Ok(exit_code)
}

fn request_credential(
    session_id: SessionId,
    active: &Arc<AtomicBool>,
    sink: &Arc<dyn SshEventSink>,
    credential_reply: &Arc<Mutex<Option<mpsc::Sender<Option<String>>>>>,
    kind: CredentialKind,
) -> Result<String, SshError> {
    if !active.load(Ordering::Acquire) {
        return Err(SshError::CredentialRequired);
    }
    let (sender, receiver) = mpsc::channel();
    *credential_reply
        .lock()
        .map_err(|_| SshError::StateUnavailable)? = Some(sender);
    sink.emit(SshEvent::Status {
        session_id,
        status: SessionStatus::AwaitingCredential,
        reason: None,
    });
    sink.emit(SshEvent::CredentialRequired { session_id, kind });
    match receiver.recv_timeout(PROMPT_TIMEOUT) {
        Ok(Some(secret)) if !secret.is_empty() && active.load(Ordering::Acquire) => Ok(secret),
        Ok(_) => Err(SshError::CredentialRequired),
        Err(_) => Err(SshError::CredentialTimedOut),
    }
}

fn validate_size(rows: u16, columns: u16) -> Result<(), SshError> {
    if rows == 0 || columns == 0 || rows > MAX_DIMENSION || columns > MAX_DIMENSION {
        Err(SshError::InvalidSize)
    } else {
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::{SshError, validate_size};

    #[test]
    fn validates_remote_terminal_dimensions() {
        assert_eq!(validate_size(0, 80), Err(SshError::InvalidSize));
        assert_eq!(validate_size(24, 80), Ok(()));
        assert_eq!(validate_size(1001, 80), Err(SshError::InvalidSize));
    }

    #[test]
    fn errors_are_sanitized() {
        assert_eq!(
            SshError::AuthenticationFailed.to_string(),
            "SSH authentication failed"
        );
        assert!(!SshError::KeyUnavailable.to_string().contains("key content"));
    }
}
