import assert from "node:assert/strict";
import test from "node:test";

import { sanitizeReplayForTerminal } from "./pty-runtime-manager.js";

test("strip replayed device attribute and status queries", () => {
  const replay = "prompt> \u001b[>cprompt redraw\u001b[6n\u001b[18tstill here";

  const sanitized = sanitizeReplayForTerminal(replay);

  assert.equal(sanitized, "prompt> prompt redrawstill here");
});

test("keep normal styling escapes in replay", () => {
  const replay = "\u001b[31mred\u001b[0m text";

  const sanitized = sanitizeReplayForTerminal(replay);

  assert.equal(sanitized, replay);
});
