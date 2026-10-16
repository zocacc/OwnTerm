import { invoke, isTauri } from "@tauri-apps/api/core";
import type { DiagnosticStage } from "../bootstrap";
import "./transparency-test.css";

const labels = {
  1: "Pass 1: minimal DOM, no React or xterm",
  2: "Pass 2: React root, no titlebar or xterm",
  3: "Pass 3: custom titlebar, no xterm",
};

export async function startDiagnostic(stage: DiagnosticStage) {
  document.documentElement.dataset.transparencyTest = String(stage);
  const root = document.getElementById("root")!;
  if (stage === 1) {
    const text = document.createElement("h1");
    text.textContent = "Transparency Test";
    root.replaceChildren(text);
  } else {
    const { renderDiagnosticStage } = await import("./react-stages");
    renderDiagnosticStage(stage, root);
  }
  const panel = document.createElement("aside");
  panel.className = "diagnostic-tools";
  panel.innerHTML = `<strong>Window composition diagnostic</strong><p>${labels[stage]}</p>
    <p>No App, xterm, session or saved preference is loaded. Move a colorful window behind this one.</p>
    <nav aria-label="Diagnostic stages">
      <a href="?transparency-test=1">1 · DOM</a>
      <a href="?transparency-test=2">2 · React</a>
      <a href="?transparency-test=3">3 · Titlebar</a>
    </nav><p class="diagnostic-status" role="status">Reading native configuration…</p>
    <button type="button">Copy diagnostic report</button>
    <details><summary>Native and DOM measurements</summary><pre></pre></details>`;
  document.body.append(panel);
  let native:
    | { backdropConfigured?: boolean; webviewRuntime?: string | null }
    | undefined;
  let error: string | undefined;
  if (isTauri()) {
    try {
      native = await invoke("prepare_transparency_test");
    } catch (reason) {
      error = String(reason);
    }
  } else {
    error = "Browser-only test: Windows/DWM/WebView2 are not available here.";
  }
  panel.querySelector(".diagnostic-status")!.textContent =
    error ??
    `Acrylic configured: ${String(native?.backdropConfigured)}. Runtime: ${native?.webviewRuntime ?? "unknown"}. Visual confirmation is still required.`;
  const collect = () => ({
    diagnosticStage: stage,
    description: labels[stage],
    native,
    error,
    layers: ["html", "body", "#root", ".diagnostic-titlebar"].flatMap(
      (selector) => {
        const element = document.querySelector(selector);
        if (!element) return [];
        const style = getComputedStyle(element);
        return [
          {
            selector,
            background: style.backgroundColor,
            opacity: style.opacity,
            filter: style.filter,
            backdropFilter: style.backdropFilter,
            colorScheme: style.colorScheme,
          },
        ];
      },
    ),
    xtermElementCount: document.querySelectorAll(".xterm").length,
    customTitlebarCount: document.querySelectorAll(".diagnostic-titlebar")
      .length,
    customWindowControlsCount:
      document.querySelectorAll(".window-controls").length,
  });
  const display = () => {
    panel.querySelector("pre")!.textContent = JSON.stringify(
      collect(),
      null,
      2,
    );
  };
  display();
  panel.querySelector("details")!.addEventListener("toggle", display);
  panel.querySelector("button")!.addEventListener("click", () => {
    void navigator.clipboard
      .writeText(JSON.stringify(collect(), null, 2))
      .then(() => {
        panel.querySelector(".diagnostic-status")!.textContent =
          "Report copied. No terminal output, hosts or credentials are included.";
      })
      .catch(() => {
        panel.querySelector(".diagnostic-status")!.textContent =
          "Clipboard unavailable. Select the report under Native and DOM measurements.";
      });
  });
}
