//! TOFU estrito: a primeira chave exige confirmação e uma troca bloqueia a conexão.

use crate::repositories::{KnownHostRepository, RepositoryError};
use ownterm_domain::{DomainError, KnownHost, Timestamp, normalize_destination};

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum TrustDecision {
    ConfirmFirstUse,
    Trusted,
    Changed,
}

pub fn verify(known_fingerprint: Option<&str>, received_fingerprint: &str) -> TrustDecision {
    match known_fingerprint {
        None => TrustDecision::ConfirmFirstUse,
        Some(known) if known == received_fingerprint => TrustDecision::Trusted,
        Some(_) => TrustDecision::Changed,
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum TrustError {
    Domain(DomainError),
    Repository(RepositoryError),
    ChangedIdentity,
}

pub struct TrustService<'a, R> {
    repository: &'a R,
}

impl<'a, R: KnownHostRepository> TrustService<'a, R> {
    pub const fn new(repository: &'a R) -> Self {
        Self { repository }
    }

    pub fn assess(
        &self,
        destination: &str,
        port: u16,
        algorithm: &str,
        fingerprint: &str,
    ) -> Result<TrustDecision, TrustError> {
        let destination = normalize_destination(destination).map_err(TrustError::Domain)?;
        let known = self
            .repository
            .find_known_host(&destination, port)
            .map_err(TrustError::Repository)?;
        Ok(match known {
            None => TrustDecision::ConfirmFirstUse,
            Some(known) if known.algorithm == algorithm && known.fingerprint == fingerprint => {
                TrustDecision::Trusted
            }
            Some(_) => TrustDecision::Changed,
        })
    }

    pub fn confirm_first_use(
        &self,
        destination: &str,
        port: u16,
        algorithm: &str,
        fingerprint: &str,
        now: Timestamp,
    ) -> Result<KnownHost, TrustError> {
        match self.assess(destination, port, algorithm, fingerprint)? {
            TrustDecision::Changed => Err(TrustError::ChangedIdentity),
            TrustDecision::Trusted => self
                .repository
                .find_known_host(destination, port)
                .map_err(TrustError::Repository)?
                .ok_or(TrustError::Repository(RepositoryError::NotFound)),
            TrustDecision::ConfirmFirstUse => {
                let known = KnownHost::new(destination, port, algorithm, fingerprint, now)
                    .map_err(TrustError::Domain)?;
                self.repository
                    .insert_known_host(&known)
                    .map_err(TrustError::Repository)?;
                Ok(known)
            }
        }
    }

    pub fn remove(&self, destination: &str, port: u16) -> Result<(), TrustError> {
        let destination = normalize_destination(destination).map_err(TrustError::Domain)?;
        self.repository
            .remove_known_host(&destination, port)
            .map_err(TrustError::Repository)
    }
}

#[cfg(test)]
mod tests {
    use super::{TrustDecision, verify};

    #[test]
    fn strict_tofu_requires_confirmation_and_blocks_a_changed_identity() {
        assert_eq!(verify(None, "SHA256:first"), TrustDecision::ConfirmFirstUse);
        assert_eq!(
            verify(Some("SHA256:first"), "SHA256:first"),
            TrustDecision::Trusted
        );
        assert_eq!(
            verify(Some("SHA256:first"), "SHA256:changed"),
            TrustDecision::Changed
        );
    }
}
