import { mockBackend } from "./mock-backend";
import { isTauriEnvironment, tauriBackend } from "./tauri-backend";

export type AppInfo = {
  name: string;
  version: string;
};

export interface Backend {
  appInfo(): Promise<AppInfo>;
}

export const defaultBackend = isTauriEnvironment ? tauriBackend : mockBackend;
