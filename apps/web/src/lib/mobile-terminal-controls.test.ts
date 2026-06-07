import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  buildMobileComposerInput,
  getMobileTerminalControlInput,
} from "./mobile-terminal-controls.js";

describe("mobile terminal controls", () => {
  it("maps touch buttons to real terminal control sequences", () => {
    assert.equal(getMobileTerminalControlInput("interrupt"), "\x03");
    assert.equal(getMobileTerminalControlInput("escape"), "\x1b");
    assert.equal(getMobileTerminalControlInput("tab"), "\t");
    assert.equal(getMobileTerminalControlInput("enter"), "\r");
    assert.equal(getMobileTerminalControlInput("eof"), "\x04");
    assert.equal(getMobileTerminalControlInput("arrow-up"), "\x1b[A");
    assert.equal(getMobileTerminalControlInput("arrow-down"), "\x1b[B");
    assert.equal(getMobileTerminalControlInput("arrow-left"), "\x1b[D");
    assert.equal(getMobileTerminalControlInput("arrow-right"), "\x1b[C");
  });

  it("turns composer send into a submitted terminal line", () => {
    assert.equal(
      buildMobileComposerInput("hello codex", "send"),
      "hello codex\r",
    );
    assert.equal(
      buildMobileComposerInput("hello codex\n", "send"),
      "hello codex\n",
    );
  });

  it("keeps paste mode as raw text without adding enter", () => {
    assert.equal(
      buildMobileComposerInput("hello codex", "paste"),
      "hello codex",
    );
    assert.equal(
      buildMobileComposerInput("line 1\r\nline 2", "paste"),
      "line 1\nline 2",
    );
  });
});
