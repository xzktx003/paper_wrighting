import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { shouldEnableMobileTerminalTouchMode } from "./mobile-terminal-mode.js";

describe("mobile terminal mode", () => {
  it("enables touch terminal control for coarse pointer devices", () => {
    assert.equal(
      shouldEnableMobileTerminalTouchMode({
        maxTouchPoints: 0,
        pointerCoarse: true,
      }),
      true,
    );
  });

  it("enables touch terminal control for touchscreen devices", () => {
    assert.equal(
      shouldEnableMobileTerminalTouchMode({
        maxTouchPoints: 1,
        pointerCoarse: false,
      }),
      true,
    );
  });

  it("keeps desktop pointer devices on the normal terminal path", () => {
    assert.equal(
      shouldEnableMobileTerminalTouchMode({
        maxTouchPoints: 0,
        pointerCoarse: false,
      }),
      false,
    );
  });
});
