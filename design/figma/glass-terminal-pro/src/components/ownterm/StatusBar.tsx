import type { Tab } from "@/data/ownterm";

export function StatusBar({ tab }: { tab: Tab }) {
  const shell = tab.protocol === "Local" ? "PowerShell" : "bash";
  const items = ["UTF-8", shell, "100%", "Ln 24, Col 8"];

  return (
    <footer className="flex h-[28px] shrink-0 items-center justify-end border-t border-hairline bg-statusbar px-4 backdrop-blur-2xl">
      {items.map((item, i) => (
        <span key={item} className="flex items-center text-[11px] text-muted-foreground">
          {i > 0 && <span className="mx-3 h-3 w-px bg-hairline" />}
          {item}
        </span>
      ))}
    </footer>
  );
}
