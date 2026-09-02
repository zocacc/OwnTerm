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
    let (sender, receiver) = mpsc::channel();
    std::thread::spawn(move || {
        let mut buffer = [0_u8; 1024];
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
                    return;
                }
            }
        }
    });

    writer.write_all(input.as_bytes()).unwrap();
    writer.flush().unwrap();

    let output_deadline = std::time::Instant::now() + Duration::from_secs(15);
    let mut output = String::new();
    let mut dsr_responses = 0;
    while !output.contains("OWNTERM_PTY_OK") {
        let remaining = output_deadline.saturating_duration_since(std::time::Instant::now());
        match receiver.recv_timeout(remaining) {
            Ok(Ok(chunk)) => {
                output.push_str(&String::from_utf8_lossy(&chunk));
                let dsr_requests = output.matches("\u{1b}[6n").count();
                while dsr_responses < dsr_requests {
                    writer.write_all(b"\x1b[1;1R").unwrap();
                    writer.flush().unwrap();
                    dsr_responses += 1;
                }
            }
            Ok(Err(error)) => panic!("could not read {shell} ConPTY output: {error}"),
            Err(error) => {
                let _ = child.kill();
                let _ = child.wait();
                drop(writer);
                drop(pair.master);
                panic!("{shell} did not produce expected output: {error}; output: {output:?}");
            }
        }
    }
    let deadline = std::time::Instant::now() + Duration::from_secs(10);
    let status = loop {
        if let Some(status) = child.try_wait().unwrap() {
            break status;
        }
        if std::time::Instant::now() >= deadline {
            let _ = child.kill();
            let _ = child.wait();
            drop(pair.master);
            panic!("{shell} did not exit: {output:?}");
        }
        std::thread::sleep(Duration::from_millis(25));
    };
    drop(writer);
    drop(pair.master);
    println!("{shell} output: {output:?}");
    assert!(status.success(), "{shell} {status}; output: {output:?}");
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
        "Write-Output ([char]27 + '[32mANSI'); Write-Output ('OWNTERM_' + 'PTY_OK'); exit 0\r\n",
        true,
    );
    smoke(
        "cmd.exe",
        &["/Q"],
        "echo OWNTERM_^PTY_OK & exit /b 0\r\n",
        false,
    );
}
