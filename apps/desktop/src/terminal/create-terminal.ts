import { Terminal } from "@xterm/xterm";

export function createTerminal() {
  return new Terminal({
    cursorBlink: true,
    fontFamily: "JetBrains Mono, Consolas, monospace",
    theme: {
      background: "#17151f",
      foreground: "#f4f2f8",
    },
  });
}
