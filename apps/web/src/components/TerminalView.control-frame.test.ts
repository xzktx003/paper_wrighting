import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { parseTerminalControlFrame } from "../lib/terminal-control-frame.js";

describe("parseTerminalControlFrame", () => {
  it("parses replay control frames", () => {
    assert.deepEqual(
      parseTerminalControlFrame(
        JSON.stringify({
          __agentOrchestrator: "terminal-control",
          event: "replay",
          data: "hello",
        }),
      ),
      { type: "replay", data: "hello" },
    );
  });

  it("parses replay-complete control frames", () => {
    assert.deepEqual(
      parseTerminalControlFrame(
        JSON.stringify({
          __agentOrchestrator: "terminal-control",
          event: "replay-complete",
        }),
      ),
      { type: "replay-complete" },
    );
  });

  it("treats unknown terminal-control events as terminal output", () => {
    const payload = JSON.stringify({
      __agentOrchestrator: "terminal-control",
      event: "future-event",
    });

    assert.deepEqual(parseTerminalControlFrame(payload), {
      type: "output",
      data: payload,
    });
  });

  it("treats malformed replay control frames as terminal output", () => {
    const payload = JSON.stringify({
      __agentOrchestrator: "terminal-control",
      event: "replay",
      data: 42,
    });

    assert.deepEqual(parseTerminalControlFrame(payload), {
      type: "output",
      data: payload,
    });
  });
});
