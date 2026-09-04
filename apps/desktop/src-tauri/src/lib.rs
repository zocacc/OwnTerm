#![forbid(unsafe_code)]

use ownterm_application::OwnTermApplication;
use ownterm_application::platform::AppDirectoriesProvider;
use ownterm_application::repositories::{
    GroupRemoval, GroupRepository, HostQuery, HostRepository, RecentHost, RecentHostRepository,
};
use ownterm_application::terminal::{
    TerminalBackend, TerminalEvent, TerminalEventSink, parse_session_id, parse_shell_profile_id,
};
use ownterm_application::vault::{SecretRef, SecretService, SecretValue, SecretVault};
use ownterm_domain::{
    AuthMethod, GroupId, Host, HostDraft, HostGroup, HostId, SessionDescriptor, SessionKind,
    SessionStatus, ShellProfile, Timestamp,
};
use ownterm_platform::{SystemDirectories, SystemVault};
use ownterm_storage_sqlite::SqliteStore;
use ownterm_terminal::NativeTerminalBackend;
use serde::{Deserialize, Serialize};
use std::fs;
use std::sync::Arc;
use std::time::{SystemTime, UNIX_EPOCH};
use tauri::{AppHandle, Emitter, State};

struct DesktopState {
    terminal: NativeTerminalBackend,
    vault: SystemVault,
    store: SqliteStore,
}

impl DesktopState {
    fn open() -> Result<Self, String> {
        let directories = SystemDirectories
            .app_directories()
            .map_err(|error| error.to_string())?;
        fs::create_dir_all(&directories.data_dir).map_err(|error| error.to_string())?;
        let store = SqliteStore::open(directories.data_dir.join("ownterm.sqlite3"))
            .map_err(|_| "could not open OwnTerm storage".to_owned())?;
        Ok(Self {
            terminal: NativeTerminalBackend::default(),
            vault: SystemVault,
            store,
        })
    }
}

#[derive(Clone)]
struct TauriEventSink(AppHandle);

impl TerminalEventSink for TauriEventSink {
    fn emit(&self, event: TerminalEvent) {
        match event {
            TerminalEvent::Output { session_id, data } => {
                let _ = self.0.emit(
                    "session-output-v1",
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
                    "session-status-v1",
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
                    "session-exit-v1",
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

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct HostDto {
    id: String,
    name: String,
    address: String,
    port: u16,
    username: Option<String>,
    group_id: Option<String>,
    tags: Vec<String>,
    favorite: bool,
    auth_kind: &'static str,
}
impl From<Host> for HostDto {
    fn from(host: Host) -> Self {
        let auth_kind = match host.auth {
            AuthMethod::Password { .. } => "password",
            AuthMethod::PrivateKey { .. } => "private_key",
            AuthMethod::Agent => "agent",
            AuthMethod::None => "none",
        };
        Self {
            id: host.id.to_string(),
            name: host.name,
            address: host.address,
            port: host.port,
            username: host.username,
            group_id: host.group_id.map(|id| id.to_string()),
            tags: host.tags,
            favorite: host.favorite,
            auth_kind,
        }
    }
}
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct HostGroupDto {
    id: String,
    name: String,
    sort_order: i32,
}
impl From<HostGroup> for HostGroupDto {
    fn from(group: HostGroup) -> Self {
        Self {
            id: group.id.to_string(),
            name: group.name,
            sort_order: group.sort_order,
        }
    }
}
#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct SaveHostRequest {
    id: Option<String>,
    name: String,
    address: String,
    port: u16,
    username: Option<String>,
    group_id: Option<String>,
    tags: Vec<String>,
    favorite: bool,
    password: Option<String>,
}
#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct SaveGroupRequest {
    id: Option<String>,
    name: String,
    sort_order: i32,
}
#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct DeleteGroupRequest {
    id: String,
    move_hosts_to_ungrouped: bool,
}

#[tauri::command]
fn list_hosts(
    state: State<'_, DesktopState>,
    search: Option<String>,
) -> Result<Vec<HostDto>, String> {
    state
        .store
        .list_hosts(&HostQuery {
            search,
            ..HostQuery::default()
        })
        .map(|hosts| hosts.into_iter().map(Into::into).collect())
        .map_err(repository_error)
}
#[tauri::command]
fn list_recent_hosts(
    state: State<'_, DesktopState>,
    limit: Option<usize>,
) -> Result<Vec<HostDto>, String> {
    let recent = state
        .store
        .list_recent(limit.unwrap_or(8).min(50))
        .map_err(repository_error)?;
    let mut hosts = Vec::new();
    for item in recent {
        if let Some(host) = state
            .store
            .get_host(item.host_id)
            .map_err(repository_error)?
        {
            hosts.push(host.into());
        }
    }
    Ok(hosts)
}

#[tauri::command]
fn list_host_groups(state: State<'_, DesktopState>) -> Result<Vec<HostGroupDto>, String> {
    state
        .store
        .list_groups()
        .map(|groups| groups.into_iter().map(Into::into).collect())
        .map_err(repository_error)
}
#[tauri::command]
fn save_host_group(
    state: State<'_, DesktopState>,
    request: SaveGroupRequest,
) -> Result<HostGroupDto, String> {
    let group = match request.id.as_deref() {
        Some(id) => HostGroup::rehydrate(
            id.parse::<GroupId>().map_err(|_| "invalid group id")?,
            request.name,
            request.sort_order,
        ),
        None => HostGroup::new(request.name, request.sort_order),
    }
    .map_err(|error| error.to_string())?;
    if request.id.is_some() {
        state.store.update_group(&group)
    } else {
        state.store.create_group(&group)
    }
    .map_err(repository_error)?;
    Ok(group.into())
}
#[tauri::command]
fn delete_host_group(
    state: State<'_, DesktopState>,
    request: DeleteGroupRequest,
) -> Result<(), String> {
    let policy = if request.move_hosts_to_ungrouped {
        GroupRemoval::MoveHostsToUngrouped
    } else {
        GroupRemoval::CancelIfNotEmpty
    };
    state
        .store
        .delete_group(
            request
                .id
                .parse::<GroupId>()
                .map_err(|_| "invalid group id")?,
            policy,
        )
        .map_err(repository_error)
}
#[tauri::command]
fn save_host(state: State<'_, DesktopState>, request: SaveHostRequest) -> Result<HostDto, String> {
    let timestamp = now();
    let group_id = request
        .group_id
        .as_deref()
        .map(str::parse)
        .transpose()
        .map_err(|_| "invalid group id")?;
    let existing = request
        .id
        .as_deref()
        .map(str::parse::<HostId>)
        .transpose()
        .map_err(|_| "invalid host id")?
        .map(|id| state.store.get_host(id).map_err(repository_error))
        .transpose()?
        .flatten();
    if request.id.is_some() && existing.is_none() {
        return Err("host not found".into());
    }
    let (auth, secret) = match (
        request.password.filter(|value| !value.is_empty()),
        existing.as_ref(),
    ) {
        (Some(password), _) => {
            let reference =
                SecretRef::try_new(format!("ownterm/host/{}/password", uuid::Uuid::new_v4()))
                    .map_err(|error| error.to_string())?;
            (
                AuthMethod::Password {
                    credential_ref: reference.clone(),
                },
                Some((reference, password)),
            )
        }
        (None, Some(host)) => (host.auth.clone(), None),
        (None, None) => (AuthMethod::None, None),
    };
    let draft = HostDraft {
        name: request.name,
        address: request.address,
        port: request.port,
        username: request.username,
        group_id,
        tags: request.tags,
        auth,
        favorite: request.favorite,
    };
    let host = match existing {
        Some(previous) => Host::rehydrate(previous.id, draft, previous.created_at, timestamp),
        None => Host::new(draft, timestamp),
    }
    .map_err(|error| error.to_string())?;
    let new_reference = secret.as_ref().map(|(reference, _)| reference.clone());
    if let Some((reference, password)) = secret {
        state
            .vault
            .store(&reference, &SecretValue::new(password))
            .map_err(|_| "could not store credential in system vault")?;
    }
    let persisted = if request.id.is_some() {
        state.store.update_host(&host)
    } else {
        state.store.create_host(&host)
    };
    if let Err(error) = persisted {
        if let Some(reference) = new_reference {
            let _ = state.vault.remove(&reference);
        }
        return Err(repository_error(error));
    }
    let _ = SecretService::new(&state.vault, &state.store).cleanup_pending();
    Ok(host.into())
}
#[tauri::command]
fn delete_host(state: State<'_, DesktopState>, id: String) -> Result<(), String> {
    state
        .store
        .delete_host(id.parse::<HostId>().map_err(|_| "invalid host id")?)
        .map_err(repository_error)?;
    let _ = SecretService::new(&state.vault, &state.store).cleanup_pending();
    Ok(())
}
#[tauri::command]
fn record_recent_host(state: State<'_, DesktopState>, id: String) -> Result<(), String> {
    state
        .store
        .record_recent(&RecentHost {
            host_id: id.parse::<HostId>().map_err(|_| "invalid host id")?,
            opened_at: now(),
        })
        .map_err(repository_error)
}

fn now() -> Timestamp {
    Timestamp::from_unix_millis(
        SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .map(|value| value.as_millis() as i64)
            .unwrap_or_default(),
    )
}
fn repository_error(error: ownterm_application::repositories::RepositoryError) -> String {
    match error {
        ownterm_application::repositories::RepositoryError::GroupHasHosts => {
            "group still contains hosts; choose to move them first".into()
        }
        _ => "could not update OwnTerm storage".into(),
    }
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
        .manage(DesktopState::open().expect("could not initialize OwnTerm storage"))
        .invoke_handler(tauri::generate_handler![
            app_info,
            list_shell_profiles,
            start_local_session,
            write_session,
            resize_session,
            close_session,
            vault_probe,
            list_hosts,
            list_host_groups,
            list_recent_hosts,
            save_host,
            delete_host,
            save_host_group,
            delete_host_group,
            record_recent_host
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
