//! Native Windows window opacity spike.
//!
//! The adapter deliberately owns all HWND/style details. React and the
//! application crates only receive a capability/result contract in the
//! follow-up Appearance issue.

use std::fmt;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum WindowOpacitySupport {
    Supported,
    Unsupported,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum WindowOpacityError {
    Unsupported,
    InvalidOpacity,
    InvalidWindowHandle,
    NativeOperationFailed,
}

impl fmt::Display for WindowOpacityError {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        let message = match self {
            Self::Unsupported => "native window opacity is unsupported on this platform",
            Self::InvalidOpacity => "window opacity must be between 0 and 100",
            Self::InvalidWindowHandle => "could not obtain the native window handle",
            Self::NativeOperationFailed => "native window opacity operation failed",
        };
        formatter.write_str(message)
    }
}

#[derive(Debug, Default)]
pub struct WindowOpacityState {
    original_ex_style: Option<isize>,
}

pub const fn support() -> WindowOpacitySupport {
    if cfg!(windows) {
        WindowOpacitySupport::Supported
    } else {
        WindowOpacitySupport::Unsupported
    }
}

pub const fn opacity_to_alpha(opacity: u8) -> Option<u8> {
    if opacity > 100 {
        return None;
    }
    Some(((opacity as u16 * 255 + 50) / 100) as u8)
}

#[cfg(windows)]
pub fn apply(
    window: &tauri::Window,
    opacity: u8,
    state: &mut WindowOpacityState,
) -> Result<(), WindowOpacityError> {
    use windows_sys::Win32::Foundation::HWND;
    use windows_sys::Win32::UI::WindowsAndMessaging::{
        GWL_EXSTYLE, GetWindowLongPtrW, LWA_ALPHA, SetLayeredWindowAttributes, SetWindowLongPtrW,
        WS_EX_LAYERED,
    };

    let alpha = opacity_to_alpha(opacity).ok_or(WindowOpacityError::InvalidOpacity)?;
    let hwnd: HWND = window
        .hwnd()
        .map_err(|_| WindowOpacityError::InvalidWindowHandle)?
        .0 as HWND;
    let original_style = *state
        .original_ex_style
        .get_or_insert_with(|| unsafe { GetWindowLongPtrW(hwnd, GWL_EXSTYLE) });
    let layered_style = original_style | WS_EX_LAYERED as isize;

    if unsafe { SetWindowLongPtrW(hwnd, GWL_EXSTYLE, layered_style) } == 0 && original_style != 0 {
        return Err(WindowOpacityError::NativeOperationFailed);
    }
    if unsafe { SetLayeredWindowAttributes(hwnd, 0, alpha, LWA_ALPHA) } == 0 {
        unsafe { SetWindowLongPtrW(hwnd, GWL_EXSTYLE, original_style) };
        return Err(WindowOpacityError::NativeOperationFailed);
    }

    if opacity == 100 && original_style & WS_EX_LAYERED as isize == 0 {
        if unsafe { SetWindowLongPtrW(hwnd, GWL_EXSTYLE, original_style) } == 0
            && original_style != 0
        {
            return Err(WindowOpacityError::NativeOperationFailed);
        }
    }
    Ok(())
}

#[cfg(not(windows))]
pub fn apply(
    _window: &tauri::Window,
    _opacity: u8,
    _state: &mut WindowOpacityState,
) -> Result<(), WindowOpacityError> {
    Err(WindowOpacityError::Unsupported)
}

#[cfg(test)]
mod tests {
    use super::{WindowOpacitySupport, opacity_to_alpha, support};

    #[test]
    fn converts_percentages_to_windows_alpha() {
        assert_eq!(opacity_to_alpha(0), Some(0));
        assert_eq!(opacity_to_alpha(70), Some(179));
        assert_eq!(opacity_to_alpha(92), Some(235));
        assert_eq!(opacity_to_alpha(100), Some(255));
        assert_eq!(opacity_to_alpha(101), None);
    }

    #[test]
    fn reports_platform_capability_without_touching_a_window() {
        assert_eq!(support(), WindowOpacitySupport::Unsupported);
    }
}
