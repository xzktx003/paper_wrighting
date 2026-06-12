import assert from "node:assert/strict";
import test from "node:test";

import { buildServer } from "../app.js";

async function buildApp() {
  const { app } = buildServer();
  await app.ready();
  return app;
}

test("POST /api/agent-sessions/:id/resize rejects invalid terminal dimensions as client errors", async () => {
  const app = await buildApp();

  try {
    const invalidPayloads = [
      {},
      { cols: 0, rows: 24 },
      { cols: 80, rows: "24" },
      { cols: Number.MAX_SAFE_INTEGER + 1, rows: 24 },
    ];

    for (const payload of invalidPayloads) {
      const resizeRes = await app.inject({
        method: "POST",
        url: "/api/agent-sessions/missing/resize",
        payload,
      });

      assert.equal(resizeRes.statusCode, 400);
      assert.match(
        JSON.parse(resizeRes.payload).error,
        /cols and rows must be positive integers/,
      );
    }
  } finally {
    await app.close();
  }
});
