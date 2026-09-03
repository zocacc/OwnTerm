#![forbid(unsafe_code)]

use std::fmt;
use std::path::PathBuf;
use std::str::FromStr;
use uuid::Uuid;

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum DomainError {
    EmptyField(&'static str),
    InvalidValue(&'static str),
}

impl fmt::Display for DomainError {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::EmptyField(field) => write!(formatter, "{field} must not be empty"),
            Self::InvalidValue(field) => write!(formatter, "{field} is invalid"),
        }
    }
}

impl std::error::Error for DomainError {}

macro_rules! entity_id {
    ($name:ident) => {
        #[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, PartialOrd, Ord)]
        pub struct $name(Uuid);

        impl $name {
            pub fn new() -> Self {
                Self(Uuid::new_v4())
            }
        }

        impl Default for $name {
            fn default() -> Self {
                Self::new()
            }
        }

        impl fmt::Display for $name {
            fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
                self.0.fmt(formatter)
            }
        }

        impl FromStr for $name {
            type Err = uuid::Error;

            fn from_str(value: &str) -> Result<Self, Self::Err> {
                Uuid::parse_str(value).map(Self)
            }
        }
    };
}

entity_id!(HostId);
entity_id!(GroupId);
entity_id!(SessionId);
entity_id!(ShellProfileId);
entity_id!(KnownHostId);

#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord)]
pub struct Timestamp(i64);

impl Timestamp {
    pub const fn from_unix_millis(value: i64) -> Self {
        Self(value)
    }

    pub const fn as_unix_millis(self) -> i64 {
        self.0
    }
}

#[derive(Clone, PartialEq, Eq, Hash)]
pub struct CredentialRef(String);

impl CredentialRef {
    pub fn try_new(value: impl Into<String>) -> Result<Self, DomainError> {
        let value = value.into();
        if value.trim().is_empty() {
            return Err(DomainError::EmptyField("credential_ref"));
        }
        if value.len() > 512 || value.chars().any(char::is_control) {
            return Err(DomainError::InvalidValue("credential_ref"));
        }
        Ok(Self(value))
    }

    pub fn as_str(&self) -> &str {
        &self.0
    }
}

impl fmt::Debug for CredentialRef {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        formatter.write_str("CredentialRef(<redacted>)")
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum AuthMethod {
    Password {
        credential_ref: CredentialRef,
    },
    PrivateKey {
        path: PathBuf,
        passphrase_ref: Option<CredentialRef>,
    },
    Agent,
    None,
}

impl AuthMethod {
    pub fn validate(&self) -> Result<(), DomainError> {
        if let Self::PrivateKey { path, .. } = self
            && path.as_os_str().is_empty()
        {
            return Err(DomainError::EmptyField("private_key_path"));
        }
        Ok(())
    }

    pub fn credential_refs(&self) -> Vec<&CredentialRef> {
        match self {
            Self::Password { credential_ref } => vec![credential_ref],
            Self::PrivateKey {
                passphrase_ref: Some(reference),
                ..
            } => vec![reference],
            Self::PrivateKey {
                passphrase_ref: None,
                ..
            }
            | Self::Agent
            | Self::None => Vec::new(),
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct HostDraft {
    pub name: String,
    pub address: String,
    pub port: u16,
    pub username: Option<String>,
    pub group_id: Option<GroupId>,
    pub tags: Vec<String>,
    pub auth: AuthMethod,
    pub favorite: bool,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Host {
    pub id: HostId,
    pub name: String,
    pub address: String,
    pub port: u16,
    pub username: Option<String>,
    pub group_id: Option<GroupId>,
    pub tags: Vec<String>,
    pub auth: AuthMethod,
    pub favorite: bool,
    pub created_at: Timestamp,
    pub updated_at: Timestamp,
}

impl Host {
    pub fn new(draft: HostDraft, now: Timestamp) -> Result<Self, DomainError> {
        Self::rehydrate(HostId::new(), draft, now, now)
    }

    pub fn rehydrate(
        id: HostId,
        mut draft: HostDraft,
        created_at: Timestamp,
        updated_at: Timestamp,
    ) -> Result<Self, DomainError> {
        draft.name = required("name", draft.name)?;
        draft.address = required("address", draft.address)?;
        if draft.address.chars().any(char::is_whitespace) {
            return Err(DomainError::InvalidValue("address"));
        }
        if draft.port == 0 {
            return Err(DomainError::InvalidValue("port"));
        }
        draft.username = optional(draft.username);
        draft.tags = normalize_tags(draft.tags)?;
        draft.auth.validate()?;

        Ok(Self {
            id,
            name: draft.name,
            address: draft.address,
            port: draft.port,
            username: draft.username,
            group_id: draft.group_id,
            tags: draft.tags,
            auth: draft.auth,
            favorite: draft.favorite,
            created_at,
            updated_at,
        })
    }

    pub fn credential_refs(&self) -> Vec<&CredentialRef> {
        self.auth.credential_refs()
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct HostGroup {
    pub id: GroupId,
    pub name: String,
    pub sort_order: i32,
}

impl HostGroup {
    pub fn new(name: impl Into<String>, sort_order: i32) -> Result<Self, DomainError> {
        Self::rehydrate(GroupId::new(), name, sort_order)
    }

    pub fn rehydrate(
        id: GroupId,
        name: impl Into<String>,
        sort_order: i32,
    ) -> Result<Self, DomainError> {
        Ok(Self {
            id,
            name: required("group_name", name.into())?,
            sort_order,
        })
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum SessionKind {
    Local { shell_profile_id: ShellProfileId },
    Ssh { host_id: HostId },
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum SessionStatus {
    Starting,
    AwaitingTrust,
    AwaitingCredential,
    Connected,
    Disconnected,
    Failed,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct SessionDescriptor {
    pub id: SessionId,
    pub kind: SessionKind,
    pub title: String,
    pub status: SessionStatus,
}

impl SessionDescriptor {
    pub fn new(
        kind: SessionKind,
        title: impl Into<String>,
        status: SessionStatus,
    ) -> Result<Self, DomainError> {
        Ok(Self {
            id: SessionId::new(),
            kind,
            title: required("session_title", title.into())?,
            status,
        })
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ShellProfile {
    pub id: ShellProfileId,
    pub name: String,
    pub program: PathBuf,
    pub arguments: Vec<String>,
}

impl ShellProfile {
    pub fn new(
        name: impl Into<String>,
        program: PathBuf,
        arguments: Vec<String>,
    ) -> Result<Self, DomainError> {
        if program.as_os_str().is_empty() {
            return Err(DomainError::EmptyField("shell_program"));
        }
        Ok(Self {
            id: ShellProfileId::new(),
            name: required("shell_name", name.into())?,
            program,
            arguments,
        })
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct KnownHost {
    pub id: KnownHostId,
    pub destination: String,
    pub port: u16,
    pub algorithm: String,
    pub fingerprint: String,
    pub created_at: Timestamp,
    pub updated_at: Timestamp,
}

impl KnownHost {
    pub fn new(
        destination: impl Into<String>,
        port: u16,
        algorithm: impl Into<String>,
        fingerprint: impl Into<String>,
        now: Timestamp,
    ) -> Result<Self, DomainError> {
        Self::rehydrate(
            KnownHostId::new(),
            destination,
            port,
            algorithm,
            fingerprint,
            now,
            now,
        )
    }

    #[allow(clippy::too_many_arguments)]
    pub fn rehydrate(
        id: KnownHostId,
        destination: impl Into<String>,
        port: u16,
        algorithm: impl Into<String>,
        fingerprint: impl Into<String>,
        created_at: Timestamp,
        updated_at: Timestamp,
    ) -> Result<Self, DomainError> {
        let destination = normalize_destination(destination.into())?;
        if port == 0 {
            return Err(DomainError::InvalidValue("port"));
        }
        Ok(Self {
            id,
            destination,
            port,
            algorithm: required("algorithm", algorithm.into())?,
            fingerprint: required("fingerprint", fingerprint.into())?,
            created_at,
            updated_at,
        })
    }
}

pub fn normalize_destination(value: impl Into<String>) -> Result<String, DomainError> {
    let value = required("destination", value.into())?;
    if value.chars().any(char::is_whitespace) {
        return Err(DomainError::InvalidValue("destination"));
    }
    Ok(value.trim_end_matches('.').to_lowercase())
}

fn required(field: &'static str, value: String) -> Result<String, DomainError> {
    let value = value.trim().to_owned();
    if value.is_empty() {
        Err(DomainError::EmptyField(field))
    } else {
        Ok(value)
    }
}

fn optional(value: Option<String>) -> Option<String> {
    value.and_then(|value| {
        let value = value.trim().to_owned();
        (!value.is_empty()).then_some(value)
    })
}

fn normalize_tags(tags: Vec<String>) -> Result<Vec<String>, DomainError> {
    let mut normalized = Vec::new();
    for tag in tags {
        let tag = required("tag", tag)?.to_lowercase();
        if !normalized.contains(&tag) {
            normalized.push(tag);
        }
    }
    normalized.sort();
    Ok(normalized)
}

/// Identidade estável do produto, independente de interface e infraestrutura.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct ProductIdentity {
    name: &'static str,
    version: &'static str,
}

impl ProductIdentity {
    pub const fn new(name: &'static str, version: &'static str) -> Self {
        Self { name, version }
    }

    pub const fn name(self) -> &'static str {
        self.name
    }

    pub const fn version(self) -> &'static str {
        self.version
    }
}

pub const OWNTERM: ProductIdentity = ProductIdentity::new("OwnTerm", env!("CARGO_PKG_VERSION"));

#[cfg(test)]
mod tests {
    use super::{
        AuthMethod, CredentialRef, DomainError, Host, HostDraft, HostGroup, KnownHost, OWNTERM,
        SessionDescriptor, SessionKind, SessionStatus, ShellProfile, Timestamp,
    };
    use std::path::PathBuf;

    #[test]
    fn exposes_the_product_identity() {
        assert_eq!(OWNTERM.name(), "OwnTerm");
        assert!(!OWNTERM.version().is_empty());
    }

    #[test]
    fn validates_and_normalizes_host_data() {
        let host = Host::new(
            HostDraft {
                name: " Edge Router ".into(),
                address: "router.example.com".into(),
                port: 22,
                username: Some(" root ".into()),
                group_id: None,
                tags: vec![" Core ".into(), "core".into(), "SSH".into()],
                auth: AuthMethod::Password {
                    credential_ref: CredentialRef::try_new("ownterm/host/id/password").unwrap(),
                },
                favorite: true,
            },
            Timestamp::from_unix_millis(10),
        )
        .unwrap();

        assert_eq!(host.name, "Edge Router");
        assert_eq!(host.username.as_deref(), Some("root"));
        assert_eq!(host.tags, ["core", "ssh"]);
        assert_eq!(host.credential_refs().len(), 1);
    }

    #[test]
    fn rejects_invalid_hosts_and_nested_group_is_absent_from_model() {
        let result = Host::new(
            HostDraft {
                name: "host".into(),
                address: "bad address".into(),
                port: 22,
                username: None,
                group_id: None,
                tags: Vec::new(),
                auth: AuthMethod::None,
                favorite: false,
            },
            Timestamp::from_unix_millis(0),
        );
        assert_eq!(result, Err(DomainError::InvalidValue("address")));

        let group = HostGroup::new("Production", 0).unwrap();
        assert_eq!(group.name, "Production");
    }

    #[test]
    fn creates_session_shell_and_normalized_known_host() {
        let shell = ShellProfile::new("PowerShell", PathBuf::from("pwsh.exe"), Vec::new()).unwrap();
        let session = SessionDescriptor::new(
            SessionKind::Local {
                shell_profile_id: shell.id,
            },
            "PowerShell",
            SessionStatus::Starting,
        )
        .unwrap();
        let known = KnownHost::new(
            "SSH.EXAMPLE.COM.",
            22,
            "ssh-ed25519",
            "SHA256:test",
            Timestamp::from_unix_millis(1),
        )
        .unwrap();

        assert_eq!(session.title, "PowerShell");
        assert_eq!(known.destination, "ssh.example.com");
    }

    #[test]
    fn redacts_credential_reference_debug_output() {
        let reference = CredentialRef::try_new("ownterm/host/secret/password").unwrap();
        let debug = format!("{reference:?}");
        assert_eq!(debug, "CredentialRef(<redacted>)");
        assert!(!debug.contains(reference.as_str()));
    }
}
