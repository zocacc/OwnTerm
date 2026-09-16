export type HostStatus = "online" | "offline";
export type HostKind = "server" | "cloud" | "github";

export type Host = {
  id: string;
  name: string;
  user: string;
  address: string;
  status: HostStatus;
  kind: HostKind;
  favorite: boolean;
};

export type RecentHost = { id: string; name: string; kind: HostKind };

export type Tone = "user" | "prompt" | "path" | "dim" | "ok" | "text" | "muted" | "dir" | "link";

export type TerminalLine = {
  segments: { text: string; tone?: Tone }[];
};

export type Tab = {
  id: string;
  hostId: string;
  title: string;
  subtitle: string;
  status: HostStatus;
  protocol: string;
  latencyMs: number;
  cwd: string;
  user: string;
  lines: TerminalLine[];
};

export const hosts: Host[] = [
  {
    id: "oracle-vps",
    name: "Oracle VPS",
    user: "oracle",
    address: "sa-saopaulo-1",
    status: "online",
    kind: "server",
    favorite: true,
  },
  {
    id: "homelab",
    name: "Homelab",
    user: "enzo",
    address: "192.168.1.10",
    status: "online",
    kind: "server",
    favorite: true,
  },
  {
    id: "lightera-lab",
    name: "Lightera Lab",
    user: "deploy",
    address: "lab.lightera.io",
    status: "online",
    kind: "cloud",
    favorite: true,
  },
  {
    id: "github-runner",
    name: "GitHub Runner",
    user: "runner",
    address: "ci.internal",
    status: "online",
    kind: "github",
    favorite: true,
  },
];

export const recentHosts: RecentHost[] = [
  { id: "ownterm-dev", name: "OwnTerm Dev", kind: "server" },
  { id: "staging-server", name: "Staging Server", kind: "cloud" },
  { id: "backup-node", name: "Backup Node", kind: "server" },
  { id: "test-vm", name: "Test VM", kind: "cloud" },
];

const prompt = (cwd: string, cmd: string): TerminalLine => ({
  segments: [
    { text: "oracle@oracle-vps", tone: "user" },
    { text: ":", tone: "muted" },
    { text: cwd, tone: "path" },
    { text: "$ ", tone: "text" },
    { text: cmd, tone: "text" },
  ],
});

const ls = (perms: string, size: string, date: string, name: string, dir = false): TerminalLine => ({
  segments: [
    { text: `${perms} `, tone: "dim" },
    { text: `${size} ${date} `, tone: "dim" },
    { text: name, tone: dir ? "dir" : "text" },
  ],
});

export const tabs: Tab[] = [
  {
    id: "tab-oracle",
    hostId: "oracle-vps",
    title: "Oracle VPS",
    subtitle: "oracle@oracle-vps",
    status: "online",
    protocol: "SSH",
    latencyMs: 22,
    cwd: "~/projects/OwnTerm",
    user: "oracle",
    lines: [
      prompt("~/projects/OwnTerm", "ls -la"),
      { segments: [{ text: "total 96", tone: "dim" }] },
      ls("drwxr-xr-x   8 oracle oracle", "4096", "mai 16 10:22", ".", true),
      ls("drwxr-x---  34 oracle oracle", "4096", "mai 16 09:11", "..", true),
      ls("drwxr-xr-x   9 oracle oracle", "4096", "mai 16 10:20", ".git", true),
      ls("-rw-r--r--   1 oracle oracle", " 124", "mai 15 19:04", ".gitignore"),
      ls("-rw-r--r--   1 oracle oracle", " 512", "mai 15 19:04", "README.md"),
      ls("drwxr-xr-x   3 oracle oracle", "4096", "mai 16 10:19", "assets", true),
      ls("drwxr-xr-x   6 oracle oracle", "4096", "mai 16 10:20", "src", true),
      ls("-rw-r--r--   1 oracle oracle", " 341", "mai 15 19:04", "package.json"),
      ls("-rw-r--r--   1 oracle oracle", "69231", "mai 15 19:04", "pnpm-lock.yaml"),
      ls("-rw-r--r--   1 oracle oracle", " 203", "mai 15 19:04", "tsconfig.json"),
      { segments: [] },
      prompt("~/projects/OwnTerm", "pnpm dev"),
      { segments: [] },
      { segments: [{ text: "> ownterm@0.1.0 dev /home/oracle/projects/OwnTerm", tone: "muted" }] },
      { segments: [{ text: "> vite", tone: "muted" }] },
      { segments: [] },
      {
        segments: [
          { text: "  VITE v5.2.11", tone: "ok" },
          { text: "  ready in 432 ms", tone: "dim" },
        ],
      },
      { segments: [] },
      {
        segments: [
          { text: "  → Local:   ", tone: "ok" },
          { text: "http://localhost:5173/", tone: "link" },
        ],
      },
      {
        segments: [
          { text: "  → Network: ", tone: "ok" },
          { text: "use ", tone: "dim" },
          { text: "--host", tone: "text" },
          { text: " to expose", tone: "dim" },
        ],
      },
      {
        segments: [
          { text: "  → press ", tone: "ok" },
          { text: "h + enter", tone: "text" },
          { text: " to show help", tone: "ok" },
        ],
      },
      { segments: [] },
      {
        segments: [
          { text: "10:23:41 ", tone: "muted" },
          { text: "[vite] ", tone: "text" },
          { text: "hmr update ", tone: "ok" },
          { text: "/src/App.tsx ", tone: "text" },
          { text: "(x4)", tone: "muted" },
        ],
      },
      {
        segments: [
          { text: "10:23:47 ", tone: "muted" },
          { text: "[vite] ", tone: "text" },
          { text: "hmr update ", tone: "ok" },
          { text: "/src/components/Terminal.tsx", tone: "text" },
        ],
      },
      { segments: [] },
    ],
  },
  {
    id: "tab-dev",
    hostId: "ownterm-dev",
    title: "OwnTerm Dev",
    subtitle: "local · powershell",
    status: "online",
    protocol: "Local",
    latencyMs: 1,
    cwd: "C:\\dev\\OwnTerm",
    user: "enzo",
    lines: [
      {
        segments: [
          { text: "PS ", tone: "path" },
          { text: "C:\\dev\\OwnTerm", tone: "link" },
          { text: "> pnpm build", tone: "text" },
        ],
      },
      { segments: [] },
      { segments: [{ text: "> ownterm@0.1.0 build C:\\dev\\OwnTerm", tone: "muted" }] },
      { segments: [{ text: "> tsc -b && vite build", tone: "muted" }] },
      { segments: [] },
      { segments: [{ text: "vite v5.2.11 building for production...", tone: "dim" }] },
      { segments: [{ text: "✓ 214 modules transformed.", tone: "ok" }] },
      { segments: [{ text: "dist/index.html                  0.46 kB", tone: "dim" }] },
      { segments: [{ text: "dist/assets/index-Bq2k9.css     41.20 kB", tone: "dim" }] },
      { segments: [{ text: "dist/assets/index-D8sa1.js     184.66 kB", tone: "dim" }] },
      {
        segments: [
          { text: "✓ built in 1.84s", tone: "ok" },
        ],
      },
      { segments: [] },
    ],
  },
];

export const quickCommands = [
  "pnpm dev",
  "pnpm build",
  "git status",
  "htop",
  "docker compose logs -f",
  "journalctl -f -u ownterm-agent",
];
