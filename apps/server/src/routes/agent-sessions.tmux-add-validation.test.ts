import assert from "node:assert/strict";
import test from "node:test";

import { buildServer } from "../app.js";

async function buildApp() {
  const { app } = buildServer();
  await app.ready();
  return app;
}

test("POST /api/agent-discovery/tmux/add rejects malformed discovery payloads as client errors", async () => {
  const app = await buildApp();

  try {
    const invalidPayloads = [
      undefined,
      {},
      {
        tmuxSession: "tmux-add-validation",
        displayName: "tmux-add-validation",
        workingDirectory: process.cwd(),
        agentKind: "shell",
        interactionState: "unknown",
      },
      {
        tmuxSession: "tmux-add-validation",
        displayName: "tmux-add-validation",
        workingDirectory: process.cwd(),
        agentKind: "shell",
        sshTarget: {
          host: "example.test",
          port: 70_000,
        },
      },
      {
        tmuxSession: "tmux-add-validation",
        displayName: "tmux-add-validation",
        workingDirectory: process.cwd(),
        agentKind: "shell",
        sshTarget: {
          host: "example.test",
          identityFile: "/tmp/key\nProxyCommand=sh",
        },
      },
    ];

    for (const payload of invalidPayloads) {
      const addRes = await app.inject({
        method: "POST",
        url: "/api/agent-discovery/tmux/add",
        ...(payload === undefined ? {} : { payload }),
      });

      assert.equal(addRes.statusCode, 400);
      assert.match(
        JSON.parse(addRes.payload).error,
        /must|required|valid|contains invalid characters/,
      );
    }
  } finally {
    await app.close();
  }
});
