import assert from "node:assert/strict";
import test from "node:test";

import { buildServer } from "../app.js";

async function buildApp() {
  const { app } = buildServer();
  await app.ready();
  return app;
}

test("agent launch routes reject malformed payloads before starting runtimes", async () => {
  const app = await buildApp();

  try {
    const invalidRequests = [
      {
        url: "/api/agent-launch/local",
        payload: {
          workspaceId: "default",
          displayName: "bad-launch",
          agentKind: "shell",
        },
      },
      {
        url: "/api/agent-launch/local",
        payload: {
          workspaceId: "default",
          displayName: "bad-launch",
          agentKind: "shell",
          command: "",
        },
      },
      {
        url: "/api/agent-launch/pty",
        payload: {
          displayName: "bad-launch",
          agentKind: "shell",
          command: "",
        },
      },
      {
        url: "/api/agent-launch/pty",
        payload: {
          workspaceId: "default",
          displayName: "bad-launch",
          agentKind: "shell",
          command: 42,
        },
      },
      {
        url: "/api/agent-launch/remote",
        payload: {
          workspaceId: "default",
          displayName: "bad-launch",
          agentKind: "shell",
          command: "echo bad",
        },
      },
      {
        url: "/api/agent-launch/remote",
        payload: {
          workspaceId: "default",
          displayName: "bad-launch",
          agentKind: "shell",
          command: "echo bad",
          sshTarget: {
            host: "example.test",
            port: 70_000,
          },
        },
      },
      {
        url: "/api/agent-launch/remote",
        payload: {
          workspaceId: "default",
          displayName: "bad-launch",
          agentKind: "shell",
          command: "echo bad",
          sshTarget: {
            host: "example.test\n-oProxyCommand=sh",
          },
        },
      },
      {
        url: "/api/agent-launch/ssh-pty",
        payload: {
          workspaceId: "default",
          displayName: "bad-launch",
          agentKind: "shell",
          sshTarget: {
            host: "example.test",
          },
        },
      },
      {
        url: "/api/agent-launch/ssh-pty",
        payload: {
          workspaceId: "default",
          displayName: "bad-launch",
          agentKind: "shell",
          remoteCommand: "echo bad",
          sshTarget: {
            host: "example.test",
          },
          agentSessionId: 123,
        },
      },
      {
        url: "/api/agent-launch/ssh-pty",
        payload: {
          workspaceId: "default",
          displayName: "bad-launch",
          agentKind: "shell",
          remoteCommand: "echo bad",
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

    const listRes = await app.inject({
      method: "GET",
      url: "/api/agent-sessions",
    });

    const listBody = JSON.parse(listRes.payload) as {
      items: Array<{ displayName: string }>;
    };
    assert.equal(
      listBody.items.some(({ displayName }) => displayName === "bad-launch"),
      false,
    );
  } finally {
    await app.close();
  }
});
