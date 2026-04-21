import { execFile, spawn, type ChildProcess } from "node:child_process";
import { existsSync, readdirSync } from "node:fs";
import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { homedir, networkInterfaces, tmpdir } from "node:os";
import { join } from "node:path";
import net from "node:net";

import type {
  AgentSessionRecord,
  OpenVsCodeWebResponse,
  VsCodeWebProvider,
} from "@agent-orchestrator/shared";

export class UnsupportedVsCodeWebSessionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UnsupportedVsCodeWebSessionError";
  }
}

export class VsCodeWebUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "VsCodeWebUnavailableError";
  }
}

interface RunningEditorInstance {
  child: ChildProcess;
  dataDir: string;
  exited: boolean;
  port: number;
  provider: VsCodeWebProvider;
  readyPromise: Promise<void>;
}

interface VsCodeWebManagerDeps {
  allocatePort?: () => Promise<number>;
  createRuntimeDir?: (sessionId: string) => Promise<string>;
  findCommand?: (candidate: string) => Promise<string | null>;
  installCodeServer?: () => Promise<void>;
  removeRuntimeDir?: (path: string) => Promise<void>;
  spawnProcess?: (
    command: string,
    args: string[],
    options: {
      cwd: string;
      env: NodeJS.ProcessEnv;
      stdio: "ignore";
    },
  ) => ChildProcess;
  waitForUrlReady?: (url: string) => Promise<void>;
}

interface EnsureVsCodeWebSessionOptions {
  requestHost?: string;
  requestProtocol?: "http" | "https";
}

function resolveLocalWorkingDirectory(input?: string): string {
  const trimmed = input?.trim();
  if (!trimmed || trimmed === "~" || trimmed === "~/") {
    return homedir();
  }

  if (trimmed.startsWith("~/")) {
    return join(homedir(), trimmed.slice(2));
  }

  return trimmed;
}

function buildEditorUrl(origin: string, workingDirectory: string): string {
  const url = new URL(origin);
  url.pathname = "/";
  url.searchParams.set("folder", workingDirectory);
  return url.toString();
}

function isLoopbackHost(host: string): boolean {
  const normalized = host.trim().toLowerCase();
  return (
    normalized === "localhost" ||
    normalized === "127.0.0.1" ||
    normalized === "::1" ||
    normalized === "[::1]"
  );
}

function resolveNonLoopbackIpv4(): string | null {
  const networks = networkInterfaces();
  for (const addresses of Object.values(networks)) {
    for (const entry of addresses ?? []) {
      if (entry.family !== "IPv4" || entry.internal) {
        continue;
      }

      return entry.address;
    }
  }

  return null;
}

function resolvePublicHost(requestHost?: string): string {
  const explicitHost = process.env.VSCODE_WEB_PUBLIC_HOST?.trim();
  if (explicitHost) {
    return explicitHost;
  }

  const normalizedRequestHost = requestHost?.trim();
  if (normalizedRequestHost && !isLoopbackHost(normalizedRequestHost)) {
    return normalizedRequestHost;
  }

  return resolveNonLoopbackIpv4() ?? "127.0.0.1";
}

async function defaultAllocatePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.unref();
    server.on("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (!address || typeof address === "string") {
        server.close(() => reject(new Error("Failed to allocate editor port")));
        return;
      }

      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }

        resolve(address.port);
      });
    });
  });
}

async function defaultCreateRuntimeDir(sessionId: string): Promise<string> {
  return mkdtemp(join(tmpdir(), `coding-kanban-vscode-${sessionId}-`));
}

async function defaultFindCommand(candidate: string): Promise<string | null> {
  const localCandidates = [
    join(homedir(), ".local", "bin", candidate),
    join(homedir(), ".local", "lib", candidate, "bin", candidate),
  ];

  if (candidate === "code-server") {
    const localLibDir = join(homedir(), ".local", "lib");
    if (existsSync(localLibDir)) {
      for (const entry of readdirSync(localLibDir)) {
        if (!entry.startsWith("code-server-")) {
          continue;
        }

        localCandidates.push(join(localLibDir, entry, "bin", "code-server"));
      }
    }
  }

  for (const pathValue of localCandidates) {
    if (existsSync(pathValue)) {
      return pathValue;
    }
  }

  return new Promise((resolve) => {
    execFile(
      "/bin/sh",
      ["-lc", `command -v ${candidate}`],
      { env: process.env },
      (error, stdout) => {
        if (error) {
          resolve(null);
          return;
        }

        const trimmed = stdout.trim();
        resolve(trimmed || null);
      },
    );
  });
}

async function defaultInstallCodeServer(): Promise<void> {
  const localBinary = join(homedir(), ".local", "bin", "code-server");
  if (existsSync(localBinary)) {
    return;
  }

  await new Promise<void>((resolve, reject) => {
    execFile(
      "/bin/sh",
      [
        "-lc",
        "curl -fsSL https://code-server.dev/install.sh | sh -s -- --method=standalone",
      ],
      { env: process.env, maxBuffer: 10 * 1024 * 1024 },
      (error) => {
        if (error) {
          reject(error);
          return;
        }

        resolve();
      },
    );
  });
}

async function defaultRemoveRuntimeDir(pathValue: string): Promise<void> {
  await rm(pathValue, { recursive: true, force: true });
}

function defaultSpawnProcess(
  command: string,
  args: string[],
  options: {
    cwd: string;
    env: NodeJS.ProcessEnv;
    stdio: "ignore";
  },
): ChildProcess {
  return spawn(command, args, options);
}

async function defaultWaitForUrlReady(url: string): Promise<void> {
  const startedAt = Date.now();
  const timeoutMs = 15_000;
  const waitStepMs = 250;

  while (Date.now() - startedAt < timeoutMs) {
    try {
      const response = await fetch(url, {
        method: "GET",
        redirect: "manual",
      });
      if (response.status >= 200 && response.status < 500) {
        return;
      }
    } catch {
      // Retry until timeout.
    }

    await new Promise((resolve) => setTimeout(resolve, waitStepMs));
  }

  throw new Error(`Timed out waiting for VS Code Web at ${url}`);
}

async function resolveProviderCommand(
  findCommand: (candidate: string) => Promise<string | null>,
): Promise<{ command: string; provider: VsCodeWebProvider } | null> {
  const candidates: Array<{
    candidate: string;
    provider: VsCodeWebProvider;
  }> = [
    { candidate: "code-server", provider: "code-server" },
    { candidate: "openvscode-server", provider: "openvscode-server" },
  ];

  for (const entry of candidates) {
    const command = await findCommand(entry.candidate);
    if (command) {
      return {
        command,
        provider: entry.provider,
      };
    }
  }

  return null;
}

function buildLaunchArgs(
  provider: VsCodeWebProvider,
  bindHost: string,
  port: number,
  dataDir: string,
): string[] {
  const userDataDir = join(dataDir, "user-data");
  const extensionsDir = join(dataDir, "extensions");

  if (provider === "code-server") {
    return [
      "--auth",
      "none",
      "--bind-addr",
      `${bindHost}:${port}`,
      "--user-data-dir",
      userDataDir,
      "--extensions-dir",
      extensionsDir,
    ];
  }

  return [
    "--host",
    bindHost,
    "--port",
    String(port),
    "--without-connection-token",
    "--user-data-dir",
    userDataDir,
    "--extensions-dir",
    extensionsDir,
  ];
}

export class VsCodeWebManager {
  private readonly allocatePort: () => Promise<number>;
  private readonly createRuntimeDir: (sessionId: string) => Promise<string>;
  private readonly findCommand: (candidate: string) => Promise<string | null>;
  private readonly installCodeServer: () => Promise<void>;
  private readonly removeRuntimeDir: (path: string) => Promise<void>;
  private readonly spawnProcess: (
    command: string,
    args: string[],
    options: {
      cwd: string;
      env: NodeJS.ProcessEnv;
      stdio: "ignore";
    },
  ) => ChildProcess;
  private readonly waitForUrlReady: (url: string) => Promise<void>;
  private readonly instances = new Map<string, RunningEditorInstance>();
  private installPromise: Promise<void> | null = null;

  constructor(deps: VsCodeWebManagerDeps = {}) {
    this.allocatePort = deps.allocatePort ?? defaultAllocatePort;
    this.createRuntimeDir = deps.createRuntimeDir ?? defaultCreateRuntimeDir;
    this.findCommand = deps.findCommand ?? defaultFindCommand;
    this.installCodeServer = deps.installCodeServer ?? defaultInstallCodeServer;
    this.removeRuntimeDir = deps.removeRuntimeDir ?? defaultRemoveRuntimeDir;
    this.spawnProcess = deps.spawnProcess ?? defaultSpawnProcess;
    this.waitForUrlReady = deps.waitForUrlReady ?? defaultWaitForUrlReady;
  }

  private async ensureProviderCommand(): Promise<{
    command: string;
    provider: VsCodeWebProvider;
  } | null> {
    const existing = await resolveProviderCommand(this.findCommand);
    if (existing) {
      return existing;
    }

    if (!this.installPromise) {
      this.installPromise = this.installCodeServer().finally(() => {
        this.installPromise = null;
      });
    }

    try {
      await this.installPromise;
    } catch {
      return null;
    }

    return resolveProviderCommand(this.findCommand);
  }

  async ensureSession(
    session: AgentSessionRecord,
    options: EnsureVsCodeWebSessionOptions = {},
  ): Promise<OpenVsCodeWebResponse> {
    if (session.sshTarget) {
      throw new UnsupportedVsCodeWebSessionError(
        "VS Code Web 第一版仅支持本地终端会话",
      );
    }

    const workingDirectory = resolveLocalWorkingDirectory(
      session.workingDirectory,
    );
    const publicProtocol = options.requestProtocol ?? "http";
    const publicHost = resolvePublicHost(options.requestHost);
    const existing = this.instances.get(session.id);
    if (existing && !existing.child.killed && !existing.exited) {
      await existing.readyPromise;
      return {
        provider: existing.provider,
        url: buildEditorUrl(
          `${publicProtocol}://${publicHost}:${existing.port}`,
          workingDirectory,
        ),
        reused: true,
        workingDirectory,
      };
    }

    const providerCommand = await this.ensureProviderCommand();
    if (!providerCommand) {
      throw new VsCodeWebUnavailableError(
        "未检测到可用的 VS Code Web 运行时，且自动安装 code-server 失败。",
      );
    }

    const port = await this.allocatePort();
    const dataDir = await this.createRuntimeDir(session.id);
    const bindHost = process.env.VSCODE_WEB_BIND_HOST?.trim() || "0.0.0.0";
    await mkdir(join(dataDir, "user-data"), { recursive: true });
    await mkdir(join(dataDir, "extensions"), { recursive: true });

    const child = this.spawnProcess(
      providerCommand.command,
      buildLaunchArgs(providerCommand.provider, bindHost, port, dataDir),
      {
        cwd: workingDirectory,
        env: (() => {
          const nextEnv: NodeJS.ProcessEnv = {
            ...process.env,
            BROWSER: "none",
          };
          delete nextEnv.HOST;
          delete nextEnv.PORT;
          delete nextEnv.PASSWORD;
          delete nextEnv.HASHED_PASSWORD;
          return nextEnv;
        })(),
        stdio: "ignore",
      },
    );

    const localOrigin = `http://127.0.0.1:${port}`;
    const publicOrigin = `${publicProtocol}://${publicHost}:${port}`;
    const instance: RunningEditorInstance = {
      child,
      dataDir,
      exited: false,
      port,
      provider: providerCommand.provider,
      readyPromise: Promise.resolve(),
    };
    child.on("exit", () => {
      instance.exited = true;
      if (this.instances.get(session.id) === instance) {
        this.instances.delete(session.id);
        void this.removeRuntimeDir(instance.dataDir);
      }
    });
    const readyPromise = new Promise<void>((resolve, reject) => {
      let settled = false;

      const rejectOnce = (error: Error) => {
        if (settled) {
          return;
        }
        settled = true;
        reject(error);
      };

      child.once("error", (error) => {
        rejectOnce(
          new VsCodeWebUnavailableError(
            `VS Code Web 启动失败: ${error.message}`,
          ),
        );
      });

      child.once("exit", (code, signal) => {
        rejectOnce(
          new VsCodeWebUnavailableError(
            `VS Code Web 进程过早退出 (code=${code ?? "null"}, signal=${signal ?? "null"})`,
          ),
        );
      });

      this.waitForUrlReady(localOrigin)
        .then(() => {
          if (settled) {
            return;
          }
          settled = true;
          resolve();
        })
        .catch((error) => {
          rejectOnce(
            error instanceof Error ? error : new Error("VS Code Web 未能就绪"),
          );
        });
    });
    instance.readyPromise = readyPromise;

    this.instances.set(session.id, instance);

    try {
      await readyPromise;
      return {
        provider: providerCommand.provider,
        url: buildEditorUrl(publicOrigin, workingDirectory),
        reused: false,
        workingDirectory,
      };
    } catch (error) {
      await this.stopSession(session.id);
      throw error;
    }
  }

  async stopSession(sessionId: string): Promise<void> {
    const instance = this.instances.get(sessionId);
    if (!instance) {
      return;
    }

    this.instances.delete(sessionId);
    if (!instance.child.killed) {
      instance.child.kill("SIGTERM");
    }
    await this.removeRuntimeDir(instance.dataDir);
  }

  async dispose(): Promise<void> {
    const sessionIds = [...this.instances.keys()];
    for (const sessionId of sessionIds) {
      await this.stopSession(sessionId);
    }
  }
}
