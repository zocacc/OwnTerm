import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "./components/ui/button";
import {
  defaultBackend,
  type AppInfo,
  type Backend,
  type SessionDescriptor,
  type SessionStatus,
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

const statusLabels: Record<SessionStatus, string> = {
  starting: "Iniciando",
  awaiting_trust: "Aguardando confiança",
  awaiting_credential: "Aguardando credencial",
  connected: "Conectado",
  disconnected: "Encerrado",
  failed: "Falhou",
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
  const terminals = useRef(new Map<string, TerminalHandle>());
  const pendingOutput = useRef(new Map<string, number[][]>());
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
      setSessions((current) =>
        current.map((session) =>
          session.id === event.sessionId
            ? { ...session, status: event.status, reason: event.reason }
            : session,
        ),
      );
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

    void Promise.allSettled([
      outputSubscription,
      statusSubscription,
      exitSubscription,
    ])
      .then(([output, status, exit]) => {
        const subscriptions = [output, status, exit];
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
          setError(
            "Não foi possível preparar os eventos do terminal: " +
              String(error),
          );
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
          setError("Não foi possível iniciar o core do OwnTerm.");
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
      setSessions((current) => [...current, descriptor]);
      setActiveSessionId(descriptor.id);
    } catch {
      setError("Não foi possível abrir o shell selecionado.");
    } finally {
      setOpening(false);
    }
  }, [backend, opening, selectedProfileId, terminalEventsReady]);

  const closeSession = useCallback(
    (sessionId: string) => {
      closedSessions.current.add(sessionId);
      pendingOutput.current.delete(sessionId);
      terminals.current.delete(sessionId);

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
          ? "Não foi possível copiar a seleção."
          : "Não foi possível colar no terminal.",
      ),
    );
  };

  return (
    <main className="flex h-screen min-h-[480px] flex-col overflow-hidden bg-[var(--background)] text-[var(--foreground)]">
      <header className="flex h-12 shrink-0 items-center justify-between border-b border-[var(--border)] bg-[var(--surface)] px-4">
        <div className="flex items-center gap-3">
          <span className="grid size-7 place-items-center rounded-md bg-[var(--primary)] font-mono text-sm font-bold text-[#15111f]">
            O
          </span>
          <div>
            <h1 className="text-sm font-semibold leading-none">OwnTerm</h1>
            <p className="mt-1 text-[10px] uppercase tracking-[0.18em] text-[var(--muted-foreground)]">
              terminal local
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <label className="sr-only" htmlFor="shell-profile">
            Shell
          </label>
          <select
            className="h-8 max-w-56 rounded-md border border-[var(--border)] bg-[var(--surface-solid)] px-2 text-xs outline-none focus:border-[var(--primary)]"
            disabled={profiles.length === 0}
            id="shell-profile"
            onChange={(event) => setSelectedProfileId(event.target.value)}
            value={selectedProfileId}
          >
            {profiles.length === 0 ? (
              <option>Nenhum shell disponível</option>
            ) : (
              profiles.map((profile) => (
                <option key={profile.id} value={profile.id}>
                  {profile.name}
                </option>
              ))
            )}
          </select>
          <Button
            className="h-8 py-1 text-xs"
            disabled={!selectedProfileId || opening || !terminalEventsReady}
            onClick={() => void openSession()}
          >
            {opening
              ? "Abrindo…"
              : terminalEventsReady
                ? "Nova aba"
                : "Preparando terminal…"}
          </Button>
        </div>
      </header>

      <nav
        aria-label="Sessões locais"
        className="flex h-10 shrink-0 items-end gap-1 overflow-x-auto border-b border-[var(--border)] bg-black/10 px-2 pt-1"
      >
        {sessions.map((session) => (
          <div
            className={
              session.id === activeSessionId
                ? "flex h-9 min-w-40 items-center gap-2 rounded-t-md border border-b-0 border-[var(--border)] bg-[var(--terminal)] px-3"
                : "flex h-9 min-w-40 items-center gap-2 rounded-t-md px-3 text-[var(--muted-foreground)] hover:bg-white/5"
            }
            key={session.id}
          >
            <button
              aria-current={session.id === activeSessionId ? "page" : undefined}
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
              aria-label={`Fechar ${session.title}`}
              className="rounded px-1 text-base leading-none hover:bg-white/10 hover:text-white"
              onClick={() => closeSession(session.id)}
              type="button"
            >
              ×
            </button>
          </div>
        ))}
      </nav>

      <section className="relative min-h-0 flex-1 bg-[var(--terminal)]">
        {sessions.length === 0 ? (
          <div className="grid h-full place-items-center p-8 text-center">
            <div>
              <p className="font-mono text-sm text-[var(--primary)]">
                Nenhuma sessão aberta
              </p>
              <p className="mt-2 text-sm text-[var(--muted-foreground)]">
                Escolha um shell e abra uma aba. Atalho: Ctrl+Shift+T.
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

      <footer className="flex min-h-8 shrink-0 items-center justify-between gap-4 border-t border-[var(--border)] bg-[var(--surface-solid)] px-3 text-[11px]">
        <div className="flex min-w-0 items-center gap-3">
          <span className="text-[var(--muted-foreground)]">
            {appInfo ? `${appInfo.name} ${appInfo.version}` : "Iniciando core…"}
          </span>
          {activeSession ? (
            <span role="status">
              {statusLabels[activeSession.status]}
              {activeSession.exitCode !== undefined
                ? ` · código ${activeSession.exitCode}`
                : ""}
              {activeSession.reason ? ` · ${activeSession.reason}` : ""}
            </span>
          ) : null}
          {error ? (
            <span className="truncate text-[var(--danger)]">{error}</span>
          ) : null}
        </div>
        <div className="flex items-center gap-1">
          <button
            className="rounded px-2 py-1 text-[var(--muted-foreground)] hover:bg-white/5 hover:text-white disabled:opacity-40"
            disabled={!activeSession}
            onClick={() => runClipboardAction("copy")}
            type="button"
          >
            Copiar
          </button>
          <button
            className="rounded px-2 py-1 text-[var(--muted-foreground)] hover:bg-white/5 hover:text-white disabled:opacity-40"
            disabled={!activeSession || activeSession.status !== "connected"}
            onClick={() => runClipboardAction("paste")}
            type="button"
          >
            Colar
          </button>
          <span className="ml-2 hidden text-[var(--muted-foreground)] sm:inline">
            Ctrl+Tab alterna abas
          </span>
        </div>
      </footer>
    </main>
  );
}

export default App;
