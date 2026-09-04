//! Eventos de diagnóstico deliberadamente incapazes de carregar payloads sensíveis.

use std::fmt;

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct DiagnosticEvent {
    operation: &'static str,
    entity_id: Option<String>,
    error_code: Option<&'static str>,
}

impl DiagnosticEvent {
    pub fn success(operation: &'static str, entity_id: Option<String>) -> Self {
        Self {
            operation,
            entity_id,
            error_code: None,
        }
    }

    pub fn failure(
        operation: &'static str,
        entity_id: Option<String>,
        error_code: &'static str,
    ) -> Self {
        Self {
            operation,
            entity_id,
            error_code: Some(error_code),
        }
    }
}

impl fmt::Display for DiagnosticEvent {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(formatter, "operation={}", self.operation)?;
        if let Some(entity_id) = &self.entity_id {
            write!(formatter, " entity_id={entity_id}")?;
        }
        if let Some(error_code) = self.error_code {
            write!(formatter, " error_code={error_code}")?;
        }
        Ok(())
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct PublicError {
    pub code: &'static str,
    pub message: &'static str,
    pub recoverable: bool,
}

#[cfg(test)]
mod tests {
    use super::{DiagnosticEvent, PublicError};

    #[test]
    fn diagnostic_snapshot_contains_only_allowlisted_fields() {
        let secret = "never-log-this-password";
        let event = DiagnosticEvent::failure(
            "credential.cleanup",
            Some("host-018".into()),
            "vault_unavailable",
        );
        let public = PublicError {
            code: "vault_unavailable",
            message: "The system credential vault is unavailable.",
            recoverable: true,
        };
        let snapshot = format!("{event}\n{public:?}");

        assert_eq!(
            snapshot,
            "operation=credential.cleanup entity_id=host-018 error_code=vault_unavailable\nPublicError { code: \"vault_unavailable\", message: \"The system credential vault is unavailable.\", recoverable: true }"
        );
        assert!(!snapshot.contains(secret));
        assert!(!snapshot.contains("credential_ref"));
    }
}
