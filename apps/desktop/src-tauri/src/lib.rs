#![forbid(unsafe_code)]

use ownterm_application::OwnTermApplication;
use ownterm_application::vault::{SecretRef, SecretVault};

mod vault;

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

#[tauri::command]
fn vault_probe() -> Result<(), String> {
    vault::SystemVault
        .read(&SecretRef::try_new("ownterm-probe").expect("static credential reference"))
        .map(|_| ())
        .map_err(|error| format!("{error:?}"))
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![app_info, vault_probe])
        .run(tauri::generate_context!())
        .expect("error while running OwnTerm");
}
