import assert from "node:assert/strict";
import test from "node:test";

import { buildServer } from "../app.js";
import {
  UnsupportedVsCodeWebSessionError,
  VsCodeWebUnavailableError,
} from "../services/vscode-web-manager.js";

async function buildApp(vsCodeWebManager?: object) {
  const { app } = vsCodeWebManager
    ? buildServer({ vsCodeWebManager: vsCodeWebManager as never })
    : buildServer();
  await app.ready();
  return app;
}

test("POST /api/agent-sessions/:id/vscode-web opens a local session in VS Code Web", async () => {
  let receivedSessionId = "";
  let receivedHost = "";
  let stoppedSessionId = "";
  const app = await buildApp({
    ensureSession: async (
      session: {
        id: string;
        workingDirectory?: string;
      },
      options: { requestHost?: string },
    ) => {
      receivedSessionId = session.id;
      receivedHost = options.requestHost ?? "";
      return {
        provider: "code-server",
        url: "http://10.30.0.22:43111/?folder=%2Ftmp%2Fproject-a",
        reused: false,
        workingDirectory: session.workingDirectory ?? "/tmp/project-a",
      };
    },
    stopSession: async (sessionId: string) => {
      stoppedSessionId = sessionId;
    },
    dispose: async () => {},
  });

  try {
    const createRes = await app.inject({
      method: "POST",
      url: "/api/agent-sessions/register",
      payload: {
        workspaceId: "default",
        sourceType: "local",
        displayName: "shell-a",
        agentKind: "shell",
        connectionState: "online",
        interactionState: "running",
        workingDirectory: "/tmp/project-a",
      },
    });
    assert.equal(createRes.statusCode, 201);
    const created = JSON.parse(createRes.payload);

    const openRes = await app.inject({
      method: "POST",
      url: `/api/agent-sessions/${created.id}/vscode-web`,
    });
    assert.equal(openRes.statusCode, 200);
    const body = JSON.parse(openRes.payload);
    assert.equal(body.provider, "code-server");
    assert.equal(receivedSessionId, created.id);
    assert.equal(receivedHost, "localhost");

    const deleteRes = await app.inject({
      method: "DELETE",
      url: `/api/agent-sessions/${created.id}`,
    });
    assert.equal(deleteRes.statusCode, 204);
    assert.equal(stoppedSessionId, created.id);
  } finally {
    await app.close();
  }
});

test("POST /api/agent-sessions/:id/vscode-web returns 400 for unsupported sessions", async () => {
  const app = await buildApp({
    ensureSession: async () => {
      throw new UnsupportedVsCodeWebSessionError("not supported");
    },
    stopSession: async () => {},
    dispose: async () => {},
  });

  try {
    const createRes = await app.inject({
      method: "POST",
      url: "/api/agent-sessions/register",
      payload: {
        workspaceId: "default",
        sourceType: "local",
        displayName: "shell-b",
        agentKind: "shell",
        connectionState: "online",
        interactionState: "running",
        workingDirectory: "/tmp/project-b",
      },
    });
    const created = JSON.parse(createRes.payload);

    const openRes = await app.inject({
      method: "POST",
      url: `/api/agent-sessions/${created.id}/vscode-web`,
    });
    assert.equal(openRes.statusCode, 400);
    assert.match(openRes.payload, /not supported/);
  } finally {
    await app.close();
  }
});

test("POST /api/agent-sessions/:id/vscode-web returns 503 when no provider is available", async () => {
  const app = await buildApp({
    ensureSession: async () => {
      throw new VsCodeWebUnavailableError("provider missing");
    },
    stopSession: async () => {},
    dispose: async () => {},
  });

  try {
    const createRes = await app.inject({
      method: "POST",
      url: "/api/agent-sessions/register",
      payload: {
        workspaceId: "default",
        sourceType: "local",
        displayName: "shell-c",
        agentKind: "shell",
        connectionState: "online",
        interactionState: "running",
        workingDirectory: "/tmp/project-c",
      },
    });
    const created = JSON.parse(createRes.payload);

    const openRes = await app.inject({
      method: "POST",
      url: `/api/agent-sessions/${created.id}/vscode-web`,
    });
    assert.equal(openRes.statusCode, 503);
    assert.match(openRes.payload, /provider missing/);
  } finally {
    await app.close();
  }
});
