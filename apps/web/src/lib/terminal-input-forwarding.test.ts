import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  shouldAttemptTerminalInputForward,
  shouldBufferTerminalInputBeforeReady,
} from "./terminal-input-forwarding.js";

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

  it("blocks normal active-pane input before replay completes while allowing protocol replies", () => {
    assert.equal(
      shouldAttemptTerminalInputForward({
        inputEnabled: true,
        terminalInputReady: false,
        sanitizedPayload: "whoami",
        socketOpen: true,
      }),
      false,
    );
    assert.equal(
      shouldAttemptTerminalInputForward({
        inputEnabled: true,
        terminalInputReady: false,
        sanitizedPayload: "\u001b[?1;2c\u001b[12;42R",
        socketOpen: true,
      }),
      true,
    );
  });

  it("buffers active-pane user input before replay completes instead of dropping it", () => {
    assert.equal(
      shouldBufferTerminalInputBeforeReady({
        inputEnabled: true,
        terminalInputReady: false,
        sanitizedPayload: "hello",
        socketOpen: true,
      }),
      true,
    );
    assert.equal(
      shouldBufferTerminalInputBeforeReady({
        inputEnabled: false,
        terminalInputReady: false,
        sanitizedPayload: "hello",
        socketOpen: true,
      }),
      false,
    );
    assert.equal(
      shouldBufferTerminalInputBeforeReady({
        inputEnabled: true,
        terminalInputReady: false,
        sanitizedPayload: "\u001b[?1;2c",
        socketOpen: true,
      }),
      false,
    );
  });
});
