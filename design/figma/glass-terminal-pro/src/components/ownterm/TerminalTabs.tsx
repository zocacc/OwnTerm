import { X } from "lucide-react";
import type { Tab } from "@/data/ownterm";

type Props = {
  tabs: Tab[];
  activeTabId: string;
  onSelectTab: (id: string) => void;
};

export function TerminalTabs({ tabs, activeTabId, onSelectTab }: Props) {
  return (
    <div className="flex min-w-0 items-stretch">
      {tabs.map((tab) => {
        const active = tab.id === activeTabId;
        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => onSelectTab(tab.id)}
            className={`group relative flex min-w-0 items-center gap-2.5 border-r border-hairline pr-3 pl-4 transition-colors ${
              active
                ? "bg-terminal text-foreground"
                : "text-muted-foreground hover:bg-accent/40 hover:text-foreground"
            }`}
          >
            {active && <span className="absolute inset-x-0 top-0 h-[2px] bg-primary" />}
            <span
              className={`size-2 shrink-0 rounded-full ${
                tab.status === "online" ? "bg-online" : "bg-offline"
              }`}
            />
            <span className={`truncate text-[12.5px] ${active ? "font-medium" : ""}`}>
              {tab.title}
            </span>
            <X
              className={`size-3.5 shrink-0 transition-opacity ${
                active
                  ? "text-muted-foreground"
                  : "opacity-0 group-hover:opacity-70"
              }`}
              strokeWidth={1.6}
            />
          </button>
        );
      })}
    </div>
  );
}
