use ownterm_application::vault::{SecretRef, SecretValue, SecretVault, VaultError};

pub struct SystemVault;

#[cfg(windows)]
impl SystemVault {
    fn entry(reference: &SecretRef) -> Result<keyring::Entry, VaultError> {
        keyring::Entry::new("dev.zocacc.ownterm", reference.as_str())
            .map_err(|error| VaultError::Platform(error.to_string()))
    }
}

#[cfg(windows)]
impl SecretVault for SystemVault {
    fn store(&self, reference: &SecretRef, secret: &SecretValue) -> Result<(), VaultError> {
        Self::entry(reference)?
            .set_password(secret.expose())
            .map_err(|error| VaultError::Platform(error.to_string()))
    }
    fn read(&self, reference: &SecretRef) -> Result<SecretValue, VaultError> {
        Self::entry(reference)?
            .get_password()
            .map(SecretValue::new)
            .map_err(|error| match error {
                keyring::Error::NoEntry => VaultError::NotFound,
                other => VaultError::Platform(other.to_string()),
            })
    }
    fn remove(&self, reference: &SecretRef) -> Result<(), VaultError> {
        Self::entry(reference)?
            .delete_credential()
            .map_err(|error| match error {
                keyring::Error::NoEntry => VaultError::NotFound,
                other => VaultError::Platform(other.to_string()),
            })
    }
}

#[cfg(not(windows))]
impl SecretVault for SystemVault {
    fn store(&self, _: &SecretRef, _: &SecretValue) -> Result<(), VaultError> {
        Err(VaultError::UnsupportedPlatform)
    }
    fn read(&self, _: &SecretRef) -> Result<SecretValue, VaultError> {
        Err(VaultError::UnsupportedPlatform)
    }
    fn remove(&self, _: &SecretRef) -> Result<(), VaultError> {
        Err(VaultError::UnsupportedPlatform)
    }
}
