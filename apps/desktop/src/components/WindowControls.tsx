import { invoke, isTauri } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { Minus, Square, X } from "lucide-react";
import { useEffect, useState } from "react";

type Appearance = { customTitlebar: boolean; acrylic: boolean };

export function WindowControls() {
  const [customTitlebar, setCustomTitlebar] = useState(false);
  const [error, setError] = useState<string>();

  useEffect(() => {
    if (!isTauri()) return;
    let mounted = true;
    void invoke<Appearance>("prepare_window_chrome")
      .then((appearance) => {
        if (!mounted) return;
        document.documentElement.dataset.material = appearance.acrylic
          ? "acrylic"
          : "opaque";
        setCustomTitlebar(appearance.customTitlebar);
      })
      .catch(() => {
        // Opaque is the CSS default; retain the OS title bar on failure.
      });
    return () => {
      mounted = false;
    };
  }, []);

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
