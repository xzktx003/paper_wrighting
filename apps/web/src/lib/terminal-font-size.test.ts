import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  DEFAULT_TERMINAL_FONT_SIZE,
  MAX_TERMINAL_FONT_SIZE,
  MIN_TERMINAL_FONT_SIZE,
  clampTerminalFontSize,
  loadTerminalFontSize,
  saveTerminalFontSize,
} from "./terminal-font-size.js";

describe("terminal font size", () => {
  it("clamps font sizes to the supported terminal range", () => {
    assert.equal(
      clampTerminalFontSize(MIN_TERMINAL_FONT_SIZE - 10),
      MIN_TERMINAL_FONT_SIZE,
    );
    assert.equal(
      clampTerminalFontSize(MAX_TERMINAL_FONT_SIZE + 10),
      MAX_TERMINAL_FONT_SIZE,
    );
    assert.equal(clampTerminalFontSize(17.6), 18);
    assert.equal(clampTerminalFontSize(Number.NaN), DEFAULT_TERMINAL_FONT_SIZE);
  });

  it("loads and saves the persisted terminal font size", () => {
    const storage = new Map<string, string>();
    const localStorageLike = {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => storage.set(key, value),
    };

    assert.equal(
      loadTerminalFontSize(localStorageLike),
      DEFAULT_TERMINAL_FONT_SIZE,
    );
    saveTerminalFontSize(20, localStorageLike);
    assert.equal(loadTerminalFontSize(localStorageLike), 20);
    saveTerminalFontSize(100, localStorageLike);
    assert.equal(
      loadTerminalFontSize(localStorageLike),
      MAX_TERMINAL_FONT_SIZE,
    );
  });
});
