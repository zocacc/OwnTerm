#![cfg(windows)]

use portable_pty::{CommandBuilder, PtySize, PtySystem, native_pty_system};
use std::io::{Read, Write};

fn smoke(shell: &str, arguments: &[&str]) {
    let pair = native_pty_system()
        .openpty(PtySize {
            rows: 24,
            cols: 80,
            pixel_width: 0,
            pixel_height: 0,
        })
        .unwrap();
    let mut command = CommandBuilder::new(shell);
    command.args(arguments);
    let mut child = pair.slave.spawn_command(command).unwrap();
    drop(pair.slave);
    pair.master
        .resize(PtySize {
            rows: 40,
            cols: 120,
            pixel_width: 0,
            pixel_height: 0,
        })
        .unwrap();
    let mut reader = pair.master.try_clone_reader().unwrap();
    let mut writer = pair.master.take_writer().unwrap();
    writer.write_all(b"\r\n").unwrap();
    drop(writer);
    let mut output = String::new();
    reader.read_to_string(&mut output).unwrap();
    assert!(child.wait().unwrap().success(), "{output}");
    assert!(output.contains("OWNTERM_PTY_OK"), "{output}");
}

#[test]
fn conpty_supports_powershell_cmd_io_resize_and_exit_code() {
    smoke(
        "powershell.exe",
        &[
            "-NoProfile",
            "-Command",
            "Write-Output OWNTERM_PTY_OK; Write-Output ([char]27 + '[32mANSI'); exit 0",
        ],
    );
    smoke("cmd.exe", &["/C", "echo OWNTERM_PTY_OK & exit /b 0"]);
}
