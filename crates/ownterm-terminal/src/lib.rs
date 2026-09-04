#![forbid(unsafe_code)]

//! Adapter produtivo para descoberta de shells e sessões locais via PTY.

mod platform;

use ownterm_application::terminal::{
    TerminalBackend, TerminalError, TerminalEvent, TerminalEventSink,
};
use ownterm_domain::{
    SessionDescriptor, SessionId, SessionKind, SessionStatus, ShellProfile, ShellProfileId,
};
use portable_pty::{ChildKiller, CommandBuilder, MasterPty, PtySize, native_pty_system};
use std::collections::HashMap;
use std::fmt;
use std::io::{Read, Write};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex, mpsc};
use std::thread;
use std::time::{Duration, Instant};

const DEFAULT_ROWS: u16 = 24;
const DEFAULT_COLUMNS: u16 = 80;
const MAX_DIMENSION: u16 = 1_000;

#[derive(Debug, Clone)]
struct ShellCatalog {
    profiles: Vec<ShellProfile>,
}

impl ShellCatalog {
    pub fn detect() -> Self {
        Self {
            profiles: platform::detect_shell_profiles(),
        }
    }

    fn from_profiles(profiles: Vec<ShellProfile>) -> Self {
        Self { profiles }
    }

    pub fn profiles(&self) -> &[ShellProfile] {
        &self.profiles
    }

    pub fn find(&self, id: ShellProfileId) -> Result<&ShellProfile, TerminalError> {
        self.profiles
            .iter()
            .find(|profile| profile.id == id)
            .ok_or(TerminalError::ProfileNotFound)
    }
}

impl Default for ShellCatalog {
    fn default() -> Self {
        Self::detect()
    }
}

struct RuntimeSession {
    writer: Mutex<Box<dyn Write + Send>>,
    master: Box<dyn MasterPty + Send>,
    killer: Mutex<Box<dyn ChildKiller + Send + Sync>>,
    active: Arc<AtomicBool>,
}

#[derive(Default)]
struct SessionRegistry {
    sessions: Mutex<HashMap<SessionId, RuntimeSession>>,
}

#[derive(Clone, Default)]
struct SessionManager {
    registry: Arc<SessionRegistry>,
}

impl fmt::Debug for SessionManager {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        formatter
            .debug_struct("SessionManager")
            .field("active_sessions", &self.active_session_count())
            .finish()
    }
}

#[derive(Debug)]
pub struct NativeTerminalBackend {
    shells: ShellCatalog,
    sessions: SessionManager,
}

impl NativeTerminalBackend {
    pub fn detect() -> Self {
        Self {
            shells: ShellCatalog::detect(),
            sessions: SessionManager::default(),
        }
    }

    pub fn with_profiles(profiles: Vec<ShellProfile>) -> Self {
        Self {
            shells: ShellCatalog::from_profiles(profiles),
            sessions: SessionManager::default(),
        }
    }
}

impl Default for NativeTerminalBackend {
    fn default() -> Self {
        Self::detect()
    }
}

impl TerminalBackend for NativeTerminalBackend {
    fn shell_profiles(&self) -> Vec<ShellProfile> {
        self.shells.profiles().to_vec()
    }

    fn start(
        &self,
        shell_profile_id: ShellProfileId,
        rows: u16,
        columns: u16,
        sink: Arc<dyn TerminalEventSink>,
    ) -> Result<SessionDescriptor, TerminalError> {
        let profile = self.shells.find(shell_profile_id)?;
        self.sessions.start(profile, rows, columns, sink)
    }

    fn write(&self, session_id: SessionId, data: &[u8]) -> Result<(), TerminalError> {
        self.sessions.write(session_id, data)
    }

    fn resize(&self, session_id: SessionId, rows: u16, columns: u16) -> Result<(), TerminalError> {
        self.sessions.resize(session_id, rows, columns)
    }

    fn close(&self, session_id: SessionId) -> Result<(), TerminalError> {
        self.sessions.close(session_id)
    }
}

impl SessionManager {
    pub fn start(
        &self,
        profile: &ShellProfile,
        rows: u16,
        columns: u16,
        sink: Arc<dyn TerminalEventSink>,
    ) -> Result<SessionDescriptor, TerminalError> {
        let size = validated_size(rows, columns)?;
        let pair = native_pty_system()
            .openpty(size)
            .map_err(|error| TerminalError::Platform(error.to_string()))?;

        let mut command = CommandBuilder::new(&profile.program);
        command.args(&profile.arguments);
        let mut child = pair
            .slave
            .spawn_command(command)
            .map_err(|error| TerminalError::Platform(error.to_string()))?;
        drop(pair.slave);

        let reader = pair
            .master
            .try_clone_reader()
            .map_err(|error| TerminalError::Platform(error.to_string()))?;
        let writer = pair
            .master
            .take_writer()
            .map_err(|error| TerminalError::Platform(error.to_string()))?;
        let killer = child.clone_killer();
        let descriptor = SessionDescriptor::new(
            SessionKind::Local {
                shell_profile_id: profile.id,
            },
            &profile.name,
            SessionStatus::Connected,
        )
        .map_err(|error| TerminalError::Platform(error.to_string()))?;
        let session_id = descriptor.id;
        let active = Arc::new(AtomicBool::new(true));

        self.registry
            .sessions
            .lock()
            .map_err(|_| TerminalError::StateUnavailable)?
            .insert(
                session_id,
                RuntimeSession {
                    writer: Mutex::new(writer),
                    master: pair.master,
                    killer: Mutex::new(killer),
                    active: Arc::clone(&active),
                },
            );

        let output_pump =
            spawn_output_pump(session_id, reader, Arc::clone(&active), Arc::clone(&sink));
        let registry = Arc::clone(&self.registry);
        thread::spawn(move || {
            let result = child.wait();
            let runtime = registry
                .sessions
                .lock()
                .ok()
                .and_then(|mut sessions| sessions.remove(&session_id));
            let was_active = runtime
                .as_ref()
                .is_some_and(|runtime| runtime.active.load(Ordering::Acquire));
            drop(runtime);
            let _ = output_pump.join();
            active.store(false, Ordering::Release);

            if was_active {
                match result {
                    Ok(status) => {
                        sink.emit(TerminalEvent::Exit {
                            session_id,
                            exit_code: Some(status.exit_code()),
                        });
                        sink.emit(TerminalEvent::Status {
                            session_id,
                            status: SessionStatus::Disconnected,
                            reason: None,
                        });
                    }
                    Err(error) => sink.emit(TerminalEvent::Status {
                        session_id,
                        status: SessionStatus::Failed,
                        reason: Some(error.to_string()),
                    }),
                }
            }
        });

        Ok(descriptor)
    }

    pub fn write(&self, session_id: SessionId, data: &[u8]) -> Result<(), TerminalError> {
        let sessions = self
            .registry
            .sessions
            .lock()
            .map_err(|_| TerminalError::StateUnavailable)?;
        let runtime = sessions
            .get(&session_id)
            .ok_or(TerminalError::SessionNotFound)?;
        let mut writer = runtime
            .writer
            .lock()
            .map_err(|_| TerminalError::StateUnavailable)?;
        writer
            .write_all(data)
            .and_then(|_| writer.flush())
            .map_err(|error| TerminalError::Io(error.to_string()))
    }

    pub fn resize(
        &self,
        session_id: SessionId,
        rows: u16,
        columns: u16,
    ) -> Result<(), TerminalError> {
        let size = validated_size(rows, columns)?;
        let sessions = self
            .registry
            .sessions
            .lock()
            .map_err(|_| TerminalError::StateUnavailable)?;
        sessions
            .get(&session_id)
            .ok_or(TerminalError::SessionNotFound)?
            .master
            .resize(size)
            .map_err(|error| TerminalError::Platform(error.to_string()))
    }

    pub fn close(&self, session_id: SessionId) -> Result<(), TerminalError> {
        let runtime = self
            .registry
            .sessions
            .lock()
            .map_err(|_| TerminalError::StateUnavailable)?
            .remove(&session_id);
        let Some(runtime) = runtime else {
            return Ok(());
        };
        runtime.active.store(false, Ordering::Release);
        let kill_result = runtime
            .killer
            .lock()
            .map_err(|_| TerminalError::StateUnavailable)?
            .kill();

        platform::finish_close(kill_result)
    }

    pub fn active_session_count(&self) -> usize {
        self.registry
            .sessions
            .lock()
            .map(|sessions| sessions.len())
            .unwrap_or_default()
    }
}

fn spawn_output_pump(
    session_id: SessionId,
    mut reader: Box<dyn Read + Send>,
    active: Arc<AtomicBool>,
    sink: Arc<dyn TerminalEventSink>,
) -> thread::JoinHandle<()> {
    let (sender, receiver) = mpsc::sync_channel::<Result<Vec<u8>, String>>(32);
    let reader_thread = thread::spawn(move || {
        let mut buffer = [0_u8; 8 * 1024];
        loop {
            match reader.read(&mut buffer) {
                Ok(0) => break,
                Ok(size) => {
                    if sender.send(Ok(buffer[..size].to_vec())).is_err() {
                        break;
                    }
                }
                Err(error) => {
                    let _ = sender.send(Err(error.to_string()));
                    break;
                }
            }
        }
    });

    thread::spawn(move || {
        const MAX_BATCH_BYTES: usize = 64 * 1024;
        const BATCH_WINDOW: Duration = Duration::from_millis(4);

        while let Ok(message) = receiver.recv() {
            let mut disconnected = false;
            match message {
                Ok(mut batch) => {
                    let deadline = Instant::now() + BATCH_WINDOW;
                    while batch.len() < MAX_BATCH_BYTES {
                        let remaining = deadline.saturating_duration_since(Instant::now());
                        match receiver.recv_timeout(remaining) {
                            Ok(Ok(chunk)) => batch.extend(chunk),
                            Ok(Err(error)) => {
                                if active.load(Ordering::Acquire) {
                                    sink.emit(TerminalEvent::Status {
                                        session_id,
                                        status: SessionStatus::Failed,
                                        reason: Some(error),
                                    });
                                }
                                disconnected = true;
                                break;
                            }
                            Err(mpsc::RecvTimeoutError::Timeout) => break,
                            Err(mpsc::RecvTimeoutError::Disconnected) => {
                                disconnected = true;
                                break;
                            }
                        }
                    }
                    if active.load(Ordering::Acquire) {
                        sink.emit(TerminalEvent::Output {
                            session_id,
                            data: batch,
                        });
                    }
                }
                Err(error) => {
                    if active.load(Ordering::Acquire) {
                        sink.emit(TerminalEvent::Status {
                            session_id,
                            status: SessionStatus::Failed,
                            reason: Some(error),
                        });
                    }
                    disconnected = true;
                }
            }
            if disconnected {
                break;
            }
        }

        let _ = reader_thread.join();
    })
}

fn validated_size(rows: u16, columns: u16) -> Result<PtySize, TerminalError> {
    if rows == 0 || columns == 0 || rows > MAX_DIMENSION || columns > MAX_DIMENSION {
        return Err(TerminalError::InvalidSize);
    }
    Ok(PtySize {
        rows,
        cols: columns,
        pixel_width: 0,
        pixel_height: 0,
    })
}
#[cfg(any(test, windows))]
fn decode_wsl_output(bytes: &[u8]) -> Vec<String> {
    let decoded = if bytes
        .iter()
        .skip(1)
        .step_by(2)
        .filter(|byte| **byte == 0)
        .count()
        > bytes.len() / 8
    {
        let utf16 = bytes
            .chunks_exact(2)
            .map(|pair| u16::from_le_bytes([pair[0], pair[1]]))
            .collect::<Vec<_>>();
        String::from_utf16_lossy(&utf16)
    } else {
        String::from_utf8_lossy(bytes).into_owned()
    };

    decoded
        .lines()
        .map(|line| line.trim_matches(['\0', '\r', ' ', '*']))
        .filter(|line| !line.is_empty())
        .map(str::to_owned)
        .collect()
}

pub const fn default_rows() -> u16 {
    DEFAULT_ROWS
}

pub const fn default_columns() -> u16 {
    DEFAULT_COLUMNS
}

#[cfg(test)]
mod tests {
    use super::{ShellCatalog, decode_wsl_output, validated_size};

    #[test]
    fn detects_at_least_one_development_shell() {
        assert!(!ShellCatalog::detect().profiles().is_empty());
    }

    #[test]
    fn validates_terminal_dimensions() {
        assert!(validated_size(24, 80).is_ok());
        assert!(validated_size(0, 80).is_err());
        assert!(validated_size(24, 1_001).is_err());
    }

    #[test]
    fn decodes_utf8_and_utf16_wsl_distribution_lists() {
        assert_eq!(
            decode_wsl_output(b"Ubuntu\r\nDebian\r\n"),
            ["Ubuntu", "Debian"]
        );
        let utf16 = "Ubuntu\r\n"
            .encode_utf16()
            .flat_map(u16::to_le_bytes)
            .collect::<Vec<_>>();
        assert_eq!(decode_wsl_output(&utf16), ["Ubuntu"]);
    }
}
