//! Contrato tipado para preferências locais de aparência.

pub const WINDOW_OPACITY_KEY: &str = "appearance.windowOpacity";
pub const TERMINAL_BACKGROUND_OPACITY_KEY: &str = "appearance.terminalBackgroundOpacity";
pub const DEFAULT_WINDOW_OPACITY: u8 = 92;
pub const MIN_WINDOW_OPACITY: u8 = 70;
pub const MAX_WINDOW_OPACITY: u8 = 100;
pub const DEFAULT_TERMINAL_BACKGROUND_OPACITY: u8 = 82;
pub const MIN_TERMINAL_BACKGROUND_OPACITY: u8 = 55;
pub const MAX_TERMINAL_BACKGROUND_OPACITY: u8 = 100;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct AppearanceSettings {
    pub window_opacity: u8,
    pub terminal_background_opacity: u8,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct AppearanceLoadResult {
    pub settings: AppearanceSettings,
    pub defaults_applied: bool,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum AppearanceSettingsError {
    WindowOpacityOutOfRange,
    TerminalBackgroundOpacityOutOfRange,
}

impl std::fmt::Display for AppearanceSettingsError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.write_str(match self {
            Self::WindowOpacityOutOfRange => "window opacity must be between 70 and 100",
            Self::TerminalBackgroundOpacityOutOfRange => {
                "terminal background opacity must be between 55 and 100"
            }
        })
    }
}

impl std::error::Error for AppearanceSettingsError {}

impl Default for AppearanceSettings {
    fn default() -> Self {
        Self {
            window_opacity: DEFAULT_WINDOW_OPACITY,
            terminal_background_opacity: DEFAULT_TERMINAL_BACKGROUND_OPACITY,
        }
    }
}

impl AppearanceSettings {
    pub fn try_new(
        window_opacity: u8,
        terminal_background_opacity: u8,
    ) -> Result<Self, AppearanceSettingsError> {
        if !(MIN_WINDOW_OPACITY..=MAX_WINDOW_OPACITY).contains(&window_opacity) {
            return Err(AppearanceSettingsError::WindowOpacityOutOfRange);
        }
        if !(MIN_TERMINAL_BACKGROUND_OPACITY..=MAX_TERMINAL_BACKGROUND_OPACITY)
            .contains(&terminal_background_opacity)
        {
            return Err(AppearanceSettingsError::TerminalBackgroundOpacityOutOfRange);
        }
        Ok(Self {
            window_opacity,
            terminal_background_opacity,
        })
    }

    pub fn from_storage(window: Option<&str>, terminal: Option<&str>) -> AppearanceLoadResult {
        let defaults_window = window
            .and_then(|value| value.parse::<u8>().ok())
            .filter(|value| (MIN_WINDOW_OPACITY..=MAX_WINDOW_OPACITY).contains(value));
        let defaults_terminal =
            terminal
                .and_then(|value| value.parse::<u8>().ok())
                .filter(|value| {
                    (MIN_TERMINAL_BACKGROUND_OPACITY..=MAX_TERMINAL_BACKGROUND_OPACITY)
                        .contains(value)
                });
        AppearanceLoadResult {
            settings: Self {
                window_opacity: defaults_window.unwrap_or(DEFAULT_WINDOW_OPACITY),
                terminal_background_opacity: defaults_terminal
                    .unwrap_or(DEFAULT_TERMINAL_BACKGROUND_OPACITY),
            },
            defaults_applied: defaults_window.is_none() || defaults_terminal.is_none(),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn validates_ranges_and_defaults() {
        assert_eq!(AppearanceSettings::default().window_opacity, 92);
        assert!(AppearanceSettings::try_new(69, 82).is_err());
        assert!(AppearanceSettings::try_new(92, 54).is_err());
        assert!(AppearanceSettings::try_new(70, 55).is_ok());
    }

    #[test]
    fn invalid_or_missing_storage_values_fall_back_without_silent_state() {
        let result = AppearanceSettings::from_storage(Some("101"), Some("bad"));
        assert_eq!(result.settings, AppearanceSettings::default());
        assert!(result.defaults_applied);
        let result = AppearanceSettings::from_storage(Some("80"), Some("75"));
        assert_eq!(result.settings.window_opacity, 80);
        assert!(!result.defaults_applied);
    }
}
