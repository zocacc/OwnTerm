import { useEffect, useRef } from "react";
import type {
  Backend,
  TerminalAppearanceProfile,
  TerminalColorScheme,
} from "../services/backend";
import { createTerminal, terminalTheme } from "./create-terminal";

export type TerminalHandle = {
  write(data: number[]): void;
  focus(): void;
  copy(): Promise<void>;
  paste(): Promise<void>;
};

type TerminalSurfaceProps = {
  active: boolean;
  backend: Backend;
  onError(message: string): void;
  onReady(sessionId: string, handle?: TerminalHandle): void;
  sessionId: string;
  profile?: TerminalAppearanceProfile;
  scheme?: TerminalColorScheme;
  /** Kept for the legacy surface contract; profile value takes precedence. */
  terminalBackgroundOpacity?: number;
};

export function TerminalSurface({
  active,
  backend,
  onError,
  onReady,
  sessionId,
  profile: suppliedProfile,
  scheme: suppliedScheme,
  terminalBackgroundOpacity,
}: TerminalSurfaceProps) {
  const fallbackScheme: TerminalColorScheme = {
    id: "fallback",
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
  const scheme = suppliedScheme ?? fallbackScheme;
  const profile = suppliedProfile ?? {
    id: "fallback",
    name: "OwnTerm Default",
    colorSchemeId: scheme.id,
    fontFamily: "JetBrains Mono, Cascadia Mono, Consolas, monospace",
    fontSize: 14,
    windowOpacity: 92,
    terminalBackgroundOpacity: terminalBackgroundOpacity ?? 82,
    useAcrylic: true,
    builtIn: true,
  };
  const containerRef = useRef<HTMLDivElement>(null);
  const activeRef = useRef(active);
  const fitRef = useRef<() => void>(() => undefined);
  const focusRef = useRef<() => void>(() => undefined);
  const terminalRef = useRef<
    ReturnType<typeof createTerminal>["terminal"] | undefined
  >(undefined);
  const initialAppearance = useRef({ profile, scheme });

  useEffect(() => {
    const container = containerRef.current;
    if (!container) {
      return;
    }

    const { profile: initialProfile, scheme: initialScheme } =
      initialAppearance.current;
    const { terminal, fitAddon } = createTerminal(
      initialProfile,
      initialScheme,
    );
    terminalRef.current = terminal;
    terminal.open(container);

    let resizeTimer: number | undefined;
    let inputTimer: number | undefined;
    let inputBuffer: number[] = [];
    const fitAndResize = () => {
      if (!activeRef.current || container.clientWidth === 0) {
        return;
      }
      try {
        fitAddon.fit();
        void backend
          .resizeSession(sessionId, terminal.rows, terminal.cols)
          .catch(() => onError("Não foi possível redimensionar o terminal."));
      } catch {
        onError("Não foi possível ajustar o terminal à janela.");
      }
    };
    fitRef.current = fitAndResize;
    focusRef.current = () => terminal.focus();

    const flushInput = () => {
      inputTimer = undefined;
      const data = inputBuffer;
      inputBuffer = [];
      if (data.length > 0) {
        void backend
          .writeSession(sessionId, data)
          .catch(() => onError("Não foi possível enviar dados ao terminal."));
      }
    };
    const inputSubscription = terminal.onData((data) => {
      inputBuffer.push(...new TextEncoder().encode(data));
      if (inputBuffer.length >= 4_096) {
        window.clearTimeout(inputTimer);
        flushInput();
      } else if (inputTimer === undefined) {
        inputTimer = window.setTimeout(flushInput, 8);
      }
    });
    const resizeObserver = new ResizeObserver(() => {
      window.clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(fitAndResize, 60);
    });
    resizeObserver.observe(container);

    onReady(sessionId, {
      write: (data) => terminal.write(Uint8Array.from(data)),
      focus: () => terminal.focus(),
      copy: async () => {
        const selection = terminal.getSelection();
        if (selection) {
          await navigator.clipboard.writeText(selection);
        }
      },
      paste: async () => {
        const text = await navigator.clipboard.readText();
        if (text) {
          await backend.writeSession(
            sessionId,
            Array.from(new TextEncoder().encode(text)),
          );
        }
      },
    });

    return () => {
      window.clearTimeout(resizeTimer);
      window.clearTimeout(inputTimer);
      resizeObserver.disconnect();
      inputSubscription.dispose();
      terminal.dispose();
      terminalRef.current = undefined;
      onReady(sessionId);
    };
  }, [backend, onError, onReady, sessionId]);

  useEffect(() => {
    activeRef.current = active;
    if (active) {
      fitRef.current();
      focusRef.current();
    }
  }, [active]);

  useEffect(() => {
    const terminal = terminalRef.current;
    if (!terminal) return;
    if (!terminal.options) return;
    terminal.options.fontFamily = profile.fontFamily;
    terminal.options.fontSize = profile.fontSize;
    terminal.options.theme = terminalTheme(scheme);
    // Font metrics affect xterm columns/rows; immediately synchronize the PTY.
    fitRef.current();
  }, [profile.fontFamily, profile.fontSize, scheme]);

  return (
    <div
      aria-hidden={!active}
      aria-labelledby={`session-tab-${sessionId}`}
      className={active ? "terminal-surface h-full w-full p-3" : "hidden"}
      id={`terminal-${sessionId}`}
      role="tabpanel"
      data-testid={`terminal-${sessionId}`}
      ref={containerRef}
      style={{
        backgroundColor: suppliedProfile
          ? `color-mix(in srgb, ${scheme.background} ${profile.terminalBackgroundOpacity}%, transparent)`
          : `rgb(12 15 21 / ${profile.terminalBackgroundOpacity}%)`,
      }}
    />
  );
}
