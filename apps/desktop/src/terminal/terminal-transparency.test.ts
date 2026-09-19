/// <reference types="node" />

import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { Terminal } from "@xterm/xterm";
import { afterEach, describe, expect, it } from "vitest";

const require = createRequire(import.meta.url);
const xtermCss = readFileSync(
  require.resolve("@xterm/xterm/css/xterm.css"),
  "utf8",
);
const terminalCss = readFileSync(
  resolve(process.cwd(), "src/terminal/terminal.css"),
  "utf8",
);
const applicationCss = readFileSync(
  resolve(process.cwd(), "src/index.css"),
  "utf8",
);

describe("terminal transparency composition", () => {
  afterEach(() => {
    document.body.replaceChildren();
  });

  it("does not leave xterm's legacy viewport opaque below an alpha theme", () => {
    const viewportOverride = terminalCss.match(
      /\.xterm\s+\.xterm-viewport\s*\{[\s\S]*?\}/,
    )?.[0];
    expect(viewportOverride).toContain("background-color: transparent");
    const styles = document.createElement("style");
    styles.textContent = `${xtermCss}\n${viewportOverride}`;
    document.head.append(styles);
    const host = document.createElement("div");
    host.style.width = "800px";
    host.style.height = "500px";
    document.body.append(host);

    const terminal = new Terminal({
      allowTransparency: true,
      cols: 80,
      rows: 24,
      theme: { background: "rgba(12, 15, 21, 0.55)" },
    });
    terminal.open(host);

    const viewport = host.querySelector<HTMLElement>(".xterm-viewport");
    const scrollable = host.querySelector<HTMLElement>(
      ".xterm-scrollable-element",
    );
    expect(viewport).not.toBeNull();
    expect(scrollable).not.toBeNull();
    expect(getComputedStyle(viewport!).backgroundColor).toBe("transparent");
    expect(scrollable!.style.backgroundColor).toBe("#0c0f158c");

    terminal.dispose();
    styles.remove();
  });

  it("paints a solid application fallback when native Acrylic is unavailable", () => {
    expect(applicationCss).toMatch(
      /:root\[data-material="opaque"\][\s\S]*?background:\s*var\(--background\)/,
    );
    expect(applicationCss).toMatch(
      /:root\[data-material="opaque"\]\s+body[\s\S]*?background:\s*var\(--background\)/,
    );
  });
});
