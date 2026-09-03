import { act, cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import App from "./App";
import type {
  Backend,
  SessionExitEvent,
  SessionOutputEvent,
  SessionStatusEvent,
} from "./services/backend";

vi.mock("./terminal/TerminalSurface", () => ({
  TerminalSurface: ({
    active,
    sessionId,
  }: {
    active: boolean;
    sessionId: string;
  }) => <div data-active={active} data-testid={`terminal-${sessionId}`} />,
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
  readonly closedSessions: string[] = [];

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

  async writeSession() {
    return undefined;
  }

  async resizeSession() {
    return undefined;
  }

  async closeSession(sessionId: string) {
    this.closedSessions.push(sessionId);
  }

  onSessionOutput = async (handler: (event: SessionOutputEvent) => void) => {
    this.outputHandlers.add(handler);
    return () => this.outputHandlers.delete(handler);
  };

  onSessionStatus = async (handler: (event: SessionStatusEvent) => void) => {
    this.statusHandlers.add(handler);
    return () => this.statusHandlers.delete(handler);
  };

  onSessionExit = async (handler: (event: SessionExitEvent) => void) => {
    this.exitHandlers.add(handler);
    return () => this.exitHandlers.delete(handler);
  };

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

    const openButton = await screen.findByRole("button", { name: "Nova aba" });
    await user.click(openButton);
    await user.click(openButton);

    const firstTab = screen.getByRole("button", { name: "PowerShell 1" });
    const secondTab = screen.getByRole("button", { name: "PowerShell 2" });
    expect(secondTab).toHaveAttribute("aria-current", "page");

    await user.click(firstTab);
    expect(firstTab).toHaveAttribute("aria-current", "page");

    await user.click(
      screen.getByRole("button", { name: "Fechar PowerShell 1" }),
    );
    expect(firstTab).not.toBeInTheDocument();
    expect(secondTab).toHaveAttribute("aria-current", "page");
    expect(backend.closedSessions).toEqual(["session-1"]);
  });

  it("shows process exit code when the backend publishes it", async () => {
    const user = userEvent.setup();
    render(<App backend={backend} />);

    await user.click(await screen.findByRole("button", { name: "Nova aba" }));
    act(() => {
      backend.emitExit({
        version: 1,
        sessionId: "session-1",
        exitCode: 7,
      });
    });

    expect(screen.getByRole("status")).toHaveTextContent(
      "Encerrado · código 7",
    );
  });

  it("ignores status and exit events after a tab was closed", async () => {
    const user = userEvent.setup();
    render(<App backend={backend} />);

    await user.click(await screen.findByRole("button", { name: "Nova aba" }));
    await user.click(
      screen.getByRole("button", { name: "Fechar PowerShell 1" }),
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
    expect(screen.getByText("Nenhuma sessão aberta")).toBeInTheDocument();
    expect(screen.queryByText(/late event/)).not.toBeInTheDocument();
  });
});
