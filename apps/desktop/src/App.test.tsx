import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import App from "./App";
import type {
  AppearanceSettings,
  Backend,
  SessionCredentialRequiredEvent,
  SessionExitEvent,
  SessionOutputEvent,
  SessionStatusEvent,
  SessionTrustRequiredEvent,
} from "./services/backend";

const terminalSurfaceMocks = vi.hoisted(() => ({ focus: vi.fn() }));

vi.mock("./terminal/TerminalSurface", () => ({
  TerminalSurface: ({
    active,
    sessionId,
    terminalBackgroundOpacity,
    onReady,
  }: {
    active: boolean;
    sessionId: string;
    terminalBackgroundOpacity: number;
    onReady: (sessionId: string, handle?: unknown) => void;
  }) => {
    onReady(sessionId, {
      focus: terminalSurfaceMocks.focus,
      write: vi.fn(),
      copy: vi.fn(async () => undefined),
      paste: vi.fn(async () => undefined),
    });
    return (
      <div
        data-active={active}
        data-opacity={terminalBackgroundOpacity}
        data-testid={`terminal-${sessionId}`}
      />
    );
  },
}));
class TestBackend implements Backend {
  private nextSession = 1;
  private readonly outputHandlers = new Set<
    (event: SessionOutputEvent) => void
  >();
  private readonly statusHandlers = new Set<
    (event: SessionStatusEvent) => void
  >();
  private readonly exitHandlers = new Set<(event: SessionExitEvent) => void>();
  private readonly trustHandlers = new Set<
    (event: SessionTrustRequiredEvent) => void
  >();
  private readonly credentialHandlers = new Set<
    (event: SessionCredentialRequiredEvent) => void
  >();
  readonly trustResponses: Array<[string, boolean]> = [];
  readonly credentialResponses: Array<[string, string | undefined]> = [];
  readonly closedSessions: string[] = [];
  readonly appearanceSaves: Array<
    Pick<AppearanceSettings, "windowOpacity" | "terminalBackgroundOpacity">
  > = [];
  appearance: AppearanceSettings = {
    windowOpacity: 92,
    terminalBackgroundOpacity: 82,
    windowOpacitySupport: "unsupported",
    windowOpacityApplied: false,
    windowOpacityWarning: null,
    defaultsApplied: false,
  };

  async appInfo() {
    return { name: "OwnTerm", version: "0.1.0-test" };
  }

  async listShellProfiles() {
    return [{ id: "powershell", name: "PowerShell" }];
  }

  async startLocalSession(shellProfileId: string) {
    const id = `session-${this.nextSession++}`;
    return {
      id,
      kind: { type: "local" as const, shellProfileId },
      title: `PowerShell ${id.slice(-1)}`,
      status: "connected" as const,
    };
  }

  async startSshSession(hostId: string) {
    return {
      id: `ssh-${this.nextSession++}`,
      kind: { type: "ssh" as const, hostId },
      title: "Servidor SSH",
      status: "starting" as const,
    };
  }

  async startQuickConnect(destination: string) {
    return {
      id: `ssh-${this.nextSession++}`,
      kind: { type: "ssh" as const, hostId: "quick" },
      title: destination,
      status: "starting" as const,
    };
  }

  async confirmSshTrust(sessionId: string, accept: boolean) {
    this.trustResponses.push([sessionId, accept]);
  }

  async provideSshCredential(sessionId: string, secret?: string) {
    this.credentialResponses.push([sessionId, secret]);
  }

  async writeSession() {
    return undefined;
  }

  async resizeSession() {
    return undefined;
  }

  async closeSession(sessionId: string) {
    this.closedSessions.push(sessionId);
  }

  async getAppearanceSettings() {
    return this.appearance;
  }

  async saveAppearanceSettings(
    request: Pick<
      AppearanceSettings,
      "windowOpacity" | "terminalBackgroundOpacity"
    >,
  ) {
    this.appearanceSaves.push(request);
    this.appearance = { ...this.appearance, ...request };
    return this.appearance;
  }

  onSessionOutput = async (handler: (event: SessionOutputEvent) => void) => {
    this.outputHandlers.add(handler);
    return () => this.outputHandlers.delete(handler);
  };

  onSessionTrustRequired = async (
    handler: (event: SessionTrustRequiredEvent) => void,
  ) => {
    this.trustHandlers.add(handler);
    return () => this.trustHandlers.delete(handler);
  };

  onSessionCredentialRequired = async (
    handler: (event: SessionCredentialRequiredEvent) => void,
  ) => {
    this.credentialHandlers.add(handler);
    return () => this.credentialHandlers.delete(handler);
  };

  onSessionStatus = async (handler: (event: SessionStatusEvent) => void) => {
    this.statusHandlers.add(handler);
    return () => this.statusHandlers.delete(handler);
  };

  onSessionExit = async (handler: (event: SessionExitEvent) => void) => {
    this.exitHandlers.add(handler);
    return () => this.exitHandlers.delete(handler);
  };

  emitTrust(event: SessionTrustRequiredEvent) {
    for (const handler of this.trustHandlers) handler(event);
  }

  emitCredential(event: SessionCredentialRequiredEvent) {
    for (const handler of this.credentialHandlers) handler(event);
  }

  emitStatus(event: SessionStatusEvent) {
    for (const handler of this.statusHandlers) {
      handler(event);
    }
  }

  emitExit(event: SessionExitEvent) {
    for (const handler of this.exitHandlers) {
      handler(event);
    }
  }
}

describe("local terminal workspace", () => {
  let backend: TestBackend;

  beforeEach(() => {
    backend = new TestBackend();
  });

  afterEach(() => {
    cleanup();
  });

  it("loads core information and detected shell profiles", async () => {
    render(<App backend={backend} />);

    expect(await screen.findByText("OwnTerm 0.1.0-test")).toBeInTheDocument();
    expect(
      screen.getByRole("option", { name: "PowerShell" }),
    ).toBeInTheDocument();
  });

  it("opens, switches and closes local session tabs", async () => {
    const user = userEvent.setup();
    render(<App backend={backend} />);

    const openButton = await screen.findByRole("button", { name: "New tab" });
    await user.click(openButton);
    await user.click(openButton);

    const firstTab = screen.getByRole("button", { name: "PowerShell 1" });
    const secondTab = screen.getByRole("button", { name: "PowerShell 2" });
    expect(secondTab).toHaveAttribute("aria-current", "page");

    await user.click(firstTab);
    expect(firstTab).toHaveAttribute("aria-current", "page");

    await user.click(
      screen.getByRole("button", { name: "Close PowerShell 1" }),
    );
    expect(firstTab).not.toBeInTheDocument();
    expect(secondTab).toHaveAttribute("aria-current", "page");
    expect(backend.closedSessions).toEqual(["session-1"]);
  });

  it("shows process exit code when the backend publishes it", async () => {
    const user = userEvent.setup();
    render(<App backend={backend} />);

    await user.click(await screen.findByRole("button", { name: "New tab" }));
    act(() => {
      backend.emitExit({
        version: 1,
        sessionId: "session-1",
        exitCode: 7,
      });
    });

    expect(screen.getByRole("status")).toHaveTextContent(
      "Closed · exit code 7",
    );
  });

  it("ignores status and exit events after a tab was closed", async () => {
    const user = userEvent.setup();
    render(<App backend={backend} />);

    await user.click(await screen.findByRole("button", { name: "New tab" }));
    await user.click(
      screen.getByRole("button", { name: "Close PowerShell 1" }),
    );

    act(() => {
      backend.emitStatus({
        version: 1,
        sessionId: "session-1",
        status: "failed",
        reason: "late event",
      });
      backend.emitExit({
        version: 1,
        sessionId: "session-1",
        exitCode: 1,
      });
    });

    expect(
      screen.queryByRole("button", { name: "PowerShell 1" }),
    ).not.toBeInTheDocument();
    expect(screen.getByText("No open sessions")).toBeInTheDocument();
    expect(screen.queryByText(/late event/)).not.toBeInTheDocument();
  });

  it("handles TOFU and an ephemeral SSH credential", async () => {
    const user = userEvent.setup();
    render(<App backend={backend} />);

    await screen.findByRole("button", { name: "New tab" });
    await user.type(
      screen.getByLabelText("Quick Connect"),
      "alice@example.test:2222",
    );
    await user.click(screen.getByRole("button", { name: "Connect" }));
    expect(
      await screen.findByRole("button", { name: "alice@example.test:2222" }),
    ).toBeInTheDocument();

    act(() =>
      backend.emitTrust({
        version: 1,
        sessionId: "ssh-1",
        destination: "example.test",
        port: 2222,
        algorithm: "ssh-ed25519",
        fingerprint: "SHA256:test-fingerprint",
      }),
    );
    expect(screen.getByText("SHA256:test-fingerprint")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Trust and connect" }));
    expect(backend.trustResponses).toEqual([["ssh-1", true]]);

    act(() =>
      backend.emitCredential({
        version: 1,
        sessionId: "ssh-1",
        kind: "password",
      }),
    );
    const credential = screen.getByLabelText("SSH credential");
    await user.type(credential, "one-use-secret");
    await user.click(
      screen.getByRole("dialog").querySelector("button[type=submit]")!,
    );
    expect(backend.credentialResponses).toEqual([["ssh-1", "one-use-secret"]]);
    expect(
      screen.queryByDisplayValue("one-use-secret"),
    ).not.toBeInTheDocument();
  });

  it("rejects trust and reconnects with a fresh SSH session", async () => {
    const user = userEvent.setup();
    render(<App backend={backend} />);

    await screen.findByRole("button", { name: "New tab" });
    await user.type(
      screen.getByLabelText("Quick Connect"),
      "alice@changed.test",
    );
    await user.click(screen.getByRole("button", { name: "Connect" }));
    act(() =>
      backend.emitTrust({
        version: 1,
        sessionId: "ssh-1",
        destination: "changed.test",
        port: 22,
        algorithm: "ssh-ed25519",
        fingerprint: "SHA256:changed",
      }),
    );
    await user.click(await screen.findByRole("button", { name: "Reject" }));
    expect(backend.trustResponses).toEqual([["ssh-1", false]]);
    act(() =>
      backend.emitStatus({
        version: 1,
        sessionId: "ssh-1",
        status: "failed",
        reason: "SSH host identity was rejected",
      }),
    );
    await user.click(await screen.findByRole("button", { name: "Reconnect" }));
    expect(
      screen.getAllByRole("button", { name: "alice@changed.test" }),
    ).toHaveLength(2);
  });

  it("opens accessible Appearance settings and applies terminal opacity without closing a session", async () => {
    const user = userEvent.setup();
    render(<App backend={backend} />);

    await user.click(await screen.findByRole("button", { name: "New tab" }));
    await user.click(
      screen.getByRole("button", { name: "Appearance settings" }),
    );
    const dialog = screen.getByRole("dialog", { name: "Appearance" });
    expect(dialog).toHaveTextContent("Window opacity 92%");
    expect(dialog).toHaveTextContent("Terminal background opacity 82%");
    expect(
      screen.getByRole("button", { name: "Close appearance settings" }),
    ).toHaveFocus();

    fireEvent.change(
      screen.getByRole("slider", { name: /Terminal background opacity/ }),
      {
        target: { value: "64" },
      },
    );
    expect(backend.appearanceSaves.at(-1)).toEqual({
      windowOpacity: 92,
      terminalBackgroundOpacity: 64,
    });
    expect(screen.getByTestId("terminal-session-1")).toHaveAttribute(
      "data-opacity",
      "64",
    );

    await user.click(screen.getByRole("button", { name: "New tab" }));
    expect(screen.getByTestId("terminal-session-2")).toHaveAttribute(
      "data-opacity",
      "64",
    );

    await user.click(screen.getByRole("button", { name: "Reset defaults" }));
    expect(backend.appearanceSaves.at(-1)).toEqual({
      windowOpacity: 92,
      terminalBackgroundOpacity: 82,
    });
    expect(
      screen.getByRole("button", { name: "PowerShell 1" }),
    ).toBeInTheDocument();
    await user.keyboard("{Escape}");
    expect(
      screen.queryByRole("dialog", { name: "Appearance" }),
    ).not.toBeInTheDocument();
    await waitFor(() => expect(terminalSurfaceMocks.focus).toHaveBeenCalled());
  });

  it("shows the non-blocking native opacity warning", async () => {
    const user = userEvent.setup();
    backend.appearance = {
      ...backend.appearance,
      windowOpacityWarning:
        "Window opacity is unavailable; using a solid window.",
    };
    render(<App backend={backend} />);

    await user.click(
      await screen.findByRole("button", { name: "Appearance settings" }),
    );
    expect(
      screen.getByText("Window opacity is unavailable; using a solid window."),
    ).toBeInTheDocument();
  });
});
