import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { after, before, test } from "node:test";
import { chromium } from "playwright";
import { createServer } from "vite";

let server;
let browser;
let origin;

before(async () => {
  await mkdir("coverage/browser", { recursive: true });
  server = await createServer({
    server: { host: "127.0.0.1", port: 0, strictPort: false },
  });
  await server.listen();
  origin = `http://127.0.0.1:${server.httpServer.address().port}`;
  browser = await chromium.launch();
});

after(async () => {
  await browser?.close();
  await server?.close();
});

async function setSlider(frame, label, value) {
  await frame.getByRole("slider", { name: label }).evaluate((slider, next) => {
    // Use the native setter so React observes the same change as user input.
    Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      "value",
    ).set.call(slider, next);
    slider.dispatchEvent(new Event("input", { bubbles: true }));
    slider.dispatchEvent(new Event("change", { bubbles: true }));
  }, String(value));
}

async function pixels(page, image, point = { x: 400, y: 300 }) {
  return page.evaluate(
    async ({ base64, point }) => {
      const response = await fetch(`data:image/png;base64,${base64}`);
      const bitmap = await createImageBitmap(await response.blob());
      const canvas = document.createElement("canvas");
      canvas.width = bitmap.width;
      canvas.height = bitmap.height;
      const context = canvas.getContext("2d");
      context.drawImage(bitmap, 0, 0);
      const background = [
        ...context.getImageData(point.x, point.y, 1, 1).data,
      ].slice(0, 3);
      const text = context.getImageData(0, 40, 150, 50).data;
      let brightestTextPixel = 0;
      for (let i = 0; i < text.length; i += 4) {
        brightestTextPixel = Math.max(
          brightestTextPixel,
          Math.min(text[i], text[i + 1], text[i + 2]),
        );
      }
      return { background, brightestTextPixel };
    },
    { base64: image.toString("base64"), point },
  );
}

test("terminal pixels reveal external color independently of chrome opacity", async () => {
  const page = await browser.newPage({
    viewport: { width: 800, height: 600 },
    deviceScaleFactor: 1,
  });
  try {
    // An outer document represents the native backdrop: no application CSS is
    // overridden, so an opaque html/body or xterm layer really fails the test.
    await page.setContent(
      `<body style="margin:0;color-scheme:dark;background:rgb(240,180,80)"><iframe id="application" src="${origin}/tests/browser/fixture.html" style="border:0;width:800px;height:600px"></iframe></body>`,
    );
    const frame = page.frameLocator("#application");
    await frame.getByRole("button", { name: "Open default shell" }).click();
    await frame.locator(".xterm-helper-textarea").focus();
    await page.keyboard.insertText("████████");
    await frame
      .locator(".xterm-rows")
      .getByText("████████", { exact: false })
      .waitFor();
    const terminalElement = await frame.locator(".xterm").elementHandle();

    for (const [chrome, terminal, expected] of [
      [100, 55, [115, 89, 48]],
      [55, 100, [12, 15, 21]],
      [55, 55, [115, 89, 48]],
      [100, 100, [12, 15, 21]],
      [100, 0, [240, 180, 80]],
      [0, 0, [240, 180, 80]],
    ]) {
      await frame.getByRole("button", { name: "Appearance settings" }).click();
      await setSlider(frame, /Interface opacity/, chrome);
      await setSlider(frame, /Terminal background opacity/, terminal);
      await frame
        .getByRole("button", { name: "Close appearance settings" })
        .click();
      await frame.locator(".xterm-scrollable-element").evaluate(async () => {
        await document.fonts.ready;
        await new Promise((resolve) =>
          requestAnimationFrame(() => requestAnimationFrame(resolve)),
        );
      });
      const actual = await pixels(
        page,
        await page.screenshot({
          path: `coverage/browser/opacity-${chrome}-${terminal}.png`,
        }),
      );
      for (let channel = 0; channel < 3; channel++) {
        assert.ok(
          Math.abs(actual.background[channel] - expected[channel]) <= 2,
          `chrome=${chrome}, terminal=${terminal}: got ${actual.background}, expected ${expected}`,
        );
      }
      assert.ok(actual.brightestTextPixel > 235, "glyphs must stay opaque");
      assert.ok(
        await terminalElement.evaluate((element) => element.isConnected),
        "same terminal survives slider updates",
      );
    }

    await frame.getByRole("button", { name: "Appearance settings" }).click();
    const preview = await pixels(
      page,
      await page.screenshot({
        path: "coverage/browser/appearance-preview-0-0.png",
      }),
      { x: 760, y: 300 },
    );
    assert.deepEqual(
      preview.background,
      [240, 180, 80],
      "Appearance preview must not darken the terminal behind the dialog",
    );
    await setSlider(frame, /Terminal background opacity/, 55);
    await frame.getByRole("checkbox", { name: /Use Windows/ }).uncheck();
    await frame
      .getByRole("button", { name: "Close appearance settings" })
      .click();
    const opaque = await pixels(
      page,
      await page.screenshot({ path: "coverage/browser/opaque-fallback.png" }),
    );
    assert.deepEqual(
      opaque.background,
      [18, 21, 29],
      "disabled material composes on the solid application fallback",
    );
  } finally {
    await page.close();
  }
});
