import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import test from "node:test";

import type { AgentSessionRecord } from "@agent-orchestrator/shared";

import {
  UnsupportedVsCodeWebSessionError,
  VsCodeWebManager,
  VsCodeWebUnavailableError,
} from "./vscode-web-manager.js";

class FakeChildProcess extends EventEmitter {
  killed = false;

  kill(): boolean {
    this.killed = true;
    return true;
  }
}

function buildSession(
  id: string,
  overrides: Partial<AgentSessionRecord> = {},
): AgentSessionRecord {
  return {
    id,
    workspaceId: "default",
    sourceType: "local",
    agentKind: "shell",
    displayName: `Local Shell ${id}`,
    workingDirectory: `/tmp/${id}`,
    connectionState: "online",
    interactionState: "running",
    ...overrides,
  };
}

test("ensureSession rejects remote sessions", async () => {
  const manager = new VsCodeWebManager();

  await assert.rejects(
    () =>
      manager.ensureSession(
        buildSession("session-1", {
          sshTarget: { host: "10.0.0.2" },
        }),
      ),
    UnsupportedVsCodeWebSessionError,
  );
});

test("ensureSession rejects when no supported provider is installed", async () => {
  const manager = new VsCodeWebManager({
    findCommand: async () => null,
    installCodeServer: async () => {},
  });

  await assert.rejects(
    () => manager.ensureSession(buildSession("session-1")),
    VsCodeWebUnavailableError,
  );
});

test("ensureSession launches one global code-server and returns session-specific workspace urls", async () => {
  const launches: Array<{ command: string; args: string[] }> = [];
  const child = new FakeChildProcess();
  const files = new Map<string, string>();
  const manager = new VsCodeWebManager({
    allocatePort: async () => 43111,
    createDataRoot: async () => "/tmp/coding-kanban-vscode-root",
    findCommand: async (candidate) =>
      candidate === "code-server" ? "/usr/bin/code-server" : null,
    spawnProcess: (command, args) => {
      launches.push({ command, args });
      return child as never;
    },
    waitForUrlReady: async () => {},
    writeFile: async (pathValue, content) => {
      files.set(pathValue, content);
    },
  });

  const first = await manager.ensureSession(buildSession("session-a"), {
    requestHost: "10.30.0.22",
    requestProtocol: "http",
  });
  const second = await manager.ensureSession(
    buildSession("session-b", {
      workingDirectory: "/tmp/project-b",
    }),
    {
      requestHost: "10.30.0.22",
      requestProtocol: "http",
    },
  );

  assert.equal(launches.length, 1);
  assert.equal(first.reused, false);
  assert.equal(second.reused, true);
  assert.match(first.url, /^http:\/\/10\.30\.0\.22:43111\//);
  assert.match(
    first.url,
    /workspace=%2Ftmp%2Fcoding-kanban-vscode-root%2Fworkspaces%2Fsession-a\.code-workspace/,
  );
  assert.match(
    second.url,
    /workspace=%2Ftmp%2Fcoding-kanban-vscode-root%2Fworkspaces%2Fsession-b\.code-workspace/,
  );
  assert.notEqual(first.url, second.url);
  assert.equal(launches[0].command, "/usr/bin/code-server");
  assert.deepEqual(launches[0].args.slice(0, 5), [
    "--auth",
    "none",
    "--bind-addr",
    "0.0.0.0:43111",
    "--disable-update-check",
  ]);
  assert.match(
    files.get(
      "/tmp/coding-kanban-vscode-root/workspaces/session-a.code-workspace",
    ) ?? "",
    /"path": "\/tmp\/session-a"/,
  );
  assert.match(
    files.get(
      "/tmp/coding-kanban-vscode-root/workspaces/session-b.code-workspace",
    ) ?? "",
    /"path": "\/tmp\/project-b"/,
  );

  await manager.dispose();
});

test("ensureSession auto-installs code-server when no provider is initially available", async () => {
  let installCount = 0;
  let findCount = 0;
  const child = new FakeChildProcess();
  const manager = new VsCodeWebManager({
    allocatePort: async () => 43114,
    createDataRoot: async () => "/tmp/coding-kanban-vscode-root",
    findCommand: async (candidate) => {
      if (candidate !== "code-server") {
        return null;
      }

      findCount += 1;
      return findCount >= 2 ? "/data01/home/xuzk/.local/bin/code-server" : null;
    },
    installCodeServer: async () => {
      installCount += 1;
    },
    spawnProcess: () => child as never,
    waitForUrlReady: async () => {},
    writeFile: async () => {},
  });

  const result = await manager.ensureSession(buildSession("session-1"));

  assert.equal(installCount, 1);
  assert.equal(result.provider, "code-server");

  await manager.dispose();
});

test("stopSession removes only the deleted session workspace and keeps the global server for other sessions", async () => {
  const child = new FakeChildProcess();
  const removedPaths: string[] = [];
  const manager = new VsCodeWebManager({
    allocatePort: async () => 43115,
    createDataRoot: async () => "/tmp/coding-kanban-vscode-root",
    findCommand: async (candidate) =>
      candidate === "code-server" ? "/usr/bin/code-server" : null,
    spawnProcess: () => child as never,
    waitForUrlReady: async () => {},
    writeFile: async () => {},
    removePath: async (pathValue) => {
      removedPaths.push(pathValue);
    },
  });

  await manager.ensureSession(buildSession("session-a"));
  await manager.ensureSession(buildSession("session-b"));
  await manager.stopSession("session-a");

  assert.equal(child.killed, false);

  await manager.stopSession("session-b");
  assert.equal(child.killed, true);

  await manager.dispose();
});

test("ensureSession prefers the request host for the returned public url", async () => {
  const child = new FakeChildProcess();
  const manager = new VsCodeWebManager({
    allocatePort: async () => 43116,
    createDataRoot: async () => "/tmp/coding-kanban-vscode-root",
    findCommand: async (candidate) =>
      candidate === "code-server" ? "/usr/bin/code-server" : null,
    spawnProcess: () => child as never,
    waitForUrlReady: async () => {},
    writeFile: async () => {},
  });

  const result = await manager.ensureSession(buildSession("session-1"), {
    requestHost: "10.30.0.22",
    requestProtocol: "http",
  });

  assert.match(result.url, /^http:\/\/10\.30\.0\.22:43116\//);

  await manager.dispose();
});
