import { execFile, spawn, type ChildProcess } from "node:child_process";
import { existsSync, readdirSync } from "node:fs";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { homedir, networkInterfaces } from "node:os";
import { join } from "node:path";
import net from "node:net";

import type {
  AgentSessionRecord,
  OpenVsCodeWebResponse,
  VsCodeWebProvider,
} from "@agent-orchestrator/shared";

const DEFAULT_VSCODE_WEB_IDLE_TIMEOUT_MS = 10 * 60 * 1000;

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

interface RunningGlobalServer {
  child: ChildProcess;
  exited: boolean;
  idleTimer: NodeJS.Timeout | null;
  lastUsedAt: number;
  port: number;
  provider: VsCodeWebProvider;
  readyPromise: Promise<void>;
}

interface VsCodeWebManagerDeps {
  allocatePort?: () => Promise<number>;
  createDataRoot?: () => Promise<string>;
  findCommand?: (candidate: string) => Promise<string | null>;
  idleTimeoutMs?: number;
  installCodeServer?: () => Promise<void>;
  now?: () => number;
  removePath?: (path: string) => Promise<void>;
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
  writeFile?: (path: string, content: string) => Promise<void>;
}

interface EnsureVsCodeWebSessionOptions {
  requestHost?: string;
  requestProtocol?: "http" | "https";
}

interface DataRootPaths {
  extensionsDir: string;
  root: string;
  userDataDir: string;
  workspacesDir: string;
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

function buildEditorUrl(
  origin: string,
  workspacePath: string,
  workingDirectory: string,
): string {
  const url = new URL(origin);
  url.pathname = "/";
  url.searchParams.set("workspace", workspacePath);
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

async function defaultCreateDataRoot(): Promise<string> {
  return join(homedir(), ".local", "share", "coding-kanban", "vscode-web");
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

async function defaultRemovePath(pathValue: string): Promise<void> {
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

async function defaultWriteFile(pathValue: string, content: string) {
  await writeFile(pathValue, content, "utf8");
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
  userDataDir: string,
  extensionsDir: string,
): string[] {
  if (provider === "code-server") {
    return [
      "--auth",
      "none",
      "--bind-addr",
      `${bindHost}:${port}`,
      "--disable-update-check",
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

function buildWorkspaceContent(
  session: AgentSessionRecord,
  workingDirectory: string,
): string {
  return JSON.stringify(
    {
      folders: [{ path: workingDirectory }],
      settings: {
        "window.title": session.displayName,
      },
    },
    null,
    2,
  );
}

export class VsCodeWebManager {
  private readonly allocatePort: () => Promise<number>;
  private readonly createDataRoot: () => Promise<string>;
  private readonly findCommand: (candidate: string) => Promise<string | null>;
  private readonly idleTimeoutMs: number;
  private readonly installCodeServer: () => Promise<void>;
  private readonly now: () => number;
  private readonly removePath: (path: string) => Promise<void>;
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
  private readonly writeFile: (path: string, content: string) => Promise<void>;
  private dataRootPathsPromise: Promise<DataRootPaths> | null = null;
  private globalServer: RunningGlobalServer | null = null;
  private installPromise: Promise<void> | null = null;
  private readonly sessionWorkspacePaths = new Map<string, string>();

  constructor(deps: VsCodeWebManagerDeps = {}) {
    this.allocatePort = deps.allocatePort ?? defaultAllocatePort;
    this.createDataRoot = deps.createDataRoot ?? defaultCreateDataRoot;
    this.findCommand = deps.findCommand ?? defaultFindCommand;
    this.idleTimeoutMs =
      deps.idleTimeoutMs ?? DEFAULT_VSCODE_WEB_IDLE_TIMEOUT_MS;
    this.installCodeServer = deps.installCodeServer ?? defaultInstallCodeServer;
    this.now = deps.now ?? (() => Date.now());
    this.removePath = deps.removePath ?? defaultRemovePath;
    this.spawnProcess = deps.spawnProcess ?? defaultSpawnProcess;
    this.waitForUrlReady = deps.waitForUrlReady ?? defaultWaitForUrlReady;
    this.writeFile = deps.writeFile ?? defaultWriteFile;
  }

  private async ensureDataRootPaths(): Promise<DataRootPaths> {
    if (!this.dataRootPathsPromise) {
      this.dataRootPathsPromise = this.createDataRoot().then(async (root) => {
        const paths = {
          root,
          userDataDir: join(root, "user-data"),
          extensionsDir: join(root, "extensions"),
          workspacesDir: join(root, "workspaces"),
        };

        await mkdir(paths.userDataDir, { recursive: true });
        await mkdir(paths.extensionsDir, { recursive: true });
        await mkdir(paths.workspacesDir, { recursive: true });

        return paths;
      });
    }

    return this.dataRootPathsPromise;
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

  private touchGlobalServer(): void {
    if (!this.globalServer) {
      return;
    }

    this.globalServer.lastUsedAt = this.now();
    if (this.globalServer.idleTimer) {
      clearTimeout(this.globalServer.idleTimer);
    }

    this.globalServer.idleTimer = setTimeout(() => {
      if (!this.globalServer) {
        return;
      }

      if (this.now() - this.globalServer.lastUsedAt < this.idleTimeoutMs) {
        this.touchGlobalServer();
        return;
      }

      void this.stopGlobalServer();
    }, this.idleTimeoutMs);
  }

  private async ensureGlobalServer(providerCommand: {
    command: string;
    provider: VsCodeWebProvider;
  }): Promise<{ reused: boolean; server: RunningGlobalServer }> {
    const existing = this.globalServer;
    if (existing && !existing.child.killed && !existing.exited) {
      await existing.readyPromise;
      this.touchGlobalServer();
      return {
        reused: true,
        server: existing,
      };
    }

    const dataRootPaths = await this.ensureDataRootPaths();
    const port = await this.allocatePort();
    const bindHost = process.env.VSCODE_WEB_BIND_HOST?.trim() || "0.0.0.0";
    const child = this.spawnProcess(
      providerCommand.command,
      buildLaunchArgs(
        providerCommand.provider,
        bindHost,
        port,
        dataRootPaths.userDataDir,
        dataRootPaths.extensionsDir,
      ),
      {
        cwd: homedir(),
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
    const server: RunningGlobalServer = {
      child,
      exited: false,
      idleTimer: null,
      lastUsedAt: this.now(),
      port,
      provider: providerCommand.provider,
      readyPromise: Promise.resolve(),
    };

    child.on("exit", () => {
      server.exited = true;
      if (server.idleTimer) {
        clearTimeout(server.idleTimer);
      }
      if (this.globalServer === server) {
        this.globalServer = null;
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

    server.readyPromise = readyPromise;
    this.globalServer = server;

    try {
      await readyPromise;
      this.touchGlobalServer();
      return {
        reused: false,
        server,
      };
    } catch (error) {
      await this.stopGlobalServer();
      throw error;
    }
  }

  private async ensureWorkspaceFile(
    session: AgentSessionRecord,
  ): Promise<{ path: string; workingDirectory: string }> {
    const dataRootPaths = await this.ensureDataRootPaths();
    const workingDirectory = resolveLocalWorkingDirectory(
      session.workingDirectory,
    );
    const workspacePath = join(
      dataRootPaths.workspacesDir,
      `${session.id}.code-workspace`,
    );

    await this.writeFile(
      workspacePath,
      buildWorkspaceContent(session, workingDirectory),
    );
    this.sessionWorkspacePaths.set(session.id, workspacePath);

    return {
      path: workspacePath,
      workingDirectory,
    };
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

    const publicProtocol = options.requestProtocol ?? "http";
    const publicHost = resolvePublicHost(options.requestHost);
    const workspace = await this.ensureWorkspaceFile(session);
    const providerCommand = await this.ensureProviderCommand();

    if (!providerCommand) {
      throw new VsCodeWebUnavailableError(
        "未检测到可用的 VS Code Web 运行时，且自动安装 code-server 失败。",
      );
    }

    const { reused, server } = await this.ensureGlobalServer(providerCommand);
    return {
      provider: server.provider,
      url: buildEditorUrl(
        `${publicProtocol}://${publicHost}:${server.port}`,
        workspace.path,
        workspace.workingDirectory,
      ),
      reused,
      workingDirectory: workspace.workingDirectory,
    };
  }

  async stopSession(sessionId: string): Promise<void> {
    const workspacePath = this.sessionWorkspacePaths.get(sessionId);
    this.sessionWorkspacePaths.delete(sessionId);
    if (workspacePath) {
      await this.removePath(workspacePath).catch(() => {});
    }

    if (this.sessionWorkspacePaths.size === 0 && this.globalServer) {
      await this.stopGlobalServer();
    }
  }

  private async stopGlobalServer(): Promise<void> {
    const server = this.globalServer;
    if (!server) {
      return;
    }

    this.globalServer = null;
    if (server.idleTimer) {
      clearTimeout(server.idleTimer);
    }
    if (!server.child.killed) {
      server.child.kill("SIGTERM");
    }
  }

  async dispose(): Promise<void> {
    await this.stopGlobalServer();
  }
}
