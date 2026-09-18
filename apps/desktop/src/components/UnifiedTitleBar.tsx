import {
  ChevronDown,
  PanelLeft,
  Plus,
  Server,
  Terminal,
  X,
} from "lucide-react";
import type { KeyboardEvent, RefObject } from "react";
import type { SessionDescriptor, ShellProfile } from "../services/backend";
import { sessionStatusLabels } from "../session-status";
import { WindowControls } from "./WindowControls";

type UnifiedTitleBarProps = {
  connectionsOpen: boolean;
  connectionsTriggerRef?: RefObject<HTMLButtonElement | null>;
  onCloseSession(sessionId: string): void;
  onOpenSession(): void;
  onSelectSession(sessionId: string): void;
  onToggleConnections(): void;
  opening: boolean;
  profiles: ShellProfile[];
  selectedProfileId: string;
  sessions: SessionDescriptor[];
  terminalEventsReady: boolean;
  activeSessionId?: string;
  onSelectedProfileChange(profileId: string): void;
};

type ConnectionDrawerTriggerProps = Pick<
  UnifiedTitleBarProps,
  "connectionsOpen" | "onToggleConnections"
>;
type SessionTabsProps = Pick<
  UnifiedTitleBarProps,
  "activeSessionId" | "onCloseSession" | "onSelectSession" | "sessions"
>;
type NewSessionActionsProps = Pick<
  UnifiedTitleBarProps,
  | "onOpenSession"
  | "onSelectedProfileChange"
  | "opening"
  | "profiles"
  | "selectedProfileId"
  | "terminalEventsReady"
>;

function ConnectionDrawerTrigger({
  connectionsOpen,
  connectionsTriggerRef,
  onToggleConnections,
}: ConnectionDrawerTriggerProps &
  Pick<UnifiedTitleBarProps, "connectionsTriggerRef">) {
  const label = connectionsOpen ? "Collapse connections" : "Expand connections";

  return (
    <button
      aria-label={label}
      aria-pressed={connectionsOpen}
      className="titlebar-connections control-icon"
      onClick={onToggleConnections}
      ref={connectionsTriggerRef}
      title={label}
      type="button"
    >
      <PanelLeft size={16} />
    </button>
  );
}

function SessionTabs({
  activeSessionId,
  onCloseSession,
  onSelectSession,
  sessions,
}: SessionTabsProps) {
  const moveFocus = (event: KeyboardEvent<HTMLDivElement>) => {
    const tab = event.target;
    if (
      !(tab instanceof HTMLElement) ||
      tab.getAttribute("role") !== "tab" ||
      sessions.length === 0
    ) {
      return;
    }

    const currentIndex = sessions.findIndex(
      (session) => `session-tab-${session.id}` === tab.id,
    );
    if (currentIndex < 0) return;
    const selectedIndex = currentIndex;
    const lastIndex = sessions.length - 1;
    let nextIndex: number | undefined;

    if (event.key === "ArrowRight")
      nextIndex = (selectedIndex + 1) % sessions.length;
    if (event.key === "ArrowLeft")
      nextIndex = (selectedIndex - 1 + sessions.length) % sessions.length;
    if (event.key === "Home") nextIndex = 0;
    if (event.key === "End") nextIndex = lastIndex;
    if (nextIndex === undefined) return;

    event.preventDefault();
    const nextSession = sessions[nextIndex];
    onSelectSession(nextSession.id);
    document.getElementById(`session-tab-${nextSession.id}`)?.focus();
  };

  return (
    <div
      aria-label="Sessions"
      aria-orientation="horizontal"
      className="session-tabs"
      onKeyDown={moveFocus}
      role="tablist"
    >
      {sessions.map((session) => {
        const statusId = `session-status-${session.id}`;
        const kindLabel = session.kind.type === "ssh" ? "SSH" : "Local shell";
        return (
          <div
            className={
              session.id === activeSessionId
                ? "session-tab is-active"
                : "session-tab"
            }
            key={session.id}
          >
            <button
              aria-controls={`terminal-${session.id}`}
              aria-current={session.id === activeSessionId ? "page" : undefined}
              aria-describedby={statusId}
              aria-selected={session.id === activeSessionId}
              className="flex min-w-0 flex-1 items-center gap-2 text-left text-xs"
              id={`session-tab-${session.id}`}
              onClick={() => onSelectSession(session.id)}
              role="tab"
              tabIndex={session.id === activeSessionId ? 0 : -1}
              type="button"
            >
              <span
                aria-hidden="true"
                className="session-type"
                title={kindLabel}
              >
                {session.kind.type === "ssh" ? (
                  <Server size={14} />
                ) : (
                  <Terminal size={14} />
                )}
              </span>
              <span
                className={`status-dot status-${session.status}`}
                title={sessionStatusLabels[session.status]}
              />
              <span className="truncate">{session.title}</span>
            </button>
            <span className="sr-only" id={statusId}>
              {sessionStatusLabels[session.status]}
            </span>
            <button
              aria-label={`Close ${session.title}`}
              className="control-icon text-base"
              onClick={() => onCloseSession(session.id)}
              type="button"
            >
              <X size={14} />
            </button>
          </div>
        );
      })}
    </div>
  );
}

function NewSessionActions({
  onOpenSession,
  onSelectedProfileChange,
  opening,
  profiles,
  selectedProfileId,
  terminalEventsReady,
}: NewSessionActionsProps) {
  return (
    <div className="tab-actions">
      <button
        aria-label={
          opening ? "Opening…" : terminalEventsReady ? "New tab" : "Preparing…"
        }
        className="control-icon"
        disabled={!selectedProfileId || opening || !terminalEventsReady}
        onClick={onOpenSession}
        title="New tab (Ctrl+Shift+T)"
        type="button"
      >
        <Plus size={17} />
      </button>
      <div className="shell-picker" title="Shell profile">
        <ChevronDown aria-hidden="true" size={16} />
        <label className="sr-only" htmlFor="shell-profile">
          Shell profile
        </label>
        <select
          disabled={profiles.length === 0}
          id="shell-profile"
          onChange={(event) => onSelectedProfileChange(event.target.value)}
          value={selectedProfileId}
        >
          {profiles.length === 0 ? (
            <option>No shell available</option>
          ) : (
            profiles.map((profile) => (
              <option key={profile.id} value={profile.id}>
                {profile.name}
              </option>
            ))
          )}
        </select>
      </div>
    </div>
  );
}

function TitlebarDragRegion() {
  return <div className="titlebar-space" data-tauri-drag-region />;
}

export function UnifiedTitleBar(props: UnifiedTitleBarProps) {
  return (
    <header className="titlebar">
      <ConnectionDrawerTrigger
        connectionsOpen={props.connectionsOpen}
        connectionsTriggerRef={props.connectionsTriggerRef}
        onToggleConnections={props.onToggleConnections}
      />
      <SessionTabs
        activeSessionId={props.activeSessionId}
        onCloseSession={props.onCloseSession}
        onSelectSession={props.onSelectSession}
        sessions={props.sessions}
      />
      <NewSessionActions
        onOpenSession={props.onOpenSession}
        onSelectedProfileChange={props.onSelectedProfileChange}
        opening={props.opening}
        profiles={props.profiles}
        selectedProfileId={props.selectedProfileId}
        terminalEventsReady={props.terminalEventsReady}
      />
      <TitlebarDragRegion />
      <WindowControls />
    </header>
  );
}
