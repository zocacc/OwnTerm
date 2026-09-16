import { ChevronsRight, CornerDownLeft, X } from "lucide-react";
import { quickCommands } from "@/data/ownterm";

export function QuickCommands({ onClose }: { onClose: () => void }) {
  return (
    <div className="absolute right-6 bottom-6 w-[320px] rounded-[12px] border border-border bg-panel shadow-[0_18px_44px_-14px_oklch(0_0_0/0.7)] backdrop-blur-2xl">
      <div className="flex items-center gap-2 px-4 pt-3.5 pb-1">
        <span className="text-[12px] font-semibold">Quick commands</span>
        <kbd className="ml-auto rounded-[5px] bg-foreground/[0.06] px-1.5 py-0.5 text-[10px] text-muted-foreground">
          ⌘P
        </kbd>
        <button
          type="button"
          aria-label="Close quick commands"
          onClick={onClose}
          className="flex size-5 items-center justify-center rounded text-muted-foreground transition-colors hover:text-foreground"
        >
          <X className="size-3.5" />
        </button>
      </div>
      <ul className="px-2.5 pt-1 pb-3">
        {quickCommands.map((cmd) => (
          <li key={cmd}>
            <button
              type="button"
              className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-left font-mono text-[11px] text-muted-foreground transition-colors hover:bg-accent/70 hover:text-foreground"
            >
              <CornerDownLeft className="size-3.5 shrink-0" strokeWidth={1.5} />
              <span className="truncate">{cmd}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function QuickCommandsHandle({ onOpen }: { onOpen: () => void }) {
  return (
    <button
      type="button"
      aria-label="Open quick commands"
      onClick={onOpen}
      className="absolute top-1/2 right-0 z-10 flex h-16 w-6 -translate-y-1/2 items-center justify-center rounded-l-lg border border-r-0 border-hairline bg-panel/80 text-muted-foreground backdrop-blur-xl transition-colors hover:text-foreground"
    >
      <ChevronsRight className="size-3.5" strokeWidth={1.6} />
    </button>
  );
}
