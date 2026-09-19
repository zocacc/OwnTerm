import { describe, expect, it, vi } from "vitest";
import type { ImportAction, PortableGroup, PortableHost } from "./backend";

const invoke = vi.hoisted(() => vi.fn());
vi.mock("@tauri-apps/api/core", () => ({ invoke }));

import { tauriBackend, terminalEvents } from "./tauri-backend";

describe("terminal event names", () => {
  it("uses only characters accepted by Tauri", () => {
    const validName = /^[A-Za-z0-9_/:-]+$/;
    for (const name of Object.values(terminalEvents)) {
      expect(name).toMatch(validName);
      expect(name).not.toContain(".");
    }
  });
});

describe("portability commands", () => {
  it("sends groups, safe settings and selected entries to Tauri", async () => {
    const groups: PortableGroup[] = [{ name: "Production", sortOrder: 0 }];
    const host: PortableHost = {
      name: "edge",
      address: "edge.example",
      port: 22,
      tags: [],
      favorite: false,
      authKind: "none",
      credentialRequired: false,
    };
    const action: ImportAction = "create";
    await tauriBackend.applyImport?.(groups, { theme: "dark" }, [
      { host, action },
    ]);
    expect(invoke).toHaveBeenCalledWith("apply_import", {
      request: {
        groups,
        settings: { theme: "dark" },
        entries: [{ host, action }],
      },
    });
  });
});

describe("appearance commands", () => {
  it("uses typed read and write IPC payloads", async () => {
    invoke.mockResolvedValueOnce({
      windowOpacity: 92,
      terminalBackgroundOpacity: 82,
      windowOpacitySupport: "unsupported",
      windowOpacityApplied: false,
      windowOpacityWarning:
        "Window opacity is unavailable; using a solid window.",
      backdropConfigured: false,
      backdropWarning:
        "Windows backdrop is unavailable; using the opaque material fallback.",
      defaultsApplied: false,
    });
    const settings = await tauriBackend.getAppearanceSettings?.();
    expect(settings?.windowOpacityApplied).toBe(false);
    expect(settings?.windowOpacityWarning).toContain("solid window");
    expect(settings?.backdropConfigured).toBe(false);
    expect(settings?.backdropWarning).toContain("opaque material fallback");
    expect(invoke).toHaveBeenCalledWith("get_appearance_settings");
    await tauriBackend.saveAppearanceSettings?.({
      windowOpacity: 92,
      terminalBackgroundOpacity: 82,
    });
    expect(invoke).toHaveBeenCalledWith("save_appearance_settings", {
      request: { windowOpacity: 92, terminalBackgroundOpacity: 82 },
    });
  });
});
