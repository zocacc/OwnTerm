//! Runtime material state and the Windows Desktop Acrylic adapter.
use std::sync::{
    Arc, Mutex,
    atomic::{AtomicBool, Ordering},
};

#[derive(Default)]
pub struct NativeMaterial {
    enabled: AtomicBool,
    current: Mutex<MaterialSnapshot>,
}

#[derive(Clone, Copy, Debug, Default, PartialEq, Eq)]
pub struct MaterialSnapshot {
    pub configured: bool,
    pub revision: u64,
}

impl NativeMaterial {
    fn snapshot(&self) -> MaterialSnapshot {
        *self
            .current
            .lock()
            .unwrap_or_else(std::sync::PoisonError::into_inner)
    }

    #[cfg_attr(not(windows), allow(dead_code))]
    fn publish(&self, configured: bool) -> MaterialSnapshot {
        let mut current = self
            .current
            .lock()
            .unwrap_or_else(std::sync::PoisonError::into_inner);
        current.revision += 1;
        current.configured = configured;
        *current
    }
}

#[derive(Default)]
pub struct BackdropState {
    requested: Option<bool>,
    native: Arc<NativeMaterial>,
}

impl BackdropState {
    pub fn snapshot(&self) -> MaterialSnapshot {
        self.native.snapshot()
    }
    pub fn native(&self) -> Arc<NativeMaterial> {
        self.native.clone()
    }

    pub fn configure(
        &mut self,
        requested: bool,
        apply: impl FnOnce(bool) -> Result<(), String>,
    ) -> bool {
        if self.requested != Some(requested) {
            self.native.enabled.store(requested, Ordering::SeqCst);
            let revision = self.snapshot().revision;
            let configured = apply(requested).is_ok() && requested;
            // Windows publishes on the HWND thread before completing apply.
            // Do not overwrite that snapshot, or a later recovery notification.
            let mut current = self
                .native
                .current
                .lock()
                .unwrap_or_else(std::sync::PoisonError::into_inner);
            if current.revision == revision {
                current.revision += 1;
                current.configured = configured;
            }
            self.requested = Some(requested);
        }
        self.snapshot().configured
    }
}

#[cfg(windows)]
pub fn apply(
    window: &tauri::WebviewWindow,
    enabled: bool,
    native: Arc<NativeMaterial>,
) -> Result<(), String> {
    let (sender, receiver) = std::sync::mpsc::sync_channel(1);
    let owner = window.clone();
    // Appearance commands are async, hence not running on the HWND thread.
    // Subclass helpers MUST run on that thread, with no application-state locks
    // acquired by the callback. Snapshot locks never span dispatch/native calls.
    window
        .run_on_main_thread(move || {
            let result = windows::install_recovery(&owner, native.clone())
                .and_then(|()| windows::apply_material(&owner, enabled));
            native.publish(enabled && result.is_ok());
            let _ = sender.send(result);
        })
        .map_err(|error| error.to_string())?;
    receiver.recv().map_err(|error| error.to_string())?
}

#[cfg(windows)]
mod windows {
    use super::{Arc, NativeMaterial, Ordering};
    use tauri::Emitter;
    use windows_sys::Win32::{
        Foundation::{HWND, LPARAM, LRESULT, WPARAM},
        Graphics::Dwm::{
            DWMSBT_NONE, DWMSBT_TRANSIENTWINDOW, DWMWA_SYSTEMBACKDROP_TYPE,
            DwmExtendFrameIntoClientArea, DwmSetWindowAttribute,
        },
        UI::{
            Controls::MARGINS,
            Shell::{DefSubclassProc, GetWindowSubclass, RemoveWindowSubclass, SetWindowSubclass},
            WindowsAndMessaging::{WM_DWMCOMPOSITIONCHANGED, WM_NCDESTROY},
        },
    };
    use windows_version::OsVersion;

    struct Recovery {
        window: tauri::WebviewWindow,
        native: Arc<NativeMaterial>,
    }

    fn checked(stage: &str, result: i32) -> Result<(), String> {
        if result < 0 {
            Err(format!("{stage} failed: 0x{:08X}", result as u32))
        } else {
            Ok(())
        }
    }

    pub fn apply_material(window: &tauri::WebviewWindow, enabled: bool) -> Result<(), String> {
        if OsVersion::current() < OsVersion::new(10, 0, 0, 22_621) {
            window_vibrancy::clear_blur(window).map_err(|error| error.to_string())?;
            return if enabled {
                window_vibrancy::apply_acrylic(window, Some((20, 23, 30, 150)))
            } else {
                window_vibrancy::clear_acrylic(window)
            }
            .map_err(|error| error.to_string());
        }
        let hwnd = window.hwnd().map_err(|error| error.to_string())?.0 as HWND;
        let material = if enabled {
            DWMSBT_TRANSIENTWINDOW
        } else {
            DWMSBT_NONE
        };
        let inset = if enabled { -1 } else { 0 };
        let margins = MARGINS {
            cxLeftWidth: inset,
            cxRightWidth: inset,
            cyTopHeight: inset,
            cyBottomHeight: inset,
        };
        // SAFETY: live Tauri HWND, initialized MARGINS and correctly sized i32.
        // This runs on the HWND-owning thread; no decoration/global alpha change.
        unsafe {
            checked(
                "DwmExtendFrameIntoClientArea",
                DwmExtendFrameIntoClientArea(hwnd, &margins),
            )?;
            checked(
                "DwmSetWindowAttribute",
                DwmSetWindowAttribute(
                    hwnd,
                    DWMWA_SYSTEMBACKDROP_TYPE as u32,
                    (&material as *const i32).cast(),
                    std::mem::size_of_val(&material) as u32,
                ),
            )
        }
    }

    pub fn install_recovery(
        window: &tauri::WebviewWindow,
        native: Arc<NativeMaterial>,
    ) -> Result<(), String> {
        let hwnd = window.hwnd().map_err(|error| error.to_string())?.0 as HWND;
        let id = composition_changed as *const () as usize;
        let mut existing = 0;
        // SAFETY: executed on the HWND-owning thread; callback identity is stable.
        if unsafe { GetWindowSubclass(hwnd, Some(composition_changed), id, &mut existing) } != 0 {
            return Ok(());
        }
        let data = Box::into_raw(Box::new(Recovery {
            window: window.clone(),
            native,
        }));
        // SAFETY: data lives until WM_NCDESTROY, or is reclaimed on install failure.
        if unsafe { SetWindowSubclass(hwnd, Some(composition_changed), id, data as usize) } == 0 {
            // SAFETY: failed install never transferred ownership to the subclass.
            unsafe {
                drop(Box::from_raw(data));
            }
            return Err("SetWindowSubclass failed".into());
        }
        Ok(())
    }

    unsafe extern "system" fn composition_changed(
        hwnd: HWND,
        message: u32,
        wparam: WPARAM,
        lparam: LPARAM,
        id: usize,
        data: usize,
    ) -> LRESULT {
        // SAFETY: pointer was created by install_recovery, remains owned by this
        // subclass, and is accessed only on the HWND thread.
        let recovery = unsafe { &*(data as *const Recovery) };
        if message == WM_DWMCOMPOSITIONCHANGED && recovery.native.enabled.load(Ordering::SeqCst) {
            let result = apply_material(&recovery.window, true);
            let configured = result.is_ok();
            let snapshot = recovery.native.publish(configured);
            let payload = serde_json::json!({
                "configured": configured,
                "revision": snapshot.revision,
                "warning": result.as_ref().err().map(|_| "Acrylic recovery failed. Using an opaque fallback."),
            });
            eprintln!(
                "{}",
                serde_json::json!({ "event": "window_backdrop_recovery", "accepted": configured, "error": result.err() })
            );
            let _ = recovery.window.emit("native-backdrop-changed", payload);
        }
        // SAFETY: remove before freeing the unique callback payload. A failed
        // removal intentionally retains it rather than risk a dangling pointer.
        if message == WM_NCDESTROY
            && unsafe { RemoveWindowSubclass(hwnd, Some(composition_changed), id) } != 0
        {
            unsafe {
                drop(Box::from_raw(data as *mut Recovery));
            }
        }
        // SAFETY: always forward unhandled/default processing to the next proc.
        unsafe { DefSubclassProc(hwnd, message, wparam, lparam) }
    }
}

#[cfg(not(windows))]
pub fn apply(
    _window: &tauri::WebviewWindow,
    enabled: bool,
    _native: Arc<NativeMaterial>,
) -> Result<(), String> {
    if enabled {
        Err("Acrylic is unavailable on this platform".into())
    } else {
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::BackdropState;
    use std::sync::atomic::Ordering;

    #[test]
    fn preserves_recovery_newer_than_the_initial_apply_result() {
        let mut state = BackdropState::default();
        let native = state.native();
        assert!(!state.configure(true, |_| {
            native.publish(true);
            native.publish(false);
            Ok(())
        }));
        assert_eq!(state.snapshot().revision, 2);
        assert!(!state.snapshot().configured);
    }

    #[test]
    fn composition_recovery_updates_cached_reads_without_reapplying() {
        let mut state = BackdropState::default();
        assert!(state.configure(true, |_| Ok(())));
        let native = state.native();
        native.publish(false);
        assert!(!state.configure(true, |_| panic!("recovery owns the native result")));
        native.publish(true);
        assert!(state.configure(true, |_| panic!("do not apply on unrelated saves")));
        assert!(!state.configure(false, |_| Ok(())));
        assert!(!native.enabled.load(Ordering::SeqCst));
    }

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
