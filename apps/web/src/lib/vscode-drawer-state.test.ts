import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { OpenVsCodeWebResponse } from "@agent-orchestrator/shared";

import {
  applyVsCodeWebOpenResponse,
  createCachedVsCodeWebEntry,
  shouldEnsureVsCodeWebOnOpen,
} from "./vscode-drawer-state.js";

function buildResponse(): OpenVsCodeWebResponse {
  return {
    provider: "code-server",
    reused: true,
    url: "https://localhost:3000/vscode/?workspace=%2Ftmp%2Fproject.code-workspace",
    workingDirectory: "/tmp/project",
  };
}

describe("vscode-drawer-state", () => {
  it("revalidates restored cache and forces one reload when the confirmed response matches", () => {
    const response = buildResponse();
    const cachedEntry = createCachedVsCodeWebEntry(response);

    assert.equal(shouldEnsureVsCodeWebOnOpen(cachedEntry), true);

    const confirmedEntry = applyVsCodeWebOpenResponse(cachedEntry, response);

    assert.equal(confirmedEntry.needsServerCheck, false);
    assert.equal(confirmedEntry.reloadKey, 1);
    assert.deepEqual(confirmedEntry.response, response);
  });
});
