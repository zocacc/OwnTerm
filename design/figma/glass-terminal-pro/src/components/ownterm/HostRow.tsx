import { Cloud, Github, Server } from "lucide-react";
import type { Host, HostKind } from "@/data/ownterm";

const kindIcon: Record<HostKind, typeof Server> = {
  server: Server,
  cloud: Cloud,
  github: Github,
};

type Props = {
  host: Host;
  selected: boolean;
  onSelect: (id: string) => void;
};

export function HostRow({ host, selected, onSelect }: Props) {
  const Icon = kindIcon[host.kind];

  return (
    <button
      type="button"
      onClick={() => onSelect(host.id)}
      className={`flex w-full items-center gap-3 rounded-lg px-3 py-[7px] text-left transition-colors ${
        selected ? "bg-primary/15" : "hover:bg-accent/50"
      }`}
    >
      <Icon
        className={`size-4 shrink-0 ${selected ? "text-primary" : "text-muted-foreground"}`}
        strokeWidth={1.5}
      />
      <span
        className={`min-w-0 flex-1 truncate text-[13px] ${
          selected ? "font-medium text-foreground" : "text-foreground/85"
        }`}
      >
        {host.name}
      </span>
      <span
        title={host.status === "online" ? "Connected" : "Disconnected"}
        className={`size-2 shrink-0 rounded-full ${
          host.status === "online" ? "bg-online" : "bg-offline"
        }`}
      />
    </button>
  );
}

export function RecentRow({
  name,
  kind,
  onSelect,
}: {
  name: string;
  kind: HostKind;
  onSelect: () => void;
}) {
  const Icon = kindIcon[kind];
  return (
    <button
      type="button"
      onClick={onSelect}
      className="flex w-full items-center gap-3 rounded-lg px-3 py-[7px] text-left transition-colors hover:bg-accent/50"
    >
      <Icon className="size-4 shrink-0 text-muted-foreground" strokeWidth={1.5} />
      <span className="min-w-0 flex-1 truncate text-[13px] text-foreground/70">{name}</span>
      <span className="size-2 shrink-0 rounded-full bg-offline" title="Disconnected" />
    </button>
  );
}
