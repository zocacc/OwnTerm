import { X } from "lucide-react";
import type { TerminalAppearanceProfile } from "../services/backend";
import { useDialogFocus } from "./useDialogFocus";

type Changes = Partial<
  Pick<
    TerminalAppearanceProfile,
    "windowOpacity" | "terminalBackgroundOpacity" | "useAcrylic"
  >
>;
export function AppearancePanel({
  profile,
  disabled,
  warning,
  onChange,
  onClose,
}: {
  profile: TerminalAppearanceProfile;
  disabled: boolean;
  warning?: string | null;
  onChange(changes: Changes): void;
  onClose(): void;
}) {
  const ref = useDialogFocus<HTMLElement>(true);
  return (
    <div
      className="overlay appearance-overlay"
      role="presentation"
      onPointerDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        className="dialog appearance-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="appearance-title"
        ref={ref}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            event.stopPropagation();
            onClose();
          }
        }}
      >
        <div className="dialog-heading">
          <h2 id="appearance-title">Appearance</h2>
          <button
            className="icon-button"
            aria-label="Close appearance settings"
            onClick={onClose}
          >
            <X size={16} />
          </button>
        </div>
        <p className="muted">Live preview · {profile.name}</p>
        <label className="slider-label" htmlFor="interface-opacity">
          Interface opacity <output>{profile.windowOpacity}%</output>
          <input
            id="interface-opacity"
            disabled={disabled}
            type="range"
            min="0"
            max="100"
            value={profile.windowOpacity}
            onChange={(event) =>
              onChange({ windowOpacity: Number(event.target.value) })
            }
          />
        </label>
        <label className="slider-label" htmlFor="terminal-opacity">
          Terminal background opacity{" "}
          <output>{profile.terminalBackgroundOpacity}%</output>
          <input
            id="terminal-opacity"
            disabled={disabled}
            type="range"
            min="0"
            max="100"
            value={profile.terminalBackgroundOpacity}
            onChange={(event) =>
              onChange({
                terminalBackgroundOpacity: Number(event.target.value),
              })
            }
          />
        </label>
        <label className="checkbox-label">
          <input
            type="checkbox"
            disabled={disabled}
            checked={profile.useAcrylic}
            onChange={(event) => onChange({ useAcrylic: event.target.checked })}
          />
          Use Windows Acrylic when available
        </label>
        {warning ? <p role="status">{warning}</p> : null}
        <div className="dialog-actions">
          <button
            disabled={disabled}
            onClick={() =>
              onChange({
                windowOpacity: 92,
                terminalBackgroundOpacity: 0,
                useAcrylic: true,
              })
            }
          >
            Reset defaults
          </button>
        </div>
        <p className="muted">
          Acrylic tint belongs to Windows. Text stays opaque. Existing visual
          profiles are preserved.
        </p>
        <p className="muted">
          Foundation preview: Hosts, SSH and advanced settings return after
          Windows visual acceptance.
        </p>
      </section>
    </div>
  );
}
