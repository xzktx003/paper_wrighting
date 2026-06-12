import assert from "node:assert/strict";
import test from "node:test";

import { buildServer } from "../app.js";

async function buildApp() {
  const { app } = buildServer();
  await app.ready();
  return app;
}

test("agent session routes return 404 for unknown session ids", async () => {
  const app = await buildApp();

  try {
    const requests = [
      {
        method: "GET",
        url: "/api/agent-sessions/missing",
      },
      {
        method: "POST",
        url: "/api/agent-sessions/focus",
        payload: { agentSessionId: "missing" },
      },
      {
        method: "POST",
        url: "/api/agent-sessions/missing/stdin",
        payload: { input: "hello" },
      },
      {
        method: "DELETE",
        url: "/api/agent-sessions/missing",
      },
    ] as const;

    for (const request of requests) {
      const response = await app.inject(request);

      assert.equal(response.statusCode, 404, `${request.method} ${request.url}`);
      assert.match(
        JSON.parse(response.payload).error,
        /Unknown agent session: missing/,
      );
    }
  } finally {
    await app.close();
  }
});
