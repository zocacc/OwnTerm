use super::super::decode_wsl_output;
use ownterm_application::terminal::TerminalError;
use ownterm_domain::ShellProfile;
use std::path::{Path, PathBuf};

pub(super) fn detect_shell_profiles() -> Vec<ShellProfile> {
    let mut profiles = Vec::new();
    add_profile_if_available(
        &mut profiles,
        "PowerShell",
        PathBuf::from("powershell.exe"),
        vec!["-NoLogo".into()],
    );
    add_profile_if_available(
        &mut profiles,
        "Command Prompt",
        PathBuf::from("cmd.exe"),
        Vec::new(),
    );

    if command_available(Path::new("wsl.exe")) {
        if let Ok(output) = std::process::Command::new("wsl.exe")
            .args(["--list", "--quiet"])
            .output()
        {
            for distribution in decode_wsl_output(&output.stdout) {
                if let Ok(profile) = ShellProfile::new(
                    format!("WSL · {distribution}"),
                    PathBuf::from("wsl.exe"),
                    vec!["--distribution".into(), distribution],
                ) {
                    profiles.push(profile);
                }
            }
        }
    }
    profiles
}

pub(super) fn finish_close(result: std::io::Result<()>) -> Result<(), TerminalError> {
    // portable-pty 0.9.0's WinChildKiller reverses the TerminateProcess
    // success check, so a successful termination is reported as an error.
    let _ = result;
    Ok(())
}

fn add_profile_if_available(
    profiles: &mut Vec<ShellProfile>,
    name: &str,
    program: PathBuf,
    arguments: Vec<String>,
) {
    if command_available(&program)
        && let Ok(profile) = ShellProfile::new(name, program, arguments)
    {
        profiles.push(profile);
    }
}

fn command_available(program: &Path) -> bool {
    std::process::Command::new("where.exe")
        .arg(program)
        .output()
        .is_ok_and(|output| output.status.success())
}
