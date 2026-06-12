import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import type { AgentSessionRecord } from "@agent-orchestrator/shared";

import {
  AgentFocusView,
  buildFocusFallbackTerminalInput,
  readTerminalMonitorDragPayload,
  resolveFocusHeaderSession,
} from "./AgentFocusView.js";

const TERMINAL_MONITOR_DRAG_MIME =
  "application/x-coding-kanban-terminal-session";

function makeDataTransfer(records: Record<string, string>): DataTransfer {
  return {
    getData(type: string) {
      return records[type] ?? "";
    },
  } as DataTransfer;
}

function installLocalStorageStub(layoutMode = "dual") {
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: {
      getItem(key: string) {
        return key === "terminal-monitor-layout-mode" ? layoutMode : null;
      },
      setItem: () => {},
    },
  });
}

function makeSession(id: string, displayName: string): AgentSessionRecord {
  return {
    id,
    workspaceId: "default",
    sourceType: "local",
    agentKind: "codex",
    displayName,
    connectionState: "online",
    interactionState: "running",
    controlMode: "control",
  };
}

describe("AgentFocusView", () => {
  it("maps fallback keyboard events to terminal stdin sequences", () => {
    assert.equal(buildFocusFallbackTerminalInput({ key: "h" }), "h");
    assert.equal(buildFocusFallbackTerminalInput({ key: "H" }), "H");
    assert.equal(buildFocusFallbackTerminalInput({ key: "Enter" }), "\r");
    assert.equal(buildFocusFallbackTerminalInput({ key: "Backspace" }), "\x7f");
    assert.equal(buildFocusFallbackTerminalInput({ key: "Tab" }), "\t");
    assert.equal(buildFocusFallbackTerminalInput({ key: "ArrowUp" }), "\x1b[A");
    assert.equal(
      buildFocusFallbackTerminalInput({ key: "c", ctrlKey: true }),
      null,
    );
    assert.equal(
      buildFocusFallbackTerminalInput({ key: "q", altKey: true }),
      null,
    );
  });

  it("ignores plain-text drops that are not terminal monitor drags", () => {
    const payload = readTerminalMonitorDragPayload(
      makeDataTransfer({
        "text/plain": "session-2",
      }),
    );

    assert.equal(payload, null);
  });

  it("parses terminal monitor drag payloads from the custom MIME type", () => {
    const payload = readTerminalMonitorDragPayload(
      makeDataTransfer({
        [TERMINAL_MONITOR_DRAG_MIME]: JSON.stringify({
          sessionId: "session-2",
          sourceSlotId: "terminal-monitor-slot-1",
        }),
        "text/plain": "session-2",
      }),
    );

    assert.deepEqual(payload, {
      sessionId: "session-2",
      sourceSlotId: "terminal-monitor-slot-1",
    });
  });

  it("ignores terminal monitor drag payloads without a real session id", () => {
    const payload = readTerminalMonitorDragPayload(
      makeDataTransfer({
        [TERMINAL_MONITOR_DRAG_MIME]: JSON.stringify({
          sessionId: "   ",
          sourceSlotId: "terminal-monitor-slot-1",
        }),
      }),
    );

    assert.equal(payload, null);
  });

  it("renders a prominent current-input badge for the active monitor pane", () => {
    installLocalStorageStub();
    const sessions = [
      makeSession("session-1", "Alpha"),
      makeSession("session-2", "Beta"),
    ];

    const markup = renderToStaticMarkup(
      createElement(AgentFocusView, {
        focusedSession: sessions[0],
        sessions,
        onExit: () => {},
        onDeleteSession: () => {},
        onHideSession: () => {},
        onReconnect: () => {},
        onSwitchFocus: () => {},
      }),
    );

    const badgeMatches = markup.match(/focus-terminal-active-badge/g) ?? [];
    assert.equal(badgeMatches.length, 1);
    assert.match(markup, /aria-label="当前输入终端"/);
    assert.match(markup, />当前输入<\/span>/);
    assert.equal(
      (markup.match(/data-terminal-pane-menu-scope="active-titlebar"/g) ?? [])
        .length,
      1,
    );
    assert.doesNotMatch(markup, /data-testid="terminal-pane-context-menu"/);
  });

  it("marks other-session cards as title-safe context menu targets", () => {
    installLocalStorageStub("single");
    const sessions = [
      makeSession("session-1", "Alpha"),
      makeSession("session-2", "Beta"),
    ];

    const markup = renderToStaticMarkup(
      createElement(AgentFocusView, {
        focusedSession: sessions[0],
        sessions,
        onExit: () => {},
        onDeleteSession: () => {},
        onHideSession: () => {},
        onReconnect: () => {},
        onSwitchFocus: () => {},
      }),
    );

    assert.equal(
      (markup.match(/data-terminal-sidebar-menu-scope="other-session"/g) ?? [])
        .length,
      1,
    );
  });

  it("keeps the focus header on the focused session while side-panel sync is off", () => {
    const sessions = [
      makeSession("session-1", "Alpha"),
      makeSession("session-2", "Beta"),
    ];

    const headerSession = resolveFocusHeaderSession({
      focusedSession: sessions[0]!,
      activeTerminalSessionId: "session-2",
      headerSessionId: "session-1",
      sessions,
      syncActiveTerminalWithFocus: false,
    });

    assert.equal(headerSession.id, "session-1");
  });

  it("uses the explicit header session while side-panel sync is off", () => {
    const sessions = [
      makeSession("session-1", "Alpha"),
      makeSession("session-2", "Beta"),
    ];

    const headerSession = resolveFocusHeaderSession({
      focusedSession: sessions[0]!,
      activeTerminalSessionId: "session-1",
      headerSessionId: "session-2",
      sessions,
      syncActiveTerminalWithFocus: false,
    });

    assert.equal(headerSession.id, "session-2");
  });

  it("lets the focus header follow the active terminal while side-panel sync is on", () => {
    const sessions = [
      makeSession("session-1", "Alpha"),
      makeSession("session-2", "Beta"),
    ];

    const headerSession = resolveFocusHeaderSession({
      focusedSession: sessions[0]!,
      activeTerminalSessionId: "session-2",
      headerSessionId: "session-1",
      sessions,
      syncActiveTerminalWithFocus: true,
    });

    assert.equal(headerSession.id, "session-2");
  });
});
