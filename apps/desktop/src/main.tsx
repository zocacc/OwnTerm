import { invoke, isTauri } from "@tauri-apps/api/core";
import { bootstrap } from "./bootstrap";

// Do not statically import React, App, application CSS or xterm here.
// The no-xterm diagnostic must branch before any of those modules execute.
void bootstrap({
  search: location.search,
  launchMode: async () =>
    isTauri() ? invoke<string>("get_launch_mode") : "terminal",
  loadTerminal: async () => {
    await import("./terminal-entry");
  },
  loadDiagnostic: async (stage) => {
    const { startDiagnostic } = await import("./diagnostics/transparency-test");
    await startDiagnostic(stage);
  },
}).catch(() => {
  const root = document.getElementById("root")!;
  root.textContent =
    "OwnTerm could not select its launch mode. Close and restart the application.";
});
