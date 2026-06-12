import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { parseFocusViewState } from "./focus-view-state.js";

describe("parseFocusViewState", () => {
  it("restores valid persisted focus state", () => {
    const state = parseFocusViewState(
      JSON.stringify({
        focusedId: "session-1",
        viewMode: "focus",
      }),
    );

    assert.equal(state.focusedId, "session-1");
    assert.equal(state.viewMode, "focus");
  });

  it("trims persisted focused ids before restoring them", () => {
    const state = parseFocusViewState(
      JSON.stringify({
        focusedId: "  session-1  ",
        viewMode: "focus",
      }),
    );

    assert.equal(state.focusedId, "session-1");
    assert.equal(state.viewMode, "focus");
  });

  it("falls back on corrupt persisted focus state", () => {
    const state = parseFocusViewState("bad-json{{");

    assert.equal(state.focusedId, null);
    assert.equal(state.viewMode, "grid");
  });
});
