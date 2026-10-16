import { ChevronDown, Plus, Settings, X } from "lucide-react";
import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import type { SessionDescriptor, ShellProfile } from "../services/backend";
import { sessionStatusLabels } from "../session-status";
import { WindowControls } from "./WindowControls";

type Props = {
  sessions: SessionDescriptor[];
  activeId?: string;
  profiles: ShellProfile[];
  opening: boolean;
  ready: boolean;
  settingsOpen: boolean;
  onSelect(id: string): void;
  onClose(id: string): void;
  onNew(id?: string): void;
  onSettings(): void;
  onCloseWindow(): void;
};
export function TitleBar(props: Props) {
  const [menuOpen, setMenuOpen] = useState(false);
  const root = useRef<HTMLElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const activeTab = useRef<HTMLButtonElement>(null);
  const hide = () => {
    setMenuOpen(false);
    trigger.current?.focus();
  };
  useEffect(() => {
    activeTab.current?.scrollIntoView?.({
      block: "nearest",
      inline: "nearest",
    });
  }, [props.activeId]);
  useEffect(() => {
    if (!menuOpen) return;
    const pointer = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setMenuOpen(false);
    };
    document.addEventListener("pointerdown", pointer);
    return () => document.removeEventListener("pointerdown", pointer);
  }, [menuOpen]);
  const tabsKey = (event: KeyboardEvent) => {
    const index = props.sessions.findIndex(
      (item) => item.id === props.activeId,
    );
    const next =
      event.key === "ArrowRight"
        ? (index + 1) % props.sessions.length
        : event.key === "ArrowLeft"
          ? (index - 1 + props.sessions.length) % props.sessions.length
          : event.key === "Home"
            ? 0
            : event.key === "End"
              ? props.sessions.length - 1
              : undefined;
    if (next === undefined || !props.sessions[next]) return;
    event.preventDefault();
    props.onSelect(props.sessions[next].id);
    requestAnimationFrame(() =>
      document
        .getElementById(`session-tab-${props.sessions[next].id}`)
        ?.focus(),
    );
  };
  const menuKey = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape") {
      event.preventDefault();
      hide();
      return;
    }
    const items = [
      ...event.currentTarget.querySelectorAll<HTMLButtonElement>(
        '[role="menuitem"]',
      ),
    ];
    const index = items.indexOf(event.target as HTMLButtonElement);
    const next =
      event.key === "ArrowDown"
        ? (index + 1) % items.length
        : event.key === "ArrowUp"
          ? (index - 1 + items.length) % items.length
          : event.key === "Home"
            ? 0
            : event.key === "End"
              ? items.length - 1
              : undefined;
    if (next === undefined) return;
    event.preventDefault();
    items[next]?.focus();
  };
  return (
    <header className="titlebar" ref={root}>
      <span className="app-name" data-tauri-drag-region>
        OwnTerm
      </span>
      <div
        className="session-tabs"
        role="tablist"
        aria-label="Sessions"
        onKeyDown={tabsKey}
      >
        {props.sessions.map((session) => (
          <div
            className={
              session.id === props.activeId
                ? "session-tab is-active"
                : "session-tab"
            }
            key={session.id}
          >
            <button
              id={`session-tab-${session.id}`}
              role="tab"
              aria-selected={session.id === props.activeId}
              aria-controls={`terminal-${session.id}`}
              tabIndex={session.id === props.activeId ? 0 : -1}
              ref={session.id === props.activeId ? activeTab : undefined}
              onClick={() => props.onSelect(session.id)}
            >
              <span
                className={`status-dot status-${session.status}`}
                aria-label={sessionStatusLabels[session.status]}
              />
              <span className="tab-label">{session.title}</span>
            </button>
            <button
              className="tab-close"
              aria-label={`Close ${session.title}`}
              onClick={() => props.onClose(session.id)}
            >
              <X size={12} />
            </button>
          </div>
        ))}
      </div>
      <div className="session-actions">
        <button
          className="icon-button"
          aria-label="New tab"
          title="New tab (Ctrl+Shift+T)"
          disabled={!props.ready || props.opening || !props.profiles.length}
          onClick={() => props.onNew()}
        >
          <Plus size={16} />
        </button>
        <button
          className="icon-button"
          ref={trigger}
          aria-label="Choose shell"
          aria-haspopup="menu"
          aria-expanded={menuOpen}
          disabled={!props.ready || props.opening || !props.profiles.length}
          onClick={() => setMenuOpen(!menuOpen)}
        >
          <ChevronDown size={13} />
        </button>
        {menuOpen ? (
          <div
            className="shell-menu"
            role="menu"
            aria-label="Local shells"
            onKeyDown={menuKey}
          >
            {props.profiles.map((profile, index) => (
              <button
                autoFocus={index === 0}
                role="menuitem"
                key={profile.id}
                onClick={() => {
                  props.onNew(profile.id);
                  setMenuOpen(false);
                }}
              >
                {profile.name}
              </button>
            ))}
          </div>
        ) : null}
      </div>
      <div className="titlebar-drag" data-tauri-drag-region />
      <button
        className="icon-button"
        aria-label="Appearance settings"
        aria-expanded={props.settingsOpen}
        onClick={props.onSettings}
      >
        <Settings size={16} />
      </button>
      <WindowControls onClose={props.onCloseWindow} />
    </header>
  );
}
