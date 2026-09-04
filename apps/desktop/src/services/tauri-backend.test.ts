import { describe, expect, it } from "vitest";
import { terminalEvents } from "./tauri-backend";

describe("terminal event names", () => {
  it("uses only characters accepted by Tauri", () => {
    const validName = /^[A-Za-z0-9_\-/:]+$/;

    for (const name of Object.values(terminalEvents)) {
      expect(name).toMatch(validName);
      expect(name).not.toContain(".");
    }
  });
});
