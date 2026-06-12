import assert from "node:assert/strict";
import Fastify from "fastify";
import test from "node:test";
import type { AgentSessionRecord } from "@agent-orchestrator/shared";

import { buildServer } from "../app.js";
import { registerAgentSessionRoutes } from "./agent-sessions.js";
import { AgentSessionRegistry } from "../services/agent-session-registry.js";

async function buildApp() {
  const { app } = buildServer();
  await app.ready();
  return app;
}

async function registerSession(app: Awaited<ReturnType<typeof buildApp>>) {
  const createRes = await app.inject({
    method: "POST",
    url: "/api/agent-sessions/register",
    payload: {
      workspaceId: "default",
      sourceType: "local",
      displayName: "update-validation",
      agentKind: "shell",
      connectionState: "online",
      interactionState: "running",
      workingDirectory: process.cwd(),
    },
  });

  assert.equal(createRes.statusCode, 201);
  return JSON.parse(createRes.payload) as { id: string };
}

test("PATCH /api/agent-sessions/:id rejects non-string display names as client errors", async () => {
  const app = await buildApp();

  try {
    const created = await registerSession(app);

    const updateRes = await app.inject({
      method: "PATCH",
      url: `/api/agent-sessions/${created.id}`,
      payload: {
        displayName: 42,
      },
    });

    assert.equal(updateRes.statusCode, 400);
    assert.match(
      JSON.parse(updateRes.payload).error,
      /displayName must be a string/,
    );
  } finally {
    await app.close();
  }
});

test("PATCH /api/agent-sessions/:id rejects non-boolean hidden flags as client errors", async () => {
  const app = await buildApp();

  try {
    const created = await registerSession(app);

    const updateRes = await app.inject({
      method: "PATCH",
      url: `/api/agent-sessions/${created.id}`,
      payload: {
        hidden: "false",
      },
    });

    assert.equal(updateRes.statusCode, 400);
    assert.match(
      JSON.parse(updateRes.payload).error,
      /hidden must be a boolean/,
    );

    const detailRes = await app.inject({
      method: "GET",
      url: `/api/agent-sessions/${created.id}`,
    });
    assert.equal(detailRes.statusCode, 200);
    const detail = JSON.parse(detailRes.payload) as {
      agentSession: { hidden?: boolean };
    };
    assert.equal(detail.agentSession.hidden, undefined);
  } finally {
    await app.close();
  }
});

test("PATCH /api/agent-sessions/:id rejects non-object bodies as client errors", async () => {
  const app = await buildApp();

  try {
    const created = await registerSession(app);

    const updateRes = await app.inject({
      method: "PATCH",
      url: `/api/agent-sessions/${created.id}`,
      headers: {
        "content-type": "application/json",
      },
      payload: JSON.stringify("not-an-update-object"),
    });

    assert.equal(updateRes.statusCode, 400);
    assert.match(
      JSON.parse(updateRes.payload).error,
      /request body must be an object/,
    );
  } finally {
    await app.close();
  }
});

test("PATCH /api/agent-sessions/:id validates all fields before renaming tmux sessions", async () => {
  const app = Fastify({ logger: false });
  const registry = new AgentSessionRegistry();
  const renamedTo: string[] = [];

  const tmuxSession = registry.register({
    workspaceId: "default",
    sourceType: "local",
    displayName: "tmux-update-validation",
    agentKind: "shell",
    connectionState: "online",
    interactionState: "running",
    workingDirectory: process.cwd(),
    transportRef: {
      tmuxSession: "session-a",
    },
  });

  await registerAgentSessionRoutes(app, {
    registry,
    processRuntimeManager: {} as never,
    tmuxAdapter: {
      renameSession: async (
        agentSession: AgentSessionRecord,
        displayName: string,
      ) => {
        renamedTo.push(displayName);
        return registry.updateSession(agentSession.id, { displayName });
      },
    } as never,
    sshRuntimeManager: {} as never,
    ptyRuntimeManager: {} as never,
    vsCodeWebManager: {} as never,
  });
  await app.ready();

  try {
    const updateRes = await app.inject({
      method: "PATCH",
      url: `/api/agent-sessions/${tmuxSession.id}`,
      payload: {
        displayName: "renamed-before-validation",
        hidden: "false",
      },
    });

    assert.equal(updateRes.statusCode, 400);
    assert.match(
      JSON.parse(updateRes.payload).error,
      /hidden must be a boolean/,
    );
    assert.deepEqual(renamedTo, []);
    assert.equal(
      registry.get(tmuxSession.id).displayName,
      "tmux-update-validation",
    );
  } finally {
    await app.close();
  }
});
