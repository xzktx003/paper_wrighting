import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  FILE_BROWSER_MIN_WIDTH,
  parseFileBrowserUiState,
} from "./file-browser-ui-state.js";

describe("parseFileBrowserUiState", () => {
  it("restores valid persisted panel state", () => {
    const state = parseFileBrowserUiState(
      JSON.stringify({
        mainCollapsed: true,
        sideCollapsed: false,
        width: 720,
      }),
    );

    assert.equal(state.mainCollapsed, true);
    assert.equal(state.sideCollapsed, false);
    assert.equal(state.width, 720);
  });

  it("ignores non-boolean collapsed flags from stale storage", () => {
    const state = parseFileBrowserUiState(
      JSON.stringify({
        mainCollapsed: "false",
        sideCollapsed: 1,
        width: 720,
      }),
    );

    assert.equal(state.mainCollapsed, false);
    assert.equal(state.sideCollapsed, false);
    assert.equal(state.width, 720);
  });

  it("falls back when persisted panel width is unusable", () => {
    const state = parseFileBrowserUiState(
      JSON.stringify({
        mainCollapsed: false,
        sideCollapsed: false,
        width: FILE_BROWSER_MIN_WIDTH - 1,
      }),
    );

    assert.equal(state.width, 540);
  });

  it("falls back on corrupt persisted panel state", () => {
    const state = parseFileBrowserUiState("bad-json{{");

    assert.equal(state.mainCollapsed, false);
    assert.equal(state.sideCollapsed, false);
    assert.equal(state.width, 540);
  });
});
