import { describe, expect, it } from "vitest";
import { terminalTheme } from "./create-terminal";

const scheme = {
  id: "dracula",
  name: "Dracula",
  background: "#1E1F29",
  foreground: "#F8F8F2",
  cursor: "#BBBBBB",
  selectionBackground: "#44475A",
  ansi: Array.from({ length: 16 }, (_, index) => `#00000${index}`),
  builtIn: true,
};

describe("terminalTheme", () => {
  it("derives the xterm background alpha only from terminal opacity", () => {
    expect(terminalTheme(scheme, 55).background).toBe("rgba(30, 31, 41, 0.55)");
    expect(terminalTheme(scheme, 100).background).toBe("rgba(30, 31, 41, 1)");
  });

  it("keeps the terminal background opaque when no opacity is supplied", () => {
    expect(terminalTheme(scheme).background).toBe("rgba(30, 31, 41, 1)");
  });
});
