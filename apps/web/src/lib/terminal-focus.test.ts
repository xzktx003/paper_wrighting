import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { shouldRepairPassiveTerminalFocus } from "./terminal-focus.js";

describe("shouldRepairPassiveTerminalFocus", () => {
  it("repairs focus when the terminal was the user's most recent focus target", () => {
    assert.equal(
      shouldRepairPassiveTerminalFocus({
        documentHasFocus: true,
        helperAvailable: true,
        helperFocused: false,
        intentionalExternalFocus: false,
        lastProtectedExternalFocusAt: 10,
        lastTerminalIntentAt: 20,
      }),
      true,
    );
  });

  it("does not repair focus while an intentional external target still owns it", () => {
    assert.equal(
      shouldRepairPassiveTerminalFocus({
        documentHasFocus: true,
        helperAvailable: true,
        helperFocused: false,
        intentionalExternalFocus: true,
        lastProtectedExternalFocusAt: 20,
        lastTerminalIntentAt: 30,
      }),
      false,
    );
  });

  it("does not repair focus when the editor was the most recent intentional target", () => {
    assert.equal(
      shouldRepairPassiveTerminalFocus({
        documentHasFocus: true,
        helperAvailable: true,
        helperFocused: false,
        intentionalExternalFocus: false,
        lastProtectedExternalFocusAt: 30,
        lastTerminalIntentAt: 20,
      }),
      false,
    );
  });

  it("does not repair focus when the terminal helper is already focused", () => {
    assert.equal(
      shouldRepairPassiveTerminalFocus({
        documentHasFocus: true,
        helperAvailable: true,
        helperFocused: true,
        intentionalExternalFocus: false,
        lastProtectedExternalFocusAt: 0,
        lastTerminalIntentAt: 20,
      }),
      false,
    );
  });

  it("repairs focus when no external target has claimed ownership yet", () => {
    assert.equal(
      shouldRepairPassiveTerminalFocus({
        documentHasFocus: true,
        helperAvailable: true,
        helperFocused: false,
        intentionalExternalFocus: false,
        lastProtectedExternalFocusAt: 0,
        lastTerminalIntentAt: 0,
      }),
      true,
    );
  });
});
