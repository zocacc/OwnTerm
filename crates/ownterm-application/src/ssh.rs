//! Casos de uso e ports para resolver e controlar sessões SSH.

use crate::repositories::{HostRepository, RepositoryError};
use crate::vault::{SecretValue, SecretVault, VaultError};
use ownterm_domain::{AuthMethod, HostId};
use std::fmt;
use std::path::PathBuf;

#[derive(Clone, PartialEq, Eq)]
pub enum ResolvedSshAuth {
    Password {
        secret: Option<SecretValue>,
    },
    PrivateKey {
        path: PathBuf,
        passphrase: Option<SecretValue>,
        needs_passphrase: bool,
    },
}

impl fmt::Debug for ResolvedSshAuth {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::Password { secret } => formatter
                .debug_struct("Password")
                .field("secret", &secret.as_ref().map(|_| "<redacted>"))
                .finish(),
            Self::PrivateKey {
                path,
                passphrase,
                needs_passphrase,
            } => formatter
                .debug_struct("PrivateKey")
                .field("path", path)
                .field("passphrase", &passphrase.as_ref().map(|_| "<redacted>"))
                .field("needs_passphrase", needs_passphrase)
                .finish(),
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ResolvedSshHost {
    pub host_id: Option<HostId>,
    pub title: String,
    pub address: String,
    pub port: u16,
    pub username: String,
    pub auth: ResolvedSshAuth,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum SshResolveError {
    HostNotFound,
    UsernameRequired,
    UnsupportedAgent,
    InvalidDestination,
    Repository(RepositoryError),
    Vault(VaultError),
}

impl fmt::Display for SshResolveError {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::HostNotFound => formatter.write_str("SSH Host was not found"),
            Self::UsernameRequired => formatter.write_str("SSH username is required"),
            Self::UnsupportedAgent => formatter.write_str("SSH agent is not supported in the MVP"),
            Self::InvalidDestination => formatter.write_str("SSH destination is invalid"),
            Self::Repository(_) => formatter.write_str("SSH Host configuration is unavailable"),
            Self::Vault(_) => formatter.write_str("SSH credential is unavailable"),
        }
    }
}

impl std::error::Error for SshResolveError {}

pub fn resolve_saved_host<R: HostRepository, V: SecretVault>(
    hosts: &R,
    vault: &V,
    host_id: HostId,
) -> Result<ResolvedSshHost, SshResolveError> {
    let host = hosts
        .get_host(host_id)
        .map_err(SshResolveError::Repository)?
        .ok_or(SshResolveError::HostNotFound)?;
    let username = host
        .username
        .clone()
        .filter(|value| !value.trim().is_empty())
        .ok_or(SshResolveError::UsernameRequired)?;
    let auth = match &host.auth {
        AuthMethod::Password { credential_ref } => ResolvedSshAuth::Password {
            secret: optional_secret(vault, credential_ref)?,
        },
        AuthMethod::PrivateKey {
            path,
            passphrase_ref,
        } => ResolvedSshAuth::PrivateKey {
            path: path.clone(),
            passphrase: passphrase_ref
                .as_ref()
                .map(|reference| optional_secret(vault, reference))
                .transpose()?
                .flatten(),
            needs_passphrase: passphrase_ref.is_some(),
        },
        AuthMethod::None => ResolvedSshAuth::Password { secret: None },
        AuthMethod::Agent => return Err(SshResolveError::UnsupportedAgent),
    };
    Ok(ResolvedSshHost {
        host_id: Some(host.id),
        title: host.name,
        address: host.address,
        port: host.port,
        username,
        auth,
    })
}

pub fn resolve_quick_connect(value: &str) -> Result<ResolvedSshHost, SshResolveError> {
    let (username, destination) = value
        .trim()
        .split_once('@')
        .filter(|(username, destination)| !username.is_empty() && !destination.is_empty())
        .ok_or(SshResolveError::InvalidDestination)?;
    let (address, port) = parse_address(destination)?;
    Ok(ResolvedSshHost {
        host_id: None,
        title: value.trim().to_owned(),
        address,
        port,
        username: username.to_owned(),
        auth: ResolvedSshAuth::Password { secret: None },
    })
}

fn optional_secret<V: SecretVault>(
    vault: &V,
    reference: &ownterm_domain::CredentialRef,
) -> Result<Option<SecretValue>, SshResolveError> {
    match vault.read(reference) {
        Ok(secret) => Ok(Some(secret)),
        Err(VaultError::NotFound) => Ok(None),
        Err(error) => Err(SshResolveError::Vault(error)),
    }
}

fn parse_address(value: &str) -> Result<(String, u16), SshResolveError> {
    if let Some(rest) = value.strip_prefix('[') {
        let (address, port) = rest
            .split_once("]:")
            .ok_or(SshResolveError::InvalidDestination)?;
        return parse_port(address, port);
    }
    if value.matches(':').count() == 1 {
        let (address, port) = value
            .rsplit_once(':')
            .ok_or(SshResolveError::InvalidDestination)?;
        return parse_port(address, port);
    }
    if value.is_empty() || value.chars().any(char::is_whitespace) {
        return Err(SshResolveError::InvalidDestination);
    }
    Ok((value.to_owned(), 22))
}

fn parse_port(address: &str, port: &str) -> Result<(String, u16), SshResolveError> {
    if address.is_empty() || address.chars().any(char::is_whitespace) {
        return Err(SshResolveError::InvalidDestination);
    }
    let port = port
        .parse::<u16>()
        .map_err(|_| SshResolveError::InvalidDestination)?;
    if port == 0 {
        return Err(SshResolveError::InvalidDestination);
    }
    Ok((address.to_owned(), port))
}

#[cfg(test)]
mod tests {
    use super::{ResolvedSshAuth, SshResolveError, resolve_quick_connect};

    #[test]
    fn parses_quick_connect_destinations() {
        let target = resolve_quick_connect("root@example.com:2222").unwrap();
        assert_eq!(target.username, "root");
        assert_eq!(target.address, "example.com");
        assert_eq!(target.port, 2222);
        assert!(matches!(
            target.auth,
            ResolvedSshAuth::Password { secret: None }
        ));

        let ipv6 = resolve_quick_connect("root@[::1]:22").unwrap();
        assert_eq!(ipv6.address, "::1");
        assert_eq!(
            resolve_quick_connect("example.com"),
            Err(SshResolveError::InvalidDestination)
        );
    }
}
