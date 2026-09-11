//! Contratos seguros e parser limitado para portabilidade de Hosts.

use ownterm_domain::{AuthMethod, Host, HostGroup};
use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;

pub const EXPORT_SCHEMA_VERSION: u8 = 1;

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PortableGroup {
    pub name: String,
    pub sort_order: i32,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PortableHost {
    pub name: String,
    pub address: String,
    pub port: u16,
    pub username: Option<String>,
    pub group: Option<String>,
    pub tags: Vec<String>,
    pub favorite: bool,
    pub auth_kind: PortableAuthKind,
    pub private_key_path: Option<String>,
    pub credential_required: bool,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum PortableAuthKind {
    Password,
    PrivateKey,
    Agent,
    None,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WorkspaceExport {
    pub schema_version: u8,
    pub exported_at: String,
    pub groups: Vec<PortableGroup>,
    pub hosts: Vec<PortableHost>,
    pub settings: BTreeMap<String, String>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct IgnoredDirective {
    pub line: usize,
    pub directive: String,
    pub reason: String,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ImportAction {
    Create,
    Update,
    Skip,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ImportPreviewEntry {
    pub host: PortableHost,
    pub conflict: bool,
    pub default_action: ImportAction,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ImportPreview {
    pub groups: Vec<PortableGroup>,
    pub settings: BTreeMap<String, String>,
    pub entries: Vec<ImportPreviewEntry>,
    pub ignored: Vec<IgnoredDirective>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum PortabilityError {
    InvalidFormat,
    UnsupportedSchema,
    InvalidSelection,
}
impl std::fmt::Display for PortabilityError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.write_str(match self {
            Self::InvalidFormat => "workspace format is invalid",
            Self::UnsupportedSchema => "workspace schema version is unsupported",
            Self::InvalidSelection => "import selection is invalid",
        })
    }
}
impl std::error::Error for PortabilityError {}

pub fn parse_openssh_config(content: &str, existing: &[Host]) -> ImportPreview {
    let mut entries = Vec::new();
    let mut ignored = Vec::new();
    let mut current: Option<(usize, Vec<String>, PortableHost)> = None;
    let flush = |current: &mut Option<(usize, Vec<String>, PortableHost)>,
                 entries: &mut Vec<ImportPreviewEntry>,
                 ignored: &mut Vec<IgnoredDirective>| {
        if let Some((line, aliases, host)) = current.take() {
            for alias in aliases {
                if !concrete_alias(&alias) {
                    ignored.push(IgnoredDirective {
                        line,
                        directive: format!("Host {alias}"),
                        reason: "pattern aliases are out of scope".into(),
                    });
                    continue;
                }
                let mut host = host.clone();
                host.name = alias.clone();
                if host.address.is_empty() {
                    host.address = alias;
                }
                entries.push(preview_entry(host, existing));
            }
        }
    };
    for (index, raw) in content.lines().enumerate() {
        let line = index + 1;
        let text = raw.split('#').next().unwrap_or("").trim();
        if text.is_empty() {
            continue;
        }
        let Some((key, value)) = text.split_once(char::is_whitespace) else {
            ignored.push(IgnoredDirective {
                line,
                directive: text.into(),
                reason: "directive has no value".into(),
            });
            continue;
        };
        let key = key.to_ascii_lowercase();
        let value = value.trim();
        if key == "host" {
            flush(&mut current, &mut entries, &mut ignored);
            let aliases = value
                .split_whitespace()
                .map(str::to_owned)
                .collect::<Vec<_>>();
            current = Some((
                line,
                aliases,
                PortableHost {
                    name: String::new(),
                    address: String::new(),
                    port: 22,
                    username: None,
                    group: None,
                    tags: Vec::new(),
                    favorite: false,
                    auth_kind: PortableAuthKind::None,
                    private_key_path: None,
                    credential_required: false,
                },
            ));
            continue;
        }
        let Some((_, _, host)) = current.as_mut() else {
            ignored.push(IgnoredDirective {
                line,
                directive: key,
                reason: "global directives are ignored".into(),
            });
            continue;
        };
        match key.as_str() {
            "hostname" => host.address = value.into(),
            "user" => host.username = (!value.is_empty()).then(|| value.into()),
            "port" => match value.parse::<u16>().ok().filter(|port| *port != 0) {
                Some(port) => host.port = port,
                None => ignored.push(IgnoredDirective {
                    line,
                    directive: "Port".into(),
                    reason: "port must be between 1 and 65535".into(),
                }),
            },
            "identityfile" => {
                host.auth_kind = PortableAuthKind::PrivateKey;
                host.private_key_path = Some(value.into());
                host.credential_required = true;
            }
            "include" | "proxyjump" => ignored.push(IgnoredDirective {
                line,
                directive: key,
                reason: "directive is out of scope".into(),
            }),
            _ => ignored.push(IgnoredDirective {
                line,
                directive: key,
                reason: "directive is not supported".into(),
            }),
        }
    }
    flush(&mut current, &mut entries, &mut ignored);
    ImportPreview {
        groups: Vec::new(),
        settings: BTreeMap::new(),
        entries,
        ignored,
    }
}

pub fn encode_workspace(
    groups: &[HostGroup],
    hosts: &[Host],
    settings: BTreeMap<String, String>,
    exported_at: String,
) -> Result<String, PortabilityError> {
    let group_names = groups
        .iter()
        .map(|group| (group.id, group.name.clone()))
        .collect::<BTreeMap<_, _>>();
    let groups = groups
        .iter()
        .map(|group| PortableGroup {
            name: group.name.clone(),
            sort_order: group.sort_order,
        })
        .collect();
    let hosts = hosts
        .iter()
        .map(|host| {
            let (auth_kind, private_key_path, credential_required) = match &host.auth {
                AuthMethod::Password { .. } => (PortableAuthKind::Password, None, true),
                AuthMethod::PrivateKey { path, .. } => (
                    PortableAuthKind::PrivateKey,
                    Some(path.to_string_lossy().into_owned()),
                    true,
                ),
                AuthMethod::Agent => (PortableAuthKind::Agent, None, true),
                AuthMethod::None => (PortableAuthKind::None, None, false),
            };
            PortableHost {
                name: host.name.clone(),
                address: host.address.clone(),
                port: host.port,
                username: host.username.clone(),
                group: host.group_id.and_then(|id| group_names.get(&id).cloned()),
                tags: host.tags.clone(),
                favorite: host.favorite,
                auth_kind,
                private_key_path,
                credential_required,
            }
        })
        .collect();
    serde_json::to_string_pretty(&WorkspaceExport {
        schema_version: EXPORT_SCHEMA_VERSION,
        exported_at,
        groups,
        hosts,
        settings: portable_settings(settings),
    })
    .map_err(|_| PortabilityError::InvalidFormat)
}

pub fn decode_workspace(
    content: &str,
    existing: &[Host],
) -> Result<ImportPreview, PortabilityError> {
    let export: WorkspaceExport =
        serde_json::from_str(content).map_err(|_| PortabilityError::InvalidFormat)?;
    if export.schema_version != EXPORT_SCHEMA_VERSION {
        return Err(PortabilityError::UnsupportedSchema);
    }
    Ok(ImportPreview {
        groups: export.groups,
        settings: portable_settings(export.settings),
        entries: export
            .hosts
            .into_iter()
            .map(|host| preview_entry(host, existing))
            .collect(),
        ignored: Vec::new(),
    })
}

pub fn portable_settings(settings: BTreeMap<String, String>) -> BTreeMap<String, String> {
    settings
        .into_iter()
        .filter(|(key, _)| key == "theme")
        .collect()
}

fn preview_entry(host: PortableHost, existing: &[Host]) -> ImportPreviewEntry {
    let conflict = existing
        .iter()
        .any(|item| item.name.eq_ignore_ascii_case(&host.name));
    ImportPreviewEntry {
        host,
        conflict,
        default_action: if conflict {
            ImportAction::Skip
        } else {
            ImportAction::Create
        },
    }
}

fn concrete_alias(alias: &str) -> bool {
    !alias.is_empty() && !alias.contains(['*', '?', '!'])
}

#[cfg(test)]
mod tests {
    use super::*;
    use ownterm_domain::{HostDraft, Timestamp};
    #[test]
    fn preview_reports_patterns_invalid_ports_and_identity_files() {
        let preview = parse_openssh_config(
            "Host edge\n HostName edge.example\n User ops\n Port 2222\n IdentityFile ~/.ssh/id\nHost *\n Port nope\nInclude x",
            &[],
        );
        assert_eq!(preview.entries.len(), 1);
        assert_eq!(preview.entries[0].host.address, "edge.example");
        assert_eq!(
            preview.entries[0].host.auth_kind,
            PortableAuthKind::PrivateKey
        );
        assert!(preview.ignored.len() >= 2);
    }
    #[test]
    fn export_omits_credential_references() {
        let host = Host::new(
            HostDraft {
                name: "edge".into(),
                address: "edge.test".into(),
                port: 22,
                username: None,
                group_id: None,
                tags: vec![],
                auth: AuthMethod::Password {
                    credential_ref: ownterm_domain::CredentialRef::try_new("secret-reference")
                        .unwrap(),
                },
                favorite: false,
            },
            Timestamp::from_unix_millis(1),
        )
        .unwrap();
        let settings = BTreeMap::from([
            ("theme".into(), "dark".into()),
            ("apiKey".into(), "must-not-export".into()),
            ("knownHosts".into(), "must-not-export".into()),
            ("appearance.windowOpacity".into(), "92".into()),
            ("appearance.terminalBackgroundOpacity".into(), "82".into()),
        ]);
        let json = encode_workspace(&[], &[host], settings, "2026-01-01T00:00:00Z".into()).unwrap();
        assert!(!json.contains("secret-reference"));
        assert!(!json.contains("credentialRef"));
        assert!(!json.contains("must-not-export"));
        assert!(json.contains("\"theme\""));
    }

    #[test]
    fn workspace_round_trip_preserves_groups_and_credential_requirement() {
        let content = r#"{"schemaVersion":1,"exportedAt":"2026-09-02T12:00:00Z","groups":[{"name":"Empty","sortOrder":3}],"hosts":[{"name":"edge","address":"edge.example","port":22,"tags":[],"favorite":false,"authKind":"password","credentialRequired":true}],"settings":{"theme":"dark","apiKey":"must-not-import"}}"#;
        let preview = decode_workspace(content, &[]).unwrap();
        assert_eq!(
            preview.groups,
            vec![PortableGroup {
                name: "Empty".into(),
                sort_order: 3
            }]
        );
        assert!(preview.entries[0].host.credential_required);
        assert_eq!(
            preview.settings,
            BTreeMap::from([("theme".into(), "dark".into())])
        );
    }
}
