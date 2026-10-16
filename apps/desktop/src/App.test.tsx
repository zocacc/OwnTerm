import { StrictMode, useEffect } from "react";
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
import type { BackdropChange } from "./services/native-window";
import { initialAppearance } from "./appearance/useTerminalAppearance";
import { mockBackend } from "./services/mock-backend";
import type {
  Backend,
  EventSubscription,
  SessionOutputEvent,
  SessionStatusEvent,
  SessionExitEvent,
  TerminalAppearanceProfile,
} from "./services/backend";

const native = vi.hoisted(() => ({
  close: vi.fn(async () => undefined),
  onCloseRequested: vi.fn<
    (handler: () => void, permitted: () => boolean) => Promise<() => void>
  >(async () => () => undefined),
  onBackdropChanged: vi.fn<
    (handler: (event: BackdropChange) => void) => Promise<() => void>
  >(async () => () => undefined),
}));
const terminal = vi.hoisted(() => ({
  write: vi.fn(),
  focus: vi.fn(),
  mounts: vi.fn(),
}));
vi.mock("./services/native-window", () => ({ nativeWindow: native }));
vi.mock("./terminal/TerminalSurface", () => ({
  TerminalSurface: ({
    active,
    sessionId,
    profile,
    onReady,
  }: {
    active: boolean;
    sessionId: string;
    profile: TerminalAppearanceProfile;
    onReady(id: string, handle?: unknown): void;
  }) => {
    useEffect(() => {
      terminal.mounts(sessionId);
      onReady(sessionId, {
        write: terminal.write,
        focus: terminal.focus,
        fit: vi.fn(),
        copy: vi.fn(),
        paste: vi.fn(),
      });
      return () => onReady(sessionId);
    }, [sessionId, onReady]);
    return (
      <div
        data-testid={`terminal-${sessionId}`}
        data-active={active}
        data-opacity={profile.terminalBackgroundOpacity}
      />
    );
  },
}));
function events<T>() {
  const handlers = new Set<(event: T) => void>();
  const release = vi.fn();
  const subscribe: EventSubscription<T> = async (handler) => {
    handlers.add(handler);
    return () => {
      handlers.delete(handler);
      release();
    };
  };
  return {
    subscribe: vi.fn(subscribe),
    emit: (event: T) => handlers.forEach((handler) => handler(event)),
    release,
  };
}
function fixture() {
  let next = 1;
  const output = events<SessionOutputEvent>();
  const status = events<SessionStatusEvent>();
  const exit = events<SessionExitEvent>();
  const settings = structuredClone(initialAppearance);
  settings.backdropConfigured = true;
  const backend = {
    ...mockBackend,
    listShellProfiles: vi.fn(async () => [
      { id: "cmd", name: "Command Prompt" },
      { id: "powershell", name: "PowerShell" },
    ]),
    startLocalSession: vi.fn(async (shellProfileId: string) => ({
      id: `session-${next++}`,
      kind: { type: "local" as const, shellProfileId },
      title: shellProfileId === "cmd" ? "Command Prompt" : "PowerShell",
      status: "connected" as const,
    })),
    closeSession: vi.fn<Backend["closeSession"]>(async () => undefined),
    getAppearanceSettings: vi.fn(async () => settings),
    saveAppearanceSettings: vi.fn(
      async (
        request: Parameters<NonNullable<Backend["saveAppearanceSettings"]>>[0],
      ) => {
        const profile = request.profiles!.find(
          (item) => item.id === request.activeProfileId,
        )!;
        return {
          ...settings,
          ...request,
          backdropConfigured: profile.useAcrylic,
        };
      },
    ),
    onSessionOutput: output.subscribe,
    onSessionStatus: status.subscribe,
    onSessionExit: exit.subscribe,
    onSessionTrustRequired: vi.fn(async () => () => undefined),
    onSessionCredentialRequired: vi.fn(async () => () => undefined),
  };
  return { backend, output, status, exit, settings };
}
let test: ReturnType<typeof fixture>;
beforeEach(() => {
  vi.clearAllMocks();
  native.onCloseRequested.mockResolvedValue(() => undefined);
  native.onBackdropChanged.mockResolvedValue(() => undefined);
  test = fixture();
});
afterEach(cleanup);
async function started() {
  await screen.findByRole("tab", { name: /PowerShell/ });
}

describe("terminal-first foundation", () => {
  it("does not replace a newer native event with the initial appearance response", async () => {
    let changed!: (event: BackdropChange) => void;
    let finish!: () => void;
    const gate = new Promise<void>((resolve) => {
      finish = resolve;
    });
    native.onBackdropChanged.mockImplementation(async (handler) => {
      changed = handler;
      return () => undefined;
    });
    test.backend.getAppearanceSettings.mockImplementation(async () => {
      await gate;
      return { ...test.settings, backdropRevision: 1 };
    });
    render(<App backend={test.backend} />);
    await started();
    act(() =>
      changed({ configured: false, revision: 2, warning: "Recovery failed" }),
    );
    await act(async () => finish());
    await screen.findByTestId("terminal-session-1");
    expect(document.documentElement.dataset.material).toBe("opaque");
    expect(
      screen.getByRole("button", { name: "Recovery failed" }),
    ).toBeInTheDocument();
  });
  it("accepts a newer native toggle response even when a recovery event arrived during the request", async () => {
    let changed!: (event: BackdropChange) => void;
    let finish!: () => void;
    const gate = new Promise<void>((resolve) => {
      finish = resolve;
    });
    native.onBackdropChanged.mockImplementation(async (handler) => {
      changed = handler;
      return () => undefined;
    });
    test.backend.saveAppearanceSettings.mockImplementation(async (request) => {
      await gate;
      return {
        ...test.settings,
        ...request,
        backdropConfigured: false,
        backdropRevision: 4,
      };
    });
    render(<App backend={test.backend} />);
    await started();
    await userEvent.click(
      screen.getByRole("button", { name: "Appearance settings" }),
    );
    await userEvent.click(
      screen.getByRole("checkbox", { name: /Use Windows/ }),
    );
    await waitFor(() =>
      expect(test.backend.saveAppearanceSettings).toHaveBeenCalledOnce(),
    );
    act(() => changed({ configured: true, revision: 3 }));
    await act(async () => finish());
    expect(document.documentElement.dataset.material).toBe("opaque");
    act(() => changed({ configured: true, revision: 3 }));
    expect(document.documentElement.dataset.material).toBe("opaque");
  });
  it("selects a surviving session when closing the window only partly succeeds", async () => {
    let request!: () => void;
    native.onCloseRequested.mockImplementation(async (handler) => {
      request = handler;
      return () => undefined;
    });
    test.backend.closeSession.mockImplementation(async (id) => {
      if (id === "session-2") throw new Error("busy");
    });
    const user = userEvent.setup();
    render(<App backend={test.backend} />);
    await started();
    await user.click(screen.getByRole("button", { name: "Choose shell" }));
    await user.click(screen.getByRole("menuitem", { name: "Command Prompt" }));
    await screen.findByRole("tab", { name: /Command Prompt/ });
    await user.click(screen.getByRole("tab", { name: /PowerShell/ }));
    act(() => request());
    await user.click(screen.getByRole("button", { name: "Close sessions" }));
    await waitFor(() =>
      expect(
        screen.queryByRole("tab", { name: /PowerShell/ }),
      ).not.toBeInTheDocument(),
    );
    expect(screen.getByTestId("terminal-session-2")).toHaveAttribute(
      "data-active",
      "true",
    );
    expect(native.close).not.toHaveBeenCalled();
  });
  it("cannot create a shell by shortcut while window closing is in flight", async () => {
    let finish!: () => void;
    test.backend.closeSession.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          finish = resolve;
        }),
    );
    render(<App backend={test.backend} />);
    await started();
    act(() =>
      test.exit.emit({ version: 1, sessionId: "session-1", exitCode: 0 }),
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Close PowerShell" }),
    );
    fireEvent.keyDown(window, { ctrlKey: true, shiftKey: true, key: "T" });
    expect(test.backend.startLocalSession).toHaveBeenCalledOnce();
    await act(async () => finish());
    await waitFor(() => expect(native.close).toHaveBeenCalledOnce());
  });
  it("does not overwrite a newer recovery event with an in-flight save response", async () => {
    let changed!: (event: BackdropChange) => void;
    let finish!: () => void;
    const gate = new Promise<void>((resolve) => {
      finish = resolve;
    });
    native.onBackdropChanged.mockImplementation(async (handler) => {
      changed = handler;
      return () => undefined;
    });
    test.backend.saveAppearanceSettings.mockImplementation(async (request) => {
      await gate;
      return { ...test.settings, ...request, backdropConfigured: true };
    });
    render(<App backend={test.backend} />);
    await started();
    await userEvent.click(
      screen.getByRole("button", { name: "Appearance settings" }),
    );
    fireEvent.change(
      screen.getByRole("slider", { name: /Interface opacity/ }),
      { target: { value: "0" } },
    );
    await waitFor(() =>
      expect(test.backend.saveAppearanceSettings).toHaveBeenCalledOnce(),
    );
    act(() =>
      changed({ configured: false, revision: 2, warning: "Recovery failed" }),
    );
    await act(async () => finish());
    expect(document.documentElement.dataset.material).toBe("opaque");
  });
  it("resets only the active profile opacity and material without deleting other profiles", async () => {
    const other = {
      ...test.settings.profiles[0],
      id: "other",
      name: "Keep me",
      terminalBackgroundOpacity: 75,
    };
    test.settings.profiles.push(other);
    test.settings.profiles[0].terminalBackgroundOpacity = 82;
    test.settings.profiles[0].windowOpacity = 30;
    test.settings.profiles[0].useAcrylic = false;
    render(<App backend={test.backend} />);
    await started();
    await userEvent.click(
      screen.getByRole("button", { name: "Appearance settings" }),
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Reset defaults" }),
    );
    await waitFor(() =>
      expect(test.backend.saveAppearanceSettings).toHaveBeenCalledOnce(),
    );
    const saved = test.backend.saveAppearanceSettings.mock.lastCall![0];
    expect(saved.profiles![0]).toMatchObject({
      windowOpacity: 92,
      terminalBackgroundOpacity: 0,
      useAcrylic: true,
    });
    expect(saved.profiles![1]).toEqual(other);
  });
  it("rediscovers shells on retry without requiring an app restart", async () => {
    test.backend.listShellProfiles.mockResolvedValueOnce([]);
    render(<App backend={test.backend} />);
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "No local shells detected",
    );
    expect(test.backend.startLocalSession).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole("button", { name: "Retry" }));
    await started();
    expect(test.backend.startLocalSession).toHaveBeenCalledOnce();
    expect(test.backend.listShellProfiles).toHaveBeenCalledTimes(2);
  });
  it("does not overwrite saved profiles when appearance loading fails", async () => {
    test.backend.getAppearanceSettings.mockRejectedValue(
      new Error("storage failure"),
    );
    render(<App backend={test.backend} />);
    await started();
    await userEvent.click(
      screen.getByRole("button", { name: "Appearance settings" }),
    );
    expect(
      screen.getByRole("slider", { name: /Interface opacity/ }),
    ).toBeDisabled();
    expect(
      screen.getByRole("slider", { name: /Terminal background opacity/ }),
    ).toBeDisabled();
    expect(test.backend.saveAppearanceSettings).not.toHaveBeenCalled();
    expect(document.documentElement.dataset.material).toBe("opaque");
  });
  it("intercepts native close requests and requires the same confirmation", async () => {
    let request!: () => void;
    let permitted!: () => boolean;
    native.onCloseRequested.mockImplementation(async (handler, allowed) => {
      request = handler;
      permitted = allowed;
      return () => undefined;
    });
    render(<App backend={test.backend} />);
    await started();
    expect(permitted()).toBe(false);
    act(() => request());
    expect(screen.getByRole("alertdialog")).toBeInTheDocument();
    await userEvent.click(
      screen.getByRole("button", { name: "Close sessions" }),
    );
    await waitFor(() => expect(native.close).toHaveBeenCalledOnce());
    expect(permitted()).toBe(true);
  });
  it("updates the fallback when native composition recovery fails and succeeds", async () => {
    let changed!: (event: BackdropChange) => void;
    native.onBackdropChanged.mockImplementation(async (handler) => {
      changed = handler;
      return () => undefined;
    });
    render(<App backend={test.backend} />);
    await started();
    act(() =>
      changed({ configured: false, revision: 2, warning: "Recovery failed" }),
    );
    expect(document.documentElement.dataset.material).toBe("opaque");
    expect(
      screen.getByRole("button", { name: "Recovery failed" }),
    ).toBeInTheDocument();
    act(() => changed({ configured: true, revision: 3 }));
    expect(document.documentElement.dataset.material).toBe("backdrop");
    expect(
      screen.queryByRole("button", { name: "Recovery failed" }),
    ).not.toBeInTheDocument();
    expect(terminal.mounts).toHaveBeenCalledOnce();
  });
  it("starts one default local session in StrictMode without an intermediate screen", async () => {
    render(
      <StrictMode>
        <App backend={test.backend} />
      </StrictMode>,
    );
    await started();
    expect(test.backend.startLocalSession).toHaveBeenCalledExactlyOnceWith(
      "powershell",
      24,
      80,
    );
    expect(screen.queryByText("Open default shell")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /connections/i }),
    ).not.toBeInTheDocument();
    expect(document.querySelector("main")?.children[0]).toHaveClass("titlebar");
    expect(document.querySelector("main")?.children[1]).toHaveClass(
      "terminal-view",
    );
  });
  it("waits for every event subscription before starting a process", async () => {
    let finish!: (release: () => undefined) => void;
    test.backend.onSessionCredentialRequired.mockImplementation(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    render(<App backend={test.backend} />);
    await waitFor(() =>
      expect(test.backend.onSessionOutput).toHaveBeenCalled(),
    );
    expect(test.backend.startLocalSession).not.toHaveBeenCalled();
    await act(async () => finish(() => undefined));
    await started();
  });
  it("does not create a session when event installation fails and releases successful subscriptions", async () => {
    test.backend.onSessionCredentialRequired.mockRejectedValue(
      new Error("unavailable"),
    );
    render(<App backend={test.backend} />);
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Could not prepare terminal events",
    );
    expect(test.backend.startLocalSession).not.toHaveBeenCalled();
    expect(test.output.release).toHaveBeenCalledOnce();
  });
  it("delivers output and process exit received before the start response", async () => {
    test.backend.startLocalSession.mockImplementation(
      async (shellProfileId) => {
        test.output.emit({ version: 1, sessionId: "early", data: [65, 66] });
        test.exit.emit({ version: 1, sessionId: "early", exitCode: 7 });
        return {
          id: "early",
          title: "PowerShell",
          kind: { type: "local", shellProfileId },
          status: "connected",
        };
      },
    );
    render(<App backend={test.backend} />);
    await started();
    await waitFor(() => expect(terminal.write).toHaveBeenCalledWith([65, 66]));
    expect(screen.getByText(/Process exited \(7\)/)).toBeInTheDocument();
  });
  it("opens shells from the small menu and keeps existing terminals mounted when switching", async () => {
    const user = userEvent.setup();
    render(<App backend={test.backend} />);
    await started();
    const first = screen.getByTestId("terminal-session-1");
    await user.click(screen.getByRole("button", { name: "Choose shell" }));
    await user.click(screen.getByRole("menuitem", { name: "Command Prompt" }));
    const cmd = await screen.findByRole("tab", { name: /Command Prompt/ });
    expect(screen.getByTestId("terminal-session-2")).toHaveAttribute(
      "data-active",
      "true",
    );
    fireEvent.keyDown(window, { ctrlKey: true, key: "Tab" });
    expect(first).toHaveAttribute("data-active", "true");
    await user.click(cmd);
    expect(first.isConnected).toBe(true);
    expect(terminal.mounts).toHaveBeenCalledTimes(2);
  });
  it("requires confirmation and closes the window only after the final session is closed", async () => {
    const user = userEvent.setup();
    render(<App backend={test.backend} />);
    await started();
    await user.click(screen.getByRole("button", { name: "Close PowerShell" }));
    expect(test.backend.closeSession).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.getByRole("tab", { name: /PowerShell/ })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Close PowerShell" }));
    await user.click(screen.getByRole("button", { name: "Close sessions" }));
    await waitFor(() => expect(native.close).toHaveBeenCalledOnce());
    expect(test.backend.closeSession).toHaveBeenCalledWith("session-1");
  });
  it("keeps the tab when process termination fails", async () => {
    const user = userEvent.setup();
    test.backend.closeSession.mockRejectedValue(new Error("unavailable"));
    render(<App backend={test.backend} />);
    await started();
    await user.click(screen.getByRole("button", { name: "Close PowerShell" }));
    await user.click(screen.getByRole("button", { name: "Close sessions" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "tab was kept open",
    );
    expect(screen.getByRole("tab", { name: /PowerShell/ })).toBeInTheDocument();
    expect(native.close).not.toHaveBeenCalled();
  });
  it("keeps saved opacity and serializes slider saves without recreating a terminal", async () => {
    const user = userEvent.setup();
    test.settings.profiles[0].terminalBackgroundOpacity = 82;
    render(<App backend={test.backend} />);
    await started();
    expect(screen.getByTestId("terminal-session-1")).toHaveAttribute(
      "data-opacity",
      "82",
    );
    await user.click(
      screen.getByRole("button", { name: "Appearance settings" }),
    );
    fireEvent.change(
      screen.getByRole("slider", { name: /Interface opacity/ }),
      { target: { value: "0" } },
    );
    fireEvent.change(
      screen.getByRole("slider", { name: /Terminal background opacity/ }),
      { target: { value: "0" } },
    );
    await waitFor(() =>
      expect(test.backend.saveAppearanceSettings).toHaveBeenCalledTimes(2),
    );
    expect(test.backend.saveAppearanceSettings.mock.lastCall![0]).toMatchObject(
      { windowOpacity: 0, terminalBackgroundOpacity: 0 },
    );
    expect(screen.getByTestId("terminal-session-1")).toHaveAttribute(
      "data-opacity",
      "0",
    );
    expect(terminal.mounts).toHaveBeenCalledOnce();
    expect(document.documentElement.dataset.material).toBe("backdrop");
  });
  it("reports a native fallback without occupying a permanent layout region", async () => {
    test.settings.backdropConfigured = false;
    test.settings.backdropWarning = "Acrylic could not be configured.";
    render(<App backend={test.backend} />);
    await started();
    expect(
      await screen.findByRole("button", {
        name: "Acrylic could not be configured.",
      }),
    ).toBeInTheDocument();
    expect(document.documentElement.dataset.material).toBe("opaque");
  });
  it("retries a failed local launch without automatically looping", async () => {
    const user = userEvent.setup();
    test.backend.startLocalSession.mockRejectedValueOnce(new Error("failure"));
    render(<App backend={test.backend} />);
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Could not start the shell",
    );
    expect(test.backend.startLocalSession).toHaveBeenCalledOnce();
    await user.click(screen.getByRole("button", { name: "Retry" }));
    await started();
    expect(test.backend.startLocalSession).toHaveBeenCalledTimes(2);
  });
});
