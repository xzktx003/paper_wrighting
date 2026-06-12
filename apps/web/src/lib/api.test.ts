import assert from "node:assert/strict";
import test from "node:test";

import {
  buildTerminalWebSocketUrl,
  parseAgentSessionSnapshotEvent,
  parseFileUploadResponse,
  parseXhrUploadResponse,
  parseDownloadFilename,
  parseFailedResponseMessage,
  parseSuccessfulResponse,
} from "./api.js";

function setWindowLocation(protocol: "http:" | "https:", host: string): void {
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: {
      location: {
        protocol,
        host,
        origin: `${protocol}//${host}`,
      },
    },
  });
}

test("buildTerminalWebSocketUrl uses wss on the default HTTPS dev frontend", () => {
  setWindowLocation("https:", "10.30.0.24:3100");

  assert.equal(
    buildTerminalWebSocketUrl("agent-1"),
    "wss://10.30.0.24:3100/ws/agent-sessions/agent-1/terminal",
  );
});

test("buildTerminalWebSocketUrl keeps ws on an HTTP frontend", () => {
  setWindowLocation("http:", "127.0.0.1:3100");

  assert.equal(
    buildTerminalWebSocketUrl("agent-1"),
    "ws://127.0.0.1:3100/ws/agent-sessions/agent-1/terminal",
  );
});

test("parseFileUploadResponse accepts parsed upload responses", () => {
  assert.deepEqual(
    parseFileUploadResponse({ uploadedPaths: ["/tmp/a.txt"] }, ""),
    { uploadedPaths: ["/tmp/a.txt"] },
  );
});

test("parseFileUploadResponse parses valid response text fallback", () => {
  assert.deepEqual(
    parseFileUploadResponse(null, JSON.stringify({ uploadedPaths: ["a.md"] })),
    { uploadedPaths: ["a.md"] },
  );
});

test("parseFileUploadResponse rejects invalid JSON fallback", () => {
  assert.throws(
    () => parseFileUploadResponse(null, ""),
    /Upload returned invalid JSON/,
  );
});

test("parseFileUploadResponse rejects unexpected response shapes", () => {
  assert.throws(
    () => parseFileUploadResponse({ uploadedPaths: [42] }, ""),
    /Upload returned an invalid response/,
  );
});

test("parseXhrUploadResponse does not read responseText when parsed JSON is available", () => {
  assert.deepEqual(
    parseXhrUploadResponse({ uploadedPaths: ["/tmp/a.txt"] }, () => {
      throw new Error("responseText is unavailable for JSON XHR responses");
    }),
    { uploadedPaths: ["/tmp/a.txt"] },
  );
});

test("parseDownloadFilename prefers RFC 5987 encoded filenames", () => {
  assert.equal(
    parseDownloadFilename(
      "attachment; filename=\"fallback.txt\"; filename*=UTF-8''report%20final.txt",
      "/tmp/source.txt",
    ),
    "report final.txt",
  );
});

test("parseDownloadFilename strips path separators from header filenames", () => {
  assert.equal(
    parseDownloadFilename(
      "attachment; filename*=UTF-8''..%2Fnested%5Creport.txt",
      "/tmp/source.txt",
    ),
    ".._nested_report.txt",
  );
});

test("parseSuccessfulResponse resolves 204 responses without parsing JSON", async () => {
  assert.equal(
    await parseSuccessfulResponse<void>(new Response(null, { status: 204 })),
    undefined,
  );
});

test("parseSuccessfulResponse resolves empty successful responses", async () => {
  assert.equal(
    await parseSuccessfulResponse<void>(new Response("", { status: 200 })),
    undefined,
  );
});

test("parseSuccessfulResponse parses non-empty JSON responses", async () => {
  assert.deepEqual(
    await parseSuccessfulResponse<{ ok: boolean }>(
      new Response(JSON.stringify({ ok: true }), { status: 200 }),
    ),
    { ok: true },
  );
});

test("parseSuccessfulResponse rejects malformed JSON responses", async () => {
  await assert.rejects(
    () => parseSuccessfulResponse(new Response("not-json", { status: 200 })),
    /Response returned invalid JSON/,
  );
});

test("parseFailedResponseMessage preserves structured JSON errors", async () => {
  assert.equal(
    await parseFailedResponseMessage(
      new Response(JSON.stringify({ error: "bad input" }), {
        status: 400,
        headers: { "content-type": "application/json" },
      }),
    ),
    "bad input",
  );
});

test("parseFailedResponseMessage falls back for malformed JSON errors", async () => {
  assert.equal(
    await parseFailedResponseMessage(
      new Response("{", {
        status: 502,
        headers: { "content-type": "application/json" },
      }),
    ),
    "Request failed: 502",
  );
});

test("parseFailedResponseMessage falls back for empty JSON errors", async () => {
  assert.equal(
    await parseFailedResponseMessage(
      new Response("", {
        status: 404,
        headers: { "content-type": "application/json" },
      }),
    ),
    "Request failed: 404",
  );
});

test("parseFailedResponseMessage preserves text errors", async () => {
  assert.equal(
    await parseFailedResponseMessage(
      new Response("upstream unavailable", {
        status: 503,
        headers: { "content-type": "text/plain" },
      }),
    ),
    "upstream unavailable",
  );
});

test("parseAgentSessionSnapshotEvent parses valid snapshot events", () => {
  const event = parseAgentSessionSnapshotEvent(
    JSON.stringify({
      type: "snapshot",
      payload: {
        items: [],
        activeAgentSessionId: null,
        updatedAt: "2026-06-11T00:00:00.000Z",
      },
    }),
  );

  assert.deepEqual(event, {
    type: "snapshot",
    payload: {
      items: [],
      activeAgentSessionId: null,
      updatedAt: "2026-06-11T00:00:00.000Z",
    },
  });
});

test("parseAgentSessionSnapshotEvent ignores malformed websocket JSON", () => {
  assert.equal(parseAgentSessionSnapshotEvent("{"), null);
});

test("parseAgentSessionSnapshotEvent ignores non-snapshot events", () => {
  assert.equal(
    parseAgentSessionSnapshotEvent(
      JSON.stringify({
        type: "heartbeat",
        payload: {
          items: [],
          activeAgentSessionId: null,
          updatedAt: "2026-06-11T00:00:00.000Z",
        },
      }),
    ),
    null,
  );
});

test("parseAgentSessionSnapshotEvent ignores malformed snapshot payloads", () => {
  assert.equal(
    parseAgentSessionSnapshotEvent(
      JSON.stringify({
        type: "snapshot",
        payload: {
          items: {},
          activeAgentSessionId: 42,
          updatedAt: null,
        },
      }),
    ),
    null,
  );
});
