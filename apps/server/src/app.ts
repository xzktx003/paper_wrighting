import cors from "@fastify/cors";
import websocket from "@fastify/websocket";
import Fastify from "fastify";

import type {
  AgentSessionSnapshotEvent,
  TerminalHistoryDiagnosticsResponse,
} from "@agent-orchestrator/shared";

import {
  resolveTerminalHistoryRuntimeConfig,
  type TerminalHistoryRuntimeConfig,
} from "./config/server-runtime-config.js";
import {
  registerAgentSessionRoutes,
  validatePtyResizeInput,
} from "./routes/agent-sessions.js";
import { registerFilesystemRoutes } from "./routes/filesystem.js";
import { registerSshHostsRoutes } from "./routes/ssh-hosts.js";
import { registerVsCodeWebProxyRoutes } from "./routes/vscode-web-proxy.js";
import { AgentSessionRegistry } from "./services/agent-session-registry.js";
import { LocalFsService } from "./services/local-fs-service.js";
import { LocalProcessRuntimeManager } from "./services/local-process-runtime-manager.js";
import { LocalTmuxAdapter } from "./services/local-tmux-adapter.js";
import { PtyRuntimeManager } from "./services/pty-runtime-manager.js";
import { SftpService } from "./services/sftp-service.js";
import { SshRuntimeManager } from "./services/ssh-runtime-manager.js";
import {
  isTerminalFocusPayload,
  isTerminalPtyControlPayload,
  sanitizeReplayForTerminal,
  stripTerminalResponsePayload,
} from "./services/terminal-control-filter.js";
import { VsCodeWebManager } from "./services/vscode-web-manager.js";

interface BuildServerOptions {
  localFsService?: LocalFsService;
  sftpService?: SftpService;
  terminalHistoryConfig?: TerminalHistoryRuntimeConfig;
  vsCodeWebManager?: VsCodeWebManager;
}

function decodeTerminalBinaryFramePayload(data: unknown): string | null {
  if (typeof data !== "string") {
    return null;
  }

  if (
    data.length % 4 !== 0 ||
    !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(
      data,
    )
  ) {
    return null;
  }

  return Buffer.from(data, "base64").toString("latin1");
}

export function parseTerminalResizeFrame(
  text: string,
): { cols: number; rows: number } | null {
  try {
    const parsed = JSON.parse(text) as {
      type?: unknown;
      cols?: unknown;
      rows?: unknown;
    };

    if (parsed.type !== "resize") {
      return null;
    }

    return validatePtyResizeInput(parsed as { cols: number; rows: number });
  } catch {
    return null;
  }
}

export type TerminalClientControlFrame =
  | { type: "resize"; cols: number; rows: number }
  | { type: "binary"; payload: string }
  | { type: "ignore" };

export function parseTerminalClientControlFrame(
  text: string,
): TerminalClientControlFrame | null {
  const trimmed = text.trimStart();
  if (!trimmed.startsWith("{")) {
    return null;
  }

  let parsed: { type?: unknown; data?: unknown; cols?: unknown; rows?: unknown };
  try {
    parsed = JSON.parse(text) as {
      type?: unknown;
      data?: unknown;
      cols?: unknown;
      rows?: unknown;
    };
  } catch {
    return null;
  }

  if (parsed.type === "resize") {
    try {
      const resize = validatePtyResizeInput(
        parsed as { cols: number; rows: number },
      );
      return { type: "resize", ...resize };
    } catch {
      return { type: "ignore" };
    }
  }

  if (parsed.type === "binary") {
    const payload = decodeTerminalBinaryFramePayload(parsed.data);
    return payload === null ? { type: "ignore" } : { type: "binary", payload };
  }

  if (typeof parsed.type === "string") {
    return { type: "ignore" };
  }

  return null;
}

export function buildServer(): {
  app: ReturnType<typeof Fastify>;
  registry: AgentSessionRegistry;
};
export function buildServer(options: BuildServerOptions): {
  app: ReturnType<typeof Fastify>;
  registry: AgentSessionRegistry;
};
export function buildServer(options: BuildServerOptions = {}): {
  app: ReturnType<typeof Fastify>;
  registry: AgentSessionRegistry;
} {
  const app = Fastify({ logger: true });
  const terminalHistoryConfig =
    options.terminalHistoryConfig ??
    resolveTerminalHistoryRuntimeConfig(process.env);
  const registry = new AgentSessionRegistry(
    undefined,
    terminalHistoryConfig.terminalRegistryOutputEntries,
  );
  const processRuntimeManager = new LocalProcessRuntimeManager(registry);
  const tmuxAdapter = new LocalTmuxAdapter(registry, {
    captureLines: terminalHistoryConfig.terminalTmuxCaptureLines,
  });
  const sshRuntimeManager = new SshRuntimeManager(registry);
  const ptyRuntimeManager = new PtyRuntimeManager(registry, {
    maxScrollbackBytes: terminalHistoryConfig.terminalScrollbackBytes,
    tmuxCaptureLines: terminalHistoryConfig.terminalTmuxCaptureLines,
  });
  const localFsService = options.localFsService ?? new LocalFsService();
  const sftpService = options.sftpService ?? new SftpService();
  const vsCodeWebManager = options.vsCodeWebManager ?? new VsCodeWebManager();

  app.register(cors, {
    origin: true,
  });

  app.register(websocket);

  app.register(async (instance) => {
    await registerAgentSessionRoutes(instance, {
      registry,
      processRuntimeManager,
      tmuxAdapter,
      sshRuntimeManager,
      ptyRuntimeManager,
      vsCodeWebManager,
    });

    await registerSshHostsRoutes(instance);
    await registerFilesystemRoutes(instance, {
      localFsService,
      sftpService,
    });
    await registerVsCodeWebProxyRoutes(instance, {
      vsCodeWebManager,
    });

    instance.get("/api/diagnostics/terminal-history", async () => {
      const response: TerminalHistoryDiagnosticsResponse = {
        timestamp: new Date().toISOString(),
        pty: ptyRuntimeManager.getScrollbackDiagnostics(),
        registry: {
          maxOutputEntries: registry.getOutputEntryLimit(),
        },
        tmux: {
          captureLines: tmuxAdapter.getCaptureLines(),
        },
      };

      return response;
    });

    instance.get("/ws/agent-sessions", { websocket: true }, (socket) => {
      const unsubscribe = registry.subscribe((snapshot) => {
        const event: AgentSessionSnapshotEvent = {
          type: "snapshot",
          payload: snapshot,
        };

        socket.send(JSON.stringify(event));
      });

      socket.on("close", () => {
        unsubscribe();
      });
    });

    instance.get<{ Params: { id: string } }>(
      "/ws/agent-sessions/:id/terminal",
      { websocket: true },
      (socket, request) => {
        const { id } = request.params;

        const buildTerminalControlFrame = (
          event: "replay" | "replay-complete",
          data?: string,
        ) =>
          JSON.stringify({
            __agentOrchestrator: "terminal-control",
            event,
            data,
          });

        let replaying = true;
        const bufferedLiveFrames: string[] = [];
        let unsubscribe = () => {};
        let tmuxInputQueue = Promise.resolve();

        if (ptyRuntimeManager.has(id)) {
          unsubscribe = ptyRuntimeManager.subscribe(
            id,
            (data) => {
              if (replaying) {
                bufferedLiveFrames.push(data);
                return;
              }

              socket.send(data);
            },
            { replay: false },
          );

          const replay = sanitizeReplayForTerminal(
            ptyRuntimeManager.getScrollback(id),
          );
          if (replay) {
            socket.send(buildTerminalControlFrame("replay", replay));
          }
        } else if (registry.has(id)) {
          const replay = sanitizeReplayForTerminal(
            registry
              .getDetail(id)
              .outputEntries.map((entry) => entry.text)
              .join(""),
          );
          if (replay) {
            socket.send(buildTerminalControlFrame("replay", replay));
          }
        } else {
          socket.close(4004, "没有找到 PTY 会话");
          return;
        }
        socket.send(buildTerminalControlFrame("replay-complete"));
        replaying = false;

        for (const frame of bufferedLiveFrames) {
          socket.send(frame);
        }
        bufferedLiveFrames.length = 0;

        socket.on("message", (message: Buffer | string) => {
          const writeToRuntime = (payload: string) => {
            const sanitizedPayload = stripTerminalResponsePayload(payload);
            if (!sanitizedPayload) {
              return;
            }

            const session = registry.has(id) ? registry.get(id) : null;
            if (session?.transportRef?.tmuxSession && !session.sshTarget) {
              if (isTerminalFocusPayload(sanitizedPayload)) {
                return;
              }

              if (isTerminalPtyControlPayload(sanitizedPayload)) {
                if (ptyRuntimeManager.has(id)) {
                  try {
                    ptyRuntimeManager.write(id, sanitizedPayload);
                  } catch {
                    // Mouse reports must enter tmux through the attached
                    // client PTY. Falling back to send-keys would inject raw
                    // escape bytes into the pane.
                  }
                }
                return;
              }

              tmuxInputQueue = tmuxInputQueue.then(async () => {
                try {
                  await tmuxAdapter.writeInput(session, {
                    input: sanitizedPayload,
                  });
                } catch {
                  try {
                    ptyRuntimeManager.write(id, sanitizedPayload);
                  } catch {
                    // The browser can still flush a final input frame after
                    // the PTY has exited or the session has been deleted.
                  }
                }
              });
              void tmuxInputQueue.catch(() => {});
              return;
            }

            try {
              ptyRuntimeManager.write(id, sanitizedPayload);
            } catch {
              // The browser can still flush a final input frame after the
              // PTY has exited or the session has been deleted.
            }
          };

          const text =
            typeof message === "string" ? message : message.toString("utf8");

          const controlFrame = parseTerminalClientControlFrame(text);
          if (controlFrame?.type === "resize") {
            ptyRuntimeManager.resize(id, controlFrame.cols, controlFrame.rows);
            return;
          }
          if (controlFrame?.type === "binary") {
            writeToRuntime(controlFrame.payload);
            return;
          }
          if (controlFrame?.type === "ignore") {
            return;
          }

          writeToRuntime(text);
        });

        socket.on("close", () => {
          unsubscribe();
        });
      },
    );
  });

  app.addHook("onClose", () => {
    return vsCodeWebManager.dispose();
  });

  return { app, registry };
}
