import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { stripTerminalResponsePayload } from "./terminal-input.js";

describe("stripTerminalResponsePayload", () => {
  it("forwards device-attribute responses so TUIs (e.g. Copilot CLI) finish their capability handshake", () => {
    assert.equal(stripTerminalResponsePayload("\u001b[?1;2c"), "\u001b[?1;2c");
  });

  it("keeps normal arrow-key input intact", () => {
    assert.equal(stripTerminalResponsePayload("\u001b[A"), "\u001b[A");
  });

  it("keeps cursor position report replies intact", () => {
    assert.equal(
      stripTerminalResponsePayload("\u001b[12;42R"),
      "\u001b[12;42R",
    );
  });

  it("keeps DSR status replies intact so interactive prompts get their answers", () => {
    assert.equal(stripTerminalResponsePayload("\u001b[0n"), "\u001b[0n");
  });
});
