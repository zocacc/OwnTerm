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
  kind:
    { type: "local"; shellProfileId: string } | { type: "ssh"; hostId: string };
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

export type SessionTrustRequiredEvent = {
  version: 1;
  sessionId: string;
  destination: string;
  port: number;
  algorithm: string;
  fingerprint: string;
};

export type SessionCredentialRequiredEvent = {
  version: 1;
  sessionId: string;
  kind: "password" | "passphrase";
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
  privateKeyPath?: string;
};
export type HostGroup = { id: string; name: string; sortOrder: number };
export type SaveHostRequest = Omit<Host, "id" | "authKind"> & {
  id?: string;
  authKind?: "password" | "private_key" | "none";
  password?: string;
  privateKeyPath?: string;
  passphrase?: string;
};
export type ImportAction = "create" | "update" | "skip";
export type PortableHost = {
  name: string;
  address: string;
  port: number;
  username?: string;
  group?: string;
  tags: string[];
  favorite: boolean;
  authKind: "password" | "private_key" | "agent" | "none";
  privateKeyPath?: string;
  credentialRequired: boolean;
};
export type PortableGroup = { name: string; sortOrder: number };
export type ImportPreview = {
  groups: PortableGroup[];
  settings: Record<string, string>;
  entries: Array<{
    host: PortableHost;
    conflict: boolean;
    defaultAction: ImportAction;
  }>;
  ignored: Array<{ line: number; directive: string; reason: string }>;
};
export type ImportResult = { applied: number; credentialsToConfigure: number };
export type SaveGroupRequest = { id?: string; name: string; sortOrder: number };
export type AppearanceSettings = {
  windowOpacity: number;
  terminalBackgroundOpacity: number;
  windowOpacitySupport: "supported" | "unsupported";
  windowOpacityApplied: boolean;
  windowOpacityWarning: string | null;
  defaultsApplied: boolean;
};
export type SaveAppearanceSettingsRequest = Pick<
  AppearanceSettings,
  "windowOpacity" | "terminalBackgroundOpacity"
>;

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
  startSshSession(
    hostId: string,
    rows: number,
    columns: number,
  ): Promise<SessionDescriptor>;
  startQuickConnect(
    destination: string,
    rows: number,
    columns: number,
  ): Promise<SessionDescriptor>;
  confirmSshTrust(sessionId: string, accept: boolean): Promise<void>;
  provideSshCredential(sessionId: string, secret?: string): Promise<void>;
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
  onSessionTrustRequired: EventSubscription<SessionTrustRequiredEvent>;
  onSessionCredentialRequired: EventSubscription<SessionCredentialRequiredEvent>;
  listHosts?(search?: string): Promise<Host[]>;
  listHostGroups?(): Promise<HostGroup[]>;
  listRecentHosts?(limit?: number): Promise<Host[]>;
  saveHost?(request: SaveHostRequest): Promise<Host>;
  deleteHost?(id: string): Promise<void>;
  saveHostGroup?(request: SaveGroupRequest): Promise<HostGroup>;
  deleteHostGroup?(id: string, moveHostsToUngrouped: boolean): Promise<void>;
  recordRecentHost?(id: string): Promise<void>;
  previewImport?(
    source: "openssh" | "workspace",
    content: string,
  ): Promise<ImportPreview>;
  applyImport?(
    groups: PortableGroup[],
    settings: Record<string, string>,
    entries: Array<{ host: PortableHost; action: ImportAction }>,
  ): Promise<ImportResult>;
  exportWorkspace?(): Promise<string>;
  getAppearanceSettings?(): Promise<AppearanceSettings>;
  saveAppearanceSettings?(
    request: SaveAppearanceSettingsRequest,
  ): Promise<AppearanceSettings>;
}

export const defaultBackend = isTauriEnvironment ? tauriBackend : mockBackend;
