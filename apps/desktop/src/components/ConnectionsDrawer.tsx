import { X } from "lucide-react";
import type { Backend } from "../services/backend";
import { HostsWorkspace } from "./HostsWorkspace";

type FocusTarget = "search" | "quickConnect";

type ConnectionsDrawerProps = {
  activeHostId?: string;
  backend: Backend;
  connectedHostIds: string[];
  focusTarget?: FocusTarget;
  onClose(): void;
  onFocusTargetHandled(): void;
  onOpenLocal(): void;
  onOverlayStateChange(open: boolean): void;
  onRequestConnection(target: { hostId?: string; destination?: string }): void;
  refreshToken: number;
};

export function ConnectionsDrawer({
  activeHostId,
  backend,
  connectedHostIds,
  focusTarget,
  onClose,
  onFocusTargetHandled,
  onOpenLocal,
  onOverlayStateChange,
  onRequestConnection,
  refreshToken,
}: ConnectionsDrawerProps) {
  return (
    <div className="connections-drawer-backdrop" onMouseDown={onClose}>
      <aside
        aria-label="Connections"
        aria-modal="false"
        className="connections-drawer"
        onMouseDown={(event) => event.stopPropagation()}
        role="dialog"
      >
        <header className="connections-drawer-header">
          <h2>Connections</h2>
          <button
            aria-label="Close connections"
            className="control-icon"
            onClick={onClose}
            title="Close connections (Escape)"
            type="button"
          >
            <X size={16} />
          </button>
        </header>
        <HostsWorkspace
          activeHostId={activeHostId}
          backend={backend}
          connectedHostIds={connectedHostIds}
          focusTarget={focusTarget}
          onFocusTargetHandled={onFocusTargetHandled}
          onOpenLocal={onOpenLocal}
          onOverlayStateChange={onOverlayStateChange}
          onRequestConnection={onRequestConnection}
          refreshToken={refreshToken}
        />
      </aside>
    </div>
  );
}
