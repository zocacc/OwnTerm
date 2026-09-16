import type { Tab, TerminalLine, Tone } from "@/data/ownterm";

const toneClass: Record<Tone, string> = {
  user: "text-term-user",
  prompt: "text-primary",
  path: "text-term-path",
  text: "text-term-text",
  dim: "text-term-dim",
  muted: "text-term-muted",
  ok: "text-online",
  dir: "text-term-dir",
  link: "text-term-link",
};

function Line({ line }: { line: TerminalLine }) {
  if (line.segments.length === 0) return <div className="h-[1.6em]" aria-hidden />;
  return (
    <div className="whitespace-pre">
      {line.segments.map((s, i) => (
        <span key={i} className={toneClass[s.tone ?? "text"]}>
          {s.text}
        </span>
      ))}
    </div>
  );
}

export function TerminalView({ tab }: { tab: Tab }) {
  const connected = tab.status === "online";
  const isLocal = tab.protocol === "Local";

  return (
    <div className="terminal-glow scroll-thin relative flex-1 overflow-y-auto bg-terminal px-6 py-4 font-mono text-[13px] leading-[1.6]">
      {tab.lines.map((line, i) => (
        <Line key={i} line={line} />
      ))}

      <div className="flex items-center whitespace-pre">
        {connected && !isLocal && (
          <>
            <span className="text-term-user">
              {tab.user}@{tab.title.toLowerCase().replace(/\s+/g, "-")}
            </span>
            <span className="text-term-muted">:</span>
            <span className="text-term-path">{tab.cwd}</span>
            <span className="text-term-text">$ </span>
            <span className="caret-blink inline-block h-[1.05em] w-[8px] translate-y-[2px] rounded-[1px] bg-primary" />
          </>
        )}
        {connected && isLocal && (
          <>
            <span className="text-term-path">PS </span>
            <span className="text-term-link">{tab.cwd}</span>
            <span className="text-term-text">{"> "}</span>
            <span className="caret-blink inline-block h-[1.05em] w-[8px] translate-y-[2px] rounded-[1px] bg-primary" />
          </>
        )}
        {!connected && <span className="text-term-muted">[session disconnected]</span>}
      </div>
    </div>
  );
}
