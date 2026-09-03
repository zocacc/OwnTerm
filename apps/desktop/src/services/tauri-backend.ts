import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import type {
  AppInfo,
  Backend,
  SessionDescriptor,
  SessionExitEvent,
  SessionOutputEvent,
  SessionStatusEvent,
  ShellProfile,
} from "./backend";

export const isTauriEnvironment =
  typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

export const tauriBackend: Backend = {
  appInfo: () => invoke<AppInfo>("app_info"),
  listShellProfiles: () => invoke<ShellProfile[]>("list_shell_profiles"),
  startLocalSession: (shellProfileId, rows, columns) =>
    invoke<SessionDescriptor>("start_local_session", {
      request: { shellProfileId, rows, columns },
    }),
  writeSession: (sessionId, data) =>
    invoke<void>("write_session", { request: { sessionId, data } }),
  resizeSession: (sessionId, rows, columns) =>
    invoke<void>("resize_session", {
      request: { sessionId, rows, columns },
    }),
  closeSession: (sessionId) =>
    invoke<void>("close_session", { request: { sessionId } }),
  onSessionOutput: (handler) =>
    listen<SessionOutputEvent>("session.output.v1", (event) =>
      handler(event.payload),
    ),
  onSessionStatus: (handler) =>
    listen<SessionStatusEvent>("session.status.v1", (event) =>
      handler(event.payload),
    ),
  onSessionExit: (handler) =>
    listen<SessionExitEvent>("session.exit.v1", (event) =>
      handler(event.payload),
    ),
};
