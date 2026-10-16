import { createRoot } from "react-dom/client";
import { flushSync } from "react-dom";
import type { DiagnosticStage } from "../bootstrap";
import { WindowControls } from "../components/WindowControls";

export function renderDiagnosticStage(
  stage: DiagnosticStage,
  root: HTMLElement,
) {
  const renderer = createRoot(root);
  flushSync(() =>
    renderer.render(
      <>
        {stage === 3 ? (
          <header className="diagnostic-titlebar">
            <span data-tauri-drag-region>OwnTerm · Transparency Test</span>
            <div className="diagnostic-drag" data-tauri-drag-region />
            <WindowControls />
          </header>
        ) : null}
        <h1>Transparency Test</h1>
      </>,
    ),
  );
}
