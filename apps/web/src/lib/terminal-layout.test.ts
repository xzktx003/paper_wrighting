import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  areTerminalMonitorSlotsEqual,
  getTerminalMonitorLayoutCapacity,
  normalizeTerminalMonitorSlots,
  setTerminalMonitorSlotSession,
} from "./terminal-layout.js";

const sessions = [
  { id: "agent-1" },
  { id: "agent-2" },
  { id: "agent-3" },
  { id: "agent-4" },
  { id: "agent-5" },
];

describe("terminal monitor layout", () => {
  it("caps monitor panes to the selected layout size", () => {
    assert.equal(getTerminalMonitorLayoutCapacity("single"), 1);
    assert.equal(getTerminalMonitorLayoutCapacity("dual"), 2);
    assert.equal(getTerminalMonitorLayoutCapacity("quad"), 4);

    const slots = normalizeTerminalMonitorSlots({
      mode: "quad",
      sessions,
      preferredSessionId: "agent-1",
    });

    assert.equal(slots.length, 4);
    assert.deepEqual(
      slots.map((slot) => slot.sessionId),
      ["agent-1", "agent-2", "agent-3", "agent-4"],
    );
  });

  it("keeps the focused session visible when reducing layout size", () => {
    const slots = normalizeTerminalMonitorSlots({
      mode: "dual",
      sessions,
      preferredSessionId: "agent-4",
      previousSlots: [
        { id: "terminal-monitor-slot-1", sessionId: "agent-1" },
        { id: "terminal-monitor-slot-2", sessionId: "agent-2" },
        { id: "terminal-monitor-slot-3", sessionId: "agent-3" },
        { id: "terminal-monitor-slot-4", sessionId: "agent-4" },
      ],
      preferredSlotId: "terminal-monitor-slot-2",
    });

    assert.deepEqual(
      slots.map((slot) => slot.sessionId),
      ["agent-1", "agent-4"],
    );
  });

  it("deduplicates sessions so one pane cannot mirror another pane", () => {
    const slots = normalizeTerminalMonitorSlots({
      mode: "quad",
      sessions,
      preferredSessionId: "agent-1",
      previousSlots: [
        { id: "terminal-monitor-slot-1", sessionId: "agent-1" },
        { id: "terminal-monitor-slot-2", sessionId: "agent-1" },
        { id: "terminal-monitor-slot-3", sessionId: "agent-2" },
        { id: "terminal-monitor-slot-4", sessionId: "agent-2" },
      ],
    });

    assert.deepEqual(
      slots.map((slot) => slot.sessionId),
      ["agent-1", "agent-3", "agent-2", "agent-4"],
    );
  });

  it("moves a selected session instead of broadcasting it into two panes", () => {
    const slots = setTerminalMonitorSlotSession(
      [
        { id: "terminal-monitor-slot-1", sessionId: "agent-1" },
        { id: "terminal-monitor-slot-2", sessionId: "agent-2" },
      ],
      "terminal-monitor-slot-2",
      "agent-1",
    );

    assert.deepEqual(slots, [
      { id: "terminal-monitor-slot-1", sessionId: null },
      { id: "terminal-monitor-slot-2", sessionId: "agent-1" },
    ]);
  });

  it("compares normalized slots without forcing redundant React state writes", () => {
    assert.equal(
      areTerminalMonitorSlotsEqual(
        [{ id: "terminal-monitor-slot-1", sessionId: "agent-1" }],
        [{ id: "terminal-monitor-slot-1", sessionId: "agent-1" }],
      ),
      true,
    );
    assert.equal(
      areTerminalMonitorSlotsEqual(
        [{ id: "terminal-monitor-slot-1", sessionId: "agent-1" }],
        [{ id: "terminal-monitor-slot-1", sessionId: "agent-2" }],
      ),
      false,
    );
  });
});
