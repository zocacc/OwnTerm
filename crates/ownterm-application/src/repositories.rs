//! Ports síncronos para a configuração local persistida.

use ownterm_domain::{CredentialRef, GroupId, Host, HostGroup, HostId, KnownHost, Timestamp};

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum RepositoryError {
    NotFound,
    Conflict,
    GroupHasHosts,
    InvalidData,
    Storage(String),
}

#[derive(Debug, Clone, Default, PartialEq, Eq)]
pub struct HostQuery {
    pub search: Option<String>,
    pub group_id: Option<GroupId>,
    pub favorites_only: bool,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum GroupRemoval {
    CancelIfNotEmpty,
    MoveHostsToUngrouped,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Setting {
    pub key: String,
    pub value: String,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct RecentHost {
    pub host_id: HostId,
    pub opened_at: Timestamp,
}

pub trait HostRepository {
    fn create_host(&self, host: &Host) -> Result<(), RepositoryError>;
    fn update_host(&self, host: &Host) -> Result<(), RepositoryError>;
    /// Remove o Host e agenda suas referências sem uso para limpeza no cofre.
    fn delete_host(&self, id: HostId) -> Result<Vec<CredentialRef>, RepositoryError>;
    fn get_host(&self, id: HostId) -> Result<Option<Host>, RepositoryError>;
    fn list_hosts(&self, query: &HostQuery) -> Result<Vec<Host>, RepositoryError>;
}

pub trait GroupRepository {
    fn create_group(&self, group: &HostGroup) -> Result<(), RepositoryError>;
    fn update_group(&self, group: &HostGroup) -> Result<(), RepositoryError>;
    fn delete_group(&self, id: GroupId, removal: GroupRemoval) -> Result<(), RepositoryError>;
    fn list_groups(&self) -> Result<Vec<HostGroup>, RepositoryError>;
}

pub trait SettingsRepository {
    fn set_setting(&self, setting: &Setting) -> Result<(), RepositoryError>;
    fn get_setting(&self, key: &str) -> Result<Option<Setting>, RepositoryError>;
    fn list_settings(&self) -> Result<Vec<Setting>, RepositoryError>;
}

pub trait RecentHostRepository {
    fn record_recent(&self, recent: &RecentHost) -> Result<(), RepositoryError>;
    fn list_recent(&self, limit: usize) -> Result<Vec<RecentHost>, RepositoryError>;
}

pub trait KnownHostRepository {
    fn find_known_host(
        &self,
        destination: &str,
        port: u16,
    ) -> Result<Option<KnownHost>, RepositoryError>;
    fn insert_known_host(&self, known_host: &KnownHost) -> Result<(), RepositoryError>;
    fn remove_known_host(&self, destination: &str, port: u16) -> Result<(), RepositoryError>;
    fn list_known_hosts(&self) -> Result<Vec<KnownHost>, RepositoryError>;
}

pub trait CredentialCleanupRepository {
    fn is_credential_referenced(&self, reference: &CredentialRef) -> Result<bool, RepositoryError>;
    fn list_pending_credential_cleanup(&self) -> Result<Vec<CredentialRef>, RepositoryError>;
    fn complete_credential_cleanup(&self, reference: &CredentialRef)
    -> Result<(), RepositoryError>;
}
