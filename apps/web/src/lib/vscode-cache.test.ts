import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { touchVsCodeCacheSessionIds } from "./vscode-cache.js";

describe("touchVsCodeCacheSessionIds", () => {
  it("keeps the existing render order when revisiting a cached session", () => {
    const result = touchVsCodeCacheSessionIds(
      ["session-a", "session-b"],
      "session-a",
      8,
    );

    assert.deepEqual(result, ["session-a", "session-b"]);
  });
});
