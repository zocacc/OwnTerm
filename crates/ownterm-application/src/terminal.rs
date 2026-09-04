//! Port para descoberta e controle de sessões locais sem detalhes de SO.

use ownterm_domain::{SessionDescriptor, SessionId, SessionStatus, ShellProfile, ShellProfileId};
use std::fmt;
use std::str::FromStr;
use std::sync::Arc;

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum TerminalEvent {
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
}

pub trait TerminalEventSink: Send + Sync + 'static {
    fn emit(&self, event: TerminalEvent);
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum TerminalError {
    InvalidSize,
    ProfileNotFound,
    SessionNotFound,
    Platform(String),
    Io(String),
    StateUnavailable,
}

impl fmt::Display for TerminalError {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::InvalidSize => formatter.write_str("terminal dimensions are invalid"),
            Self::ProfileNotFound => formatter.write_str("shell profile was not found"),
            Self::SessionNotFound => formatter.write_str("terminal session was not found"),
            Self::Platform(message) => {
                write!(formatter, "terminal platform operation failed: {message}")
            }
            Self::Io(message) => write!(formatter, "terminal I/O failed: {message}"),
            Self::StateUnavailable => formatter.write_str("terminal state is unavailable"),
        }
    }
}

impl std::error::Error for TerminalError {}

pub trait TerminalBackend: Send + Sync {
    fn shell_profiles(&self) -> Vec<ShellProfile>;
    fn start(
        &self,
        shell_profile_id: ShellProfileId,
        rows: u16,
        columns: u16,
        sink: Arc<dyn TerminalEventSink>,
    ) -> Result<SessionDescriptor, TerminalError>;
    fn write(&self, session_id: SessionId, data: &[u8]) -> Result<(), TerminalError>;
    fn resize(&self, session_id: SessionId, rows: u16, columns: u16) -> Result<(), TerminalError>;
    fn close(&self, session_id: SessionId) -> Result<(), TerminalError>;
}

pub fn parse_session_id(value: &str) -> Result<SessionId, TerminalError> {
    SessionId::from_str(value).map_err(|_| TerminalError::SessionNotFound)
}

pub fn parse_shell_profile_id(value: &str) -> Result<ShellProfileId, TerminalError> {
    ShellProfileId::from_str(value).map_err(|_| TerminalError::ProfileNotFound)
}

#[cfg(test)]
mod tests {
    use super::{TerminalError, parse_session_id, parse_shell_profile_id};

    #[test]
    fn parses_public_session_and_shell_profile_identifiers() {
        let id = "00000000-0000-0000-0000-000000000001";
        assert!(parse_session_id(id).is_ok());
        assert!(parse_shell_profile_id(id).is_ok());
        assert_eq!(
            parse_session_id("invalid"),
            Err(TerminalError::SessionNotFound)
        );
        assert_eq!(
            parse_shell_profile_id("invalid"),
            Err(TerminalError::ProfileNotFound)
        );
    }
}
