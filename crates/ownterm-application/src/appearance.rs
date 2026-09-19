//! Contrato tipado para perfis visuais locais de terminal.

use serde::{Deserialize, Serialize};

pub const WINDOW_OPACITY_KEY: &str = "appearance.windowOpacity";
pub const TERMINAL_BACKGROUND_OPACITY_KEY: &str = "appearance.terminalBackgroundOpacity";
pub const TERMINAL_APPEARANCE_PROFILES_KEY: &str = "appearance.terminalProfiles";
pub const ACTIVE_TERMINAL_APPEARANCE_PROFILE_KEY: &str = "appearance.activeTerminalProfile";
pub const DEFAULT_WINDOW_OPACITY: u8 = 92;
pub const MIN_WINDOW_OPACITY: u8 = 0;
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
            Self::WindowOpacityOutOfRange => "window opacity must be between 0 and 100",
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

/// A reusable xterm palette. Built-ins are copied to local storage on first
/// load, so a user can duplicate and change them without mutating the preset.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TerminalColorScheme {
    pub id: String,
    pub name: String,
    pub background: String,
    pub foreground: String,
    pub cursor: String,
    pub selection_background: String,
    pub ansi: [String; 16],
    #[serde(default)]
    pub built_in: bool,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TerminalAppearanceProfile {
    pub id: String,
    pub name: String,
    pub color_scheme_id: String,
    pub font_family: String,
    pub font_size: u8,
    pub window_opacity: u8,
    pub terminal_background_opacity: u8,
    pub use_acrylic: bool,
    #[serde(default)]
    pub built_in: bool,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TerminalAppearanceCatalog {
    pub active_profile_id: String,
    pub profiles: Vec<TerminalAppearanceProfile>,
    pub color_schemes: Vec<TerminalColorScheme>,
}

pub fn default_terminal_appearance_catalog(
    settings: AppearanceSettings,
) -> TerminalAppearanceCatalog {
    TerminalAppearanceCatalog {
        active_profile_id: "migrated-appearance".into(),
        profiles: vec![TerminalAppearanceProfile {
            id: "migrated-appearance".into(),
            name: "Migrated appearance".into(),
            color_scheme_id: "ownterm-default".into(),
            font_family: "JetBrains Mono, Cascadia Mono, Consolas, monospace".into(),
            font_size: 14,
            window_opacity: settings.window_opacity,
            terminal_background_opacity: settings.terminal_background_opacity,
            use_acrylic: true,
            built_in: false,
        }],
        color_schemes: built_in_color_schemes(),
    }
}

/// Built-in schemes are immutable product defaults. A caller may only submit
/// one when its complete payload matches the canonical definition.
pub fn is_canonical_builtin_scheme(scheme: &TerminalColorScheme) -> bool {
    !scheme.built_in
        || built_in_color_schemes()
            .iter()
            .any(|builtin| builtin == scheme)
}

pub fn built_in_color_schemes() -> Vec<TerminalColorScheme> {
    vec![
        scheme(
            "ownterm-default",
            "OwnTerm Default",
            "#0c0f15",
            "#f4f2f8",
            "#b9a7ff",
            "#6750a455",
            [
                "#151820", "#ff6b81", "#50c878", "#f0c674", "#7aa2f7", "#b9a7ff", "#78dce8",
                "#d7dae0", "#4b5263", "#ff8294", "#70e1a8", "#ffe08a", "#94b6ff", "#d3bdff",
                "#9feaf9", "#ffffff",
            ],
        ),
        scheme(
            "dracula",
            "Dracula",
            "#1E1F29",
            "#F8F8F2",
            "#BBBBBB",
            "#44475A",
            [
                "#000000", "#FF5555", "#50FA7B", "#F1FA8C", "#BD93F9", "#FF79C6", "#8BE9FD",
                "#BBBBBB", "#555555", "#FF5555", "#50FA7B", "#F1FA8C", "#BD93F9", "#FF79C6",
                "#8BE9FD", "#FFFFFF",
            ],
        ),
        scheme(
            "material-ocean",
            "MaterialOcean",
            "#0F111A",
            "#8F93A2",
            "#FFCC00",
            "#1F2233",
            [
                "#546E7A", "#FF5370", "#C3E88D", "#FFCB6B", "#82AAFF", "#C792EA", "#89DDFF",
                "#FFFFFF", "#546E7A", "#FF5370", "#C3E88D", "#FFCB6B", "#82AAFF", "#C792EA",
                "#89DDFF", "#FFFFFF",
            ],
        ),
        scheme(
            "moonlight-ii",
            "Moonlight II",
            "#222436",
            "#C8D3F5",
            "#FFFFFF",
            "#FFFFFF",
            [
                "#191A2A", "#FF757F", "#C3E88D", "#FFC777", "#82AAFF", "#C099FF", "#86E1FC",
                "#C8D3F5", "#828BB8", "#FF757F", "#C3E88D", "#FFC777", "#82AAFF", "#C099FF",
                "#86E1FC", "#C8D3F5",
            ],
        ),
        scheme(
            "tokyo-night",
            "TokyoNight",
            "#16161E",
            "#787C99",
            "#FFFFFF",
            "#FFFFFF",
            [
                "#363B54", "#F7768E", "#41A6B5", "#E0AF68", "#7AA2F7", "#BB9AF7", "#7DCFFF",
                "#787C99", "#363B54", "#F7768E", "#41A6B5", "#E0AF68", "#7AA2F7", "#BB9AF7",
                "#7DCFFF", "#ACB0D0",
            ],
        ),
    ]
}

fn scheme(
    id: &str,
    name: &str,
    background: &str,
    foreground: &str,
    cursor: &str,
    selection_background: &str,
    ansi: [&str; 16],
) -> TerminalColorScheme {
    TerminalColorScheme {
        id: id.into(),
        name: name.into(),
        background: background.into(),
        foreground: foreground.into(),
        cursor: cursor.into(),
        selection_background: selection_background.into(),
        ansi: ansi.map(str::to_owned),
        built_in: true,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn validates_ranges_and_defaults() {
        assert_eq!(AppearanceSettings::default().window_opacity, 92);
        assert!(AppearanceSettings::try_new(101, 82).is_err());
        assert!(AppearanceSettings::try_new(92, 54).is_err());
        assert!(AppearanceSettings::try_new(0, 55).is_ok());
    }

    #[test]
    fn rejects_mutated_builtin_schemes() {
        let builtin = built_in_color_schemes().into_iter().next().unwrap();
        assert!(is_canonical_builtin_scheme(&builtin));
        let mut changed = builtin;
        changed.background = "#000000".into();
        assert!(!is_canonical_builtin_scheme(&changed));
    }

    #[test]
    fn migrated_catalog_preserves_legacy_opacity_and_provides_terminal_presets() {
        let catalog =
            default_terminal_appearance_catalog(AppearanceSettings::try_new(88, 61).unwrap());
        assert_eq!(catalog.active_profile_id, "migrated-appearance");
        assert_eq!(catalog.profiles[0].window_opacity, 88);
        assert_eq!(catalog.profiles[0].terminal_background_opacity, 61);
        assert!(
            catalog
                .color_schemes
                .iter()
                .any(|scheme| scheme.name == "Dracula")
        );
        assert!(
            catalog
                .color_schemes
                .iter()
                .any(|scheme| scheme.name == "MaterialOcean")
        );
        assert!(
            catalog
                .color_schemes
                .iter()
                .any(|scheme| scheme.name == "Moonlight II")
        );
        assert!(
            catalog
                .color_schemes
                .iter()
                .any(|scheme| scheme.name == "TokyoNight")
        );
        assert!(
            catalog
                .color_schemes
                .iter()
                .all(|scheme| scheme.ansi.len() == 16)
        );
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
