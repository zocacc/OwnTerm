import { describe, expect, it, vi } from "vitest";
import { bootstrap, diagnosticStage } from "./bootstrap";

function loaders(mode = "terminal") {
  return {
    search: "",
    launchMode: vi.fn(async () => mode),
    loadTerminal: vi.fn(async () => undefined),
    loadDiagnostic: vi.fn(async () => undefined),
  };
}

describe("isolated launch mode", () => {
  it("starts the ordinary application only in normal mode", async () => {
    const options = loaders();
    await bootstrap(options);
    expect(options.loadTerminal).toHaveBeenCalledOnce();
    expect(options.loadDiagnostic).not.toHaveBeenCalled();
  });

  it("starts the native diagnostic before loading the application", async () => {
    const options = loaders("transparency-test");
    await bootstrap(options);
    expect(options.loadDiagnostic).toHaveBeenCalledExactlyOnceWith(1);
    expect(options.loadTerminal).not.toHaveBeenCalled();
  });

  it("allows explicit no-xterm stages and rejects unsupported stages", async () => {
    const options = { ...loaders(), search: "?transparency-test=3" };
    await bootstrap(options);
    expect(options.loadDiagnostic).toHaveBeenCalledExactlyOnceWith(3);
    expect(options.loadTerminal).not.toHaveBeenCalled();
    expect(diagnosticStage("?transparency-test=4")).toBeUndefined();
    expect(diagnosticStage("?transparency-test=App")).toBeUndefined();
  });

  it("does not silently load xterm when native launch-mode lookup fails", async () => {
    const options = loaders();
    options.launchMode.mockRejectedValue(new Error("native unavailable"));
    await expect(bootstrap(options)).rejects.toThrow("native unavailable");
    expect(options.loadDiagnostic).not.toHaveBeenCalled();
    expect(options.loadTerminal).not.toHaveBeenCalled();
  });
});
