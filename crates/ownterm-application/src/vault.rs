//! Contrato de cofre: nunca persiste segredos fora do cofre do sistema.

use crate::repositories::{CredentialCleanupRepository, RepositoryError};
use std::collections::HashMap;
use std::fmt;

pub use ownterm_domain::CredentialRef as SecretRef;

#[derive(Clone, PartialEq, Eq)]
pub struct SecretValue(String);

impl SecretValue {
    pub fn new(value: impl Into<String>) -> Self {
        Self(value.into())
    }

    pub fn expose(&self) -> &str {
        &self.0
    }
}

impl fmt::Debug for SecretValue {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        formatter.write_str("SecretValue(<redacted>)")
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum VaultError {
    NotFound,
    Platform(String),
    UnsupportedPlatform,
}

pub trait SecretVault {
    fn store(&self, reference: &SecretRef, secret: &SecretValue) -> Result<(), VaultError>;
    fn read(&self, reference: &SecretRef) -> Result<SecretValue, VaultError>;
    fn remove(&self, reference: &SecretRef) -> Result<(), VaultError>;
}

#[derive(Default)]
pub struct FakeSecretVault {
    values: std::sync::Mutex<HashMap<SecretRef, String>>,
    fail_with: Option<VaultError>,
}

impl FakeSecretVault {
    pub fn failing(error: VaultError) -> Self {
        Self {
            values: std::sync::Mutex::new(HashMap::new()),
            fail_with: Some(error),
        }
    }
}

impl SecretVault for FakeSecretVault {
    fn store(&self, reference: &SecretRef, secret: &SecretValue) -> Result<(), VaultError> {
        if let Some(error) = &self.fail_with {
            return Err(error.clone());
        }
        self.values
            .lock()
            .expect("fake vault lock")
            .insert(reference.clone(), secret.expose().to_owned());
        Ok(())
    }
    fn read(&self, reference: &SecretRef) -> Result<SecretValue, VaultError> {
        if let Some(error) = &self.fail_with {
            return Err(error.clone());
        }
        self.values
            .lock()
            .expect("fake vault lock")
            .get(reference)
            .cloned()
            .map(SecretValue::new)
            .ok_or(VaultError::NotFound)
    }
    fn remove(&self, reference: &SecretRef) -> Result<(), VaultError> {
        if let Some(error) = &self.fail_with {
            return Err(error.clone());
        }
        self.values
            .lock()
            .expect("fake vault lock")
            .remove(reference)
            .map(|_| ())
            .ok_or(VaultError::NotFound)
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum SecretServiceError {
    Vault(VaultError),
    Repository(RepositoryError),
}

pub struct SecretService<'a, V, R> {
    vault: &'a V,
    cleanup: &'a R,
}

impl<'a, V, R> SecretService<'a, V, R>
where
    V: SecretVault,
    R: CredentialCleanupRepository,
{
    pub const fn new(vault: &'a V, cleanup: &'a R) -> Self {
        Self { vault, cleanup }
    }

    pub fn store(
        &self,
        reference: &SecretRef,
        secret: &SecretValue,
    ) -> Result<(), SecretServiceError> {
        self.vault
            .store(reference, secret)
            .map_err(SecretServiceError::Vault)
    }

    pub fn remove_if_orphaned(&self, reference: &SecretRef) -> Result<bool, SecretServiceError> {
        if self
            .cleanup
            .is_credential_referenced(reference)
            .map_err(SecretServiceError::Repository)?
        {
            self.cleanup
                .complete_credential_cleanup(reference)
                .map_err(SecretServiceError::Repository)?;
            return Ok(false);
        }
        match self.vault.remove(reference) {
            Ok(()) | Err(VaultError::NotFound) => {
                self.cleanup
                    .complete_credential_cleanup(reference)
                    .map_err(SecretServiceError::Repository)?;
                Ok(true)
            }
            Err(error) => Err(SecretServiceError::Vault(error)),
        }
    }

    pub fn cleanup_pending(&self) -> Result<usize, SecretServiceError> {
        let references = self
            .cleanup
            .list_pending_credential_cleanup()
            .map_err(SecretServiceError::Repository)?;
        let mut removed = 0;
        for reference in references {
            if self.remove_if_orphaned(&reference)? {
                removed += 1;
            }
        }
        Ok(removed)
    }
}

#[cfg(test)]
mod tests {
    use super::{FakeSecretVault, SecretRef, SecretValue, SecretVault, VaultError};
    #[test]
    fn fake_vault_covers_success_missing_and_platform_failure() {
        let vault = FakeSecretVault::default();
        let reference = SecretRef::try_new("test").unwrap();
        let secret = SecretValue::new("secret");
        vault.store(&reference, &secret).unwrap();
        assert_eq!(vault.read(&reference).unwrap().expose(), "secret");
        vault.remove(&reference).unwrap();
        assert_eq!(vault.read(&reference), Err(VaultError::NotFound));
        let failing = FakeSecretVault::failing(VaultError::Platform("denied".into()));
        assert_eq!(
            failing.store(&reference, &secret),
            Err(VaultError::Platform("denied".into()))
        );
        assert_eq!(format!("{secret:?}"), "SecretValue(<redacted>)");
    }
}
