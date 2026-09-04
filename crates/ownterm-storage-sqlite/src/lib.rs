#![forbid(unsafe_code)]

use ownterm_application::repositories::{
    CredentialCleanupRepository, GroupRemoval, GroupRepository, HostQuery, HostRepository,
    KnownHostRepository, RecentHost, RecentHostRepository, RepositoryError, Setting,
    SettingsRepository,
};
use ownterm_domain::{
    AuthMethod, CredentialRef, GroupId, Host, HostDraft, HostGroup, HostId, KnownHost, KnownHostId,
    Timestamp,
};
use rusqlite::{Connection, ErrorCode, OptionalExtension, Transaction, params};
use std::path::{Path, PathBuf};
use std::str::FromStr;
use std::sync::{Mutex, MutexGuard};

const INITIAL_MIGRATION: &str = include_str!("../migrations/0001_initial.sql");

pub struct SqliteStore {
    connection: Mutex<Connection>,
}

impl SqliteStore {
    pub fn open(path: impl AsRef<Path>) -> Result<Self, RepositoryError> {
        let connection = Connection::open(path).map_err(map_sqlite)?;
        Self::initialize(connection)
    }

    pub fn open_in_memory() -> Result<Self, RepositoryError> {
        let connection = Connection::open_in_memory().map_err(map_sqlite)?;
        Self::initialize(connection)
    }

    fn initialize(mut connection: Connection) -> Result<Self, RepositoryError> {
        connection
            .execute_batch(
                "PRAGMA foreign_keys = ON;
                 CREATE TABLE IF NOT EXISTS schema_migrations (
                    version INTEGER PRIMARY KEY NOT NULL,
                    applied_at INTEGER NOT NULL DEFAULT (unixepoch('subsec') * 1000)
                 );",
            )
            .map_err(map_sqlite)?;
        let applied = connection
            .query_row(
                "SELECT EXISTS(SELECT 1 FROM schema_migrations WHERE version = 1)",
                [],
                |row| row.get::<_, bool>(0),
            )
            .map_err(map_sqlite)?;
        if !applied {
            let transaction = connection.transaction().map_err(map_sqlite)?;
            transaction
                .execute_batch(INITIAL_MIGRATION)
                .map_err(map_sqlite)?;
            transaction
                .execute("INSERT INTO schema_migrations(version) VALUES (1)", [])
                .map_err(map_sqlite)?;
            transaction.commit().map_err(map_sqlite)?;
        }
        Ok(Self {
            connection: Mutex::new(connection),
        })
    }

    pub fn migration_versions(&self) -> Result<Vec<i64>, RepositoryError> {
        let connection = self.connection()?;
        let mut statement = connection
            .prepare("SELECT version FROM schema_migrations ORDER BY version")
            .map_err(map_sqlite)?;
        statement
            .query_map([], |row| row.get(0))
            .map_err(map_sqlite)?
            .collect::<Result<Vec<_>, _>>()
            .map_err(map_sqlite)
    }

    pub fn schema_columns(&self, table: &str) -> Result<Vec<String>, RepositoryError> {
        let allowed = [
            "hosts",
            "host_groups",
            "host_tags",
            "settings",
            "recent_hosts",
            "known_hosts",
            "orphaned_credential_refs",
            "schema_migrations",
        ];
        if !allowed.contains(&table) {
            return Err(RepositoryError::InvalidData);
        }
        let connection = self.connection()?;
        let mut statement = connection
            .prepare(&format!("PRAGMA table_info({table})"))
            .map_err(map_sqlite)?;
        statement
            .query_map([], |row| row.get(1))
            .map_err(map_sqlite)?
            .collect::<Result<Vec<_>, _>>()
            .map_err(map_sqlite)
    }

    fn connection(&self) -> Result<MutexGuard<'_, Connection>, RepositoryError> {
        self.connection
            .lock()
            .map_err(|_| RepositoryError::Storage("database lock poisoned".into()))
    }
}

impl HostRepository for SqliteStore {
    fn create_host(&self, host: &Host) -> Result<(), RepositoryError> {
        let mut connection = self.connection()?;
        let transaction = connection.transaction().map_err(map_sqlite)?;
        insert_host(&transaction, host)?;
        insert_tags(&transaction, host)?;
        transaction.commit().map_err(map_sqlite)
    }

    fn update_host(&self, host: &Host) -> Result<(), RepositoryError> {
        let mut connection = self.connection()?;
        let transaction = connection.transaction().map_err(map_sqlite)?;
        let previous = credential_refs_for_host(&transaction, host.id)?;
        let (auth_kind, credential_ref, private_key_path, passphrase_ref) =
            encode_auth(&host.auth)?;
        let changed = transaction
            .execute(
                "UPDATE hosts SET name = ?2, address = ?3, port = ?4, username = ?5,
                    group_id = ?6, auth_kind = ?7, credential_ref = ?8,
                    private_key_path = ?9, passphrase_ref = ?10, favorite = ?11,
                    updated_at = ?12 WHERE id = ?1",
                params![
                    host.id.to_string(),
                    host.name,
                    host.address,
                    i64::from(host.port),
                    host.username,
                    host.group_id.map(|id| id.to_string()),
                    auth_kind,
                    credential_ref,
                    private_key_path,
                    passphrase_ref,
                    host.favorite,
                    host.updated_at.as_unix_millis(),
                ],
            )
            .map_err(map_sqlite)?;
        if changed == 0 {
            return Err(RepositoryError::NotFound);
        }
        transaction
            .execute(
                "DELETE FROM host_tags WHERE host_id = ?1",
                [host.id.to_string()],
            )
            .map_err(map_sqlite)?;
        insert_tags(&transaction, host)?;
        let current = host.credential_refs();
        for reference in previous {
            if !current.contains(&&reference)
                && !credential_is_referenced(&transaction, &reference)?
            {
                queue_cleanup(&transaction, &reference)?;
            }
        }
        transaction.commit().map_err(map_sqlite)
    }

    fn delete_host(&self, id: HostId) -> Result<Vec<CredentialRef>, RepositoryError> {
        let mut connection = self.connection()?;
        let transaction = connection.transaction().map_err(map_sqlite)?;
        let references = credential_refs_for_host(&transaction, id)?;
        let deleted = transaction
            .execute("DELETE FROM hosts WHERE id = ?1", [id.to_string()])
            .map_err(map_sqlite)?;
        if deleted == 0 {
            return Err(RepositoryError::NotFound);
        }
        let mut orphaned = Vec::new();
        for reference in references {
            if !credential_is_referenced(&transaction, &reference)? {
                queue_cleanup(&transaction, &reference)?;
                orphaned.push(reference);
            }
        }
        transaction.commit().map_err(map_sqlite)?;
        Ok(orphaned)
    }

    fn get_host(&self, id: HostId) -> Result<Option<Host>, RepositoryError> {
        let connection = self.connection()?;
        load_host(&connection, id)
    }

    fn list_hosts(&self, query: &HostQuery) -> Result<Vec<Host>, RepositoryError> {
        let connection = self.connection()?;
        let mut statement = connection
            .prepare(
                "SELECT id, name, address, port, username, group_id, auth_kind,
                        credential_ref, private_key_path, passphrase_ref, favorite,
                        created_at, updated_at
                 FROM hosts ORDER BY lower(name), id",
            )
            .map_err(map_sqlite)?;
        let rows = statement
            .query_map([], stored_host_from_row)
            .map_err(map_sqlite)?
            .collect::<Result<Vec<_>, _>>()
            .map_err(map_sqlite)?;
        drop(statement);
        let search = query
            .search
            .as_ref()
            .map(|value| value.trim().to_lowercase());
        let mut hosts = Vec::new();
        for row in rows {
            let host = decode_host(&connection, row)?;
            if query.favorites_only && !host.favorite {
                continue;
            }
            if query.group_id.is_some() && query.group_id != host.group_id {
                continue;
            }
            if let Some(search) = &search
                && !search.is_empty()
                && !host_matches(&connection, &host, search)?
            {
                continue;
            }
            hosts.push(host);
        }
        Ok(hosts)
    }
}

impl GroupRepository for SqliteStore {
    fn create_group(&self, group: &HostGroup) -> Result<(), RepositoryError> {
        self.connection()?
            .execute(
                "INSERT INTO host_groups(id, name, sort_order) VALUES (?1, ?2, ?3)",
                params![group.id.to_string(), group.name, group.sort_order],
            )
            .map(|_| ())
            .map_err(map_sqlite)
    }

    fn update_group(&self, group: &HostGroup) -> Result<(), RepositoryError> {
        let changed = self
            .connection()?
            .execute(
                "UPDATE host_groups SET name = ?2, sort_order = ?3 WHERE id = ?1",
                params![group.id.to_string(), group.name, group.sort_order],
            )
            .map_err(map_sqlite)?;
        if changed == 0 {
            Err(RepositoryError::NotFound)
        } else {
            Ok(())
        }
    }

    fn delete_group(&self, id: GroupId, removal: GroupRemoval) -> Result<(), RepositoryError> {
        let mut connection = self.connection()?;
        let transaction = connection.transaction().map_err(map_sqlite)?;
        let associated: i64 = transaction
            .query_row(
                "SELECT count(*) FROM hosts WHERE group_id = ?1",
                [id.to_string()],
                |row| row.get(0),
            )
            .map_err(map_sqlite)?;
        if associated > 0 {
            match removal {
                GroupRemoval::CancelIfNotEmpty => return Err(RepositoryError::GroupHasHosts),
                GroupRemoval::MoveHostsToUngrouped => {
                    transaction
                        .execute(
                            "UPDATE hosts SET group_id = NULL WHERE group_id = ?1",
                            [id.to_string()],
                        )
                        .map_err(map_sqlite)?;
                }
            }
        }
        let deleted = transaction
            .execute("DELETE FROM host_groups WHERE id = ?1", [id.to_string()])
            .map_err(map_sqlite)?;
        if deleted == 0 {
            return Err(RepositoryError::NotFound);
        }
        transaction.commit().map_err(map_sqlite)
    }

    fn list_groups(&self) -> Result<Vec<HostGroup>, RepositoryError> {
        let connection = self.connection()?;
        let mut statement = connection
            .prepare(
                "SELECT id, name, sort_order FROM host_groups ORDER BY sort_order, lower(name)",
            )
            .map_err(map_sqlite)?;
        statement
            .query_map([], |row| {
                Ok((
                    row.get::<_, String>(0)?,
                    row.get::<_, String>(1)?,
                    row.get::<_, i32>(2)?,
                ))
            })
            .map_err(map_sqlite)?
            .map(|row| {
                let (id, name, sort_order) = row.map_err(map_sqlite)?;
                HostGroup::rehydrate(parse_id(&id)?, name, sort_order)
                    .map_err(|_| RepositoryError::InvalidData)
            })
            .collect()
    }
}

impl SettingsRepository for SqliteStore {
    fn set_setting(&self, setting: &Setting) -> Result<(), RepositoryError> {
        if setting.key.trim().is_empty() {
            return Err(RepositoryError::InvalidData);
        }
        self.connection()?
            .execute(
                "INSERT INTO settings(key, value) VALUES (?1, ?2)
                 ON CONFLICT(key) DO UPDATE SET value = excluded.value",
                params![setting.key, setting.value],
            )
            .map(|_| ())
            .map_err(map_sqlite)
    }

    fn get_setting(&self, key: &str) -> Result<Option<Setting>, RepositoryError> {
        self.connection()?
            .query_row(
                "SELECT key, value FROM settings WHERE key = ?1",
                [key],
                |row| {
                    Ok(Setting {
                        key: row.get(0)?,
                        value: row.get(1)?,
                    })
                },
            )
            .optional()
            .map_err(map_sqlite)
    }

    fn list_settings(&self) -> Result<Vec<Setting>, RepositoryError> {
        let connection = self.connection()?;
        let mut statement = connection
            .prepare("SELECT key, value FROM settings ORDER BY key")
            .map_err(map_sqlite)?;
        statement
            .query_map([], |row| {
                Ok(Setting {
                    key: row.get(0)?,
                    value: row.get(1)?,
                })
            })
            .map_err(map_sqlite)?
            .collect::<Result<Vec<_>, _>>()
            .map_err(map_sqlite)
    }
}

impl RecentHostRepository for SqliteStore {
    fn record_recent(&self, recent: &RecentHost) -> Result<(), RepositoryError> {
        self.connection()?
            .execute(
                "INSERT INTO recent_hosts(host_id, opened_at) VALUES (?1, ?2)
                 ON CONFLICT(host_id) DO UPDATE SET opened_at = excluded.opened_at",
                params![
                    recent.host_id.to_string(),
                    recent.opened_at.as_unix_millis()
                ],
            )
            .map(|_| ())
            .map_err(map_sqlite)
    }

    fn list_recent(&self, limit: usize) -> Result<Vec<RecentHost>, RepositoryError> {
        let connection = self.connection()?;
        let mut statement = connection
            .prepare(
                "SELECT host_id, opened_at FROM recent_hosts
                 ORDER BY opened_at DESC, host_id LIMIT ?1",
            )
            .map_err(map_sqlite)?;
        statement
            .query_map([i64::try_from(limit).unwrap_or(i64::MAX)], |row| {
                Ok((row.get::<_, String>(0)?, row.get::<_, i64>(1)?))
            })
            .map_err(map_sqlite)?
            .map(|row| {
                let (host_id, opened_at) = row.map_err(map_sqlite)?;
                Ok(RecentHost {
                    host_id: parse_id(&host_id)?,
                    opened_at: Timestamp::from_unix_millis(opened_at),
                })
            })
            .collect()
    }
}

impl KnownHostRepository for SqliteStore {
    fn find_known_host(
        &self,
        destination: &str,
        port: u16,
    ) -> Result<Option<KnownHost>, RepositoryError> {
        self.connection()?
            .query_row(
                "SELECT id, destination, port, algorithm, fingerprint, created_at, updated_at
                 FROM known_hosts WHERE destination = ?1 COLLATE NOCASE AND port = ?2",
                params![destination, i64::from(port)],
                known_host_from_row,
            )
            .optional()
            .map_err(map_sqlite)?
            .map(decode_known_host)
            .transpose()
    }

    fn insert_known_host(&self, known_host: &KnownHost) -> Result<(), RepositoryError> {
        self.connection()?
            .execute(
                "INSERT INTO known_hosts(
                    id, destination, port, algorithm, fingerprint, created_at, updated_at
                 ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
                params![
                    known_host.id.to_string(),
                    known_host.destination,
                    i64::from(known_host.port),
                    known_host.algorithm,
                    known_host.fingerprint,
                    known_host.created_at.as_unix_millis(),
                    known_host.updated_at.as_unix_millis(),
                ],
            )
            .map(|_| ())
            .map_err(map_sqlite)
    }

    fn remove_known_host(&self, destination: &str, port: u16) -> Result<(), RepositoryError> {
        let deleted = self
            .connection()?
            .execute(
                "DELETE FROM known_hosts WHERE destination = ?1 COLLATE NOCASE AND port = ?2",
                params![destination, i64::from(port)],
            )
            .map_err(map_sqlite)?;
        if deleted == 0 {
            Err(RepositoryError::NotFound)
        } else {
            Ok(())
        }
    }

    fn list_known_hosts(&self) -> Result<Vec<KnownHost>, RepositoryError> {
        let connection = self.connection()?;
        let mut statement = connection
            .prepare(
                "SELECT id, destination, port, algorithm, fingerprint, created_at, updated_at
                 FROM known_hosts ORDER BY destination COLLATE NOCASE, port",
            )
            .map_err(map_sqlite)?;
        statement
            .query_map([], known_host_from_row)
            .map_err(map_sqlite)?
            .map(|row| decode_known_host(row.map_err(map_sqlite)?))
            .collect()
    }
}

impl CredentialCleanupRepository for SqliteStore {
    fn is_credential_referenced(&self, reference: &CredentialRef) -> Result<bool, RepositoryError> {
        let connection = self.connection()?;
        credential_is_referenced(&connection, reference)
    }

    fn list_pending_credential_cleanup(&self) -> Result<Vec<CredentialRef>, RepositoryError> {
        let connection = self.connection()?;
        let mut statement = connection
            .prepare(
                "SELECT credential_ref FROM orphaned_credential_refs
                 ORDER BY queued_at, credential_ref",
            )
            .map_err(map_sqlite)?;
        statement
            .query_map([], |row| row.get::<_, String>(0))
            .map_err(map_sqlite)?
            .map(|row| {
                CredentialRef::try_new(row.map_err(map_sqlite)?)
                    .map_err(|_| RepositoryError::InvalidData)
            })
            .collect()
    }

    fn complete_credential_cleanup(
        &self,
        reference: &CredentialRef,
    ) -> Result<(), RepositoryError> {
        self.connection()?
            .execute(
                "DELETE FROM orphaned_credential_refs WHERE credential_ref = ?1",
                [reference.as_str()],
            )
            .map(|_| ())
            .map_err(map_sqlite)
    }
}

#[derive(Debug)]
struct StoredHost {
    id: String,
    name: String,
    address: String,
    port: i64,
    username: Option<String>,
    group_id: Option<String>,
    auth_kind: String,
    credential_ref: Option<String>,
    private_key_path: Option<String>,
    passphrase_ref: Option<String>,
    favorite: bool,
    created_at: i64,
    updated_at: i64,
}

fn stored_host_from_row(row: &rusqlite::Row<'_>) -> rusqlite::Result<StoredHost> {
    Ok(StoredHost {
        id: row.get(0)?,
        name: row.get(1)?,
        address: row.get(2)?,
        port: row.get(3)?,
        username: row.get(4)?,
        group_id: row.get(5)?,
        auth_kind: row.get(6)?,
        credential_ref: row.get(7)?,
        private_key_path: row.get(8)?,
        passphrase_ref: row.get(9)?,
        favorite: row.get(10)?,
        created_at: row.get(11)?,
        updated_at: row.get(12)?,
    })
}

fn load_host(connection: &Connection, id: HostId) -> Result<Option<Host>, RepositoryError> {
    connection
        .query_row(
            "SELECT id, name, address, port, username, group_id, auth_kind,
                    credential_ref, private_key_path, passphrase_ref, favorite,
                    created_at, updated_at FROM hosts WHERE id = ?1",
            [id.to_string()],
            stored_host_from_row,
        )
        .optional()
        .map_err(map_sqlite)?
        .map(|row| decode_host(connection, row))
        .transpose()
}

fn decode_host(connection: &Connection, row: StoredHost) -> Result<Host, RepositoryError> {
    let id = parse_id(&row.id)?;
    let tags = tags_for_host(connection, id)?;
    let auth = match row.auth_kind.as_str() {
        "password_ref" => AuthMethod::Password {
            credential_ref: parse_credential(row.credential_ref)?,
        },
        "private_key_ref" => AuthMethod::PrivateKey {
            path: PathBuf::from(row.private_key_path.ok_or(RepositoryError::InvalidData)?),
            passphrase_ref: row
                .passphrase_ref
                .map(CredentialRef::try_new)
                .transpose()
                .map_err(|_| RepositoryError::InvalidData)?,
        },
        "agent" => AuthMethod::Agent,
        "none" => AuthMethod::None,
        _ => return Err(RepositoryError::InvalidData),
    };
    let port = u16::try_from(row.port).map_err(|_| RepositoryError::InvalidData)?;
    Host::rehydrate(
        id,
        HostDraft {
            name: row.name,
            address: row.address,
            port,
            username: row.username,
            group_id: row.group_id.as_deref().map(parse_id).transpose()?,
            tags,
            auth,
            favorite: row.favorite,
        },
        Timestamp::from_unix_millis(row.created_at),
        Timestamp::from_unix_millis(row.updated_at),
    )
    .map_err(|_| RepositoryError::InvalidData)
}

fn insert_host(transaction: &Transaction<'_>, host: &Host) -> Result<(), RepositoryError> {
    let (auth_kind, credential_ref, private_key_path, passphrase_ref) = encode_auth(&host.auth)?;
    transaction
        .execute(
            "INSERT INTO hosts(
                id, name, address, port, username, group_id, auth_kind, credential_ref,
                private_key_path, passphrase_ref, favorite, created_at, updated_at
             ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13)",
            params![
                host.id.to_string(),
                host.name,
                host.address,
                i64::from(host.port),
                host.username,
                host.group_id.map(|id| id.to_string()),
                auth_kind,
                credential_ref,
                private_key_path,
                passphrase_ref,
                host.favorite,
                host.created_at.as_unix_millis(),
                host.updated_at.as_unix_millis(),
            ],
        )
        .map(|_| ())
        .map_err(map_sqlite)
}

fn insert_tags(transaction: &Transaction<'_>, host: &Host) -> Result<(), RepositoryError> {
    for tag in &host.tags {
        transaction
            .execute(
                "INSERT INTO host_tags(host_id, tag) VALUES (?1, ?2)",
                params![host.id.to_string(), tag],
            )
            .map_err(map_sqlite)?;
    }
    Ok(())
}

type StoredAuth<'a> = (
    &'static str,
    Option<&'a str>,
    Option<&'a str>,
    Option<&'a str>,
);

fn encode_auth(auth: &AuthMethod) -> Result<StoredAuth<'_>, RepositoryError> {
    match auth {
        AuthMethod::Password { credential_ref } => {
            Ok(("password_ref", Some(credential_ref.as_str()), None, None))
        }
        AuthMethod::PrivateKey {
            path,
            passphrase_ref,
        } => Ok((
            "private_key_ref",
            None,
            Some(path.to_str().ok_or(RepositoryError::InvalidData)?),
            passphrase_ref.as_ref().map(CredentialRef::as_str),
        )),
        AuthMethod::Agent => Ok(("agent", None, None, None)),
        AuthMethod::None => Ok(("none", None, None, None)),
    }
}

fn credential_refs_for_host(
    connection: &Connection,
    id: HostId,
) -> Result<Vec<CredentialRef>, RepositoryError> {
    let row = connection
        .query_row(
            "SELECT credential_ref, passphrase_ref FROM hosts WHERE id = ?1",
            [id.to_string()],
            |row| {
                Ok((
                    row.get::<_, Option<String>>(0)?,
                    row.get::<_, Option<String>>(1)?,
                ))
            },
        )
        .optional()
        .map_err(map_sqlite)?
        .ok_or(RepositoryError::NotFound)?;
    row.0
        .into_iter()
        .chain(row.1)
        .map(|value| CredentialRef::try_new(value).map_err(|_| RepositoryError::InvalidData))
        .collect()
}

fn credential_is_referenced(
    connection: &Connection,
    reference: &CredentialRef,
) -> Result<bool, RepositoryError> {
    connection
        .query_row(
            "SELECT EXISTS(
                SELECT 1 FROM hosts WHERE credential_ref = ?1 OR passphrase_ref = ?1
             )",
            [reference.as_str()],
            |row| row.get(0),
        )
        .map_err(map_sqlite)
}

fn queue_cleanup(
    transaction: &Transaction<'_>,
    reference: &CredentialRef,
) -> Result<(), RepositoryError> {
    transaction
        .execute(
            "INSERT OR IGNORE INTO orphaned_credential_refs(credential_ref) VALUES (?1)",
            [reference.as_str()],
        )
        .map(|_| ())
        .map_err(map_sqlite)
}

fn tags_for_host(connection: &Connection, id: HostId) -> Result<Vec<String>, RepositoryError> {
    let mut statement = connection
        .prepare("SELECT tag FROM host_tags WHERE host_id = ?1 ORDER BY tag")
        .map_err(map_sqlite)?;
    statement
        .query_map([id.to_string()], |row| row.get(0))
        .map_err(map_sqlite)?
        .collect::<Result<Vec<_>, _>>()
        .map_err(map_sqlite)
}

fn host_matches(
    connection: &Connection,
    host: &Host,
    search: &str,
) -> Result<bool, RepositoryError> {
    let direct = host.name.to_lowercase().contains(search)
        || host.address.to_lowercase().contains(search)
        || host
            .username
            .as_ref()
            .is_some_and(|username| username.to_lowercase().contains(search))
        || host.tags.iter().any(|tag| tag.contains(search));
    if direct {
        return Ok(true);
    }
    let Some(group_id) = host.group_id else {
        return Ok(false);
    };
    let group_name = connection
        .query_row(
            "SELECT name FROM host_groups WHERE id = ?1",
            [group_id.to_string()],
            |row| row.get::<_, String>(0),
        )
        .optional()
        .map_err(map_sqlite)?;
    Ok(group_name.is_some_and(|name| name.to_lowercase().contains(search)))
}

type StoredKnownHost = (String, String, i64, String, String, i64, i64);

fn known_host_from_row(row: &rusqlite::Row<'_>) -> rusqlite::Result<StoredKnownHost> {
    Ok((
        row.get(0)?,
        row.get(1)?,
        row.get(2)?,
        row.get(3)?,
        row.get(4)?,
        row.get(5)?,
        row.get(6)?,
    ))
}

fn decode_known_host(row: StoredKnownHost) -> Result<KnownHost, RepositoryError> {
    KnownHost::rehydrate(
        parse_id::<KnownHostId>(&row.0)?,
        row.1,
        u16::try_from(row.2).map_err(|_| RepositoryError::InvalidData)?,
        row.3,
        row.4,
        Timestamp::from_unix_millis(row.5),
        Timestamp::from_unix_millis(row.6),
    )
    .map_err(|_| RepositoryError::InvalidData)
}

fn parse_credential(value: Option<String>) -> Result<CredentialRef, RepositoryError> {
    CredentialRef::try_new(value.ok_or(RepositoryError::InvalidData)?)
        .map_err(|_| RepositoryError::InvalidData)
}

fn parse_id<T: FromStr>(value: &str) -> Result<T, RepositoryError> {
    value.parse().map_err(|_| RepositoryError::InvalidData)
}

fn map_sqlite(error: rusqlite::Error) -> RepositoryError {
    match &error {
        rusqlite::Error::SqliteFailure(failure, _)
            if failure.code == ErrorCode::ConstraintViolation =>
        {
            RepositoryError::Conflict
        }
        _ => RepositoryError::Storage(error.to_string()),
    }
}
