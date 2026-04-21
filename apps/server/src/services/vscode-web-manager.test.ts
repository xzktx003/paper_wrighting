import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import test from "node:test";

import type { AgentSessionRecord } from "@agent-orchestrator/shared";

import {
  UnsupportedVsCodeWebSessionError,
  VsCodeWebManager,
  VsCodeWebUnavailableError,
} from "./vscode-web-manager.js";

const TEST_DATA_ROOT = "/tmp/coding-kanban-vscode-root";

function resolveTestExtensionsDir(root: string): string {
  return `${root}/extensions`;
}

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
    createDataRoot: async () => TEST_DATA_ROOT,
    findCommand: async (candidate) =>
      candidate === "code-server" ? "/usr/bin/code-server" : null,
    resolveLaunchEnv: async () => ({
      HOME: "/tmp/demo-home",
      PATH: "/tmp/demo-bin",
      SHELL: "/bin/bash",
    }),
    resolveExtensionsDir: resolveTestExtensionsDir,
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
    /workspace=%2Ftmp%2Fcoding-kanban-vscode-root%2Fworkspaces%2Fsession-a-[a-f0-9]{16}\.code-workspace/,
  );
  assert.match(
    second.url,
    /workspace=%2Ftmp%2Fcoding-kanban-vscode-root%2Fworkspaces%2Fproject-b-[a-f0-9]{16}\.code-workspace/,
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
  assert.deepEqual(launches[0].args.slice(5, 9), [
    "--config",
    `${TEST_DATA_ROOT}/config.yaml`,
    "--user-data-dir",
    `${TEST_DATA_ROOT}/user-data`,
  ]);
  assert.deepEqual(launches[0].args.slice(9, 11), [
    "--extensions-dir",
    `${TEST_DATA_ROOT}/extensions`,
  ]);
  assert.match(files.get(`${TEST_DATA_ROOT}/config.yaml`) ?? "", /auth: none/);
  const userSettingsPath = `${TEST_DATA_ROOT}/user-data/User/settings.json`;
  const userSettings = JSON.parse(files.get(userSettingsPath) ?? "{}");
  assert.equal(
    userSettings["terminal.integrated.defaultProfile.linux"],
    "coding-kanban-user-shell",
  );
  assert.equal(userSettings["terminal.integrated.inheritEnv"], true);
  assert.equal(
    userSettings["terminal.integrated.profiles.linux"][
      "coding-kanban-user-shell"
    ].path,
    "/bin/bash",
  );
  assert.deepEqual(
    userSettings["terminal.integrated.profiles.linux"][
      "coding-kanban-user-shell"
    ].args,
    ["-i"],
  );
  const sessionAWorkspacePath = [...files.keys()].find((pathValue) =>
    pathValue.includes("/workspaces/session-a-"),
  );
  const sessionBWorkspacePath = [...files.keys()].find((pathValue) =>
    pathValue.includes("/workspaces/project-b-"),
  );
  assert.ok(sessionAWorkspacePath);
  assert.ok(sessionBWorkspacePath);
  assert.match(
    files.get(sessionAWorkspacePath) ?? "",
    /"path": "\/tmp\/session-a"/,
  );
  assert.match(
    files.get(sessionBWorkspacePath) ?? "",
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
    createDataRoot: async () => TEST_DATA_ROOT,
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
    resolveExtensionsDir: resolveTestExtensionsDir,
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
    createDataRoot: async () => TEST_DATA_ROOT,
    findCommand: async (candidate) =>
      candidate === "code-server" ? "/usr/bin/code-server" : null,
    resolveExtensionsDir: resolveTestExtensionsDir,
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
    createDataRoot: async () => TEST_DATA_ROOT,
    findCommand: async (candidate) =>
      candidate === "code-server" ? "/usr/bin/code-server" : null,
    resolveExtensionsDir: resolveTestExtensionsDir,
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

test("ensureSession does not rewrite an unchanged workspace file", async () => {
  const child = new FakeChildProcess();
  const writes = new Map<string, number>();
  const manager = new VsCodeWebManager({
    allocatePort: async () => 43117,
    createDataRoot: async () => TEST_DATA_ROOT,
    findCommand: async (candidate) =>
      candidate === "code-server" ? "/usr/bin/code-server" : null,
    resolveExtensionsDir: resolveTestExtensionsDir,
    spawnProcess: () => child as never,
    waitForUrlReady: async () => {},
    writeFile: async (pathValue) => {
      writes.set(pathValue, (writes.get(pathValue) ?? 0) + 1);
    },
  });

  await manager.ensureSession(buildSession("session-1"));
  await manager.ensureSession(buildSession("session-1"));

  const workspaceWrites = [...writes.entries()].filter(([pathValue]) =>
    pathValue.includes("/workspaces/"),
  );
  assert.equal(workspaceWrites.length, 1);
  assert.equal(workspaceWrites[0]?.[1], 1);

  await manager.dispose();
});

test("ensureSession uses an explicit shared extensions directory override", async () => {
  const child = new FakeChildProcess();
  const launches: Array<{ args: string[] }> = [];
  const previousExtensionsDir = process.env.VSCODE_WEB_EXTENSIONS_DIR;
  process.env.VSCODE_WEB_EXTENSIONS_DIR = "/tmp/shared-vscode-extensions";

  try {
    const manager = new VsCodeWebManager({
      allocatePort: async () => 43118,
      createDataRoot: async () => TEST_DATA_ROOT,
      findCommand: async (candidate) =>
        candidate === "code-server" ? "/usr/bin/code-server" : null,
      spawnProcess: (_command, args) => {
        launches.push({ args });
        return child as never;
      },
      waitForUrlReady: async () => {},
      writeFile: async () => {},
    });

    await manager.ensureSession(buildSession("session-1"));

    assert.deepEqual(launches[0]?.args.slice(9, 11), [
      "--extensions-dir",
      "/tmp/shared-vscode-extensions",
    ]);

    await manager.dispose();
  } finally {
    if (previousExtensionsDir === undefined) {
      delete process.env.VSCODE_WEB_EXTENSIONS_DIR;
    } else {
      process.env.VSCODE_WEB_EXTENSIONS_DIR = previousExtensionsDir;
    }
  }
});

test("ensureSession uses the resolved shell env and strips inherited VS Code IPC hooks before spawning", async () => {
  const child = new FakeChildProcess();
  let spawnedEnv: NodeJS.ProcessEnv | undefined;
  const manager = new VsCodeWebManager({
    allocatePort: async () => 43119,
    createDataRoot: async () => TEST_DATA_ROOT,
    findCommand: async (candidate) =>
      candidate === "code-server" ? "/usr/bin/code-server" : null,
    resolveExtensionsDir: resolveTestExtensionsDir,
    resolveLaunchEnv: async () => ({
      HOME: "/tmp/demo-home",
      PATH: "/tmp/demo-bin",
      SHELL: "/bin/zsh",
      HOST: "3000",
      PASSWORD: "secret",
      HASHED_PASSWORD: "hashed-secret",
      VSCODE_IPC_HOOK_CLI: "/tmp/vscode-ipc-hook.sock",
      npm_config_prefix: "/tmp/npm-prefix",
    }),
    spawnProcess: (_command, _args, options) => {
      spawnedEnv = options.env;
      return child as never;
    },
    waitForUrlReady: async () => {},
    writeFile: async () => {},
  });

  await manager.ensureSession(buildSession("session-1"));

  assert.equal(spawnedEnv?.HOME, "/tmp/demo-home");
  assert.equal(spawnedEnv?.PATH, "/tmp/demo-bin");
  assert.equal(spawnedEnv?.SHELL, "/bin/zsh");
  assert.equal(spawnedEnv?.BROWSER, "none");
  assert.equal(spawnedEnv?.HOST, undefined);
  assert.equal(spawnedEnv?.PASSWORD, undefined);
  assert.equal(spawnedEnv?.HASHED_PASSWORD, undefined);
  assert.equal(spawnedEnv?.VSCODE_IPC_HOOK_CLI, undefined);
  assert.equal(spawnedEnv?.npm_config_prefix, undefined);

  await manager.dispose();
});
