import assert from "node:assert/strict";
import test from "node:test";

import { buildServer } from "../app.js";

async function buildApp() {
  const { app } = buildServer();
  await app.ready();
  return app;
}

test("POST /api/agent-sessions/focus rejects missing or non-string session ids as client errors", async () => {
  const app = await buildApp();

  try {
    for (const payload of [{}, { agentSessionId: 42 }]) {
      const focusRes = await app.inject({
        method: "POST",
        url: "/api/agent-sessions/focus",
        payload,
      });

      assert.equal(focusRes.statusCode, 400);
      assert.match(
        JSON.parse(focusRes.payload).error,
        /agentSessionId must be a string/,
      );
    }
  } finally {
    await app.close();
  }
});
