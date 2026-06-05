import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  TERMINAL_PREVIEW_MODE_STORAGE_KEY,
  formatTerminalPreviewMode,
  loadTerminalPreviewLightweightMode,
  parseTerminalPreviewMode,
  saveTerminalPreviewLightweightMode,
} from "./terminal-preview-mode.js";

class MemoryStorage {
  private readonly values = new Map<string, string>();

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }
}

describe("terminal preview mode", () => {
  it("defaults to lightweight mode unless full preview was explicitly saved", () => {
    assert.equal(parseTerminalPreviewMode(null), true);
    assert.equal(parseTerminalPreviewMode("lightweight"), true);
    assert.equal(parseTerminalPreviewMode("unexpected"), true);
    assert.equal(parseTerminalPreviewMode("full"), false);
  });

  it("formats and persists the selected preview mode", () => {
    const storage = new MemoryStorage();

    saveTerminalPreviewLightweightMode(false, storage);
    assert.equal(storage.getItem(TERMINAL_PREVIEW_MODE_STORAGE_KEY), "full");
    assert.equal(loadTerminalPreviewLightweightMode(storage), false);

    saveTerminalPreviewLightweightMode(true, storage);
    assert.equal(
      storage.getItem(TERMINAL_PREVIEW_MODE_STORAGE_KEY),
      "lightweight",
    );
    assert.equal(loadTerminalPreviewLightweightMode(storage), true);
  });

  it("uses stable storage payloads for future migrations", () => {
    assert.equal(formatTerminalPreviewMode(true), "lightweight");
    assert.equal(formatTerminalPreviewMode(false), "full");
  });
});
