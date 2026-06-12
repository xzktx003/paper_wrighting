import assert from "node:assert/strict";
import test from "node:test";

import { buildServer } from "../app.js";

async function buildApp() {
  const { app } = buildServer();
  await app.ready();
  return app;
}

test("agent discovery routes reject malformed payloads as client errors", async () => {
  const app = await buildApp();

  try {
    const invalidRequests = [
      {
        url: "/api/agent-discovery/tmux/scan",
        payload: {
          sshTarget: {
            host: "example.test",
            port: 70_000,
          },
        },
      },
      {
        url: "/api/agent-discovery/tmux/scan",
        payload: {
          sshTarget: "example.test",
        },
      },
      {
        url: "/api/agent-discovery/tmux/scan",
        payload: {
          sshTarget: {
            host: "example.test\n-oProxyCommand=sh",
          },
        },
      },
      {
        url: "/api/agent-discovery/scan",
        payload: {},
      },
      {
        url: "/api/agent-discovery/scan",
        payload: {
          path: 42,
        },
      },
      {
        url: "/api/agent-discovery/scan",
        payload: {
          path: process.cwd(),
          sshTarget: {
            host: "example.test",
            port: "22",
          },
        },
      },
      {
        url: "/api/agent-discovery/scan",
        payload: {
          path: process.cwd(),
          sshTarget: {
            host: "example.test",
            username: "demo\ruser",
          },
        },
      },
    ];

    for (const { url, payload } of invalidRequests) {
      const response = await app.inject({
        method: "POST",
        url,
        payload,
      });

      assert.equal(response.statusCode, 400, `${url} should reject payload`);
      assert.match(
        JSON.parse(response.payload).error,
        /must|required|contains invalid characters/,
      );
    }
  } finally {
    await app.close();
  }
});
