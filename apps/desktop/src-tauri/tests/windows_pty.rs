#![cfg(windows)]

use portable_pty::{CommandBuilder, PtySize, native_pty_system};
use std::io::{Read, Write};
use std::sync::mpsc;
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
    let (sender, receiver) = mpsc::channel();
    std::thread::spawn(move || {
        let mut output = String::new();
        let mut buffer = [0_u8; 1024];
        loop {
            match reader.read(&mut buffer) {
                Ok(0) => break,
                Ok(size) => {
                    output.push_str(&String::from_utf8_lossy(&buffer[..size]));
                    if output.contains("OWNTERM_PTY_OK") {
                        break;
                    }
                }
                Err(error) => {
                    let _ = sender.send(Err(error.to_string()));
                    return;
                }
            }
        }
        let _ = sender.send(Ok(output));
    });
    let output = match receiver.recv_timeout(Duration::from_secs(10)) {
        Ok(result) => result.expect("could not read ConPTY output"),
        Err(error) => {
            let _ = child.kill();
            panic!("ConPTY did not produce output within 10 seconds: {error}");
        }
    };
    let deadline = std::time::Instant::now() + Duration::from_secs(10);
    let status = loop {
        if let Some(status) = child.try_wait().unwrap() {
            break status;
        }
        if std::time::Instant::now() >= deadline {
            let _ = child.kill();
            panic!("{shell} did not exit within 10 seconds");
        }
        std::thread::sleep(Duration::from_millis(25));
    };
    drop(writer);
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
