import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "../../src/App";
import type { AppearanceSettings, Backend } from "../../src/services/backend";
import { mockBackend } from "../../src/services/mock-backend";
import "../../src/index.css";

// Only the OS/PTY boundary is simulated. App, TerminalSurface, xterm and CSS
// are production code; the containing page supplies a known external color.
let appearance: AppearanceSettings = {
  windowOpacity: 100,
  terminalBackgroundOpacity: 55,
  windowOpacitySupport: "supported",
  windowOpacityApplied: true,
  windowOpacityWarning: null,
  backdropConfigured: true,
  backdropWarning: null,
  defaultsApplied: false,
  activeProfileId: "composition-test",
  profiles: [
    {
      id: "composition-test",
      name: "Composition test",
      colorSchemeId: "test",
      fontFamily: "monospace",
      fontSize: 16,
      windowOpacity: 100,
      terminalBackgroundOpacity: 55,
      useAcrylic: true,
      builtIn: false,
    },
  ],
  colorSchemes: [
    {
      id: "test",
      name: "Test",
      background: "#0c0f15",
      foreground: "#ffffff",
      cursor: "#ffffff",
      selectionBackground: "#6750a455",
      ansi: Array(16).fill("#ffffff"),
      builtIn: false,
    },
  ],
};

const backend: Backend = {
  ...mockBackend,
  getAppearanceSettings: async () => appearance,
  saveAppearanceSettings: async (request) => {
    const profiles = request.profiles ?? appearance.profiles;
    const active =
      profiles.find((profile) => profile.id === request.activeProfileId) ??
      profiles[0];
    appearance = {
      ...appearance,
      ...request,
      backdropConfigured: active.useAcrylic,
      backdropWarning: null,
    };
    return appearance;
  },
};

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App backend={backend} />
  </StrictMode>,
);
