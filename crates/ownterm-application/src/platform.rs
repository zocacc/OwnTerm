//! Port para os diretórios persistentes definidos pelo sistema operacional.

use std::fmt;
use std::path::PathBuf;

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct AppDirectories {
    pub data_dir: PathBuf,
    pub config_dir: PathBuf,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum PlatformError {
    UnsupportedPlatform,
    Unavailable(&'static str),
}

impl fmt::Display for PlatformError {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::UnsupportedPlatform => formatter.write_str("platform is not supported"),
            Self::Unavailable(name) => {
                write!(
                    formatter,
                    "required platform directory is unavailable: {name}"
                )
            }
        }
    }
}

impl std::error::Error for PlatformError {}

pub trait AppDirectoriesProvider: Send + Sync {
    fn app_directories(&self) -> Result<AppDirectories, PlatformError>;
}
