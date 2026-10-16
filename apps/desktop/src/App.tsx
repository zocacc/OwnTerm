import { useCallback, useEffect, useRef, useState } from "react";
import { AppearancePanel } from "./components/AppearancePanel";
import { TitleBar } from "./components/TitleBar";
import { useDialogFocus } from "./components/useDialogFocus";
import { defaultBackend, type Backend } from "./services/backend";
import { nativeWindow } from "./services/native-window";
import { useLocalSessions } from "./sessions/useLocalSessions";
import { useTerminalAppearance } from "./appearance/useTerminalAppearance";
import { TerminalSurface } from "./terminal/TerminalSurface";

function CloseConfirmation({
  busy,
  onConfirm,
  onCancel,
}: {
  busy: boolean;
  onConfirm(): void;
  onCancel(): void;
}) {
  const ref = useDialogFocus<HTMLElement>(true);
  return (
    <div className="overlay confirm-overlay">
      <section
        className="dialog"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="close-title"
        aria-describedby="close-description"
        ref={ref}
        onKeyDown={(event) => {
          if (event.key === "Escape" && !busy) onCancel();
        }}
      >
        <h2 id="close-title">Close active sessions?</h2>
        <p id="close-description">
          Running shells and commands will be terminated.
        </p>
        <div className="dialog-actions">
          <button disabled={busy} onClick={onCancel}>
            Cancel
          </button>
          <button className="danger-button" disabled={busy} onClick={onConfirm}>
            {busy ? "Closing…" : "Close sessions"}
          </button>
        </div>
      </section>
    </div>
  );
}

export default function App({
  backend = defaultBackend,
}: {
  backend?: Backend;
}) {
  const terminal = useLocalSessions(backend);
  const { reportError } = terminal;
  const appearance = useTerminalAppearance(backend);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [closeRequest, setCloseRequest] = useState<string>();
  const [closing, setClosing] = useState(false);
  const closeLock = useRef(false);
  const permittedClose = useRef(false);
  const active = terminal.sessions.find(
    (item) => item.id === terminal.activeId,
  );
  const performClose = useCallback(
    async (target: string) => {
      if (closeLock.current) return;
      closeLock.current = true;
      terminal.blockOpening(true);
      setClosing(true);
      const targets =
        target === "window"
          ? terminal.sessions
          : terminal.sessions.filter((item) => item.id === target);
      const results = await Promise.all(
        targets.map((item) => terminal.close(item.id)),
      );
      const ended = new Set(
        targets.filter((_, index) => results[index]).map((item) => item.id),
      );
      const remaining = terminal.sessions.filter((item) => !ended.has(item.id));
      if (ended.has(terminal.activeId ?? "") && remaining.length)
        terminal.select(remaining.at(-1)!.id);
      let windowClosing = false;
      if (results.every(Boolean)) {
        if (!remaining.length) {
          permittedClose.current = true;
          try {
            await nativeWindow.close();
            windowClosing = true;
          } catch {
            permittedClose.current = false;
            terminal.reportError(
              "Could not close the window. Please try again.",
            );
          }
        }
      }
      if (!windowClosing) {
        terminal.blockOpening(false);
        closeLock.current = false;
        setClosing(false);
      }
      setCloseRequest(undefined);
    },
    [terminal],
  );
  const requestClose = (target: string) => {
    if (closeLock.current || closing || closeRequest || terminal.opening)
      return;
    const items =
      target === "window"
        ? terminal.sessions
        : terminal.sessions.filter((item) => item.id === target);
    if (
      items.some(
        (item) => item.status !== "disconnected" && item.status !== "failed",
      )
    )
      setCloseRequest(target);
    else void performClose(target);
  };
  const requestWindowClose = useRef(() => requestClose("window"));
  useEffect(() => {
    requestWindowClose.current = () => requestClose("window");
  });
  useEffect(() => {
    let active = true;
    let release: (() => void) | undefined;
    void nativeWindow
      .onCloseRequested(
        () => requestWindowClose.current(),
        () => permittedClose.current,
      )
      .then((unsubscribe) => {
        if (active) release = unsubscribe;
        else unsubscribe();
      })
      .catch(() =>
        reportError(
          "Could not install the close confirmation. Use the titlebar controls.",
        ),
      );
    return () => {
      active = false;
      release?.();
    };
  }, [reportError]);

  useEffect(() => {
    const keydown = (event: KeyboardEvent) => {
      if (settingsOpen || closeRequest || closeLock.current) return;
      if (
        event.ctrlKey &&
        (event.key === "Tab" ||
          (event.shiftKey &&
            ["t", "w", "c", "v"].includes(event.key.toLowerCase())))
      ) {
        event.stopPropagation();
      }
      if (event.ctrlKey && event.key === "Tab") {
        event.preventDefault();
        terminal.cycle(event.shiftKey ? -1 : 1);
      } else if (
        event.ctrlKey &&
        event.shiftKey &&
        event.key.toLowerCase() === "t"
      ) {
        event.preventDefault();
        void terminal.open();
      } else if (
        event.ctrlKey &&
        event.shiftKey &&
        event.key.toLowerCase() === "w" &&
        terminal.activeId
      ) {
        event.preventDefault();
        requestClose(terminal.activeId);
      } else if (
        event.ctrlKey &&
        event.shiftKey &&
        event.key.toLowerCase() === "c" &&
        terminal.activeId
      ) {
        event.preventDefault();
        void terminal.handles.current
          .get(terminal.activeId)
          ?.copy()
          .catch(() => terminal.reportError("Could not copy selection."));
      } else if (
        event.ctrlKey &&
        event.shiftKey &&
        event.key.toLowerCase() === "v" &&
        terminal.activeId
      ) {
        event.preventDefault();
        void terminal.handles.current
          .get(terminal.activeId)
          ?.paste()
          .catch(() => terminal.reportError("Could not paste clipboard."));
      }
    };
    // Capture application shortcuts before xterm consumes them or emits shell input.
    window.addEventListener("keydown", keydown, true);
    return () => window.removeEventListener("keydown", keydown, true);
  });
  const closeSettings = () => {
    setSettingsOpen(false);
    requestAnimationFrame(
      () =>
        terminal.activeId &&
        terminal.handles.current.get(terminal.activeId)?.focus(),
    );
  };
  const warning =
    appearance.error ??
    appearance.settings.backdropWarning ??
    (appearance.ready && !appearance.settings.backdropConfigured
      ? "Opaque fallback: Acrylic is disabled or unavailable."
      : undefined);
  return (
    <main className="app-shell">
      <TitleBar
        sessions={terminal.sessions}
        activeId={terminal.activeId}
        profiles={terminal.profiles}
        opening={terminal.opening || closing}
        ready={terminal.ready}
        settingsOpen={settingsOpen}
        onSelect={terminal.select}
        onClose={requestClose}
        onNew={(id) => {
          void terminal.open(id);
        }}
        onSettings={() => setSettingsOpen((value) => !value)}
        onCloseWindow={() => requestClose("window")}
      />
      <div className="terminal-view" aria-label="Terminal workspace">
        {appearance.ready
          ? terminal.sessions.map((session) => (
              <TerminalSurface
                key={session.id}
                active={session.id === terminal.activeId}
                sessionId={session.id}
                backend={backend}
                onReady={terminal.register}
                onError={terminal.reportError}
                profile={appearance.profile}
                scheme={appearance.scheme}
              />
            ))
          : null}
        {active?.status === "disconnected" ? (
          <div className="terminal-notice" role="status">
            Process exited
            {active.exitCode !== undefined ? ` (${active.exitCode})` : ""}.{" "}
            <button onClick={() => requestClose(active.id)}>Close tab</button>
          </div>
        ) : null}
        {terminal.error ? (
          <div className="terminal-notice" role="alert">
            {terminal.error}{" "}
            <button disabled={terminal.opening} onClick={terminal.retry}>
              Retry
            </button>
          </div>
        ) : null}
        {warning ? (
          <button
            className="material-warning"
            onClick={() => setSettingsOpen(true)}
            aria-label={warning}
          >
            {appearance.settings.backdropConfigured
              ? "Appearance warning"
              : "Opaque fallback"}{" "}
            · Appearance
          </button>
        ) : null}
        {!terminal.sessions.length && !terminal.error ? (
          <span className="sr-only" role="status">
            Preparing terminal…
          </span>
        ) : null}
      </div>
      {settingsOpen ? (
        <AppearancePanel
          profile={appearance.profile}
          disabled={!appearance.editable}
          warning={warning}
          onChange={appearance.update}
          onClose={closeSettings}
        />
      ) : null}
      {closeRequest ? (
        <CloseConfirmation
          busy={closing}
          onCancel={() => {
            setCloseRequest(undefined);
            requestAnimationFrame(
              () =>
                terminal.activeId &&
                terminal.handles.current.get(terminal.activeId)?.focus(),
            );
          }}
          onConfirm={() => {
            void performClose(closeRequest);
          }}
        />
      ) : null}
    </main>
  );
}
