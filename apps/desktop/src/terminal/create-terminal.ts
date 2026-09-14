import { FitAddon } from "@xterm/addon-fit";
import { Terminal } from "@xterm/xterm";
import type {
  TerminalAppearanceProfile,
  TerminalColorScheme,
} from "../services/backend";

export function terminalTheme(scheme: TerminalColorScheme) {
  const [
    black,
    red,
    green,
    yellow,
    blue,
    magenta,
    cyan,
    white,
    brightBlack,
    brightRed,
    brightGreen,
    brightYellow,
    brightBlue,
    brightMagenta,
    brightCyan,
    brightWhite,
  ] = scheme.ansi;
  return {
    background: "#00000000",
    foreground: scheme.foreground,
    cursor: scheme.cursor,
    selectionBackground: scheme.selectionBackground,
    black,
    red,
    green,
    yellow,
    blue,
    magenta,
    cyan,
    white,
    brightBlack,
    brightRed,
    brightGreen,
    brightYellow,
    brightBlue,
    brightMagenta,
    brightCyan,
    brightWhite,
  };
}

export function createTerminal(
  profile: TerminalAppearanceProfile,
  scheme: TerminalColorScheme,
) {
  const terminal = new Terminal({
    allowProposedApi: false,
    allowTransparency: true,
    convertEol: false,
    cursorBlink: true,
    cursorStyle: "bar",
    fontFamily: profile.fontFamily,
    fontSize: profile.fontSize,
    scrollback: 5_000,
    theme: terminalTheme(scheme),
  });
  const fitAddon = new FitAddon();
  terminal.loadAddon(fitAddon);
  return { terminal, fitAddon };
}
