import { Monitor, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import type { Tab } from "@/data/ownterm";

type Props = {
  tab: Tab;
  sidebarOpen: boolean;
  onToggleSidebar: () => void;
};

export function SessionToolbar({ tab, sidebarOpen, onToggleSidebar }: Props) {
  const connected = tab.status === "online";

  return (
    <div className="flex h-[46px] shrink-0 items-center gap-3 border-b border-hairline bg-toolbar px-3 backdrop-blur-2xl">
      <button
        type="button"
        aria-label={sidebarOpen ? "Collapse connections" : "Expand connections"}
        onClick={onToggleSidebar}
        className="flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
      >
        {sidebarOpen ? (
          <PanelLeftClose className="size-4" strokeWidth={1.5} />
        ) : (
          <PanelLeftOpen className="size-4" strokeWidth={1.5} />
        )}
      </button>

      <div className="flex min-w-0 items-center gap-2 text-[12.5px]">
        <Monitor className="size-4 shrink-0 text-muted-foreground" strokeWidth={1.5} />
        <span className="truncate text-foreground/80">{tab.subtitle.split("@")[0]}</span>
        <span className="text-muted-foreground">/</span>
        <span className="truncate text-term-path">{tab.cwd}</span>
      </div>

      <div className="ml-auto flex items-center gap-2">
        <span className="rounded-md border border-hairline px-2 py-[3px] text-[10.5px] font-medium text-muted-foreground">
          {tab.protocol}
        </span>
        <span className="rounded-md border border-online/30 px-2 py-[3px] text-[10.5px] font-medium text-online">
          {connected ? `${tab.latencyMs} ms` : "-- ms"}
        </span>
        <span
          className={`flex items-center gap-1.5 rounded-md px-2 py-[3px] text-[10.5px] font-medium ${
            connected ? "bg-online/15 text-online" : "bg-foreground/[0.06] text-muted-foreground"
          }`}
        >
          <span className={`size-1.5 rounded-full ${connected ? "bg-online" : "bg-offline"}`} />
          {connected ? "Connected" : "Disconnected"}
        </span>
      </div>
    </div>
  );
}
