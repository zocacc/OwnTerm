import { invoke, isTauri } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { Minus, Square, X } from "lucide-react";
import { useEffect, useState } from "react";

type Appearance = { customTitlebar: boolean; backdropConfigured: boolean };

type WindowControlsProps = {
  onMaterialChange(backdropConfigured: boolean): void;
};

export function WindowControls({ onMaterialChange }: WindowControlsProps) {
  const [customTitlebar, setCustomTitlebar] = useState(() => isTauri());
  const [error, setError] = useState<string>();

  // React runs this after the WebView has committed its first frame. The Windows
  // window is already borderless, so no native style changes follow the backdrop.
  useEffect(() => {
    if (!isTauri()) return;
    let mounted = true;
    void invoke<Appearance>("prepare_window_chrome")
      .then((appearance) => {
        if (!mounted) return;
        onMaterialChange(appearance.backdropConfigured);
        setCustomTitlebar(appearance.customTitlebar);
      })
      .catch(() => {
        // Opaque is the CSS default; the configured borderless window keeps its custom controls.
      });
    return () => {
      mounted = false;
    };
  }, [onMaterialChange]);

  if (!customTitlebar) return null;
  const perform = (action: "minimize" | "toggleMaximize" | "close") => {
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
