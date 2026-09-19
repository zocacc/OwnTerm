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
      fit: vi.fn(),
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
  readonly startedShellProfiles: string[] = [];
  localSessionGate?: Promise<void>;
  shellProfiles = [{ id: "powershell", name: "PowerShell" }];
  readonly appearanceSaves: Array<
    Pick<AppearanceSettings, "windowOpacity" | "terminalBackgroundOpacity">
  > = [];
  appearance: AppearanceSettings = {
    windowOpacity: 92,
    terminalBackgroundOpacity: 82,
    windowOpacitySupport: "unsupported",
    windowOpacityApplied: false,
    windowOpacityWarning: null,
    acrylicApplied: true,
    acrylicWarning: null,
    defaultsApplied: false,
    activeProfileId: "migrated-appearance",
    profiles: [
      {
        id: "migrated-appearance",
        name: "Migrated appearance",
        colorSchemeId: "ownterm-default",
        fontFamily: "Consolas",
        fontSize: 14,
        windowOpacity: 92,
        terminalBackgroundOpacity: 82,
        useAcrylic: true,
        builtIn: false,
      },
    ],
    colorSchemes: [
      {
        id: "ownterm-default",
        name: "OwnTerm Default",
        background: "#0c0f15",
        foreground: "#f4f2f8",
        cursor: "#b9a7ff",
        selectionBackground: "#6750a455",
        ansi: Array(16).fill("#ffffff"),
        builtIn: true,
      },
    ],
  };

  async appInfo() {
    return { name: "OwnTerm", version: "0.1.0-test" };
  }

  async listShellProfiles() {
    return this.shellProfiles;
  }

  async startLocalSession(shellProfileId: string) {
    this.startedShellProfiles.push(shellProfileId);
    await this.localSessionGate;
    const id = `session-${this.nextSession++}`;
    const profile = this.shellProfiles.find(
      (item) => item.id === shellProfileId,
    );
    return {
      id,
      kind: { type: "local" as const, shellProfileId },
      title: `${profile?.name ?? shellProfileId} ${id.slice(-1)}`,
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

    expect(
      await screen.findByRole("button", { name: "Open session launcher" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Expand connections" }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("tab")).not.toBeInTheDocument();
  });

  it("offers primary shell and connection actions from the empty workspace", async () => {
    const user = userEvent.setup();
    render(<App backend={backend} />);

    expect(
      screen.queryByRole("button", { name: "Open connections" }),
    ).not.toBeInTheDocument();
    await user.click(
      await screen.findByRole("button", { name: "Open default shell" }),
    );
    expect(
      await screen.findByRole("tab", { name: "PowerShell 1" }),
    ).toBeInTheDocument();
  });

  it("opens local profiles from the accessible session launcher", async () => {
    const user = userEvent.setup();
    backend.shellProfiles = [
      { id: "powershell", name: "PowerShell" },
      { id: "cmd", name: "Command Prompt" },
    ];
    render(<App backend={backend} />);

    const launcher = await screen.findByRole("button", {
      name: "Open session launcher",
    });
    await user.click(launcher);
    expect(
      screen.getByRole("menu", { name: "Session launcher" }),
    ).toBeInTheDocument();
    const firstProfile = screen.getByRole("menuitem", {
      name: /PowerShell.*Local shell/,
    });
    expect(firstProfile).toHaveFocus();
    await user.keyboard("{ArrowDown}");
    expect(
      screen.getByRole("menuitem", { name: /Command Prompt.*Local shell/ }),
    ).toHaveFocus();
    await user.keyboard("{Enter}");
    expect(backend.startedShellProfiles).toEqual(["cmd"]);
    expect(screen.queryByRole("menu", { name: "Session launcher" })).toBeNull();
    expect(
      await screen.findByRole("tab", { name: "Command Prompt 1" }),
    ).toBeInTheDocument();

    fireEvent.keyDown(window, { ctrlKey: true, shiftKey: true, key: "p" });
    expect(
      await screen.findByRole("menu", { name: "Session launcher" }),
    ).toBeInTheDocument();
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("menu", { name: "Session launcher" })).toBeNull();
    await waitFor(() => expect(launcher).toHaveFocus());

    expect(screen.queryByRole("menuitem", { name: "Connections…" })).toBeNull();
    expect(
      screen.queryByRole("menuitem", { name: "Quick Connect…" }),
    ).toBeNull();
  });

  it("keeps the drawer trigger as the connection entry point when no local profile is detected", async () => {
    const user = userEvent.setup();
    backend.shellProfiles = [];
    render(<App backend={backend} />);

    await user.click(
      await screen.findByRole("button", { name: "Open session launcher" }),
    );
    expect(screen.queryByRole("menuitem", { name: /Local shell/ })).toBeNull();
    expect(screen.getByRole("status")).toHaveTextContent(
      "No local shells detected",
    );
    expect(screen.getByRole("button", { name: "New tab" })).toBeDisabled();
    await user.keyboard("{Escape}");

    await user.click(
      screen.getByRole("button", { name: "Expand connections" }),
    );
    expect(
      await screen.findByRole("dialog", { name: "Connections" }),
    ).toBeInTheDocument();
  });

  it("prevents duplicate local sessions while a launch is pending", async () => {
    let release: (() => void) | undefined;
    backend.localSessionGate = new Promise((resolve) => {
      release = resolve;
    });
    render(<App backend={backend} />);

    const openButton = await screen.findByRole("button", { name: "New tab" });
    fireEvent.click(openButton);
    fireEvent.click(openButton);
    expect(backend.startedShellProfiles).toEqual(["powershell"]);
    release?.();
    expect(
      await screen.findByRole("tab", { name: "PowerShell 1" }),
    ).toBeInTheDocument();
  });

  it("opens and closes the connections drawer with its trigger, backdrop and Escape", async () => {
    const user = userEvent.setup();
    render(<App backend={backend} />);

    const trigger = await screen.findByRole("button", {
      name: "Expand connections",
    });
    await user.click(trigger);
    const drawer = await screen.findByRole("dialog", { name: "Connections" });
    expect(screen.getAllByText("Connections")).toHaveLength(1);
    expect(screen.getByLabelText("Search hosts")).toHaveFocus();
    expect(
      screen.queryByRole("button", { name: "Close connections" }),
    ).toBeNull();

    fireEvent.mouseDown(drawer.parentElement!);
    expect(screen.queryByRole("dialog", { name: "Connections" })).toBeNull();
    await waitFor(() => expect(trigger).toHaveFocus());

    await user.click(trigger);
    expect(
      await screen.findByRole("dialog", { name: "Connections" }),
    ).toBeInTheDocument();
    fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.queryByRole("dialog", { name: "Connections" })).toBeNull();
  });

  it("keeps the drawer open for its internal dialog and preserves terminal surfaces", async () => {
    const user = userEvent.setup();
    render(<App backend={backend} />);

    await user.click(await screen.findByRole("button", { name: "New tab" }));
    const terminal = screen.getByTestId("terminal-session-1");
    await user.click(
      screen.getByRole("button", { name: "Expand connections" }),
    );
    expect(screen.getByTestId("terminal-session-1")).toBe(terminal);

    await user.click(screen.getByRole("button", { name: "New" }));
    expect(await screen.findByLabelText("Name")).toHaveFocus();
    fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.getByLabelText("Name")).toBeInTheDocument();
    expect(
      screen.getByRole("dialog", { name: "Connections" }),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Cancel" }));
    await user.click(
      screen.getByRole("button", { name: "Collapse connections" }),
    );
    expect(screen.getByTestId("terminal-session-1")).toBe(terminal);
  });

  it("opens a local shell from the drawer and closes it after success", async () => {
    const user = userEvent.setup();
    render(<App backend={backend} />);

    await user.click(
      await screen.findByRole("button", { name: "Expand connections" }),
    );
    await user.click(
      await screen.findByRole("button", { name: "Open a local shell" }),
    );
    expect(
      await screen.findByRole("tab", { name: "PowerShell 1" }),
    ).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.queryByRole("dialog", { name: "Connections" })).toBeNull(),
    );
  });

  it("opens, navigates and closes local session tabs", async () => {
    const user = userEvent.setup();
    render(<App backend={backend} />);

    const openButton = await screen.findByRole("button", { name: "New tab" });
    await user.click(openButton);
    expect(screen.getAllByRole("tab")).toHaveLength(1);
    await user.click(openButton);

    const firstTab = screen.getByRole("tab", { name: "PowerShell 1" });
    const secondTab = screen.getByRole("tab", { name: "PowerShell 2" });
    expect(secondTab).toHaveAttribute("aria-current", "page");
    expect(
      screen.getByRole("tablist", { name: "Sessions" }),
    ).toBeInTheDocument();
    expect(secondTab).toHaveAttribute("aria-selected", "true");
    expect(secondTab).toHaveAccessibleDescription("Connected");
    expect(screen.getAllByTitle("Connected")).toHaveLength(2);

    secondTab.focus();
    await user.keyboard("{ArrowLeft}");
    expect(firstTab).toHaveFocus();
    expect(firstTab).toHaveAttribute("aria-current", "page");
    await user.keyboard("{End}");
    expect(secondTab).toHaveFocus();
    await user.keyboard("{Home}");
    expect(firstTab).toHaveFocus();

    await user.click(
      screen.getByRole("button", { name: "Close PowerShell 1" }),
    );
    expect(firstTab).not.toBeInTheDocument();
    expect(secondTab).toHaveAttribute("aria-current", "page");
    expect(backend.closedSessions).toEqual(["session-1"]);
  });

  it("announces every terminal status with text and a tooltip", async () => {
    const user = userEvent.setup();
    render(<App backend={backend} />);

    await user.click(await screen.findByRole("button", { name: "New tab" }));
    const tab = screen.getByRole("tab", { name: "PowerShell 1" });
    const statuses = [
      ["starting", "Starting"],
      ["awaiting_trust", "Awaiting trust"],
      ["awaiting_credential", "Awaiting credential"],
      ["connected", "Connected"],
      ["disconnected", "Closed"],
      ["failed", "Failed"],
    ] as const;

    for (const [status, label] of statuses) {
      act(() => {
        backend.emitStatus({
          version: 1,
          sessionId: "session-1",
          status,
        });
      });
      expect(tab).toHaveAccessibleDescription(label);
      expect(screen.getByTitle(label)).toBeInTheDocument();
    }
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
      screen.queryByRole("tab", { name: "PowerShell 1" }),
    ).not.toBeInTheDocument();
    expect(screen.getByText("No open sessions")).toBeInTheDocument();
    expect(screen.queryByText(/late event/)).not.toBeInTheDocument();
  });

  it("handles TOFU and an ephemeral SSH credential", async () => {
    const user = userEvent.setup();
    render(<App backend={backend} />);

    await screen.findByRole("button", { name: "New tab" });
    await user.click(
      screen.getByRole("button", { name: "Expand connections" }),
    );
    await user.type(
      await screen.findByLabelText("Quick Connect"),
      "alice@example.test:2222",
    );
    await user.click(screen.getByRole("button", { name: "Connect" }));
    expect(
      await screen.findByRole("tab", { name: "alice@example.test:2222" }),
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
    await user.click(
      screen.getByRole("button", { name: "Expand connections" }),
    );
    await user.type(
      await screen.findByLabelText("Quick Connect"),
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
      screen.getAllByRole("tab", { name: "alice@changed.test" }),
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

    fireEvent.change(screen.getByRole("slider", { name: /Window opacity/ }), {
      target: { value: "100" },
    });
    expect(backend.appearanceSaves.at(-1)).toMatchObject({
      windowOpacity: 100,
      terminalBackgroundOpacity: 82,
      activeProfileId: "migrated-appearance",
    });
    expect(screen.getByTestId("terminal-session-1")).toHaveAttribute(
      "data-opacity",
      "82",
    );

    fireEvent.change(
      screen.getByRole("slider", { name: /Terminal background opacity/ }),
      {
        target: { value: "64" },
      },
    );
    expect(backend.appearanceSaves.at(-1)).toMatchObject({
      windowOpacity: 100,
      terminalBackgroundOpacity: 64,
      activeProfileId: "migrated-appearance",
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
    expect(backend.appearanceSaves.at(-1)).toMatchObject({
      windowOpacity: 92,
      terminalBackgroundOpacity: 82,
    });
    expect(
      screen.getByRole("tab", { name: "PowerShell 1" }),
    ).toBeInTheDocument();
    await user.keyboard("{Escape}");
    expect(
      screen.queryByRole("dialog", { name: "Appearance" }),
    ).not.toBeInTheDocument();
    await waitFor(() => expect(terminalSurfaceMocks.focus).toHaveBeenCalled());
  });

  it("uses a chrome-only CSS variable for window opacity", async () => {
    const user = userEvent.setup();
    render(<App backend={backend} />);

    await user.click(
      await screen.findByRole("button", { name: "Appearance settings" }),
    );
    fireEvent.change(screen.getByRole("slider", { name: /Window opacity/ }), {
      target: { value: "55" },
    });
    expect(
      document.documentElement.style.getPropertyValue("--window-opacity"),
    ).toBe("0.55");
  });

  it("uses the opaque CSS fallback when native Acrylic is unavailable", async () => {
    const user = userEvent.setup();
    backend.appearance = {
      ...backend.appearance,
      acrylicApplied: false,
      acrylicWarning:
        "Acrylic is unavailable; using the opaque material fallback.",
    };
    render(<App backend={backend} />);

    await user.click(
      await screen.findByRole("button", { name: "Appearance settings" }),
    );
    expect(
      screen.getByText(
        "Acrylic is unavailable; using the opaque material fallback.",
      ),
    ).toBeInTheDocument();
    expect(document.documentElement.dataset.material).toBe("opaque");
  });
});
