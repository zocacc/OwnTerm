#![cfg(any(unix, windows))]

use ownterm_domain::ShellProfile;
use ownterm_terminal::{SessionEvent, SessionEventSink, SessionManager};
use std::path::PathBuf;
use std::sync::Arc;
use std::sync::mpsc::{self, Sender};
use std::time::{Duration, Instant};

struct ChannelSink(Sender<SessionEvent>);

impl SessionEventSink for ChannelSink {
    fn emit(&self, event: SessionEvent) {
        let _ = self.0.send(event);
    }
}

#[cfg(unix)]
fn test_shell() -> (ShellProfile, &'static [u8]) {
    (
        ShellProfile::new("Test shell", PathBuf::from("/bin/sh"), Vec::new()).unwrap(),
        b"printf 'OWNTERM_MANAGER_OK\n'; exit 7\n",
    )
}

#[cfg(windows)]
fn test_shell() -> (ShellProfile, &'static [u8]) {
    (
        ShellProfile::new(
            "Command Prompt",
            PathBuf::from("cmd.exe"),
            vec!["/Q".into()],
        )
        .unwrap(),
        b"echo OWNTERM_MANAGER_OK & exit /b 7\r\n",
    )
}

#[test]
fn relays_input_output_resize_and_exit_code() {
    let manager = SessionManager::default();
    let (sender, receiver) = mpsc::channel();
    let (profile, input) = test_shell();
    let descriptor = manager
        .start(&profile, 24, 80, Arc::new(ChannelSink(sender)))
        .unwrap();

    manager.resize(descriptor.id, 40, 120).unwrap();
    manager.write(descriptor.id, input).unwrap();

    let deadline = Instant::now() + Duration::from_secs(10);
    let mut output = Vec::new();
    let mut exit_code = None;
    while Instant::now() < deadline {
        match receiver.recv_timeout(Duration::from_millis(250)) {
            Ok(SessionEvent::Output { session_id, data }) => {
                assert_eq!(session_id, descriptor.id);
                output.extend(data);
            }
            Ok(SessionEvent::Exit {
                session_id,
                exit_code: code,
            }) => {
                assert_eq!(session_id, descriptor.id);
                exit_code = code;
            }
            Ok(SessionEvent::Status { session_id, .. }) => {
                assert_eq!(session_id, descriptor.id);
            }
            Err(mpsc::RecvTimeoutError::Timeout) if exit_code.is_some() => break,
            Err(mpsc::RecvTimeoutError::Timeout) => continue,
            Err(error) => panic!("session event channel failed: {error}"),
        }
        if exit_code.is_some() && String::from_utf8_lossy(&output).contains("OWNTERM_MANAGER_OK") {
            break;
        }
    }

    assert!(
        String::from_utf8_lossy(&output).contains("OWNTERM_MANAGER_OK"),
        "output: {:?}",
        String::from_utf8_lossy(&output)
    );
    assert_eq!(exit_code, Some(7));
    assert_eq!(manager.active_session_count(), 0);
}

#[test]
fn closing_a_session_is_idempotent_and_removes_it_immediately() {
    let manager = SessionManager::default();
    let (sender, _receiver) = mpsc::channel();
    let (profile, _) = test_shell();
    let descriptor = manager
        .start(&profile, 24, 80, Arc::new(ChannelSink(sender)))
        .unwrap();

    manager.close(descriptor.id).unwrap();
    manager.close(descriptor.id).unwrap();

    assert_eq!(manager.active_session_count(), 0);
}
