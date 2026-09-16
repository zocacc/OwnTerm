import { useMemo, useState } from "react";
import { Clock, MoreVertical, Plus, Search, Star } from "lucide-react";
import { HostRow, RecentRow } from "./HostRow";
import { hosts, recentHosts } from "@/data/ownterm";

type Props = {
  selectedHostId: string;
  onSelectHost: (id: string) => void;
};

export function ConnectionsSidebar({ selectedHostId, onSelectHost }: Props) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return hosts;
    return hosts.filter((h) => `${h.name} ${h.user} ${h.address}`.toLowerCase().includes(q));
  }, [query]);

  const filteredRecent = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? recentHosts.filter((r) => r.name.toLowerCase().includes(q)) : recentHosts;
  }, [query]);

  return (
    <aside className="flex w-[290px] shrink-0 flex-col border-r border-hairline bg-sidebar-surface backdrop-blur-2xl">
      <div className="flex items-center justify-between px-4 pt-3.5 pb-2">
        <h2 className="text-[14px] font-semibold">Connections</h2>
        <div className="flex items-center gap-0.5">
          <button
            type="button"
            aria-label="Add connection"
            className="flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            <Plus className="size-4" strokeWidth={1.6} />
          </button>
          <button
            type="button"
            aria-label="Connection options"
            className="flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            <MoreVertical className="size-4" strokeWidth={1.6} />
          </button>
        </div>
      </div>

      <div className="px-3.5 pb-3">
        <div className="relative flex h-[34px] items-center rounded-lg border border-hairline bg-background/50">
          <Search className="absolute left-3 size-3.5 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search hosts..."
            className="h-full w-full bg-transparent pr-12 pl-9 text-[12px] text-foreground outline-none placeholder:text-muted-foreground"
          />
          <kbd className="absolute right-2.5 rounded-[5px] bg-foreground/[0.06] px-1.5 py-0.5 text-[10px] text-muted-foreground">
            ⌘K
          </kbd>
        </div>
      </div>

      <div className="scroll-thin flex-1 overflow-y-auto px-3 pb-4">
        <p className="flex items-center gap-2 px-2 pt-1 pb-1.5 text-[12px] text-muted-foreground">
          <Star className="size-3.5" strokeWidth={1.6} />
          Favorites
        </p>
        <div className="flex flex-col gap-0.5">
          {filtered.map((host) => (
            <HostRow
              key={host.id}
              host={host}
              selected={host.id === selectedHostId}
              onSelect={onSelectHost}
            />
          ))}
          {filtered.length === 0 && (
            <p className="px-2 py-2 text-[11px] text-muted-foreground">No matching hosts</p>
          )}
        </div>

        <p className="flex items-center gap-2 px-2 pt-5 pb-1.5 text-[12px] text-muted-foreground">
          <Clock className="size-3.5" strokeWidth={1.6} />
          Recent
        </p>
        <div className="flex flex-col gap-0.5">
          {filteredRecent.map((r) => (
            <RecentRow key={r.id} name={r.name} kind={r.kind} onSelect={() => onSelectHost(r.id)} />
          ))}
        </div>
      </div>
    </aside>
  );
}
