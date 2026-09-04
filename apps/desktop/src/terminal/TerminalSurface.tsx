import { useEffect, useRef } from "react";
import type { Backend } from "../services/backend";
import { createTerminal } from "./create-terminal";

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
};

export function TerminalSurface({
  active,
  backend,
  onError,
  onReady,
  sessionId,
}: TerminalSurfaceProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const activeRef = useRef(active);
  const fitRef = useRef<() => void>(() => undefined);
  const focusRef = useRef<() => void>(() => undefined);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) {
      return;
    }

    const { terminal, fitAddon } = createTerminal();
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

  return (
    <div
      aria-hidden={!active}
      className={active ? "h-full w-full p-3" : "hidden"}
      data-testid={`terminal-${sessionId}`}
      ref={containerRef}
    />
  );
}
