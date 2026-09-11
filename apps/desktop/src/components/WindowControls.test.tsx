import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { WindowControls } from "./WindowControls";

const native = vi.hoisted(() => ({
  invoke: vi.fn(),
  minimize: vi.fn(),
  toggleMaximize: vi.fn(),
  close: vi.fn(),
}));
vi.mock("@tauri-apps/api/core", () => ({
  isTauri: () => true,
  invoke: native.invoke,
}));
vi.mock("@tauri-apps/api/window", () => ({ getCurrentWindow: () => native }));
afterEach(() => {
  cleanup();
  vi.resetAllMocks();
  delete document.documentElement.dataset.material;
});

describe("native window presentation", () => {
  it("keeps an opaque surface when Acrylic is unavailable and wires the replacement controls", async () => {
    native.invoke.mockImplementation(async (command) => {
      if (command === "prepare_window_chrome")
        return { customTitlebar: true, acrylic: false };
      // The native bar must not disappear before its replacement exists.
      expect(
        screen.getByRole("button", { name: "Close window" }),
      ).toBeInTheDocument();
    });
    native.minimize.mockResolvedValue(undefined);
    native.toggleMaximize.mockResolvedValue(undefined);
    native.close.mockResolvedValue(undefined);
    render(<WindowControls />);
    await userEvent.click(
      await screen.findByRole("button", { name: "Minimize window" }),
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Maximize or restore window" }),
    );
    await userEvent.click(screen.getByRole("button", { name: "Close window" }));
    expect(document.documentElement.dataset.material).toBe("opaque");
    expect(native.minimize).toHaveBeenCalledOnce();
    expect(native.toggleMaximize).toHaveBeenCalledOnce();
    expect(native.close).toHaveBeenCalledOnce();
  });

  it("retains native chrome if presentation initialization fails", async () => {
    native.invoke.mockRejectedValue(new Error("unavailable"));
    render(<WindowControls />);
    await waitFor(() => expect(native.invoke).toHaveBeenCalledOnce());
    expect(native.invoke).not.toHaveBeenCalledWith("show_custom_chrome");
    expect(
      screen.queryByRole("button", { name: "Close window" }),
    ).not.toBeInTheDocument();
    expect(document.documentElement.dataset.material).toBeUndefined();
  });
});
