import { invoke } from "@tauri-apps/api/core";
import type { AppInfo, Backend } from "./backend";

export const isTauriEnvironment =
  typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

export const tauriBackend: Backend = {
  appInfo: () => invoke<AppInfo>("app_info"),
};
