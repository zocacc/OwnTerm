//! Runtime material state and the Windows Desktop Acrylic adapter.

#[derive(Default)]
pub struct BackdropState {
    requested: Option<bool>,
    configured: bool,
}

impl BackdropState {
    pub fn configure(
        &mut self,
        requested: bool,
        apply: impl FnOnce(bool) -> Result<(), String>,
    ) -> bool {
        if self.requested != Some(requested) {
            self.configured = apply(requested).is_ok() && requested;
            self.requested = Some(requested);
        }
        self.configured
    }
}

#[cfg(windows)]
pub fn apply(window: &tauri::WebviewWindow, enabled: bool) -> Result<(), String> {
    use windows_sys::Win32::Foundation::HWND;
    use windows_sys::Win32::Graphics::Dwm::{
        DWMSBT_NONE, DWMSBT_TRANSIENTWINDOW, DWMWA_SYSTEMBACKDROP_TYPE, DwmSetWindowAttribute,
    };
    use windows_version::OsVersion;

    if OsVersion::current() >= OsVersion::new(10, 0, 0, 22_621) {
        let hwnd = window.hwnd().map_err(|error| error.to_string())?.0 as HWND;
        let material = if enabled {
            DWMSBT_TRANSIENTWINDOW
        } else {
            DWMSBT_NONE
        };
        // SAFETY: Tauri owns this live HWND; material is an initialized i32 and
        // DWM reads exactly its size synchronously. Check the actual HRESULT:
        // window-vibrancy 0.6 discards it for this documented API.
        let result = unsafe {
            DwmSetWindowAttribute(
                hwnd,
                DWMWA_SYSTEMBACKDROP_TYPE as u32,
                (&material as *const i32).cast(),
                std::mem::size_of_val(&material) as u32,
            )
        };
        if result < 0 {
            return Err(format!(
                "DwmSetWindowAttribute failed: 0x{:08X}",
                result as u32
            ));
        }
        return Ok(());
    }

    // Keep the existing adapter on older Windows. Its Ok result only confirms
    // that the request was accepted; visual composition still needs Windows QA.
    window_vibrancy::clear_blur(window).map_err(|error| error.to_string())?;
    if enabled {
        window_vibrancy::apply_acrylic(window, Some((20, 23, 30, 150)))
    } else {
        window_vibrancy::clear_acrylic(window)
    }
    .map_err(|error| error.to_string())
}

#[cfg(not(windows))]
pub fn apply(_window: &tauri::WebviewWindow, enabled: bool) -> Result<(), String> {
    if enabled {
        Err("Acrylic is unavailable on this platform".into())
    } else {
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::BackdropState;

    #[test]
    fn shares_a_successful_material_across_reads_and_unrelated_saves() {
        let mut state = BackdropState::default();
        assert!(state.configure(true, |_| Ok(())));
        assert!(state.configure(true, |_| panic!("material already configured")));
    }

    #[test]
    fn keeps_native_failure_opaque_until_material_is_explicitly_toggled() {
        let mut state = BackdropState::default();
        assert!(!state.configure(true, |_| Err("DWM rejected Acrylic".into())));
        assert!(!state.configure(true, |_| panic!("do not retry on every slider")));
        assert!(!state.configure(false, |_| Ok(())));
        assert!(state.configure(true, |_| Ok(())));
    }

    #[test]
    fn clears_material_when_disabled_and_restores_it_when_enabled() {
        let mut state = BackdropState::default();
        assert!(state.configure(true, |_| Ok(())));
        assert!(!state.configure(false, |enabled| {
            assert!(!enabled);
            Ok(())
        }));
        assert!(!state.configure(false, |_| panic!("already disabled")));
        assert!(state.configure(true, |_| Ok(())));
    }
}
