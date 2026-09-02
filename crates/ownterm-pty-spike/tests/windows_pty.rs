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
    let input = input.to_owned();
    let (sender, receiver) = mpsc::channel();
    std::thread::spawn(move || {
        if let Err(error) = writer
            .write_all(input.as_bytes())
            .and_then(|_| writer.flush())
        {
            let _ = sender.send(Err(error.to_string()));
            return;
        }

        let mut output = String::new();
        let mut buffer = [0_u8; 1024];
        let mut dsr_responses = 0;
        loop {
            match reader.read(&mut buffer) {
                Ok(0) => break,
                Ok(size) => {
                    output.push_str(&String::from_utf8_lossy(&buffer[..size]));
                    let dsr_requests = output.matches("\u{1b}[6n").count();
                    while dsr_responses < dsr_requests {
                        if let Err(error) =
                            writer.write_all(b"\x1b[1;1R").and_then(|_| writer.flush())
                        {
                            let _ = sender.send(Err(error.to_string()));
                            return;
                        }
                        dsr_responses += 1;
                    }
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

    let output = match receiver.recv_timeout(Duration::from_secs(15)) {
        Ok(result) => result.expect("could not drive ConPTY terminal"),
        Err(error) => {
            let _ = child.kill();
            let _ = child.wait();
            drop(pair.master);
            panic!("{shell} did not produce expected output: {error}");
        }
    };
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
    drop(pair.master);
    println!("{shell} output: {output:?}");
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
