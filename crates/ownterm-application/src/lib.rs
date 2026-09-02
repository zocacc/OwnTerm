#![forbid(unsafe_code)]

pub mod vault;

use ownterm_domain::{OWNTERM, ProductIdentity};

/// Fachada inicial dos casos de uso compartilháveis por desktop e futura CLI.
#[derive(Debug)]
pub struct OwnTermApplication;

impl OwnTermApplication {
    pub const fn product_identity() -> ProductIdentity {
        OWNTERM
    }
}

#[cfg(test)]
mod tests {
    use super::OwnTermApplication;

    #[test]
    fn delegates_product_identity_to_the_domain() {
        assert_eq!(OwnTermApplication::product_identity().name(), "OwnTerm");
    }
}
