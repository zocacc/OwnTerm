use ownterm_application::terminal::TerminalError;
use ownterm_domain::ShellProfile;
use std::path::PathBuf;

pub(super) fn detect_shell_profiles() -> Vec<ShellProfile> {
    let configured = std::env::var_os("SHELL").map(PathBuf::from);
    let program = configured
        .filter(|path| path.is_file())
        .unwrap_or_else(|| PathBuf::from("/bin/sh"));
    let name = program
        .file_name()
        .and_then(|name| name.to_str())
        .unwrap_or("Shell")
        .to_owned();
    ShellProfile::new(name, program, Vec::new())
        .into_iter()
        .collect()
}

pub(super) fn finish_close(result: std::io::Result<()>) -> Result<(), TerminalError> {
    result.map_err(|error| TerminalError::Io(error.to_string()))
}
