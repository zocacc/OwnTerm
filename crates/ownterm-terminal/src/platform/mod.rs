use ownterm_application::terminal::TerminalError;
use ownterm_domain::ShellProfile;

#[cfg(windows)]
mod windows;

#[cfg(unix)]
mod unix;

#[cfg(not(any(unix, windows)))]
mod unsupported;

pub(crate) fn detect_shell_profiles() -> Vec<ShellProfile> {
    #[cfg(windows)]
    {
        windows::detect_shell_profiles()
    }

    #[cfg(unix)]
    {
        unix::detect_shell_profiles()
    }

    #[cfg(not(any(unix, windows)))]
    unsupported::detect_shell_profiles()
}

pub(crate) fn finish_close(result: std::io::Result<()>) -> Result<(), TerminalError> {
    #[cfg(windows)]
    {
        windows::finish_close(result)
    }

    #[cfg(unix)]
    {
        unix::finish_close(result)
    }

    #[cfg(not(any(unix, windows)))]
    unsupported::finish_close(result)
}
