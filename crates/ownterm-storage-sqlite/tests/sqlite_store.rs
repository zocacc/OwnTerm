use ownterm_application::repositories::{
    CredentialCleanupRepository, GroupRemoval, GroupRepository, HostQuery, HostRepository,
    KnownHostRepository, RecentHost, RecentHostRepository, RepositoryError, Setting,
    SettingsRepository,
};
use ownterm_application::ssh_trust::{TrustDecision, TrustError, TrustService};
use ownterm_application::vault::{
    FakeSecretVault, SecretService, SecretServiceError, SecretValue, SecretVault, VaultError,
};
use ownterm_domain::{AuthMethod, CredentialRef, Host, HostDraft, HostGroup, Timestamp};
use ownterm_storage_sqlite::SqliteStore;

fn timestamp(value: i64) -> Timestamp {
    Timestamp::from_unix_millis(value)
}

fn host(
    name: &str,
    address: &str,
    group: Option<ownterm_domain::GroupId>,
    reference: CredentialRef,
    now: i64,
) -> Host {
    Host::new(
        HostDraft {
            name: name.into(),
            address: address.into(),
            port: 22,
            username: Some("root".into()),
            group_id: group,
            tags: vec!["Production".into(), "SSH".into(), "ssh".into()],
            auth: AuthMethod::Password {
                credential_ref: reference,
            },
            favorite: true,
        },
        timestamp(now),
    )
    .unwrap()
}

#[test]
fn migrations_are_idempotent_and_schema_has_no_secret_columns() {
    let directory = tempfile::tempdir().unwrap();
    let path = directory.path().join("ownterm.sqlite3");
    {
        let store = SqliteStore::open(&path).unwrap();
        assert_eq!(store.migration_versions().unwrap(), [1]);
        let columns = store.schema_columns("hosts").unwrap();
        for forbidden in ["password", "passphrase", "secret", "token", "private_key"] {
            assert!(
                !columns.iter().any(|column| column == forbidden),
                "{columns:?}"
            );
        }
        assert!(columns.contains(&"credential_ref".into()));
        assert!(columns.contains(&"private_key_path".into()));
    }
    assert_eq!(
        SqliteStore::open(&path)
            .unwrap()
            .migration_versions()
            .unwrap(),
        [1]
    );
}

#[test]
fn persists_and_searches_workspace_configuration() {
    let store = SqliteStore::open_in_memory().unwrap();
    let group = HostGroup::new("Network", 10).unwrap();
    store.create_group(&group).unwrap();
    let host = host(
        "Core Router",
        "router.example.com",
        Some(group.id),
        CredentialRef::try_new("ownterm/host/router/password").unwrap(),
        100,
    );
    store.create_host(&host).unwrap();

    assert_eq!(store.get_host(host.id).unwrap(), Some(host.clone()));
    for search in ["network", "production", "router.example"] {
        assert_eq!(
            store
                .list_hosts(&HostQuery {
                    search: Some(search.into()),
                    favorites_only: true,
                    ..HostQuery::default()
                })
                .unwrap(),
            std::slice::from_ref(&host)
        );
    }
    let setting = Setting {
        key: "theme".into(),
        value: "dark".into(),
    };
    store.set_setting(&setting).unwrap();
    assert_eq!(store.get_setting("theme").unwrap(), Some(setting));
    store
        .record_recent(&RecentHost {
            host_id: host.id,
            opened_at: timestamp(200),
        })
        .unwrap();
    assert_eq!(store.list_recent(10).unwrap()[0].host_id, host.id);
}

#[test]
fn group_removal_requires_an_explicit_host_policy() {
    let store = SqliteStore::open_in_memory().unwrap();
    let group = HostGroup::new("Production", 0).unwrap();
    store.create_group(&group).unwrap();
    let host = host(
        "Server",
        "server.example.com",
        Some(group.id),
        CredentialRef::try_new("ownterm/host/server/password").unwrap(),
        1,
    );
    store.create_host(&host).unwrap();
    assert_eq!(
        store.delete_group(group.id, GroupRemoval::CancelIfNotEmpty),
        Err(RepositoryError::GroupHasHosts)
    );
    assert_eq!(store.list_groups().unwrap(), [group]);
    store
        .delete_group(host.group_id.unwrap(), GroupRemoval::MoveHostsToUngrouped)
        .unwrap();
    assert_eq!(store.get_host(host.id).unwrap().unwrap().group_id, None);
}

#[test]
fn updates_auth_and_rolls_back_a_host_with_an_unknown_group() {
    let store = SqliteStore::open_in_memory().unwrap();
    let old_reference = CredentialRef::try_new("ownterm/host/server/password").unwrap();
    let mut existing_host = host(
        "Server",
        "server.example.com",
        None,
        old_reference.clone(),
        1,
    );
    store.create_host(&existing_host).unwrap();

    let passphrase_ref = CredentialRef::try_new("ownterm/host/server/passphrase").unwrap();
    existing_host.auth = AuthMethod::PrivateKey {
        path: std::path::PathBuf::from("C:/Users/example/.ssh/id_ed25519"),
        passphrase_ref: Some(passphrase_ref),
    };
    existing_host.updated_at = timestamp(2);
    store.update_host(&existing_host).unwrap();
    assert_eq!(
        store.get_host(existing_host.id).unwrap(),
        Some(existing_host)
    );
    assert_eq!(
        store.list_pending_credential_cleanup().unwrap(),
        std::slice::from_ref(&old_reference)
    );

    let invalid = host(
        "Invalid group",
        "invalid.example.com",
        Some(HostGroup::new("Not persisted", 0).unwrap().id),
        CredentialRef::try_new("ownterm/host/invalid/password").unwrap(),
        3,
    );
    assert_eq!(store.create_host(&invalid), Err(RepositoryError::Conflict));
    assert_eq!(store.get_host(invalid.id).unwrap(), None);
}

#[test]
fn queues_only_unreferenced_credentials_and_cleans_the_vault() {
    let store = SqliteStore::open_in_memory().unwrap();
    let reference = CredentialRef::try_new("ownterm/shared/password").unwrap();
    let first = host("First", "first.example.com", None, reference.clone(), 1);
    let second = host("Second", "second.example.com", None, reference.clone(), 2);
    store.create_host(&first).unwrap();
    store.create_host(&second).unwrap();
    assert!(store.delete_host(first.id).unwrap().is_empty());
    assert_eq!(
        store.delete_host(second.id).unwrap(),
        std::slice::from_ref(&reference)
    );

    let vault = FakeSecretVault::default();
    vault
        .store(&reference, &SecretValue::new("must-not-leak"))
        .unwrap();
    let service = SecretService::new(&vault, &store);
    assert_eq!(service.cleanup_pending().unwrap(), 1);
    assert_eq!(vault.read(&reference), Err(VaultError::NotFound));
    assert!(store.list_pending_credential_cleanup().unwrap().is_empty());
}

#[test]
fn vault_failure_has_no_plaintext_fallback() {
    let store = SqliteStore::open_in_memory().unwrap();
    let reference = CredentialRef::try_new("ownterm/host/failing/password").unwrap();
    let secret = SecretValue::new("must-never-be-persisted");
    let vault = FakeSecretVault::failing(VaultError::Platform("access denied".into()));
    let service = SecretService::new(&vault, &store);
    assert_eq!(
        service.store(&reference, &secret),
        Err(SecretServiceError::Vault(VaultError::Platform(
            "access denied".into()
        )))
    );
    assert_eq!(
        vault.read(&reference),
        Err(VaultError::Platform("access denied".into()))
    );
    assert!(
        !store
            .schema_columns("hosts")
            .unwrap()
            .contains(&"password".into())
    );
}

#[test]
fn cleanup_queue_drops_a_reference_that_is_in_use_again() {
    let store = SqliteStore::open_in_memory().unwrap();
    let reference = CredentialRef::try_new("ownterm/reused/password").unwrap();
    let first = host("First", "first.example.com", None, reference.clone(), 1);
    store.create_host(&first).unwrap();
    store.delete_host(first.id).unwrap();
    let replacement = host("Replacement", "new.example.com", None, reference.clone(), 2);
    store.create_host(&replacement).unwrap();

    let vault = FakeSecretVault::default();
    vault
        .store(&reference, &SecretValue::new("still-needed"))
        .unwrap();
    assert_eq!(
        SecretService::new(&vault, &store)
            .cleanup_pending()
            .unwrap(),
        0
    );
    assert_eq!(vault.read(&reference).unwrap().expose(), "still-needed");
    assert!(store.list_pending_credential_cleanup().unwrap().is_empty());
}

#[test]
fn strict_tofu_persists_first_use_and_blocks_changed_identity() {
    let store = SqliteStore::open_in_memory().unwrap();
    let trust = TrustService::new(&store);
    assert_eq!(
        trust
            .assess("SSH.EXAMPLE.COM.", 22, "ssh-ed25519", "SHA256:first")
            .unwrap(),
        TrustDecision::ConfirmFirstUse
    );
    let known = trust
        .confirm_first_use(
            "SSH.EXAMPLE.COM.",
            22,
            "ssh-ed25519",
            "SHA256:first",
            timestamp(50),
        )
        .unwrap();
    assert_eq!(known.destination, "ssh.example.com");
    assert_eq!(
        trust
            .assess("ssh.example.com", 22, "ssh-ed25519", "SHA256:first")
            .unwrap(),
        TrustDecision::Trusted
    );
    assert_eq!(
        trust
            .assess("ssh.example.com", 22, "ssh-ed25519", "SHA256:changed")
            .unwrap(),
        TrustDecision::Changed
    );
    assert_eq!(
        trust.confirm_first_use(
            "ssh.example.com",
            22,
            "ssh-ed25519",
            "SHA256:changed",
            timestamp(60),
        ),
        Err(TrustError::ChangedIdentity)
    );
    assert_eq!(store.list_known_hosts().unwrap(), [known]);
    trust.remove("ssh.example.com", 22).unwrap();
    assert_eq!(
        trust
            .assess("ssh.example.com", 22, "ssh-ed25519", "SHA256:changed")
            .unwrap(),
        TrustDecision::ConfirmFirstUse
    );
}
