import { PanelLeft, Terminal } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "./components/ui/button";
import { useDialogFocus } from "./components/useDialogFocus";
import { HostsWorkspace } from "./components/HostsWorkspace";
import ownTermLogo from "./assets/svg/ownterm-logo.svg";
import {
  defaultBackend,
  type AppInfo,
  type Backend,
  type SessionDescriptor,
  type SessionCredentialRequiredEvent,
  type SessionStatus,
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

const statusLabels: Record<SessionStatus, string> = {
  starting: "Starting",
  awaiting_trust: "Awaiting trust",
  awaiting_credential: "Awaiting credential",
  connected: "Connected",
  disconnected: "Closed",
  failed: "Failed",
};

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
  const [trustPrompt, setTrustPrompt] = useState<SessionTrustRequiredEvent>();
  const [credentialPrompt, setCredentialPrompt] =
    useState<SessionCredentialRequiredEvent>();
  const trustDialogRef = useDialogFocus<HTMLElement>(Boolean(trustPrompt));
  const credentialDialogRef = useDialogFocus<HTMLFormElement>(
    Boolean(credentialPrompt),
  );
  const credentialInput = useRef<HTMLInputElement>(null);
  const sshTargets = useRef(new Map<string, SshTarget>());
  const terminals = useRef(new Map<string, TerminalHandle>());
  const pendingOutput = useRef(new Map<string, number[][]>());
  const pendingStatus = useRef(new Map<string, SessionStatusEvent>());
  const closedSessions = useRef(new Set<string>());

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

  return (
    <main className="flex h-screen min-h-[480px] flex-col overflow-hidden bg-[var(--background)] text-[var(--foreground)]">
      <header className="flex h-11 shrink-0 items-center justify-between border-b border-[var(--hairline)] bg-[var(--titlebar)] px-3 backdrop-blur-xl">
        <div className="flex min-w-0 items-center gap-2.5 pr-4">
          <img alt="" className="size-6 rounded-[5px]" src={ownTermLogo} />
          <h1 className="text-[12.5px] font-medium tracking-[0.01em] text-[var(--strong-foreground)]">
            OwnTerm
          </h1>
          <span className="hidden h-4 w-px bg-[var(--hairline)] sm:block" />
          <span className="hidden text-[11px] text-[var(--muted-foreground)] sm:inline">
            Terminal workspace
          </span>
        </div>
        <nav
          aria-label="Sessions"
          className="flex min-w-0 flex-1 items-stretch gap-0 overflow-x-auto"
        >
          {sessions.map((session) => (
            <div
              className={
                session.id === activeSessionId
                  ? "relative flex h-full min-w-40 items-center gap-2 border-r border-[var(--hairline)] bg-[var(--terminal)] px-3 before:absolute before:inset-x-0 before:top-0 before:h-0.5 before:bg-[var(--primary)]"
                  : "flex h-full min-w-40 items-center gap-2 border-r border-[var(--hairline)] px-3 text-[var(--muted-foreground)] transition-colors hover:bg-[var(--control-hover)] hover:text-[var(--foreground)]"
              }
              key={session.id}
            >
              <button
                aria-current={
                  session.id === activeSessionId ? "page" : undefined
                }
                className="flex min-w-0 flex-1 items-center gap-2 text-left text-xs"
                onClick={() => {
                  setActiveSessionId(session.id);
                  terminals.current.get(session.id)?.focus();
                }}
                type="button"
              >
                <span
                  className={`status-dot status-${session.status}`}
                  title={statusLabels[session.status]}
                />
                <span className="truncate">{session.title}</span>
              </button>
              <button
                aria-label={`Close ${session.title}`}
                className="control-icon text-base"
                onClick={() => closeSession(session.id)}
                type="button"
              >
                ×
              </button>
            </div>
          ))}
        </nav>
        <div className="flex shrink-0 items-center gap-2">
          <label className="sr-only" htmlFor="shell-profile">
            Shell profile
          </label>
          <select
            className="h-7 max-w-48 rounded-md border border-[var(--hairline)] bg-[var(--control-surface)] px-2 text-[11px] text-[var(--foreground)] outline-none transition-colors hover:bg-[var(--control-hover)] focus:border-[var(--primary)]"
            disabled={profiles.length === 0}
            id="shell-profile"
            onChange={(event) => setSelectedProfileId(event.target.value)}
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
          <Button
            className="h-7 rounded-md px-2.5 py-0 text-[11px]"
            disabled={!selectedProfileId || opening || !terminalEventsReady}
            onClick={() => void openSession()}
          >
            {opening
              ? "Opening…"
              : terminalEventsReady
                ? "New tab"
                : "Preparing…"}
          </Button>
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        <nav
          aria-label="Workspace"
          className="flex w-12 shrink-0 flex-col items-center border-r border-[var(--hairline)] bg-[var(--toolbar)] py-2"
        >
          <button
            aria-label={
              connectionsOpen ? "Collapse connections" : "Expand connections"
            }
            aria-pressed={connectionsOpen}
            className="control-icon text-[var(--primary)]"
            onClick={() => setConnectionsOpen((open) => !open)}
            title={
              connectionsOpen ? "Collapse connections" : "Expand connections"
            }
            type="button"
          >
            {connectionsOpen ? (
              <PanelLeft className="size-4" />
            ) : (
              <Terminal className="size-4" />
            )}
          </button>
        </nav>
        {connectionsOpen ? (
          <HostsWorkspace
            backend={backend}
            onOpenLocal={() => void openSession()}
            refreshToken={hostsRefreshToken}
            onRequestConnection={requestHostConnection}
          />
        ) : null}
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex h-10 shrink-0 items-center gap-3 border-b border-[var(--hairline)] bg-[var(--toolbar)] px-3 text-[11px] backdrop-blur-xl">
            <span className="min-w-0 truncate text-[var(--strong-foreground)]">
              {activeSession ? activeSession.title : "No active session"}
            </span>
            <span className="text-[var(--muted-foreground)]">/</span>
            <span className="font-mono text-[var(--primary)]">
              {activeSession?.kind.type === "ssh"
                ? "SSH"
                : activeSession
                  ? "Local"
                  : "Ready"}
            </span>
            {activeSession ? (
              <span className="ml-auto flex items-center gap-1.5 rounded-md border border-[var(--hairline)] px-2 py-0.5 text-[var(--muted-foreground)]">
                <span className={`status-dot status-${activeSession.status}`} />
                {statusLabels[activeSession.status]}
              </span>
            ) : null}
          </div>
          <section className="relative min-h-0 flex-1 bg-[var(--terminal)]">
            {sessions.length === 0 ? (
              <div className="grid h-full place-items-center p-8 text-center">
                <div>
                  <p className="font-mono text-sm text-[var(--primary)]">
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
              />
            ))}
          </section>
        </div>
      </div>

      <footer className="flex min-h-8 shrink-0 items-center justify-between gap-4 border-t border-[var(--hairline)] bg-[var(--statusbar)] px-3 text-[11px] text-[var(--muted-foreground)] backdrop-blur-xl">
        <div className="flex min-w-0 items-center gap-3">
          <span className="text-[var(--muted-foreground)]">
            {appInfo ? `${appInfo.name} ${appInfo.version}` : "Starting core…"}
          </span>
          {activeSession ? (
            <span role="status">
              {statusLabels[activeSession.status]}
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
