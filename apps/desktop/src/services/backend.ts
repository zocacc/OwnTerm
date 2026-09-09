import { mockBackend } from "./mock-backend";
import { isTauriEnvironment, tauriBackend } from "./tauri-backend";

export type AppInfo = {
  name: string;
  version: string;
};

export type ShellProfile = {
  id: string;
  name: string;
};

export type SessionStatus =
  | "starting"
  | "awaiting_trust"
  | "awaiting_credential"
  | "connected"
  | "disconnected"
  | "failed";

export type SessionDescriptor = {
  id: string;
  kind: { type: "local"; shellProfileId: string };
  title: string;
  status: SessionStatus;
};

export type SessionOutputEvent = {
  version: 1;
  sessionId: string;
  data: number[];
};

export type SessionStatusEvent = {
  version: 1;
  sessionId: string;
  status: SessionStatus;
  reason?: string;
};

export type SessionExitEvent = {
  version: 1;
  sessionId: string;
  exitCode?: number;
};

export type Host = {
  id: string;
  name: string;
  address: string;
  port: number;
  username?: string;
  groupId?: string;
  tags: string[];
  favorite: boolean;
  authKind: "password" | "private_key" | "agent" | "none";
};
export type HostGroup = { id: string; name: string; sortOrder: number };
export type SaveHostRequest = Omit<Host, "id" | "authKind"> & {
  id?: string;
  password?: string;
};
export type SaveGroupRequest = { id?: string; name: string; sortOrder: number };

export type Unsubscribe = () => void;
export type EventSubscription<T> = (
  handler: (event: T) => void,
) => Promise<Unsubscribe>;

export interface Backend {
  appInfo(): Promise<AppInfo>;
  listShellProfiles(): Promise<ShellProfile[]>;
  startLocalSession(
    shellProfileId: string,
    rows: number,
    columns: number,
  ): Promise<SessionDescriptor>;
  writeSession(sessionId: string, data: number[]): Promise<void>;
  resizeSession(
    sessionId: string,
    rows: number,
    columns: number,
  ): Promise<void>;
  closeSession(sessionId: string): Promise<void>;
  onSessionOutput: EventSubscription<SessionOutputEvent>;
  onSessionStatus: EventSubscription<SessionStatusEvent>;
  onSessionExit: EventSubscription<SessionExitEvent>;
  listHosts?(search?: string): Promise<Host[]>;
  listHostGroups?(): Promise<HostGroup[]>;
  listRecentHosts?(limit?: number): Promise<Host[]>;
  saveHost?(request: SaveHostRequest): Promise<Host>;
  deleteHost?(id: string): Promise<void>;
  saveHostGroup?(request: SaveGroupRequest): Promise<HostGroup>;
  deleteHostGroup?(id: string, moveHostsToUngrouped: boolean): Promise<void>;
  recordRecentHost?(id: string): Promise<void>;
}

export const defaultBackend = isTauriEnvironment ? tauriBackend : mockBackend;
