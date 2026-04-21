import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";

import type { OpenVsCodeWebResponse } from "@agent-orchestrator/shared";

import {
  clearInflightVsCodeWebRequests,
  openVsCodeWebOnce,
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

  it("allows a new request after the previous one settles", async () => {
    let callCount = 0;

    await openVsCodeWebOnce("session-a", async () => {
      callCount += 1;
      return buildResponse("http://example.test/editor-a");
    });

    await openVsCodeWebOnce("session-a", async () => {
      callCount += 1;
      return buildResponse("http://example.test/editor-b");
    });

    assert.equal(callCount, 2);
  });
});
