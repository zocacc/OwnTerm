use ownterm_application::platform::{AppDirectories, AppDirectoriesProvider, PlatformError};
use std::ffi::OsString;
use std::path::PathBuf;

const APP_DIRECTORY: &str = "OwnTerm";

#[derive(Debug, Default)]
pub struct SystemDirectories;

impl AppDirectoriesProvider for SystemDirectories {
    fn app_directories(&self) -> Result<AppDirectories, PlatformError> {
        #[cfg(windows)]
        {
            windows_directories(std::env::var_os("LOCALAPPDATA"))
        }

        #[cfg(target_os = "linux")]
        {
            linux_directories(
                std::env::var_os("XDG_DATA_HOME"),
                std::env::var_os("XDG_CONFIG_HOME"),
                std::env::var_os("HOME"),
            )
        }

        #[cfg(not(any(windows, target_os = "linux")))]
        Err(PlatformError::UnsupportedPlatform)
    }
}

#[cfg(windows)]
fn windows_directories(local_app_data: Option<OsString>) -> Result<AppDirectories, PlatformError> {
    let root = local_app_data
        .map(PathBuf::from)
        .ok_or(PlatformError::Unavailable("LOCALAPPDATA"))?
        .join(APP_DIRECTORY);
    Ok(AppDirectories {
        data_dir: root.clone(),
        config_dir: root,
    })
}

#[cfg(any(test, target_os = "linux"))]
fn linux_directories(
    data_home: Option<OsString>,
    config_home: Option<OsString>,
    home: Option<OsString>,
) -> Result<AppDirectories, PlatformError> {
    let home = home.map(PathBuf::from);
    let data_root = data_home
        .map(PathBuf::from)
        .or_else(|| home.as_ref().map(|path| path.join(".local/share")))
        .ok_or(PlatformError::Unavailable("XDG_DATA_HOME or HOME"))?;
    let config_root = config_home
        .map(PathBuf::from)
        .or_else(|| home.map(|path| path.join(".config")))
        .ok_or(PlatformError::Unavailable("XDG_CONFIG_HOME or HOME"))?;
    Ok(AppDirectories {
        data_dir: data_root.join(APP_DIRECTORY),
        config_dir: config_root.join(APP_DIRECTORY),
    })
}

#[cfg(test)]
mod tests {
    use super::linux_directories;
    use std::ffi::OsString;
    use std::path::PathBuf;

    #[test]
    fn resolves_xdg_directories_without_creating_them() {
        let directories = linux_directories(
            Some(OsString::from("/tmp/data")),
            Some(OsString::from("/tmp/config")),
            None,
        )
        .unwrap();
        assert_eq!(directories.data_dir, PathBuf::from("/tmp/data/OwnTerm"));
        assert_eq!(directories.config_dir, PathBuf::from("/tmp/config/OwnTerm"));
    }

    #[test]
    fn falls_back_to_home_for_xdg_directories() {
        let directories =
            linux_directories(None, None, Some(OsString::from("/home/test"))).unwrap();
        assert_eq!(
            directories.data_dir,
            PathBuf::from("/home/test/.local/share/OwnTerm")
        );
        assert_eq!(
            directories.config_dir,
            PathBuf::from("/home/test/.config/OwnTerm")
        );
    }
}
