import assert from "node:assert/strict";
import test from "node:test";

import { formatPlaywrightPreflightError } from "./playwright-preflight.mjs";

test("formats missing Chromium shared library failures as actionable preflight errors", () => {
  const message = formatPlaywrightPreflightError(
    new Error(
      "/chrome-headless-shell: error while loading shared libraries: libatk-1.0.so.0: cannot open shared object file: No such file or directory",
    ),
  );

  assert.match(message, /libatk-1\.0\.so\.0/);
  assert.match(message, /npx playwright install/);
  assert.match(message, /sudo npx playwright install-deps/);
});

test("keeps non-library launch failures visible", () => {
  const message = formatPlaywrightPreflightError(new Error("sandbox denied"));

  assert.match(message, /preflight failed/i);
  assert.match(message, /sandbox denied/);
});
