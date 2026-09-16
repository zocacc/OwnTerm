import { CircleHelp, FileText, Files, Settings, SquareTerminal, Waypoints } from "lucide-react";

const topItems = [
  { id: "terminals", icon: SquareTerminal, label: "Terminals" },
  { id: "snippets", icon: FileText, label: "Snippets" },
  { id: "transfers", icon: Files, label: "File transfers" },
  { id: "tunnels", icon: Waypoints, label: "Tunnels" },
];

type Props = {
  active: string;
  onChange: (id: string) => void;
};

export function NavigationRail({ active, onChange }: Props) {
  return (
    <nav className="flex w-16 shrink-0 flex-col items-center border-r border-hairline bg-rail py-4 backdrop-blur-xl">
      <div className="flex flex-col gap-2">
        {topItems.map(({ id, icon: Icon, label }) => {
          const selected = id === active;
          return (
            <button
              key={id}
              type="button"
              title={label}
              aria-label={label}
              aria-current={selected}
              onClick={() => onChange(id)}
              className={`relative flex h-[42px] w-[46px] items-center justify-center rounded-[10px] transition-colors ${
                selected
                  ? "bg-primary/15 text-primary"
                  : "text-muted-foreground hover:bg-accent/70 hover:text-foreground"
              }`}
            >
              {selected && (
                <span className="absolute left-0 h-[22px] w-[3px] rounded-full bg-primary" />
              )}
              <Icon className="size-[18px]" strokeWidth={1.5} />
            </button>
          );
        })}
      </div>

      <div className="mt-auto flex flex-col gap-2">
        {[CircleHelp, Settings].map((Icon, i) => (
          <button
            key={i}
            type="button"
            aria-label={["Help", "Settings"][i]}
            className="flex h-[42px] w-[46px] items-center justify-center rounded-[10px] text-muted-foreground transition-colors hover:bg-accent/70 hover:text-foreground"
          >
            <Icon className="size-[18px]" strokeWidth={1.5} />
          </button>
        ))}
      </div>
    </nav>
  );
}
