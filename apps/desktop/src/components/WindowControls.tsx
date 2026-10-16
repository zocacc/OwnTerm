import { invoke, isTauri } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { Minus, Square, X } from "lucide-react";
import { useEffect, useState } from "react";

type WindowChrome = { customTitlebar: boolean };

export function WindowControls({ onClose }: { onClose?: () => void }) {
  const [customTitlebar, setCustomTitlebar] = useState(() => isTauri());
  const [error, setError] = useState<string>();

  // Chrome metadata never configures or overwrites the Appearance material.
  useEffect(() => {
    if (!isTauri()) return;
    let mounted = true;
    void invoke<WindowChrome>("prepare_window_chrome")
      .then((appearance) => {
        if (!mounted) return;
        setCustomTitlebar(appearance.customTitlebar);
      })
      .catch(() => {
        // Opaque is the CSS default; the configured borderless window keeps its custom controls.
      });
    return () => {
      mounted = false;
    };
  }, []);

  if (!customTitlebar) return null;
  const perform = (action: "minimize" | "toggleMaximize" | "close") => {
    if (action === "close" && onClose) {
      onClose();
      return;
    }
    setError(undefined);
    const appWindow = getCurrentWindow();
    void appWindow[action]().catch(() =>
      setError("Could not update the window. Please try again."),
    );
  };
  return (
    <div className="window-controls">
      {error ? (
        <span className="window-error" role="alert">
          {error}
        </span>
      ) : null}
      <button
        aria-label="Minimize window"
        onClick={() => perform("minimize")}
        type="button"
      >
        <Minus size={14} />
      </button>
      <button
        aria-label="Maximize or restore window"
        onClick={() => perform("toggleMaximize")}
        type="button"
      >
        <Square size={12} />
      </button>
      <button
        aria-label="Close window"
        className="window-close"
        onClick={() => perform("close")}
        type="button"
      >
        <X size={15} />
      </button>
    </div>
  );
}
