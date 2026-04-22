import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";

import type { OpenVsCodeWebResponse } from "@agent-orchestrator/shared";

import {
  clearInflightVsCodeWebRequests,
  openVsCodeWebOnce,
  primeVsCodeWebOpenResponse,
} from "./vscode-web-open.js";

function buildResponse(url: string): OpenVsCodeWebResponse {
  return {
    provider: "code-server",
    reused: false,
    url,
    workingDirectory: "/tmp/project-a",
  };
}

describe("vscode-web-open", () => {
  afterEach(() => {
    clearInflightVsCodeWebRequests();
  });

  it("reuses the inflight open request for the same session", async () => {
    let callCount = 0;
    let resolveRequest = (_value: OpenVsCodeWebResponse) => {};
    const pendingRequest = new Promise<OpenVsCodeWebResponse>((resolve) => {
      resolveRequest = resolve;
    });

    const first = openVsCodeWebOnce("session-a", async () => {
      callCount += 1;
      return pendingRequest;
    });
    const second = openVsCodeWebOnce("session-a", async () => {
      callCount += 1;
      return buildResponse("http://example.test/editor");
    });

    assert.equal(callCount, 1);
    assert.equal(first, second);

    resolveRequest(buildResponse("http://example.test/editor"));
    await Promise.all([first, second]);
  });

  it("reuses the last successful response when cached reuse is allowed", async () => {
    let callCount = 0;

    await openVsCodeWebOnce("session-a", async () => {
      callCount += 1;
      return buildResponse("http://example.test/editor-a");
    });

    const second = await openVsCodeWebOnce(
      "session-a",
      async () => {
        callCount += 1;
        return buildResponse("http://example.test/editor-b");
      },
      { allowCachedResponse: true },
    );

    assert.equal(callCount, 1);
    assert.equal(second.url, "http://example.test/editor-a");
  });

  it("allows bypassing the cached response when a fresh request is required", async () => {
    let callCount = 0;

    await openVsCodeWebOnce("session-a", async () => {
      callCount += 1;
      return buildResponse("http://example.test/editor-a");
    });

    const second = await openVsCodeWebOnce("session-a", async () => {
      callCount += 1;
      return buildResponse("http://example.test/editor-b");
    });

    assert.equal(callCount, 2);
    assert.equal(second.url, "http://example.test/editor-b");
  });

  it("can prime a cached response for a session before the first open call", async () => {
    let callCount = 0;
    primeVsCodeWebOpenResponse(
      "session-a",
      buildResponse("http://example.test/editor-primed"),
    );

    const result = await openVsCodeWebOnce(
      "session-a",
      async () => {
        callCount += 1;
        return buildResponse("http://example.test/editor-network");
      },
      { allowCachedResponse: true },
    );

    assert.equal(callCount, 0);
    assert.equal(result.url, "http://example.test/editor-primed");
  });
});
