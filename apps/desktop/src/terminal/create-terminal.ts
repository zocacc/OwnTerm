import { FitAddon } from "@xterm/addon-fit";
import { Terminal } from "@xterm/xterm";
import type {
  TerminalAppearanceProfile,
  TerminalColorScheme,
} from "../services/backend";

function rgbaColor(color: string, opacity: number) {
  const hex = color.replace("#", "");
  const normalized =
    hex.length === 3
      ? hex
          .split("")
          .map((part) => part + part)
          .join("")
      : hex.slice(0, 6);
  if (!/^[0-9a-f]{6}$/i.test(normalized)) return color;
  const value = Number.parseInt(normalized, 16);
  return `rgba(${(value >> 16) & 255}, ${(value >> 8) & 255}, ${value & 255}, ${Math.max(0, Math.min(100, opacity)) / 100})`;
}

export function terminalTheme(
  scheme: TerminalColorScheme,
  backgroundOpacity = 100,
) {
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
    background: rgbaColor(scheme.background, backgroundOpacity),
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
    theme: terminalTheme(scheme, profile.terminalBackgroundOpacity),
  });
  const fitAddon = new FitAddon();
  terminal.loadAddon(fitAddon);
  return { terminal, fitAddon };
}
