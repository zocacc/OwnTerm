#![forbid(unsafe_code)]

use ownterm_application::OwnTermApplication;
use ownterm_application::platform::AppDirectoriesProvider;
use ownterm_application::portability::{
    ImportAction, ImportPreview, PortableGroup, PortableHost, decode_workspace, encode_workspace,
    parse_openssh_config,
};
use ownterm_application::repositories::{
    GroupRemoval, GroupRepository, HostQuery, HostRepository, RecentHost, RecentHostRepository,
    SettingsRepository,
};
use ownterm_application::ssh::{resolve_quick_connect, resolve_saved_host};
use ownterm_application::ssh_trust::{TrustDecision, TrustService};
use ownterm_application::terminal::{
    TerminalBackend, TerminalEvent, TerminalEventSink, parse_session_id, parse_shell_profile_id,
};
use ownterm_application::vault::{SecretRef, SecretService, SecretValue, SecretVault};
use ownterm_domain::{
    AuthMethod, GroupId, Host, HostDraft, HostGroup, HostId, SessionDescriptor, SessionKind,
    SessionStatus, ShellProfile, Timestamp,
};
use ownterm_platform::{SystemDirectories, SystemVault};
use ownterm_ssh::{
    CredentialKind, SshEvent, SshEventSink, SshSessionBackend, SshTrustStore, TrustAssessment,
};
use ownterm_storage_sqlite::SqliteStore;
use ownterm_terminal::NativeTerminalBackend;
use serde::{Deserialize, Serialize};
use std::fs;
use std::sync::Arc;
use std::sync::atomic::{AtomicBool, Ordering};
use std::time::{SystemTime, UNIX_EPOCH};
use tauri::{AppHandle, Emitter, State};
use time::{OffsetDateTime, format_description::well_known::Rfc3339};

struct DesktopState {
    terminal: NativeTerminalBackend,
    ssh: SshSessionBackend,
    vault: SystemVault,
    store: Arc<SqliteStore>,
}

impl DesktopState {
    fn open() -> Result<Self, String> {
        let directories = SystemDirectories
            .app_directories()
            .map_err(|error| error.to_string())?;
        fs::create_dir_all(&directories.data_dir).map_err(|error| error.to_string())?;
        let store = Arc::new(
            SqliteStore::open(directories.data_dir.join("ownterm.sqlite3"))
                .map_err(|_| "could not open OwnTerm storage".to_owned())?,
        );
        Ok(Self {
            terminal: NativeTerminalBackend::default(),
            ssh: SshSessionBackend::default(),
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
    if state.ssh.contains(session_id) {
        state
            .ssh
            .write(session_id, &request.data)
            .map_err(|error| error.to_string())
    } else {
        state
            .terminal
            .write(session_id, &request.data)
            .map_err(|error| error.to_string())
    }
}

#[tauri::command]
fn resize_session(
    state: State<'_, DesktopState>,
    request: ResizeSessionRequest,
) -> Result<(), String> {
    let session_id = parse_session_id(&request.session_id).map_err(|error| error.to_string())?;
    if state.ssh.contains(session_id) {
        state
            .ssh
            .resize(session_id, request.rows, request.columns)
            .map_err(|error| error.to_string())
    } else {
        state
            .terminal
            .resize(session_id, request.rows, request.columns)
            .map_err(|error| error.to_string())
    }
}

#[tauri::command]
fn close_session(
    state: State<'_, DesktopState>,
    request: CloseSessionRequest,
) -> Result<(), String> {
    let session_id = parse_session_id(&request.session_id).map_err(|error| error.to_string())?;
    if state.ssh.contains(session_id) {
        state
            .ssh
            .close(session_id)
            .map_err(|error| error.to_string())
    } else {
        state
            .terminal
            .close(session_id)
            .map_err(|error| error.to_string())
    }
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
    private_key_path: Option<String>,
}
impl From<Host> for HostDto {
    fn from(host: Host) -> Self {
        let (auth_kind, private_key_path) = match &host.auth {
            AuthMethod::Password { .. } => ("password", None),
            AuthMethod::PrivateKey { path, .. } => {
                ("private_key", Some(path.to_string_lossy().into_owned()))
            }
            AuthMethod::Agent => ("agent", None),
            AuthMethod::None => ("none", None),
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
            private_key_path,
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
    auth_kind: Option<String>,
    private_key_path: Option<String>,
    passphrase: Option<String>,
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
    let password = request.password.filter(|value| !value.is_empty());
    let passphrase = request.passphrase.filter(|value| !value.is_empty());
    let requested_auth = request.auth_kind.as_deref().or(if password.is_some() {
        Some("password")
    } else {
        None
    });
    let new_reference = |kind: &str| {
        SecretRef::try_new(format!("ownterm/host/{}/{kind}", uuid::Uuid::new_v4()))
            .map_err(|error| error.to_string())
    };
    let (auth, secret) = match requested_auth {
        Some("password") => match (password, existing.as_ref()) {
            (Some(value), _) => {
                let reference = new_reference("password")?;
                (
                    AuthMethod::Password {
                        credential_ref: reference.clone(),
                    },
                    Some((reference, value)),
                )
            }
            (
                None,
                Some(Host {
                    auth: AuthMethod::Password { credential_ref },
                    ..
                }),
            ) => (
                AuthMethod::Password {
                    credential_ref: credential_ref.clone(),
                },
                None,
            ),
            (None, _) => (
                AuthMethod::Password {
                    credential_ref: new_reference("password")?,
                },
                None,
            ),
        },
        Some("private_key") => {
            let path = request
                .private_key_path
                .filter(|value| !value.trim().is_empty())
                .map(std::path::PathBuf::from)
                .or_else(|| match existing.as_ref().map(|host| &host.auth) {
                    Some(AuthMethod::PrivateKey { path, .. }) => Some(path.clone()),
                    _ => None,
                })
                .ok_or("private key path is required")?;
            let (passphrase_ref, secret) = match passphrase {
                Some(value) => {
                    let reference = new_reference("passphrase")?;
                    (Some(reference.clone()), Some((reference, value)))
                }
                None => {
                    let reference = match existing.as_ref().map(|host| &host.auth) {
                        Some(AuthMethod::PrivateKey { passphrase_ref, .. }) => {
                            passphrase_ref.clone()
                        }
                        _ => None,
                    };
                    (reference, None)
                }
            };
            (
                AuthMethod::PrivateKey {
                    path,
                    passphrase_ref,
                },
                secret,
            )
        }
        Some("none") => (AuthMethod::None, None),
        Some(_) => return Err("unsupported SSH authentication method".into()),
        None => existing
            .as_ref()
            .map(|host| (host.auth.clone(), None))
            .unwrap_or((AuthMethod::None, None)),
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
    let _ = SecretService::new(&state.vault, state.store.as_ref()).cleanup_pending();
    Ok(host.into())
}
#[tauri::command]
fn delete_host(state: State<'_, DesktopState>, id: String) -> Result<(), String> {
    state
        .store
        .delete_host(id.parse::<HostId>().map_err(|_| "invalid host id")?)
        .map_err(repository_error)?;
    let _ = SecretService::new(&state.vault, state.store.as_ref()).cleanup_pending();
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
            start_ssh_session,
            start_quick_connect,
            confirm_ssh_trust,
            provide_ssh_credential,
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
            record_recent_host,
            preview_import,
            apply_import,
            export_workspace
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

#[derive(Clone)]
struct DesktopTrustStore(Arc<SqliteStore>);

impl SshTrustStore for DesktopTrustStore {
    fn assess(
        &self,
        destination: &str,
        port: u16,
        algorithm: &str,
        fingerprint: &str,
    ) -> Result<TrustAssessment, ownterm_ssh::SshError> {
        TrustService::new(self.0.as_ref())
            .assess(destination, port, algorithm, fingerprint)
            .map(|decision| match decision {
                TrustDecision::Trusted => TrustAssessment::Trusted,
                TrustDecision::ConfirmFirstUse => TrustAssessment::ConfirmFirstUse,
                TrustDecision::Changed => TrustAssessment::Changed,
            })
            .map_err(|_| ownterm_ssh::SshError::StateUnavailable)
    }

    fn accept(
        &self,
        destination: &str,
        port: u16,
        algorithm: &str,
        fingerprint: &str,
    ) -> Result<(), ownterm_ssh::SshError> {
        TrustService::new(self.0.as_ref())
            .confirm_first_use(destination, port, algorithm, fingerprint, now())
            .map(|_| ())
            .map_err(|_| ownterm_ssh::SshError::StateUnavailable)
    }
}

struct TauriSshEventSink {
    app: AppHandle,
    store: Arc<SqliteStore>,
    recent_host: Option<HostId>,
    recent_recorded: AtomicBool,
}

impl SshEventSink for TauriSshEventSink {
    fn emit(&self, event: SshEvent) {
        match event {
            SshEvent::Output { session_id, data } => {
                let _ = self.app.emit(
                    "session-output-v1",
                    SessionOutputEvent {
                        version: 1,
                        session_id: session_id.to_string(),
                        data,
                    },
                );
            }
            SshEvent::Status {
                session_id,
                status,
                reason,
            } => {
                if status == SessionStatus::Connected
                    && !self.recent_recorded.swap(true, Ordering::AcqRel)
                    && let Some(host_id) = self.recent_host
                {
                    let _ = self.store.record_recent(&RecentHost {
                        host_id,
                        opened_at: now(),
                    });
                }
                let _ = self.app.emit(
                    "session-status-v1",
                    SessionStatusEvent {
                        version: 1,
                        session_id: session_id.to_string(),
                        status: status_name(status),
                        reason,
                    },
                );
            }
            SshEvent::Exit {
                session_id,
                exit_code,
            } => {
                let _ = self.app.emit(
                    "session-exit-v1",
                    SessionExitEvent {
                        version: 1,
                        session_id: session_id.to_string(),
                        exit_code,
                    },
                );
            }
            SshEvent::TrustRequired {
                session_id,
                destination,
                port,
                algorithm,
                fingerprint,
            } => {
                let _ = self.app.emit(
                    "session-trust-required-v1",
                    SessionTrustRequiredEvent {
                        version: 1,
                        session_id: session_id.to_string(),
                        destination,
                        port,
                        algorithm,
                        fingerprint,
                    },
                );
            }
            SshEvent::CredentialRequired { session_id, kind } => {
                let _ = self.app.emit(
                    "session-credential-required-v1",
                    SessionCredentialRequiredEvent {
                        version: 1,
                        session_id: session_id.to_string(),
                        kind: match kind {
                            CredentialKind::Password => "password",
                            CredentialKind::Passphrase => "passphrase",
                        },
                    },
                );
            }
        }
    }
}

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
struct SessionTrustRequiredEvent {
    version: u8,
    session_id: String,
    destination: String,
    port: u16,
    algorithm: String,
    fingerprint: String,
}

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
struct SessionCredentialRequiredEvent {
    version: u8,
    session_id: String,
    kind: &'static str,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct StartSshSessionRequest {
    host_id: String,
    rows: u16,
    columns: u16,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct StartQuickConnectRequest {
    destination: String,
    rows: u16,
    columns: u16,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct ConfirmSshTrustRequest {
    session_id: String,
    accept: bool,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct ProvideSshCredentialRequest {
    session_id: String,
    secret: Option<String>,
}

#[tauri::command]
fn start_ssh_session(
    app: AppHandle,
    state: State<'_, DesktopState>,
    request: StartSshSessionRequest,
) -> Result<SessionDescriptorDto, String> {
    let host_id = request
        .host_id
        .parse::<HostId>()
        .map_err(|_| "invalid host id")?;
    let target = resolve_saved_host(state.store.as_ref(), &state.vault, host_id)
        .map_err(|error| error.to_string())?;
    let sink = Arc::new(TauriSshEventSink {
        app,
        store: Arc::clone(&state.store),
        recent_host: Some(host_id),
        recent_recorded: AtomicBool::new(false),
    });
    state
        .ssh
        .start(
            target,
            request.rows,
            request.columns,
            Arc::new(DesktopTrustStore(Arc::clone(&state.store))),
            sink,
        )
        .map(Into::into)
        .map_err(|error| error.to_string())
}

#[tauri::command]
fn start_quick_connect(
    app: AppHandle,
    state: State<'_, DesktopState>,
    request: StartQuickConnectRequest,
) -> Result<SessionDescriptorDto, String> {
    let target = resolve_quick_connect(&request.destination).map_err(|error| error.to_string())?;
    let sink = Arc::new(TauriSshEventSink {
        app,
        store: Arc::clone(&state.store),
        recent_host: None,
        recent_recorded: AtomicBool::new(false),
    });
    state
        .ssh
        .start_quick_connect(
            target,
            request.rows,
            request.columns,
            Arc::new(DesktopTrustStore(Arc::clone(&state.store))),
            sink,
        )
        .map(Into::into)
        .map_err(|error| error.to_string())
}

#[tauri::command]
fn confirm_ssh_trust(
    state: State<'_, DesktopState>,
    request: ConfirmSshTrustRequest,
) -> Result<(), String> {
    state
        .ssh
        .confirm_trust(
            parse_session_id(&request.session_id).map_err(|error| error.to_string())?,
            request.accept,
        )
        .map_err(|error| error.to_string())
}

#[tauri::command]
fn provide_ssh_credential(
    state: State<'_, DesktopState>,
    request: ProvideSshCredentialRequest,
) -> Result<(), String> {
    state
        .ssh
        .provide_credential(
            parse_session_id(&request.session_id).map_err(|error| error.to_string())?,
            request.secret,
        )
        .map_err(|error| error.to_string())
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct PreviewImportRequest {
    source: String,
    content: String,
}
#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct ImportSelection {
    host: PortableHost,
    action: ImportAction,
}
#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct ApplyImportRequest {
    groups: Vec<PortableGroup>,
    entries: Vec<ImportSelection>,
}
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct ImportResult {
    applied: usize,
    credentials_to_configure: usize,
}

#[tauri::command]
fn preview_import(
    state: State<'_, DesktopState>,
    request: PreviewImportRequest,
) -> Result<ImportPreview, String> {
    let existing = state
        .store
        .list_hosts(&HostQuery::default())
        .map_err(repository_error)?;
    match request.source.as_str() {
        "openssh" => Ok(parse_openssh_config(&request.content, &existing)),
        "workspace" => {
            decode_workspace(&request.content, &existing).map_err(|error| error.to_string())
        }
        _ => Err("unsupported import source".into()),
    }
}

#[tauri::command]
fn apply_import(
    state: State<'_, DesktopState>,
    request: ApplyImportRequest,
) -> Result<ImportResult, String> {
    let credentials_to_configure = request
        .entries
        .iter()
        .filter(|entry| entry.action != ImportAction::Skip && entry.host.credential_required)
        .count();
    let entries = request
        .entries
        .into_iter()
        .map(|entry| (entry.host, entry.action))
        .collect::<Vec<_>>();
    let applied = state
        .store
        .apply_portability_import(&request.groups, &entries, now())
        .map_err(repository_error)?;
    let _ = SecretService::new(&state.vault, state.store.as_ref()).cleanup_pending();
    Ok(ImportResult {
        applied,
        credentials_to_configure,
    })
}

#[tauri::command]
fn export_workspace(state: State<'_, DesktopState>) -> Result<String, String> {
    let groups = state.store.list_groups().map_err(repository_error)?;
    let hosts = state
        .store
        .list_hosts(&HostQuery::default())
        .map_err(repository_error)?;
    let settings = state
        .store
        .list_settings()
        .map_err(repository_error)?
        .into_iter()
        .filter(|setting| !sensitive_setting_key(&setting.key))
        .map(|setting| (setting.key, setting.value))
        .collect();
    encode_workspace(
        &groups,
        &hosts,
        settings,
        OffsetDateTime::now_utc()
            .format(&Rfc3339)
            .map_err(|error| error.to_string())?,
    )
    .map_err(|error| error.to_string())
}

fn sensitive_setting_key(key: &str) -> bool {
    let key = key.to_ascii_lowercase();
    [
        "password",
        "passphrase",
        "secret",
        "token",
        "credential",
        "private_key",
    ]
    .iter()
    .any(|needle| key.contains(needle))
}
