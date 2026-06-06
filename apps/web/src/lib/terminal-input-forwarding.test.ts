import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { shouldAttemptTerminalInputForward } from "./terminal-input-forwarding.js";

describe("terminal input forwarding", () => {
  it("does not forward stdin from monitor-only panes", () => {
    assert.equal(
      shouldAttemptTerminalInputForward({
        inputEnabled: false,
        sanitizedPayload: "whoami",
        socketOpen: true,
      }),
      false,
    );
  });

  it("still forwards terminal handshake replies from monitor-only panes", () => {
    assert.equal(
      shouldAttemptTerminalInputForward({
        inputEnabled: false,
        sanitizedPayload: "\u001b[?1;2c",
        socketOpen: true,
      }),
      true,
    );
    assert.equal(
      shouldAttemptTerminalInputForward({
        inputEnabled: false,
        sanitizedPayload: "\u001b[A",
        socketOpen: true,
      }),
      false,
    );
  });

  it("forwards stdin only from the active input pane over an open socket", () => {
    assert.equal(
      shouldAttemptTerminalInputForward({
        inputEnabled: true,
        sanitizedPayload: "whoami",
        socketOpen: true,
      }),
      true,
    );
    assert.equal(
      shouldAttemptTerminalInputForward({
        inputEnabled: true,
        sanitizedPayload: "whoami",
        socketOpen: false,
      }),
      false,
    );
    assert.equal(
      shouldAttemptTerminalInputForward({
        inputEnabled: true,
        sanitizedPayload: "",
        socketOpen: true,
      }),
      false,
    );
  });
});
