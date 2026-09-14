import { act, cleanup, render, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Backend } from "../services/backend";
import { TerminalSurface, type TerminalHandle } from "./TerminalSurface";

const terminalMocks = vi.hoisted(() => {
  const state: { input?: (data: string) => void } = {};
  return {
    state,
    terminal: {
      cols: 100,
      rows: 30,
      dispose: vi.fn(),
      focus: vi.fn(),
      getSelection: vi.fn(() => "selected text"),
      loadAddon: vi.fn(),
      onData: vi.fn((handler: (data: string) => void) => {
        state.input = handler;
        return { dispose: vi.fn() };
      }),
      open: vi.fn(),
      write: vi.fn(),
    },
    fitAddon: { fit: vi.fn() },
  };
});

vi.mock("./create-terminal", () => ({
  createTerminal: () => ({
    terminal: terminalMocks.terminal,
    fitAddon: terminalMocks.fitAddon,
  }),
}));

let resizeCallback: ResizeObserverCallback;

class ResizeObserverStub implements ResizeObserver {
  constructor(callback: ResizeObserverCallback) {
    resizeCallback = callback;
  }

  disconnect() {}
  observe() {}
  unobserve() {}
}

function testBackend(): Backend {
  return {
    appInfo: vi.fn(async () => ({ name: "OwnTerm", version: "test" })),
    listShellProfiles: vi.fn(async () => []),
    startLocalSession: vi.fn(),
    startSshSession: vi.fn(),
    startQuickConnect: vi.fn(),
    confirmSshTrust: vi.fn(async () => undefined),
    provideSshCredential: vi.fn(async () => undefined),
    writeSession: vi.fn(async () => undefined),
    resizeSession: vi.fn(async () => undefined),
    closeSession: vi.fn(async () => undefined),
    onSessionOutput: vi.fn(async () => () => undefined),
    onSessionStatus: vi.fn(async () => () => undefined),
    onSessionExit: vi.fn(async () => () => undefined),
    onSessionTrustRequired: vi.fn(async () => () => undefined),
    onSessionCredentialRequired: vi.fn(async () => () => undefined),
  };
}

describe("TerminalSurface", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    terminalMocks.state.input = undefined;
    Object.defineProperty(globalThis, "ResizeObserver", {
      configurable: true,
      value: ResizeObserverStub,
    });
    Object.defineProperty(HTMLElement.prototype, "clientWidth", {
      configurable: true,
      get: () => 640,
    });
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        readText: vi.fn(async () => "pasted text"),
        writeText: vi.fn(async () => undefined),
      },
    });
  });

  afterEach(() => {
    cleanup();
  });

  it("bridges xterm input, output, resize and clipboard without interpreting bytes", async () => {
    const backend = testBackend();
    let handle: TerminalHandle | undefined;
    const onError = vi.fn();
    const onReady = (_sessionId: string, nextHandle?: TerminalHandle) => {
      handle = nextHandle;
    };

    const view = render(
      <TerminalSurface
        active
        backend={backend}
        onError={onError}
        onReady={onReady}
        sessionId="session-1"
        terminalBackgroundOpacity={82}
      />,
    );

    expect(handle).toBeDefined();
    expect(
      document.querySelector("[data-testid=terminal-session-1]"),
    ).toHaveStyle({
      backgroundColor: "rgb(12 15 21 / 82%)",
    });
    view.rerender(
      <TerminalSurface
        active
        backend={backend}
        onError={onError}
        onReady={onReady}
        sessionId="session-1"
        terminalBackgroundOpacity={64}
      />,
    );
    expect(
      document.querySelector("[data-testid=terminal-session-1]"),
    ).toHaveStyle({
      backgroundColor: "rgb(12 15 21 / 64%)",
    });
    expect(terminalMocks.terminal.open).toHaveBeenCalledTimes(1);
    expect(terminalMocks.terminal.focus).toHaveBeenCalledTimes(1);
    act(() => {
      terminalMocks.state.input?.("d");
      terminalMocks.state.input?.("ir\r");
    });
    await waitFor(() =>
      expect(backend.writeSession).toHaveBeenCalledWith(
        "session-1",
        Array.from(new TextEncoder().encode("dir\r")),
      ),
    );
    expect(backend.writeSession).toHaveBeenCalledTimes(1);

    act(() => {
      resizeCallback([], {} as ResizeObserver);
    });
    await waitFor(() =>
      expect(backend.resizeSession).toHaveBeenCalledWith("session-1", 30, 100),
    );

    handle?.write([0, 27, 255]);
    expect(terminalMocks.terminal.write).toHaveBeenCalledWith(
      Uint8Array.from([0, 27, 255]),
    );

    await handle?.copy();
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith("selected text");

    await handle?.paste();
    expect(backend.writeSession).toHaveBeenCalledWith(
      "session-1",
      Array.from(new TextEncoder().encode("pasted text")),
    );
  });
});
