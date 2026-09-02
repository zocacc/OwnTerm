//! TOFU estrito: a primeira chave exige confirmação e uma troca bloqueia a conexão.

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
