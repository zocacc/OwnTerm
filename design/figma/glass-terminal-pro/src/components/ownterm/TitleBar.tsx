import { ChevronDown, Minus, Plus, Square, X } from "lucide-react";
import { TerminalTabs } from "./TerminalTabs";
import type { Tab } from "@/data/ownterm";

type Props = {
  tabs: Tab[];
  activeTabId: string;
  onSelectTab: (id: string) => void;
};

export function TitleBar({ tabs, activeTabId, onSelectTab }: Props) {
  return (
    <header className="flex h-[42px] shrink-0 items-stretch border-b border-hairline bg-titlebar backdrop-blur-2xl">
      <div className="flex items-center gap-2 pr-5 pl-3.5">
        <div className="flex size-[20px] items-center justify-center rounded-[5px] bg-foreground/[0.06]">
          <svg viewBox="0 0 22 22" className="size-[15px]" fill="none">
            <path
              d="M6.8 7.2 10.2 11l-3.4 3.8M11.8 14.8h4"
              stroke="currentColor"
              className="text-primary"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>
        <span className="text-[12.5px] font-medium text-foreground/90">OwnTerm</span>
      </div>

      <TerminalTabs tabs={tabs} activeTabId={activeTabId} onSelectTab={onSelectTab} />

      <div className="flex items-center gap-0.5 px-1.5">
        <button
          type="button"
          aria-label="New tab"
          className="flex size-6 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        >
          <Plus className="size-4" strokeWidth={1.6} />
        </button>
        <button
          type="button"
          aria-label="Tab options"
          className="flex size-6 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        >
          <ChevronDown className="size-4" strokeWidth={1.6} />
        </button>
      </div>

      <div className="ml-auto flex items-stretch">
        {[Minus, Square, X].map((Icon, i) => (
          <button
            key={i}
            type="button"
            aria-label={["Minimize", "Maximize", "Close"][i]}
            className={`flex w-[46px] items-center justify-center text-muted-foreground transition-colors hover:text-foreground ${
              i === 2 ? "hover:bg-destructive hover:text-destructive-foreground" : "hover:bg-accent"
            }`}
          >
            <Icon className={i === 1 ? "size-3" : "size-3.5"} strokeWidth={1.5} />
          </button>
        ))}
      </div>
    </header>
  );
}
