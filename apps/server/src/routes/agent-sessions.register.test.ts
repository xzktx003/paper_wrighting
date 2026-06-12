import assert from "node:assert/strict";
import test from "node:test";

import { buildServer } from "../app.js";

async function buildApp() {
  const { app } = buildServer();
  await app.ready();
  return app;
}

test("POST /api/agent-sessions/register rejects malformed session records as client errors", async () => {
  const app = await buildApp();

  try {
    const invalidPayloads = [
      {},
      {
        workspaceId: "default",
        sourceType: "invalid",
        displayName: "bad-register",
        agentKind: "shell",
      },
      {
        workspaceId: "default",
        sourceType: "local",
        displayName: "bad-register",
        agentKind: "shell",
        connectionState: "waiting",
      },
      {
        workspaceId: "default",
        sourceType: "local",
        displayName: "bad-register",
        agentKind: "shell",
        transportRef: {
          processId: "123",
        },
      },
      {
        workspaceId: "default",
        sourceType: "remote-connect",
        displayName: "bad-register",
        agentKind: "shell",
        transportRef: {
          runtimeId: "ssh:bad-register",
          sshHost: "example.test",
          sshPort: 70_000,
        },
      },
    ];

    for (const payload of invalidPayloads) {
      const registerRes = await app.inject({
        method: "POST",
        url: "/api/agent-sessions/register",
        payload,
      });

      assert.equal(registerRes.statusCode, 400);
      assert.match(JSON.parse(registerRes.payload).error, /must|required|valid/);
    }

    const listRes = await app.inject({
      method: "GET",
      url: "/api/agent-sessions",
    });

    const listBody = JSON.parse(listRes.payload) as {
      items: Array<{ displayName: string }>;
    };
    assert.equal(
      listBody.items.some(({ displayName }) => displayName === "bad-register"),
      false,
    );
  } finally {
    await app.close();
  }
});
