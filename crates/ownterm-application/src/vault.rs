//! Contrato de cofre: nunca persiste segredos fora do cofre do sistema.

use std::collections::HashMap;

#[derive(Debug, Clone, PartialEq, Eq, Hash)]
pub struct SecretRef(String);

impl SecretRef {
    pub fn new(value: impl Into<String>) -> Self {
        Self(value.into())
    }
    pub fn as_str(&self) -> &str {
        &self.0
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum VaultError {
    NotFound,
    Platform(String),
    UnsupportedPlatform,
}

pub trait SecretVault {
    fn store(&self, reference: &SecretRef, secret: &str) -> Result<(), VaultError>;
    fn read(&self, reference: &SecretRef) -> Result<String, VaultError>;
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
    fn store(&self, reference: &SecretRef, secret: &str) -> Result<(), VaultError> {
        if let Some(error) = &self.fail_with {
            return Err(error.clone());
        }
        self.values
            .lock()
            .expect("fake vault lock")
            .insert(reference.clone(), secret.to_owned());
        Ok(())
    }
    fn read(&self, reference: &SecretRef) -> Result<String, VaultError> {
        if let Some(error) = &self.fail_with {
            return Err(error.clone());
        }
        self.values
            .lock()
            .expect("fake vault lock")
            .get(reference)
            .cloned()
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

#[cfg(test)]
mod tests {
    use super::{FakeSecretVault, SecretRef, SecretVault, VaultError};
    #[test]
    fn fake_vault_covers_success_missing_and_platform_failure() {
        let vault = FakeSecretVault::default();
        let reference = SecretRef::new("test");
        vault.store(&reference, "secret").unwrap();
        assert_eq!(vault.read(&reference).unwrap(), "secret");
        vault.remove(&reference).unwrap();
        assert_eq!(vault.read(&reference), Err(VaultError::NotFound));
        let failing = FakeSecretVault::failing(VaultError::Platform("denied".into()));
        assert_eq!(
            failing.store(&reference, "secret"),
            Err(VaultError::Platform("denied".into()))
        );
    }
}
