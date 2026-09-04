#![forbid(unsafe_code)]

//! Adapters nativos para cofre do sistema e diretórios persistentes.

mod directories;
mod vault;

pub use directories::SystemDirectories;
pub use vault::SystemVault;
