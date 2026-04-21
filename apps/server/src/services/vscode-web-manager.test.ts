import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
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
  overrides: Partial<AgentSessionRecord> = {},
): AgentSessionRecord {
  return {
    id: "session-1",
    workspaceId: "default",
    sourceType: "local",
    agentKind: "shell",
    displayName: "Local Shell",
    workingDirectory: "/tmp/project-a",
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
        buildSession({
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
    () => manager.ensureSession(buildSession()),
    VsCodeWebUnavailableError,
  );
});

test("ensureSession launches code-server and returns a folder-bound url", async () => {
  const launches: Array<{ command: string; args: string[] }> = [];
  const child = new FakeChildProcess();
  const manager = new VsCodeWebManager({
    allocatePort: async () => 43111,
    createRuntimeDir: async () =>
      mkdtemp(join(tmpdir(), "coding-kanban-vscode-test-")),
    findCommand: async (candidate) =>
      candidate === "code-server" ? "/usr/bin/code-server" : null,
    spawnProcess: (command, args) => {
      launches.push({ command, args });
      return child as never;
    },
    waitForUrlReady: async () => {},
  });

  const result = await manager.ensureSession(buildSession());

  assert.equal(result.provider, "code-server");
  assert.equal(result.reused, false);
  assert.match(result.url, /10\.30\.0\.22:43111|http:\/\/[^/]+:43111/);
  assert.match(result.url, /folder=%2Ftmp%2Fproject-a/);
  assert.equal(launches.length, 1);
  assert.equal(launches[0].command, "/usr/bin/code-server");
  assert.deepEqual(launches[0].args.slice(0, 4), [
    "--auth",
    "none",
    "--bind-addr",
    "0.0.0.0:43111",
  ]);

  await manager.dispose();
});

test("ensureSession auto-installs code-server when no provider is initially available", async () => {
  let installCount = 0;
  let findCount = 0;
  const child = new FakeChildProcess();
  const manager = new VsCodeWebManager({
    allocatePort: async () => 43114,
    createRuntimeDir: async () =>
      mkdtemp(join(tmpdir(), "coding-kanban-vscode-test-")),
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
  });

  const result = await manager.ensureSession(buildSession());

  assert.equal(installCount, 1);
  assert.equal(result.provider, "code-server");

  await manager.dispose();
});

test("ensureSession reuses an existing instance for the same session", async () => {
  let spawnCount = 0;
  const child = new FakeChildProcess();
  const manager = new VsCodeWebManager({
    allocatePort: async () => 43112,
    createRuntimeDir: async () =>
      mkdtemp(join(tmpdir(), "coding-kanban-vscode-test-")),
    findCommand: async (candidate) =>
      candidate === "code-server" ? "/usr/bin/code-server" : null,
    spawnProcess: () => {
      spawnCount += 1;
      return child as never;
    },
    waitForUrlReady: async () => {},
  });

  const first = await manager.ensureSession(buildSession());
  const second = await manager.ensureSession(
    buildSession({
      workingDirectory: "/tmp/project-b",
    }),
  );

  assert.equal(spawnCount, 1);
  assert.equal(first.reused, false);
  assert.equal(second.reused, true);
  assert.match(second.url, /folder=%2Ftmp%2Fproject-b/);

  await manager.dispose();
});

test("stopSession terminates the editor process", async () => {
  const child = new FakeChildProcess();
  const manager = new VsCodeWebManager({
    allocatePort: async () => 43113,
    createRuntimeDir: async () =>
      mkdtemp(join(tmpdir(), "coding-kanban-vscode-test-")),
    findCommand: async (candidate) =>
      candidate === "openvscode-server" ? "/usr/bin/openvscode-server" : null,
    spawnProcess: () => child as never,
    waitForUrlReady: async () => {},
  });

  await manager.ensureSession(buildSession());
  await manager.stopSession("session-1");

  assert.equal(child.killed, true);
});

test("ensureSession prefers the request host for the returned public url", async () => {
  const child = new FakeChildProcess();
  const manager = new VsCodeWebManager({
    allocatePort: async () => 43115,
    createRuntimeDir: async () =>
      mkdtemp(join(tmpdir(), "coding-kanban-vscode-test-")),
    findCommand: async (candidate) =>
      candidate === "code-server" ? "/usr/bin/code-server" : null,
    spawnProcess: () => child as never,
    waitForUrlReady: async () => {},
  });

  const result = await manager.ensureSession(buildSession(), {
    requestHost: "10.30.0.22",
    requestProtocol: "http",
  });

  assert.match(result.url, /^http:\/\/10\.30\.0\.22:43115\//);

  await manager.dispose();
});
