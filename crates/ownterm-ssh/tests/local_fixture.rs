use ownterm_application::ssh::{ResolvedSshAuth, ResolvedSshHost};
use ownterm_application::vault::SecretValue;
use ownterm_domain::{HostId, SessionStatus};
use ownterm_ssh::{SshEvent, SshEventSink, SshSessionBackend, SshTrustStore, TrustAssessment};
use russh::keys::{Algorithm, PrivateKey};
use russh::server::{self, Msg, Server as _, Session};
use russh::{Channel, ChannelId, Pty};
use std::io::Write;
use std::sync::{Arc, Mutex, mpsc};
use std::time::{Duration, Instant};
use tokio::net::TcpListener;

const WAIT: Duration = Duration::from_secs(5);

#[derive(Clone, Default)]
struct FixtureServer {
    resized_to: Arc<Mutex<Option<(u32, u32)>>>,
}

impl server::Server for FixtureServer {
    type Handler = Self;

    fn new_client(&mut self, _: Option<std::net::SocketAddr>) -> Self {
        self.clone()
    }
}

impl server::Handler for FixtureServer {
    type Error = russh::Error;

    async fn auth_password(
        &mut self,
        user: &str,
        password: &str,
    ) -> Result<server::Auth, Self::Error> {
        if user == "alice" && password == "fixture-password" {
            Ok(server::Auth::Accept)
        } else {
            Ok(server::Auth::Reject {
                proceed_with_methods: None,
                partial_success: false,
            })
        }
    }

    async fn auth_publickey(
        &mut self,
        user: &str,
        _: &russh::keys::ssh_key::PublicKey,
    ) -> Result<server::Auth, Self::Error> {
        Ok(if user == "alice" {
            server::Auth::Accept
        } else {
            server::Auth::Reject {
                proceed_with_methods: None,
                partial_success: false,
            }
        })
    }

    async fn channel_open_session(
        &mut self,
        _: Channel<Msg>,
        reply: server::ChannelOpenHandle,
        _: &mut Session,
    ) -> Result<(), Self::Error> {
        reply.accept().await;
        Ok(())
    }

    async fn pty_request(
        &mut self,
        channel: ChannelId,
        _: &str,
        columns: u32,
        rows: u32,
        _: u32,
        _: u32,
        _: &[(Pty, u32)],
        session: &mut Session,
    ) -> Result<(), Self::Error> {
        *self.resized_to.lock().unwrap() = Some((columns, rows));
        session.channel_success(channel)?;
        Ok(())
    }

    async fn shell_request(
        &mut self,
        channel: ChannelId,
        session: &mut Session,
    ) -> Result<(), Self::Error> {
        session.channel_success(channel)?;
        Ok(())
    }

    async fn data(
        &mut self,
        channel: ChannelId,
        data: &[u8],
        session: &mut Session,
    ) -> Result<(), Self::Error> {
        session.data(channel, data.to_vec())?;
        Ok(())
    }

    async fn window_change_request(
        &mut self,
        _: ChannelId,
        columns: u32,
        rows: u32,
        _: u32,
        _: u32,
        _: &mut Session,
    ) -> Result<(), Self::Error> {
        *self.resized_to.lock().unwrap() = Some((columns, rows));
        Ok(())
    }
}

struct Fixture {
    port: u16,
    resized_to: Arc<Mutex<Option<(u32, u32)>>>,
    handle: russh::server::RunningServerHandle,
}

impl Fixture {
    async fn start() -> Self {
        let listener = TcpListener::bind(("127.0.0.1", 0)).await.unwrap();
        let port = listener.local_addr().unwrap().port();
        let config = Arc::new(server::Config {
            auth_rejection_time: Duration::ZERO,
            auth_rejection_time_initial: Some(Duration::ZERO),
            keys: vec![PrivateKey::random(&mut rand::rng(), Algorithm::Ed25519).unwrap()],
            ..Default::default()
        });
        let resized_to = Arc::new(Mutex::new(None));
        let mut fixture = FixtureServer {
            resized_to: Arc::clone(&resized_to),
        };
        let (handle_sender, handle_receiver) = tokio::sync::oneshot::channel();
        tokio::spawn(async move {
            let running = fixture.run_on_socket(config, &listener);
            let _ = handle_sender.send(running.handle());
            let _ = running.await;
        });
        let handle = handle_receiver.await.unwrap();
        Self {
            port,
            resized_to,
            handle,
        }
    }
}

impl Drop for Fixture {
    fn drop(&mut self) {
        self.handle.shutdown("fixture complete".into());
    }
}

struct EventChannel(mpsc::Sender<SshEvent>);
impl SshEventSink for EventChannel {
    fn emit(&self, event: SshEvent) {
        let _ = self.0.send(event);
    }
}

struct MemoryTrust(Mutex<TrustAssessment>);
impl MemoryTrust {
    fn new(value: TrustAssessment) -> Self {
        Self(Mutex::new(value))
    }
}
impl SshTrustStore for MemoryTrust {
    fn assess(
        &self,
        _: &str,
        _: u16,
        _: &str,
        _: &str,
    ) -> Result<TrustAssessment, ownterm_ssh::SshError> {
        Ok(*self.0.lock().unwrap())
    }

    fn accept(&self, _: &str, _: u16, _: &str, _: &str) -> Result<(), ownterm_ssh::SshError> {
        *self.0.lock().unwrap() = TrustAssessment::Trusted;
        Ok(())
    }
}

fn target(port: u16, auth: ResolvedSshAuth) -> ResolvedSshHost {
    ResolvedSshHost {
        host_id: Some(HostId::new()),
        title: "Local fixture".into(),
        address: "127.0.0.1".into(),
        port,
        username: "alice".into(),
        auth,
    }
}

fn wait_for(
    receiver: &mpsc::Receiver<SshEvent>,
    predicate: impl Fn(&SshEvent) -> bool,
) -> SshEvent {
    let deadline = Instant::now() + WAIT;
    loop {
        let remaining = deadline.saturating_duration_since(Instant::now());
        let event = receiver
            .recv_timeout(remaining)
            .expect("timed out waiting for SSH event");
        if predicate(&event) {
            return event;
        }
    }
}

#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn password_tofu_io_resize_cancel_and_reconnect() {
    let fixture = Fixture::start().await;
    let backend = SshSessionBackend::default();
    let trust = Arc::new(MemoryTrust::new(TrustAssessment::ConfirmFirstUse));
    let (sender, receiver) = mpsc::channel();
    let sink = Arc::new(EventChannel(sender));

    let first = backend
        .start(
            target(fixture.port, ResolvedSshAuth::Password { secret: None }),
            24,
            80,
            trust.clone(),
            sink.clone(),
        )
        .unwrap();
    wait_for(&receiver, |event| {
        matches!(event, SshEvent::TrustRequired { .. })
    });
    backend.confirm_trust(first.id, true).unwrap();
    wait_for(&receiver, |event| {
        matches!(event, SshEvent::CredentialRequired { .. })
    });
    backend
        .provide_credential(first.id, Some("fixture-password".into()))
        .unwrap();
    wait_for(&receiver, |event| {
        matches!(
            event,
            SshEvent::Status {
                status: SessionStatus::Connected,
                ..
            }
        )
    });

    backend.write(first.id, b"ping\r").unwrap();
    let output = wait_for(&receiver, |event| matches!(event, SshEvent::Output { .. }));
    assert!(matches!(output, SshEvent::Output { data, .. } if data == b"ping\r"));
    backend.resize(first.id, 40, 120).unwrap();
    let deadline = Instant::now() + WAIT;
    while *fixture.resized_to.lock().unwrap() != Some((120, 40)) && Instant::now() < deadline {
        std::thread::sleep(Duration::from_millis(10));
    }
    assert_eq!(*fixture.resized_to.lock().unwrap(), Some((120, 40)));
    backend.close(first.id).unwrap();

    let second = backend
        .start(
            target(
                fixture.port,
                ResolvedSshAuth::Password {
                    secret: Some(SecretValue::new("fixture-password")),
                },
            ),
            24,
            80,
            trust,
            sink,
        )
        .unwrap();
    assert_ne!(first.id, second.id);
    wait_for(
        &receiver,
        |event| matches!(event, SshEvent::Status { session_id, status: SessionStatus::Connected, .. } if *session_id == second.id),
    );
    backend.close(second.id).unwrap();
}

#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn authenticates_with_a_private_key_against_the_local_fixture() {
    let fixture = Fixture::start().await;
    let key = PrivateKey::random(&mut rand::rng(), Algorithm::Ed25519)
        .unwrap()
        .encrypt(&mut rand::rng(), "fixture-passphrase")
        .unwrap();
    let mut key_file = tempfile::NamedTempFile::new().unwrap();
    key_file
        .write_all(
            key.to_openssh(russh::keys::ssh_key::LineEnding::LF)
                .unwrap()
                .as_bytes(),
        )
        .unwrap();
    let backend = SshSessionBackend::default();
    let (sender, receiver) = mpsc::channel();
    let descriptor = backend
        .start(
            target(
                fixture.port,
                ResolvedSshAuth::PrivateKey {
                    path: key_file.path().to_path_buf(),
                    passphrase: None,
                    needs_passphrase: true,
                },
            ),
            24,
            80,
            Arc::new(MemoryTrust::new(TrustAssessment::Trusted)),
            Arc::new(EventChannel(sender)),
        )
        .unwrap();
    wait_for(&receiver, |event| {
        matches!(event, SshEvent::CredentialRequired { .. })
    });
    backend
        .provide_credential(descriptor.id, Some("fixture-passphrase".into()))
        .unwrap();
    wait_for(&receiver, |event| {
        matches!(
            event,
            SshEvent::Status {
                status: SessionStatus::Connected,
                ..
            }
        )
    });
    backend.close(descriptor.id).unwrap();
}

#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn blocks_changed_host_keys_and_can_cancel_a_pending_prompt() {
    let fixture = Fixture::start().await;
    let backend = SshSessionBackend::default();
    let (sender, receiver) = mpsc::channel();
    let changed = backend
        .start(
            target(fixture.port, ResolvedSshAuth::Password { secret: None }),
            24,
            80,
            Arc::new(MemoryTrust::new(TrustAssessment::Changed)),
            Arc::new(EventChannel(sender)),
        )
        .unwrap();
    let failure = wait_for(&receiver, |event| {
        matches!(
            event,
            SshEvent::Status {
                status: SessionStatus::Failed,
                ..
            }
        )
    });
    assert!(
        matches!(failure, SshEvent::Status { reason: Some(reason), .. } if reason.contains("identity changed"))
    );
    let deadline = Instant::now() + WAIT;
    while backend.contains(changed.id) && Instant::now() < deadline {
        std::thread::sleep(Duration::from_millis(10));
    }
    assert!(!backend.contains(changed.id));

    let (sender, receiver) = mpsc::channel();
    let pending = backend
        .start(
            target(fixture.port, ResolvedSshAuth::Password { secret: None }),
            24,
            80,
            Arc::new(MemoryTrust::new(TrustAssessment::ConfirmFirstUse)),
            Arc::new(EventChannel(sender)),
        )
        .unwrap();
    wait_for(&receiver, |event| {
        matches!(event, SshEvent::TrustRequired { .. })
    });
    backend.close(pending.id).unwrap();
    assert!(!backend.contains(pending.id));
}
