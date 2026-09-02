#![forbid(unsafe_code)]

use ownterm_application::OwnTermApplication;

#[tauri::command]
fn app_info() -> AppInfo {
    let identity = OwnTermApplication::product_identity();

    AppInfo {
        name: identity.name(),
        version: identity.version(),
    }
}

#[derive(serde::Serialize)]
struct AppInfo {
    name: &'static str,
    version: &'static str,
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![app_info])
        .run(tauri::generate_context!())
        .expect("error while running OwnTerm");
}
