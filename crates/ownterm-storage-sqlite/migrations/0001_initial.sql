CREATE TABLE host_groups (
    id TEXT PRIMARY KEY NOT NULL,
    name TEXT NOT NULL COLLATE NOCASE UNIQUE,
    sort_order INTEGER NOT NULL
);

CREATE TABLE hosts (
    id TEXT PRIMARY KEY NOT NULL,
    name TEXT NOT NULL,
    address TEXT NOT NULL,
    port INTEGER NOT NULL CHECK (port BETWEEN 1 AND 65535),
    username TEXT,
    group_id TEXT REFERENCES host_groups(id) ON DELETE RESTRICT,
    auth_kind TEXT NOT NULL CHECK (auth_kind IN ('password_ref', 'private_key_ref', 'agent', 'none')),
    credential_ref TEXT,
    private_key_path TEXT,
    passphrase_ref TEXT,
    favorite INTEGER NOT NULL CHECK (favorite IN (0, 1)),
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    CHECK (
        (auth_kind = 'password_ref' AND credential_ref IS NOT NULL AND private_key_path IS NULL AND passphrase_ref IS NULL)
        OR (auth_kind = 'private_key_ref' AND credential_ref IS NULL AND private_key_path IS NOT NULL)
        OR (auth_kind IN ('agent', 'none') AND credential_ref IS NULL AND private_key_path IS NULL AND passphrase_ref IS NULL)
    )
);

CREATE TABLE host_tags (
    host_id TEXT NOT NULL REFERENCES hosts(id) ON DELETE CASCADE,
    tag TEXT NOT NULL,
    PRIMARY KEY (host_id, tag)
);

CREATE TABLE settings (
    key TEXT PRIMARY KEY NOT NULL,
    value TEXT NOT NULL
);

CREATE TABLE recent_hosts (
    host_id TEXT PRIMARY KEY NOT NULL REFERENCES hosts(id) ON DELETE CASCADE,
    opened_at INTEGER NOT NULL
);

CREATE TABLE known_hosts (
    id TEXT PRIMARY KEY NOT NULL,
    destination TEXT NOT NULL COLLATE NOCASE,
    port INTEGER NOT NULL CHECK (port BETWEEN 1 AND 65535),
    algorithm TEXT NOT NULL,
    fingerprint TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    UNIQUE (destination, port)
);

CREATE TABLE orphaned_credential_refs (
    credential_ref TEXT PRIMARY KEY NOT NULL,
    queued_at INTEGER NOT NULL DEFAULT (unixepoch('subsec') * 1000)
);

CREATE INDEX hosts_group_idx ON hosts(group_id);
CREATE INDEX hosts_favorite_idx ON hosts(favorite);
CREATE INDEX host_tags_tag_idx ON host_tags(tag);
CREATE INDEX recent_hosts_opened_idx ON recent_hosts(opened_at DESC);
