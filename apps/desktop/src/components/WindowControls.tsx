import { invoke, isTauri } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { Minus, Square, X } from "lucide-react";
import { useEffect, useState } from "react";

type Appearance = { customTitlebar: boolean; acrylic: boolean };

type WindowControlsProps = {
  onMaterialChange(acrylic: boolean): void;
};

export function WindowControls({ onMaterialChange }: WindowControlsProps) {
  const [customTitlebar, setCustomTitlebar] = useState(false);
  const [error, setError] = useState<string>();

  useEffect(() => {
    if (!isTauri()) return;
    let mounted = true;
    void invoke<Appearance>("prepare_window_chrome")
      .then((appearance) => {
        if (!mounted) return;
        onMaterialChange(appearance.acrylic);
        setCustomTitlebar(appearance.customTitlebar);
      })
      .catch(() => {
        // Opaque is the CSS default; retain the OS title bar on failure.
      });
    return () => {
      mounted = false;
    };
  }, [onMaterialChange]);

  useEffect(() => {
    if (!customTitlebar || !isTauri()) return;
    let disposed = false;
    let unlisten: (() => void) | undefined;
    let timer: number | undefined;
    const refreshMaterial = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        void invoke<Appearance>("refresh_window_material")
          .then((appearance) => {
            if (disposed) return;
            onMaterialChange(appearance.acrylic);
          })
          .catch(() => {
            if (!disposed) onMaterialChange(false);
          });
      }, 120);
    };
    void getCurrentWindow()
      .onResized(refreshMaterial)
      .then((nextUnlisten) => {
        if (disposed) nextUnlisten();
        else unlisten = nextUnlisten;
      })
      .catch(() => {
        // Keep the existing material; resize listening is a resilience path.
      });
    return () => {
      disposed = true;
      window.clearTimeout(timer);
      unlisten?.();
    };
  }, [customTitlebar, onMaterialChange]);

  useEffect(() => {
    if (!customTitlebar) return;
    // Hide the native title bar only after its replacement has rendered.
    void invoke("show_custom_chrome").catch(() => setCustomTitlebar(false));
  }, [customTitlebar]);

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
