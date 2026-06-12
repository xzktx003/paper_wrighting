import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  registerTerminalInputBridge,
  sendTerminalInputViaBridge,
} from "./terminal-input-bridge.js";

describe("terminal input bridge", () => {
  it("routes fallback input to the registered session bridge", () => {
    const received: string[] = [];
    const unregister = registerTerminalInputBridge("session-1", (input) => {
      received.push(input);
      return true;
    });

    assert.equal(sendTerminalInputViaBridge("session-1", "hello"), true);
    assert.deepEqual(received, ["hello"]);

    unregister();
    assert.equal(sendTerminalInputViaBridge("session-1", "again"), false);
  });

  it("keeps a newer bridge when an older unregister runs", () => {
    const unregisterOld = registerTerminalInputBridge("session-1", () => false);
    registerTerminalInputBridge("session-1", () => true);

    unregisterOld();

    assert.equal(sendTerminalInputViaBridge("session-1", "hello"), true);
  });
});
