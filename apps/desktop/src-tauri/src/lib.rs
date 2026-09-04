#![forbid(unsafe_code)]

use ownterm_application::OwnTermApplication;
use ownterm_application::terminal::{
    TerminalBackend, TerminalEvent, TerminalEventSink, parse_session_id, parse_shell_profile_id,
};
use ownterm_application::vault::{SecretRef, SecretVault};
use ownterm_domain::{SessionDescriptor, SessionKind, SessionStatus, ShellProfile};
use ownterm_platform::SystemVault;
use ownterm_terminal::NativeTerminalBackend;
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use tauri::{AppHandle, Emitter, State};

struct DesktopState {
    terminal: NativeTerminalBackend,
    vault: SystemVault,
}

impl Default for DesktopState {
    fn default() -> Self {
        Self {
            terminal: NativeTerminalBackend::default(),
            vault: SystemVault,
        }
    }
}

#[derive(Clone)]
struct TauriEventSink(AppHandle);

impl TerminalEventSink for TauriEventSink {
    fn emit(&self, event: TerminalEvent) {
        match event {
            TerminalEvent::Output { session_id, data } => {
                let _ = self.0.emit(
                    "session.output.v1",
                    SessionOutputEvent {
                        version: 1,
                        session_id: session_id.to_string(),
                        data,
                    },
                );
            }
            TerminalEvent::Status {
                session_id,
                status,
                reason,
            } => {
                let _ = self.0.emit(
                    "session.status.v1",
                    SessionStatusEvent {
                        version: 1,
                        session_id: session_id.to_string(),
                        status: status_name(status),
                        reason,
                    },
                );
            }
            TerminalEvent::Exit {
                session_id,
                exit_code,
            } => {
                let _ = self.0.emit(
                    "session.exit.v1",
                    SessionExitEvent {
                        version: 1,
                        session_id: session_id.to_string(),
                        exit_code,
                    },
                );
            }
        }
    }
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct AppInfo {
    name: &'static str,
    version: &'static str,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct ShellProfileDto {
    id: String,
    name: String,
}

impl From<&ShellProfile> for ShellProfileDto {
    fn from(profile: &ShellProfile) -> Self {
        Self {
            id: profile.id.to_string(),
            name: profile.name.clone(),
        }
    }
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct SessionDescriptorDto {
    id: String,
    kind: SessionKindDto,
    title: String,
    status: &'static str,
}

#[derive(Serialize)]
#[serde(tag = "type", rename_all = "snake_case")]
enum SessionKindDto {
    Local {
        #[serde(rename = "shellProfileId")]
        shell_profile_id: String,
    },
    Ssh {
        #[serde(rename = "hostId")]
        host_id: String,
    },
}

impl From<SessionDescriptor> for SessionDescriptorDto {
    fn from(descriptor: SessionDescriptor) -> Self {
        let kind = match descriptor.kind {
            SessionKind::Local { shell_profile_id } => SessionKindDto::Local {
                shell_profile_id: shell_profile_id.to_string(),
            },
            SessionKind::Ssh { host_id } => SessionKindDto::Ssh {
                host_id: host_id.to_string(),
            },
        };
        Self {
            id: descriptor.id.to_string(),
            kind,
            title: descriptor.title,
            status: status_name(descriptor.status),
        }
    }
}

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
struct SessionOutputEvent {
    version: u8,
    session_id: String,
    data: Vec<u8>,
}

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
struct SessionStatusEvent {
    version: u8,
    session_id: String,
    status: &'static str,
    #[serde(skip_serializing_if = "Option::is_none")]
    reason: Option<String>,
}

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
struct SessionExitEvent {
    version: u8,
    session_id: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    exit_code: Option<u32>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct StartLocalSessionRequest {
    shell_profile_id: String,
    rows: u16,
    columns: u16,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct WriteSessionRequest {
    session_id: String,
    data: Vec<u8>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct ResizeSessionRequest {
    session_id: String,
    rows: u16,
    columns: u16,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct CloseSessionRequest {
    session_id: String,
}

#[tauri::command]
fn app_info() -> AppInfo {
    let identity = OwnTermApplication::product_identity();

    AppInfo {
        name: identity.name(),
        version: identity.version(),
    }
}

#[tauri::command]
fn list_shell_profiles(state: State<'_, DesktopState>) -> Vec<ShellProfileDto> {
    state
        .terminal
        .shell_profiles()
        .iter()
        .map(Into::into)
        .collect()
}

#[tauri::command]
fn start_local_session(
    app: AppHandle,
    state: State<'_, DesktopState>,
    request: StartLocalSessionRequest,
) -> Result<SessionDescriptorDto, String> {
    let profile_id =
        parse_shell_profile_id(&request.shell_profile_id).map_err(|error| error.to_string())?;
    state
        .terminal
        .start(
            profile_id,
            request.rows,
            request.columns,
            Arc::new(TauriEventSink(app)),
        )
        .map(Into::into)
        .map_err(|error| error.to_string())
}

#[tauri::command]
fn write_session(
    state: State<'_, DesktopState>,
    request: WriteSessionRequest,
) -> Result<(), String> {
    let session_id = parse_session_id(&request.session_id).map_err(|error| error.to_string())?;
    state
        .terminal
        .write(session_id, &request.data)
        .map_err(|error| error.to_string())
}

#[tauri::command]
fn resize_session(
    state: State<'_, DesktopState>,
    request: ResizeSessionRequest,
) -> Result<(), String> {
    let session_id = parse_session_id(&request.session_id).map_err(|error| error.to_string())?;
    state
        .terminal
        .resize(session_id, request.rows, request.columns)
        .map_err(|error| error.to_string())
}

#[tauri::command]
fn close_session(
    state: State<'_, DesktopState>,
    request: CloseSessionRequest,
) -> Result<(), String> {
    let session_id = parse_session_id(&request.session_id).map_err(|error| error.to_string())?;
    state
        .terminal
        .close(session_id)
        .map_err(|error| error.to_string())
}

#[tauri::command]
fn vault_probe(state: State<'_, DesktopState>) -> Result<(), String> {
    state
        .vault
        .read(&SecretRef::try_new("ownterm-probe").expect("static credential reference"))
        .map(|_| ())
        .map_err(|error| format!("{error:?}"))
}

const fn status_name(status: SessionStatus) -> &'static str {
    match status {
        SessionStatus::Starting => "starting",
        SessionStatus::AwaitingTrust => "awaiting_trust",
        SessionStatus::AwaitingCredential => "awaiting_credential",
        SessionStatus::Connected => "connected",
        SessionStatus::Disconnected => "disconnected",
        SessionStatus::Failed => "failed",
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(DesktopState::default())
        .invoke_handler(tauri::generate_handler![
            app_info,
            list_shell_profiles,
            start_local_session,
            write_session,
            resize_session,
            close_session,
            vault_probe
        ])
        .run(tauri::generate_context!())
        .expect("error while running OwnTerm");
}

#[cfg(test)]
mod tests {
    use super::{SessionDescriptorDto, SessionKindDto, status_name};
    use ownterm_domain::{SessionDescriptor, SessionKind, SessionStatus, ShellProfileId};

    #[test]
    fn maps_local_session_to_public_contract() {
        let descriptor = SessionDescriptor::new(
            SessionKind::Local {
                shell_profile_id: ShellProfileId::new(),
            },
            "PowerShell",
            SessionStatus::Connected,
        )
        .unwrap();

        let dto = SessionDescriptorDto::from(descriptor);
        assert_eq!(dto.status, "connected");
        assert!(matches!(dto.kind, SessionKindDto::Local { .. }));
        assert_eq!(status_name(SessionStatus::Disconnected), "disconnected");
    }
}
