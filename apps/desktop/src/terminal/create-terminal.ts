import { FitAddon } from "@xterm/addon-fit";
import { Terminal } from "@xterm/xterm";

export function createTerminal() {
  const terminal = new Terminal({
    allowProposedApi: false,
    convertEol: false,
    cursorBlink: true,
    cursorStyle: "bar",
    fontFamily: "JetBrains Mono, Cascadia Mono, Consolas, monospace",
    fontSize: 14,
    scrollback: 5_000,
    theme: {
      background: "#111016",
      cursor: "#b9a7ff",
      foreground: "#f4f2f8",
      selectionBackground: "#6750a455",
    },
  });
  const fitAddon = new FitAddon();
  terminal.loadAddon(fitAddon);
  return { terminal, fitAddon };
}
