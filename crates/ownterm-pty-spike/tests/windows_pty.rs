#![cfg(windows)]

use portable_pty::{CommandBuilder, PtySize, native_pty_system};
use std::io::{Read, Write};
use std::time::Duration;

fn smoke(shell: &str, arguments: &[&str], input: &str, expect_ansi: bool) {
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
    writer.write_all(input.as_bytes()).unwrap();
    writer.flush().unwrap();
    let deadline = std::time::Instant::now() + Duration::from_secs(10);
    let status = loop {
        if let Some(status) = child.try_wait().unwrap() {
            break Some(status);
        }
        if std::time::Instant::now() >= deadline {
            let _ = child.kill();
            let _ = child.wait();
            break None;
        }
        std::thread::sleep(Duration::from_millis(25));
    };
    drop(writer);
    drop(pair.master);

    let mut output = String::new();
    reader.read_to_string(&mut output).unwrap();
    println!("{shell} output: {output:?}");

    let status = status.unwrap_or_else(|| panic!("{shell} did not exit: {output:?}"));
    assert!(status.success(), "{output}");
    assert!(output.contains("OWNTERM_PTY_OK"), "{output}");
    if expect_ansi {
        assert!(output.contains("\u{1b}[32mANSI"), "{output:?}");
    }
}

#[test]
fn conpty_supports_powershell_cmd_io_resize_and_exit_code() {
    smoke(
        "powershell.exe",
        &["-NoLogo", "-NoProfile"],
        "Write-Output ('OWNTERM_' + 'PTY_OK'); Write-Output ([char]27 + '[32mANSI'); exit 0\r\n",
        true,
    );
    smoke(
        "cmd.exe",
        &["/Q"],
        "echo OWNTERM_^PTY_OK & exit /b 0\r\n",
        false,
    );
}
