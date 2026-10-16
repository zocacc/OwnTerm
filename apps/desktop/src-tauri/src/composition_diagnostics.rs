//! Temporary, read-only measurements for the no-xterm Windows test.
use serde::Serialize;
use tauri::Manager;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CompositionReport {
    platform: &'static str,
    app_version: String,
    build_run_id: Option<&'static str>,
    webview_runtime: Option<String>,
    tauri_window_count: usize,
    runtime_theme: Option<String>,
    configured_transparent: Option<bool>,
    configured_decorations: Option<bool>,
    runtime_decorations: Option<bool>,
    backdrop_configured: bool,
    backdrop_revision: u64,
    windows: Option<WindowsComposition>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct WindowsComposition {
    os_version: String,
    window_style: String,
    extended_style: String,
    layered_window: bool,
    caption_style_flag: bool,
    system_backdrop_type: Option<i32>,
    caption_button_bounds: Option<[i32; 4]>,
    webview_background_rgba: Option<[u8; 4]>,
    errors: Vec<String>,
}

pub fn inspect(
    window: &tauri::WebviewWindow,
    material: super::backdrop::MaterialSnapshot,
) -> Result<CompositionReport, String> {
    let app = window.app_handle();
    let config = app
        .config()
        .app
        .windows
        .iter()
        .find(|config| config.label == window.label());
    let report = CompositionReport {
        platform: std::env::consts::OS,
        app_version: app.package_info().version.to_string(),
        build_run_id: option_env!("GITHUB_RUN_ID"),
        webview_runtime: tauri::webview_version().ok(),
        tauri_window_count: app.webview_windows().len(),
        runtime_theme: window.theme().ok().map(|theme| format!("{theme:?}")),
        configured_transparent: config.map(|config| config.transparent),
        configured_decorations: config.map(|config| config.decorations),
        runtime_decorations: window.is_decorated().ok(),
        backdrop_configured: material.configured,
        backdrop_revision: material.revision,
        windows: None,
    };
    #[cfg(windows)]
    {
        let (sender, receiver) = std::sync::mpsc::sync_channel(1);
        let owner = window.clone();
        // Both HWND inspection and the COM getter run on the WebView thread.
        window
            .with_webview(move |platform| {
                let mut report = report;
                report.windows = Some(windows::inspect(&owner, platform.controller()));
                let _ = sender.send(report);
            })
            .map_err(|error| error.to_string())?;
        receiver.recv().map_err(|error| error.to_string())
    }
    #[cfg(not(windows))]
    Ok(report)
}

#[cfg(windows)]
mod windows {
    use super::WindowsComposition;
    use webview2_com::Microsoft::Web::WebView2::Win32::{
        COREWEBVIEW2_COLOR, ICoreWebView2Controller, ICoreWebView2Controller2,
    };
    use windows_core::Interface;
    use windows_sys::Win32::{
        Foundation::{GetLastError, HWND, RECT, SetLastError},
        Graphics::Dwm::{
            DWMWA_CAPTION_BUTTON_BOUNDS, DWMWA_SYSTEMBACKDROP_TYPE, DwmGetWindowAttribute,
        },
        UI::WindowsAndMessaging::{
            GWL_EXSTYLE, GWL_STYLE, GetWindowLongPtrW, IsIconic, WS_CAPTION, WS_EX_LAYERED,
        },
    };

    fn style(hwnd: HWND, index: i32, errors: &mut Vec<String>) -> isize {
        // SAFETY: live HWND from Tauri; immediately check last-error for the zero result.
        unsafe {
            SetLastError(0);
            let value = GetWindowLongPtrW(hwnd, index);
            let error = GetLastError();
            if value == 0 && error != 0 {
                errors.push(format!("GetWindowLongPtrW({index}) failed: {error}"));
            }
            value
        }
    }

    pub fn inspect(
        window: &tauri::WebviewWindow,
        controller: ICoreWebView2Controller,
    ) -> WindowsComposition {
        let mut result = WindowsComposition {
            os_version: format!("{:?}", windows_version::OsVersion::current()),
            window_style: String::new(),
            extended_style: String::new(),
            layered_window: false,
            caption_style_flag: false,
            system_backdrop_type: None,
            caption_button_bounds: None,
            webview_background_rgba: None,
            errors: Vec::new(),
        };
        if let Ok(handle) = window.hwnd() {
            let hwnd = handle.0 as HWND;
            let window_style = style(hwnd, GWL_STYLE, &mut result.errors) as u32;
            let extended_style = style(hwnd, GWL_EXSTYLE, &mut result.errors) as u32;
            result.window_style = format!("0x{window_style:08X}");
            result.extended_style = format!("0x{extended_style:08X}");
            result.layered_window = extended_style & WS_EX_LAYERED != 0;
            // Tao retains these flags for window behavior. A caption flag alone
            // is NOT evidence that a second native titlebar is being rendered.
            result.caption_style_flag = window_style & WS_CAPTION != 0;
            let mut backdrop = 0_i32;
            // SAFETY: initialized buffers of precisely the API-required sizes,
            // live HWND; caller executes on the owning WebView thread.
            unsafe {
                let status = DwmGetWindowAttribute(
                    hwnd,
                    DWMWA_SYSTEMBACKDROP_TYPE as u32,
                    (&mut backdrop as *mut i32).cast(),
                    std::mem::size_of_val(&backdrop) as u32,
                );
                if status >= 0 {
                    result.system_backdrop_type = Some(backdrop);
                } else {
                    result.errors.push(format!(
                        "DWM backdrop query failed: 0x{:08X}",
                        status as u32
                    ));
                }
                if IsIconic(hwnd) == 0 {
                    let mut bounds = RECT::default();
                    let status = DwmGetWindowAttribute(
                        hwnd,
                        DWMWA_CAPTION_BUTTON_BOUNDS as u32,
                        (&mut bounds as *mut RECT).cast(),
                        std::mem::size_of_val(&bounds) as u32,
                    );
                    if status >= 0 {
                        result.caption_button_bounds =
                            Some([bounds.left, bounds.top, bounds.right, bounds.bottom]);
                    } else {
                        result
                            .errors
                            .push(format!("DWM caption query failed: 0x{:08X}", status as u32));
                    }
                }
            }
        } else {
            result.errors.push("Could not obtain the live HWND".into());
        }
        let background = controller
            .cast::<ICoreWebView2Controller2>()
            .and_then(|controller| {
                let mut color = COREWEBVIEW2_COLOR::default();
                // SAFETY: queried COM interface, initialized color; executing on its owning thread.
                unsafe {
                    controller.DefaultBackgroundColor(&mut color)?;
                }
                Ok([color.R, color.G, color.B, color.A])
            });
        match background {
            Ok(color) => result.webview_background_rgba = Some(color),
            Err(error) => result
                .errors
                .push(format!("WebView2 background query failed: {error}")),
        }
        result
    }
}
