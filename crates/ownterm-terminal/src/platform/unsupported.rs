use ownterm_application::terminal::TerminalError;
use ownterm_domain::ShellProfile;

pub(super) fn detect_shell_profiles() -> Vec<ShellProfile> {
    Vec::new()
}

pub(super) fn finish_close(_: std::io::Result<()>) -> Result<(), TerminalError> {
    Err(TerminalError::Platform("unsupported platform".into()))
}
