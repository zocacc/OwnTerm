#![forbid(unsafe_code)]

/// Identidade estável do produto, independente de interface e infraestrutura.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct ProductIdentity {
    name: &'static str,
    version: &'static str,
}

impl ProductIdentity {
    pub const fn new(name: &'static str, version: &'static str) -> Self {
        Self { name, version }
    }

    pub const fn name(self) -> &'static str {
        self.name
    }

    pub const fn version(self) -> &'static str {
        self.version
    }
}

pub const OWNTERM: ProductIdentity = ProductIdentity::new("OwnTerm", env!("CARGO_PKG_VERSION"));

#[cfg(test)]
mod tests {
    use super::OWNTERM;

    #[test]
    fn exposes_the_product_identity() {
        assert_eq!(OWNTERM.name(), "OwnTerm");
        assert!(!OWNTERM.version().is_empty());
    }
}
