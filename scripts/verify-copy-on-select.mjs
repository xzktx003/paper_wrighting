// Real-browser verification that mouseup-after-select copies xterm selection
// to the clipboard. Boots Chromium directly from the playwright SDK cache so we
// don't depend on `chrome` channel discovery.

import { chromium } from "@playwright/test";
import { readdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";

function locateChromium() {
  const root = join(homedir(), ".cache", "ms-playwright");
  const dirs = readdirSync(root)
    .filter((name) => name.startsWith("chromium-"))
    .sort()
    .reverse();
  for (const dir of dirs) {
    const candidate = join(root, dir, "chrome-linux64", "chrome");
    if (existsSync(candidate)) {
      return candidate;
    }
    const legacy = join(root, dir, "chrome-linux", "chrome");
    if (existsSync(legacy)) {
      return legacy;
    }
  }
  throw new Error("no chromium binary found in ms-playwright cache");
}

const TARGET = process.env.TARGET_URL ?? "https://127.0.0.1:3333/";

const exec = locateChromium();
console.log("[verify] chromium:", exec);
console.log("[verify] target  :", TARGET);

const browser = await chromium.launch({
  executablePath: exec,
  headless: true,
  args: ["--ignore-certificate-errors", "--no-sandbox"],
});

try {
  const context = await browser.newContext({
    ignoreHTTPSErrors: true,
    permissions: ["clipboard-read", "clipboard-write"],
  });
  const page = await context.newPage();
  page.on("console", (msg) => {
    if (msg.type() === "error" || msg.type() === "warning") {
      console.log(`[browser ${msg.type()}]`, msg.text());
    }
  });
  page.on("pageerror", (err) => console.log("[browser pageerror]", err.message));

  await page.goto(TARGET, { waitUntil: "domcontentloaded", timeout: 15000 });

  // Wait for any xterm container to mount.
  const xtermLocator = page.locator(".terminal-view .xterm").first();
  try {
    await xtermLocator.waitFor({ state: "visible", timeout: 10000 });
  } catch {
    console.log("[verify] no .terminal-view .xterm visible within 10s");
    await page.screenshot({ path: "scripts/verify-copy-on-select.snapshot.png" });
    throw new Error("no terminal mounted on the page — open a session first");
  }

  await page.screenshot({ path: "scripts/verify-copy-on-select.before.png" });

  // Probe each terminal-view: write deterministic text, programmatically select,
  // dispatch a real mouseup, and read clipboard. clipboard-write permission is
  // granted at context creation so synthetic mouseup is enough to satisfy
  // chromium's gesture check.
  const probeText = "PUA-CLIPBOARD-PROBE-" + Date.now().toString(36);

  // Click somewhere on the page first so we have a real user gesture, then
  // operate on the terminal view via the DOM.
  const xtermBox = await xtermLocator.boundingBox();
  if (xtermBox) {
    await page.mouse.click(xtermBox.x + 4, xtermBox.y + 4);
  }
  await page.waitForTimeout(50);

  const result = await page.evaluate(async (text) => {
    const view = document.querySelector(".terminal-view");
    if (!view) {
      return { stage: "no-view" };
    }
    const term = view.__xterm;
    if (!term) {
      return { stage: "no-term" };
    }
    term.write(text + "\r\n");
    await new Promise((r) => setTimeout(r, 120));
    term.selectAll();
    await new Promise((r) => setTimeout(r, 30));

    const hasSel = term.hasSelection();
    const xtermSelection = hasSel ? term.getSelection() : null;

    // Dispatch a real mouseup on the same stage element our handler listens on.
    // For interactive views stage === view; for previews stage is the inner
    // .terminal-view-stage. We try the live stage first, then fall back.
    const stage = view.classList.contains("terminal-view-live")
      ? view
      : view.querySelector(".terminal-view-stage") ?? view;
    stage.dispatchEvent(
      new MouseEvent("mouseup", { bubbles: true, cancelable: true }),
    );
    await new Promise((r) => setTimeout(r, 80));

    let clipboardText = null;
    let clipboardError = null;
    try {
      clipboardText = await navigator.clipboard.readText();
    } catch (err) {
      clipboardError = String(err);
    }
    return {
      stage: "ok",
      viewClasses: view.className,
      hasSel,
      xtermSelection,
      clipboardText,
      clipboardError,
    };
  }, probeText);

  console.log("[verify] probe text       :", probeText);
  console.log("[verify] result           :", JSON.stringify(result, null, 2));

  if (result.stage !== "ok") {
    console.log("[verify] FAIL — could not access terminal:", result.stage);
    process.exitCode = 2;
  } else if (!result.xtermSelection) {
    console.log("[verify] FAIL — term.selectAll did not produce a selection");
    process.exitCode = 3;
  } else if (
    result.clipboardText &&
    (result.clipboardText.includes(probeText) ||
      result.clipboardText.trim() === result.xtermSelection.trim())
  ) {
    console.log("[verify] PASS — clipboard contains the selected xterm text");
    process.exitCode = 0;
  } else {
    console.log(
      "[verify] FAIL — clipboard does not contain the xterm selection",
    );
    process.exitCode = 4;
  }
} finally {
  await browser.close();
}
