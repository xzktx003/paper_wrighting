import assert from "node:assert/strict";
import test from "node:test";

import { buildServer } from "../app.js";

async function buildApp() {
  const { app } = buildServer();
  await app.ready();
  return app;
}

test("POST /api/agent-sessions/:id/stdin rejects missing or non-string input as client errors", async () => {
  const app = await buildApp();

  try {
    const createRes = await app.inject({
      method: "POST",
      url: "/api/agent-sessions/register",
      payload: {
        workspaceId: "default",
        sourceType: "local",
        displayName: "stdin-validation",
        agentKind: "shell",
        connectionState: "online",
        interactionState: "running",
        workingDirectory: process.cwd(),
      },
    });

    assert.equal(createRes.statusCode, 201);
    const created = JSON.parse(createRes.payload) as { id: string };

    for (const payload of [{}, { input: 42 }]) {
      const stdinRes = await app.inject({
        method: "POST",
        url: `/api/agent-sessions/${created.id}/stdin`,
        payload,
      });

      assert.equal(stdinRes.statusCode, 400);
      assert.match(JSON.parse(stdinRes.payload).error, /input must be a string/);
    }
  } finally {
    await app.close();
  }
});
