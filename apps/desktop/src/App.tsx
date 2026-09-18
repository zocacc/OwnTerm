import { Terminal, Monitor, Settings, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { UnifiedTitleBar } from "./components/UnifiedTitleBar";
import { sessionStatusLabels } from "./session-status";
import { Button } from "./components/ui/button";
import { useDialogFocus } from "./components/useDialogFocus";
import { HostsWorkspace } from "./components/HostsWorkspace";
import {
  defaultBackend,
  type AppInfo,
  type AppearanceSettings,
  type TerminalAppearanceProfile,
  type TerminalColorScheme,
  type Backend,
  type SessionDescriptor,
  type SessionCredentialRequiredEvent,
  type SessionStatusEvent,
  type SessionTrustRequiredEvent,
  type ShellProfile,
} from "./services/backend";
import {
  TerminalSurface,
  type TerminalHandle,
} from "./terminal/TerminalSurface";

type AppProps = {
  backend?: Backend;
};

type OpenSession = SessionDescriptor & {
  exitCode?: number;
  reason?: string;
};

type SshTarget = { hostId?: string; destination?: string };

const defaultScheme: TerminalColorScheme = {
  id: "ownterm-default",
  name: "OwnTerm Default",
  background: "#0c0f15",
  foreground: "#f4f2f8",
  cursor: "#b9a7ff",
  selectionBackground: "#6750a455",
  ansi: [
    "#151820",
    "#ff6b81",
    "#50c878",
    "#f0c674",
    "#7aa2f7",
    "#b9a7ff",
    "#78dce8",
    "#d7dae0",
    "#4b5263",
    "#ff8294",
    "#70e1a8",
    "#ffe08a",
    "#94b6ff",
    "#d3bdff",
    "#9feaf9",
    "#ffffff",
  ],
  builtIn: true,
};
const defaultProfile: TerminalAppearanceProfile = {
  id: "migrated-appearance",
  name: "Migrated appearance",
  colorSchemeId: defaultScheme.id,
  fontFamily: "JetBrains Mono, Cascadia Mono, Consolas, monospace",
  fontSize: 14,
  windowOpacity: 92,
  terminalBackgroundOpacity: 82,
  useAcrylic: true,
  builtIn: false,
};
const appearanceBounds = {
  windowOpacity: { min: 70, max: 100 },
  terminalBackgroundOpacity: { min: 55, max: 100 },
} as const;
const defaultAppearance: AppearanceSettings = {
  ...defaultProfile,
  windowOpacitySupport: "unsupported",
  windowOpacityApplied: false,
  windowOpacityWarning: null,
  defaultsApplied: false,
  activeProfileId: defaultProfile.id,
  profiles: [defaultProfile],
  colorSchemes: [defaultScheme],
};
function activeAppearanceProfile(appearance: AppearanceSettings) {
  return (
    appearance.profiles.find(
      (profile) => profile.id === appearance.activeProfileId,
    ) ??
    appearance.profiles[0] ??
    defaultProfile
  );
}
function schemeForProfile(
  appearance: AppearanceSettings,
  profile: TerminalAppearanceProfile,
) {
  return (
    appearance.colorSchemes.find(
      (scheme) => scheme.id === profile.colorSchemeId,
    ) ?? defaultScheme
  );
}

function App({ backend = defaultBackend }: AppProps) {
  const [appInfo, setAppInfo] = useState<AppInfo>();
  const [profiles, setProfiles] = useState<ShellProfile[]>([]);
  const [selectedProfileId, setSelectedProfileId] = useState("");
  const [sessions, setSessions] = useState<OpenSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string>();
  const [error, setError] = useState<string>();
  const [opening, setOpening] = useState(false);
  const [terminalEventsReady, setTerminalEventsReady] = useState(false);
  const [hostsRefreshToken, setHostsRefreshToken] = useState(0);
  const [connectionsOpen, setConnectionsOpen] = useState(true);
  const [appearanceOpen, setAppearanceOpen] = useState(false);
  const [appearance, setAppearance] = useState(defaultAppearance);
  const [systemFonts, setSystemFonts] = useState<string[]>([
    "Cascadia Mono",
    "Consolas",
    "JetBrains Mono",
    "Fira Code",
  ]);
  const [trustPrompt, setTrustPrompt] = useState<SessionTrustRequiredEvent>();
  const [credentialPrompt, setCredentialPrompt] =
    useState<SessionCredentialRequiredEvent>();
  const trustDialogRef = useDialogFocus<HTMLElement>(Boolean(trustPrompt));
  const credentialDialogRef = useDialogFocus<HTMLFormElement>(
    Boolean(credentialPrompt),
  );
  const credentialInput = useRef<HTMLInputElement>(null);
  const appearanceTrigger = useRef<HTMLButtonElement>(null);
  const appearanceSaveVersion = useRef(0);
  const sshTargets = useRef(new Map<string, SshTarget>());
  const terminals = useRef(new Map<string, TerminalHandle>());
  const pendingOutput = useRef(new Map<string, number[][]>());
  const pendingStatus = useRef(new Map<string, SessionStatusEvent>());
  const closedSessions = useRef(new Set<string>());
  const appearanceDialogRef = useDialogFocus<HTMLElement>(
    appearanceOpen,
    appearanceTrigger,
  );

  const reportError = useCallback((message: string) => setError(message), []);

  const registerTerminal = useCallback(
    (sessionId: string, handle?: TerminalHandle) => {
      if (!handle) {
        terminals.current.delete(sessionId);
        return;
      }
      if (closedSessions.current.has(sessionId)) {
        return;
      }
      terminals.current.set(sessionId, handle);
      const pending = pendingOutput.current.get(sessionId);
      if (pending) {
        for (const chunk of pending) {
          handle.write(chunk);
        }
        pendingOutput.current.delete(sessionId);
      }
    },
    [],
  );

  useEffect(() => {
    let mounted = true;
    const unsubscribers: Array<() => void> = [];

    const keep = (unsubscribe: () => void) => {
      if (mounted) {
        unsubscribers.push(unsubscribe);
      } else {
        unsubscribe();
      }
    };

    const outputSubscription = backend.onSessionOutput((event) => {
      if (event.version !== 1 || closedSessions.current.has(event.sessionId)) {
        return;
      }
      const terminal = terminals.current.get(event.sessionId);
      if (terminal) {
        terminal.write(event.data);
      } else {
        const chunks = pendingOutput.current.get(event.sessionId) ?? [];
        if (
          chunks.length < 64 &&
          (pendingOutput.current.has(event.sessionId) ||
            pendingOutput.current.size < 8)
        ) {
          chunks.push(event.data);
          pendingOutput.current.set(event.sessionId, chunks);
        }
      }
    });

    const statusSubscription = backend.onSessionStatus((event) => {
      if (event.version !== 1 || closedSessions.current.has(event.sessionId)) {
        return;
      }
      setSessions((current) => {
        if (!current.some((session) => session.id === event.sessionId)) {
          pendingStatus.current.set(event.sessionId, event);
          return current;
        }
        if (
          event.status === "connected" &&
          sshTargets.current.get(event.sessionId)?.hostId
        ) {
          setHostsRefreshToken((value) => value + 1);
        }
        return current.map((session) =>
          session.id === event.sessionId
            ? { ...session, status: event.status, reason: event.reason }
            : session,
        );
      });
    });

    const exitSubscription = backend.onSessionExit((event) => {
      if (event.version !== 1 || closedSessions.current.has(event.sessionId)) {
        return;
      }
      setSessions((current) =>
        current.map((session) =>
          session.id === event.sessionId
            ? {
                ...session,
                status: "disconnected",
                exitCode: event.exitCode,
              }
            : session,
        ),
      );
    });

    const trustSubscription = backend.onSessionTrustRequired((event) => {
      if (event.version === 1 && !closedSessions.current.has(event.sessionId)) {
        setTrustPrompt(event);
        setActiveSessionId(event.sessionId);
      }
    });

    const credentialSubscription = backend.onSessionCredentialRequired(
      (event) => {
        if (
          event.version === 1 &&
          !closedSessions.current.has(event.sessionId)
        ) {
          setCredentialPrompt(event);
          setActiveSessionId(event.sessionId);
        }
      },
    );

    void Promise.allSettled([
      outputSubscription,
      statusSubscription,
      exitSubscription,
      trustSubscription,
      credentialSubscription,
    ])
      .then((subscriptions) => {
        const failure = subscriptions.find(
          (subscription) => subscription.status === "rejected",
        );
        if (failure) {
          for (const subscription of subscriptions) {
            if (subscription.status === "fulfilled") {
              subscription.value();
            }
          }
          throw failure.reason;
        }
        for (const subscription of subscriptions) {
          if (subscription.status === "fulfilled") {
            keep(subscription.value);
          }
        }
        if (mounted) {
          setTerminalEventsReady(true);
        }
      })
      .catch((error: unknown) => {
        if (mounted) {
          setError("Could not prepare terminal events: " + String(error));
        }
      });

    return () => {
      mounted = false;
      for (const unsubscribe of unsubscribers) {
        unsubscribe();
      }
    };
  }, [backend]);

  useEffect(() => {
    let mounted = true;
    if (backend.listSystemFonts) {
      void backend
        .listSystemFonts()
        .then((fonts) => {
          if (mounted && fonts.length) setSystemFonts(fonts);
        })
        .catch(() => undefined);
    }
    if (!backend.getAppearanceSettings) return;
    void backend
      .getAppearanceSettings()
      .then((settings) => {
        if (mounted) setAppearance(settings);
      })
      .catch(() => {
        if (mounted) setError("Could not load appearance preferences.");
      });
    return () => {
      mounted = false;
    };
  }, [backend]);

  useEffect(() => {
    let mounted = true;
    void Promise.all([backend.appInfo(), backend.listShellProfiles()])
      .then(([info, availableProfiles]) => {
        if (!mounted) {
          return;
        }
        setAppInfo(info);
        setProfiles(availableProfiles);
        setSelectedProfileId(
          (current) => current || availableProfiles[0]?.id || "",
        );
      })
      .catch(() => {
        if (mounted) {
          setError("Could not start the OwnTerm core.");
        }
      });
    return () => {
      mounted = false;
    };
  }, [backend]);

  const activeSession = useMemo(
    () => sessions.find((session) => session.id === activeSessionId),
    [activeSessionId, sessions],
  );

  const openSession = useCallback(async () => {
    if (!selectedProfileId || opening || !terminalEventsReady) {
      return;
    }
    setOpening(true);
    setError(undefined);
    try {
      const descriptor = await backend.startLocalSession(
        selectedProfileId,
        24,
        80,
      );
      closedSessions.current.delete(descriptor.id);
      const pending = pendingStatus.current.get(descriptor.id);
      pendingStatus.current.delete(descriptor.id);
      setSessions((current) => [
        ...current,
        pending
          ? { ...descriptor, status: pending.status, reason: pending.reason }
          : descriptor,
      ]);
      setActiveSessionId(descriptor.id);
    } catch {
      setError("Could not open the selected shell.");
    } finally {
      setOpening(false);
    }
  }, [backend, opening, selectedProfileId, terminalEventsReady]);

  const closeSession = useCallback(
    (sessionId: string) => {
      closedSessions.current.add(sessionId);
      sshTargets.current.delete(sessionId);
      setTrustPrompt((current) =>
        current?.sessionId === sessionId ? undefined : current,
      );
      setCredentialPrompt((current) =>
        current?.sessionId === sessionId ? undefined : current,
      );
      pendingOutput.current.delete(sessionId);
      terminals.current.delete(sessionId);
      pendingStatus.current.delete(sessionId);

      const index = sessions.findIndex((session) => session.id === sessionId);
      const remaining = sessions.filter((session) => session.id !== sessionId);
      setSessions(remaining);
      if (activeSessionId === sessionId) {
        setActiveSessionId(
          remaining[Math.min(Math.max(index, 0), remaining.length - 1)]?.id,
        );
      }

      void backend
        .closeSession(sessionId)
        .catch(() =>
          setError(
            "A aba foi fechada, mas o processo pode ainda estar encerrando.",
          ),
        );
    },
    [activeSessionId, backend, sessions],
  );

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.ctrlKey && event.shiftKey && event.key.toLowerCase() === "t") {
        event.preventDefault();
        void openSession();
      }
      if (event.ctrlKey && event.key === "Tab" && sessions.length > 1) {
        event.preventDefault();
        const currentIndex = sessions.findIndex(
          (session) => session.id === activeSessionId,
        );
        const direction = event.shiftKey ? -1 : 1;
        const nextIndex =
          (currentIndex + direction + sessions.length) % sessions.length;
        setActiveSessionId(sessions[nextIndex]?.id);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [activeSessionId, openSession, sessions]);

  const runClipboardAction = (action: "copy" | "paste") => {
    const terminal = activeSessionId
      ? terminals.current.get(activeSessionId)
      : undefined;
    if (!terminal) {
      return;
    }
    void terminal[action]().catch(() =>
      setError(
        action === "copy"
          ? "Could not copy the selection."
          : "Could not paste into the terminal.",
      ),
    );
  };

  const requestHostConnection = useCallback(
    async (target: SshTarget) => {
      if (opening || !terminalEventsReady) return;
      setOpening(true);
      setError(undefined);
      try {
        const descriptor = target.hostId
          ? await backend.startSshSession(target.hostId, 24, 80)
          : await backend.startQuickConnect(target.destination ?? "", 24, 80);
        closedSessions.current.delete(descriptor.id);
        sshTargets.current.set(descriptor.id, target);
        const pending = pendingStatus.current.get(descriptor.id);
        pendingStatus.current.delete(descriptor.id);
        setSessions((current) => [
          ...current,
          pending
            ? { ...descriptor, status: pending.status, reason: pending.reason }
            : descriptor,
        ]);
        if (pending?.status === "connected" && target.hostId) {
          setHostsRefreshToken((value) => value + 1);
        }
        setActiveSessionId(descriptor.id);
      } catch (reason) {
        setError("Could not start the SSH connection: " + String(reason));
      } finally {
        setOpening(false);
      }
    },
    [backend, opening, terminalEventsReady],
  );

  const respondToTrust = useCallback(
    async (accept: boolean) => {
      if (!trustPrompt) return;
      const sessionId = trustPrompt.sessionId;
      setTrustPrompt(undefined);
      try {
        await backend.confirmSshTrust(sessionId, accept);
      } catch (reason) {
        setError("Could not confirm the Host identity: " + String(reason));
      }
    },
    [backend, trustPrompt],
  );

  const provideCredential = useCallback(
    async (submit: boolean) => {
      if (!credentialPrompt) return;
      const sessionId = credentialPrompt.sessionId;
      const secret = submit ? credentialInput.current?.value : undefined;
      if (credentialInput.current) credentialInput.current.value = "";
      setCredentialPrompt(undefined);
      try {
        await backend.provideSshCredential(sessionId, secret);
      } catch (reason) {
        setError("Could not provide the credential: " + String(reason));
      }
    },
    [backend, credentialPrompt],
  );

  const closeAppearance = useCallback(() => {
    setAppearanceOpen(false);
    window.setTimeout(() => {
      const terminal = activeSessionId
        ? terminals.current.get(activeSessionId)
        : undefined;
      if (terminal) terminal.focus();
    });
  }, [activeSessionId]);

  const saveAppearance = useCallback(
    (next: AppearanceSettings) => {
      const active = activeAppearanceProfile(next);
      const requested = {
        ...next,
        windowOpacity: active.windowOpacity,
        terminalBackgroundOpacity: active.terminalBackgroundOpacity,
      };
      setAppearance(requested);
      const version = ++appearanceSaveVersion.current;
      if (!backend.saveAppearanceSettings) return;
      void backend
        .saveAppearanceSettings(requested)
        .then((saved) => {
          if (version === appearanceSaveVersion.current) setAppearance(saved);
        })
        .catch(() => {
          if (version === appearanceSaveVersion.current)
            setError("Could not save appearance preferences.");
        });
    },
    [backend],
  );

  const updateActiveProfile = useCallback(
    (update: Partial<TerminalAppearanceProfile>) => {
      const active = activeAppearanceProfile(appearance);
      saveAppearance({
        ...appearance,
        profiles: appearance.profiles.map((profile) =>
          profile.id === active.id ? { ...profile, ...update } : profile,
        ),
      });
    },
    [appearance, saveAppearance],
  );

  const selectAppearanceProfile = useCallback(
    (id: string) => {
      const selected = appearance.profiles.find((profile) => profile.id === id);
      if (!selected) return;
      saveAppearance({
        ...appearance,
        activeProfileId: id,
        windowOpacity: selected.windowOpacity,
        terminalBackgroundOpacity: selected.terminalBackgroundOpacity,
      });
    },
    [appearance, saveAppearance],
  );

  const duplicateAppearanceProfile = useCallback(() => {
    const source = activeAppearanceProfile(appearance);
    const id = `profile-${crypto.randomUUID()}`;
    const copy = { ...source, id, name: `${source.name} copy`, builtIn: false };
    saveAppearance({
      ...appearance,
      activeProfileId: id,
      profiles: [...appearance.profiles, copy],
      windowOpacity: copy.windowOpacity,
      terminalBackgroundOpacity: copy.terminalBackgroundOpacity,
    });
  }, [appearance, saveAppearance]);

  const duplicateColorScheme = useCallback(() => {
    const profile = activeAppearanceProfile(appearance);
    const source = schemeForProfile(appearance, profile);
    const id = `scheme-${crypto.randomUUID()}`;
    const copy = { ...source, id, name: `${source.name} copy`, builtIn: false };
    saveAppearance({
      ...appearance,
      colorSchemes: [...appearance.colorSchemes, copy],
      profiles: appearance.profiles.map((item) =>
        item.id === profile.id ? { ...item, colorSchemeId: id } : item,
      ),
    });
  }, [appearance, saveAppearance]);

  const updateActiveScheme = useCallback(
    (update: Partial<TerminalColorScheme>) => {
      const profile = activeAppearanceProfile(appearance);
      const scheme = schemeForProfile(appearance, profile);
      if (scheme.builtIn) return;
      saveAppearance({
        ...appearance,
        colorSchemes: appearance.colorSchemes.map((item) =>
          item.id === scheme.id ? { ...item, ...update } : item,
        ),
      });
    },
    [appearance, saveAppearance],
  );

  return (
    <main className="app-shell">
      <UnifiedTitleBar
        activeSessionId={activeSessionId}
        connectionsOpen={connectionsOpen}
        onCloseSession={closeSession}
        onOpenSession={() => void openSession()}
        onSelectSession={(sessionId) => {
          setActiveSessionId(sessionId);
          terminals.current.get(sessionId)?.focus();
        }}
        onSelectedProfileChange={setSelectedProfileId}
        onToggleConnections={() => setConnectionsOpen((open) => !open)}
        opening={opening}
        profiles={profiles}
        selectedProfileId={selectedProfileId}
        sessions={sessions}
        terminalEventsReady={terminalEventsReady}
      />

      <div className="flex min-h-0 flex-1">
        <nav aria-label="Workspace" className="activity-rail">
          <button
            aria-label="Appearance settings"
            aria-pressed={appearanceOpen}
            className="rail-button appearance-button"
            onClick={() => setAppearanceOpen(true)}
            ref={appearanceTrigger}
            title="Appearance settings"
            type="button"
          >
            <Settings className="size-4" />
          </button>
        </nav>
        {connectionsOpen ? (
          <HostsWorkspace
            backend={backend}
            onOpenLocal={() => void openSession()}
            refreshToken={hostsRefreshToken}
            activeHostId={
              activeSession?.kind.type === "ssh"
                ? activeSession.kind.hostId
                : undefined
            }
            connectedHostIds={sessions
              .filter((session) => session.status === "connected")
              .flatMap((session) => {
                const hostId =
                  session.kind.type === "ssh" ? session.kind.hostId : undefined;
                return hostId ? [hostId] : [];
              })}
            onRequestConnection={requestHostConnection}
          />
        ) : null}
        <div className="terminal-workspace">
          <div className="session-info">
            <Monitor
              size={14}
              className="shrink-0 text-[var(--muted-foreground)]"
            />
            <span className="min-w-0 truncate text-[var(--strong-foreground)]">
              {activeSession ? activeSession.title : "No active session"}
            </span>
            <span className="session-kind">
              {activeSession?.kind.type === "ssh"
                ? "SSH"
                : activeSession
                  ? "Local"
                  : "Ready"}
            </span>
            {activeSession ? (
              <span
                className={`session-badge ${activeSession.status === "connected" ? "is-connected" : ""}`}
              >
                <span className={`status-dot status-${activeSession.status}`} />
                {sessionStatusLabels[activeSession.status]}
              </span>
            ) : null}
          </div>
          <section className="terminal-stage">
            {sessions.length === 0 ? (
              <div className="empty-terminal">
                <div>
                  <Terminal className="empty-terminal-icon" size={32} />
                  <p className="text-sm text-[var(--strong-foreground)]">
                    No open sessions
                  </p>
                  <p className="mt-2 text-sm text-[var(--muted-foreground)]">
                    Choose a shell and open a tab. Shortcut: Ctrl+Shift+T.
                  </p>
                </div>
              </div>
            ) : null}
            {sessions.map((session) => (
              <TerminalSurface
                active={session.id === activeSessionId}
                backend={backend}
                key={session.id}
                onError={reportError}
                onReady={registerTerminal}
                sessionId={session.id}
                profile={activeAppearanceProfile(appearance)}
                scheme={schemeForProfile(
                  appearance,
                  activeAppearanceProfile(appearance),
                )}
                terminalBackgroundOpacity={
                  activeAppearanceProfile(appearance).terminalBackgroundOpacity
                }
              />
            ))}
          </section>
        </div>
      </div>

      <footer className="statusbar">
        <div className="flex min-w-0 items-center gap-3">
          <span className="text-[var(--muted-foreground)]">
            {appInfo ? `${appInfo.name} ${appInfo.version}` : "Starting core…"}
          </span>
          {activeSession ? (
            <span role="status">
              {sessionStatusLabels[activeSession.status]}
              {activeSession.exitCode !== undefined
                ? ` · exit code ${activeSession.exitCode}`
                : ""}
              {activeSession.reason ? ` · ${activeSession.reason}` : ""}
            </span>
          ) : null}
          {error ? (
            <span className="truncate text-[var(--danger)]">{error}</span>
          ) : null}
        </div>
        <div className="flex items-center gap-1">
          {activeSession?.kind.type === "ssh" &&
          (activeSession.status === "failed" ||
            activeSession.status === "disconnected") ? (
            <button
              className="rounded px-2 py-1 text-[var(--primary)] hover:bg-[var(--control-hover)]"
              onClick={() => {
                const target = sshTargets.current.get(activeSession.id);
                if (target) void requestHostConnection(target);
              }}
              type="button"
            >
              Reconnect
            </button>
          ) : null}
          <button
            className="control-ghost"
            disabled={!activeSession}
            onClick={() => runClipboardAction("copy")}
            type="button"
          >
            Copy
          </button>
          <button
            className="control-ghost"
            disabled={!activeSession || activeSession.status !== "connected"}
            onClick={() => runClipboardAction("paste")}
            type="button"
          >
            Paste
          </button>
          <span className="ml-2 hidden text-[var(--muted-foreground)] sm:inline">
            Ctrl+Tab switches tabs
          </span>
        </div>
      </footer>

      {appearanceOpen
        ? (() => {
            const profile = activeAppearanceProfile(appearance);
            const scheme = schemeForProfile(appearance, profile);
            return (
              <div className="dialog-backdrop" role="presentation">
                <section
                  aria-describedby="appearance-description"
                  aria-labelledby="appearance-title"
                  aria-modal="true"
                  className="dialog appearance-dialog"
                  onKeyDown={(event) => {
                    if (event.key === "Escape") closeAppearance();
                  }}
                  ref={appearanceDialogRef}
                  role="dialog"
                >
                  <div className="appearance-dialog-heading">
                    <div>
                      <h2 className="font-semibold" id="appearance-title">
                        Appearance
                      </h2>
                      <p id="appearance-description">
                        Profiles are local and apply to open and future sessions
                        immediately.
                      </p>
                    </div>
                    <button
                      aria-label="Close appearance settings"
                      className="control-icon"
                      onClick={closeAppearance}
                      type="button"
                    >
                      <X size={16} />
                    </button>
                  </div>
                  <label htmlFor="appearance-profile">
                    <span>Visual profile</span>
                    <select
                      id="appearance-profile"
                      value={profile.id}
                      onChange={(event) =>
                        selectAppearanceProfile(event.target.value)
                      }
                    >
                      {appearance.profiles.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <div className="appearance-profile-actions">
                    <Button
                      onClick={duplicateAppearanceProfile}
                      variant="secondary"
                    >
                      Duplicate profile
                    </Button>
                  </div>
                  <label htmlFor="profile-name">
                    <span>Profile name</span>
                    <input
                      className="field"
                      id="profile-name"
                      value={profile.name}
                      onChange={(event) =>
                        updateActiveProfile({ name: event.target.value })
                      }
                    />
                  </label>
                  <label htmlFor="color-scheme">
                    <span>Color scheme</span>
                    <select
                      id="color-scheme"
                      value={profile.colorSchemeId}
                      onChange={(event) =>
                        updateActiveProfile({
                          colorSchemeId: event.target.value,
                        })
                      }
                    >
                      {appearance.colorSchemes.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label htmlFor="font-family">
                    <span>Font family</span>
                    <input
                      className="field"
                      id="font-family"
                      list="monospaced-fonts"
                      value={profile.fontFamily}
                      onChange={(event) =>
                        updateActiveProfile({ fontFamily: event.target.value })
                      }
                    />
                    <datalist id="monospaced-fonts">
                      {systemFonts.map((font) => (
                        <option key={font} value={font} />
                      ))}
                    </datalist>
                  </label>
                  <label htmlFor="font-size">
                    <span>
                      Font size <output>{profile.fontSize}px</output>
                    </span>
                    <input
                      aria-valuetext={`${profile.fontSize}px`}
                      id="font-size"
                      max="32"
                      min="6"
                      onChange={(event) =>
                        updateActiveProfile({
                          fontSize: Number(event.target.value),
                        })
                      }
                      type="range"
                      value={profile.fontSize}
                    />
                  </label>
                  <label htmlFor="window-opacity">
                    <span>
                      Window opacity <output>{profile.windowOpacity}%</output>
                    </span>
                    <input
                      aria-valuetext={`${profile.windowOpacity}%`}
                      id="window-opacity"
                      max={appearanceBounds.windowOpacity.max}
                      min={appearanceBounds.windowOpacity.min}
                      onChange={(event) =>
                        updateActiveProfile({
                          windowOpacity: Number(event.target.value),
                        })
                      }
                      type="range"
                      value={profile.windowOpacity}
                    />
                  </label>
                  {appearance.windowOpacityWarning ? (
                    <p className="appearance-warning" role="status">
                      {appearance.windowOpacityWarning}
                    </p>
                  ) : null}
                  <label htmlFor="terminal-background-opacity">
                    <span>
                      Terminal background opacity{" "}
                      <output>{profile.terminalBackgroundOpacity}%</output>
                    </span>
                    <input
                      aria-valuetext={`${profile.terminalBackgroundOpacity}%`}
                      id="terminal-background-opacity"
                      max={appearanceBounds.terminalBackgroundOpacity.max}
                      min={appearanceBounds.terminalBackgroundOpacity.min}
                      onChange={(event) =>
                        updateActiveProfile({
                          terminalBackgroundOpacity: Number(event.target.value),
                        })
                      }
                      type="range"
                      value={profile.terminalBackgroundOpacity}
                    />
                  </label>
                  <label className="appearance-check" htmlFor="use-acrylic">
                    <input
                      checked={profile.useAcrylic}
                      id="use-acrylic"
                      onChange={(event) =>
                        updateActiveProfile({
                          useAcrylic: event.target.checked,
                        })
                      }
                      type="checkbox"
                    />
                    Use Windows acrylic when available
                  </label>
                  <div className="appearance-colors">
                    <div>
                      <span>Scheme preview</span>
                      <div
                        className="appearance-swatch"
                        style={{
                          background: scheme.background,
                          color: scheme.foreground,
                        }}
                      >
                        <i style={{ background: scheme.cursor }} />
                        Aa
                      </div>
                    </div>
                    <Button onClick={duplicateColorScheme} variant="secondary">
                      Duplicate scheme
                    </Button>
                  </div>
                  {!scheme.builtIn ? (
                    <div className="scheme-editor">
                      <label htmlFor="scheme-name">
                        <span>Scheme name</span>
                        <input
                          className="field"
                          id="scheme-name"
                          value={scheme.name}
                          onChange={(event) =>
                            updateActiveScheme({ name: event.target.value })
                          }
                        />
                      </label>
                      {(
                        [
                          "background",
                          "foreground",
                          "cursor",
                          "selectionBackground",
                        ] as const
                      ).map((field) => (
                        <label key={field}>
                          <span>{field}</span>
                          <input
                            aria-label={field}
                            type="color"
                            value={scheme[field]}
                            onChange={(event) =>
                              updateActiveScheme({
                                [field]: event.target.value,
                              })
                            }
                          />
                        </label>
                      ))}
                      <div className="ansi-colors">
                        {scheme.ansi.map((color, index) => (
                          <label key={index}>
                            <span>ANSI {index}</span>
                            <input
                              aria-label={`ANSI ${index}`}
                              type="color"
                              value={color}
                              onChange={(event) => {
                                const ansi = [...scheme.ansi];
                                ansi[index] = event.target.value;
                                updateActiveScheme({ ansi });
                              }}
                            />
                          </label>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <p className="appearance-hint">
                      Built-in schemes are read-only. Duplicate one to edit
                      every ANSI color.
                    </p>
                  )}
                  <div className="appearance-dialog-actions">
                    <Button
                      onClick={() =>
                        updateActiveProfile({
                          windowOpacity: 92,
                          terminalBackgroundOpacity: 82,
                        })
                      }
                      variant="secondary"
                    >
                      Reset defaults
                    </Button>
                    <Button onClick={closeAppearance}>Done</Button>
                  </div>
                </section>
              </div>
            );
          })()
        : null}

      {trustPrompt ? (
        <div className="dialog-backdrop" role="presentation">
          <section
            aria-labelledby="ssh-trust-title"
            ref={trustDialogRef}
            aria-modal="true"
            className="dialog"
            role="dialog"
          >
            <h2 className="font-semibold" id="ssh-trust-title">
              Confirm Host identity
            </h2>
            <p className="mt-3 text-sm text-[var(--muted-foreground)]">
              First connection to {trustPrompt.destination}:{trustPrompt.port}.
              Confirm the fingerprint through a trusted channel.
            </p>
            <dl className="mt-3 rounded border border-[var(--border)] bg-[var(--control-surface)] p-3 font-mono text-xs">
              <dt className="text-[var(--muted-foreground)]">Algorithm</dt>
              <dd>{trustPrompt.algorithm}</dd>
              <dt className="mt-2 text-[var(--muted-foreground)]">
                Fingerprint
              </dt>
              <dd className="break-all">{trustPrompt.fingerprint}</dd>
            </dl>
            <div className="mt-4 flex justify-end gap-3">
              <button
                autoFocus
                onClick={() => void respondToTrust(false)}
                type="button"
              >
                Reject
              </button>
              <Button onClick={() => void respondToTrust(true)} type="button">
                Trust and connect
              </Button>
            </div>
          </section>
        </div>
      ) : null}

      {credentialPrompt ? (
        <div className="dialog-backdrop" role="presentation">
          <form
            aria-labelledby="ssh-credential-title"
            ref={credentialDialogRef}
            aria-modal="true"
            className="dialog"
            role="dialog"
            onSubmit={(event) => {
              event.preventDefault();
              void provideCredential(true);
            }}
          >
            <h2 className="font-semibold" id="ssh-credential-title">
              {credentialPrompt.kind === "password"
                ? "SSH password"
                : "Key passphrase"}
            </h2>
            <p className="mt-2 text-xs text-[var(--muted-foreground)]">
              The credential is used only for this attempt and is never retained
              in interface state.
            </p>
            <input
              aria-label="SSH credential"
              autoComplete="current-password"
              autoFocus
              className="field mt-4"
              ref={credentialInput}
              required
              type="password"
            />
            <div className="mt-4 flex justify-end gap-3">
              <button
                onClick={() => void provideCredential(false)}
                type="button"
              >
                Cancel
              </button>
              <Button type="submit">Connect</Button>
            </div>
          </form>
        </div>
      ) : null}
    </main>
  );
}

export default App;
