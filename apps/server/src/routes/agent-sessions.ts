import type { FastifyInstance } from "fastify";

import type {
  AgentControlMode,
  AgentSessionRecord,
  AgentSourceType,
  AgentTransportRef,
  ConnectionState,
  InteractionState,
  OpenVsCodeWebResponse,
  LaunchRemoteAgentInput,
  LaunchLocalAgentInput,
  LaunchSshPtyInput,
  StateConfidence,
  FocusAgentSessionInput,
  PtyResizeInput,
  RegisterAgentSessionInput,
  ScanDirectoryInput,
  StdinAgentSessionInput,
  UpdateAgentSessionInput,
  DiscoverTmuxInput,
  AddDiscoveredTmuxInput,
  SshTarget,
} from "@agent-orchestrator/shared";

import { scanAgentDirectory } from "../services/agent-scanner.js";
import { AgentSessionRegistry } from "../services/agent-session-registry.js";
import { LocalProcessRuntimeManager } from "../services/local-process-runtime-manager.js";
import { LocalTmuxAdapter } from "../services/local-tmux-adapter.js";
import { PtyRuntimeManager } from "../services/pty-runtime-manager.js";
import { DEFAULT_TERMINAL_TMUX_CAPTURE_LINES } from "../config/server-runtime-config.js";
import {
  buildInteractiveShellCommand,
  buildTmuxCommand,
  quoteForPosixShell,
} from "../services/runtime-compat.js";
import { SshRuntimeManager } from "../services/ssh-runtime-manager.js";
import {
  UnsupportedVsCodeWebSessionError,
  VsCodeWebManager,
  VsCodeWebUnavailableError,
} from "../services/vscode-web-manager.js";
import { resolveVsCodeWebRequestTarget } from "./vscode-web-request-target.js";

function shellQuote(value: string): string {
  return quoteForPosixShell(value);
}

function formatWorkingDirectory(workingDirectory: string): string {
  if (workingDirectory === "~" || workingDirectory === "~/") {
    return "~";
  }

  if (workingDirectory.startsWith("~/")) {
    const suffix = workingDirectory
      .slice(2)
      .split("/")
      .filter(Boolean)
      .map((segment) => shellQuote(segment))
      .join("/");

    return suffix ? `~/${suffix}` : "~";
  }

  return shellQuote(workingDirectory);
}

function buildAgentInvocation(
  agentKind: string,
  displayName: string,
  sessionId?: string,
): string | undefined {
  if (agentKind === "shell") {
    return undefined;
  }

  if (sessionId) {
    return `${agentKind} --resume=${sessionId}`;
  }

  if (agentKind === "claude") {
    return `claude -n ${shellQuote(displayName)}`;
  }

  return agentKind;
}

function buildDirectLaunchCommand(
  agentKind: string,
  workingDirectory: string,
  displayName: string,
  sessionId?: string,
): string {
  const invocation = buildAgentInvocation(agentKind, displayName, sessionId);

  if (!invocation) {
    return "";
  }

  return `cd ${formatWorkingDirectory(workingDirectory)} && ${invocation}`;
}

function buildTmuxLaunchCommand(
  agentKind: string,
  workingDirectory: string,
  displayName: string,
  tmuxSessionName: string,
  sessionId?: string,
  tmuxHistoryLimit = DEFAULT_TERMINAL_TMUX_CAPTURE_LINES,
): string {
  const tmuxPrefix = `tmux set-option -g history-limit ${tmuxHistoryLimit} \\; new-session`;

  if (agentKind === "shell") {
    return `${tmuxPrefix} -s ${shellQuote(tmuxSessionName)} -c ${formatWorkingDirectory(workingDirectory)}`;
  }

  return `${tmuxPrefix} -s ${shellQuote(tmuxSessionName)} ${buildTmuxCommand(buildDirectLaunchCommand(agentKind, workingDirectory, displayName, sessionId), true)}`;
}

function buildTmuxAttachCommand(
  tmuxSessionName: string,
  tmuxPaneId?: string,
  tmuxHistoryLimit = DEFAULT_TERMINAL_TMUX_CAPTURE_LINES,
): string {
  const tmuxPrefix = `tmux set-option -t ${shellQuote(tmuxSessionName)} history-limit ${tmuxHistoryLimit}`;

  if (tmuxPaneId) {
    return `${tmuxPrefix} \\; select-pane -t ${shellQuote(tmuxPaneId)} \\; attach -t ${shellQuote(tmuxSessionName)}`;
  }

  return `${tmuxPrefix} \\; attach -t ${shellQuote(tmuxSessionName)}`;
}

function validateStdinInput(input: StdinAgentSessionInput | undefined): string {
  if (!input || typeof input.input !== "string") {
    throw new Error("input must be a string");
  }

  return input.input;
}

function validateFocusInput(
  input: FocusAgentSessionInput | undefined,
): FocusAgentSessionInput {
  if (!input || typeof input.agentSessionId !== "string") {
    throw new Error("agentSessionId must be a string");
  }

  return input;
}

export function validatePtyResizeInput(input: PtyResizeInput | undefined): {
  cols: number;
  rows: number;
} {
  if (
    !input ||
    !Number.isSafeInteger(input.cols) ||
    input.cols <= 0 ||
    !Number.isSafeInteger(input.rows) ||
    input.rows <= 0
  ) {
    throw new Error("cols and rows must be positive integers");
  }

  return {
    cols: input.cols,
    rows: input.rows,
  };
}

function requireStringField(
  input: Record<string, unknown>,
  field: string,
): string {
  const value = input[field];
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`${field} must be a non-empty string`);
  }

  return value;
}

function optionalStringField(
  input: Record<string, unknown>,
  field: string,
): string | undefined {
  const value = input[field];
  if (value === undefined) {
    return undefined;
  }

  if (typeof value !== "string") {
    throw new Error(`${field} must be a string`);
  }

  return value;
}

function optionalSshStringField(
  input: Record<string, unknown>,
  field: string,
): string | undefined {
  const value = optionalStringField(input, field);
  if (value !== undefined && /[\0\r\n]/.test(value)) {
    throw new Error(`sshTarget.${field} contains invalid characters`);
  }

  return value;
}

function optionalSshPort(input: Record<string, unknown>): number | undefined {
  const value = input.port;
  if (value === undefined) {
    return undefined;
  }

  if (
    typeof value !== "number" ||
    !Number.isSafeInteger(value) ||
    value < 1 ||
    value > 65535
  ) {
    throw new Error("sshTarget.port must be an integer from 1 to 65535");
  }

  return value;
}

function optionalSafeIntegerField(
  input: Record<string, unknown>,
  field: string,
): number | undefined {
  const value = input[field];
  if (value === undefined) {
    return undefined;
  }

  if (typeof value !== "number" || !Number.isSafeInteger(value)) {
    throw new Error(`${field} must be a safe integer`);
  }

  return value;
}

function optionalTcpPortField(
  input: Record<string, unknown>,
  field: string,
): number | undefined {
  const value = input[field];
  if (value === undefined) {
    return undefined;
  }

  if (
    typeof value !== "number" ||
    !Number.isSafeInteger(value) ||
    value < 1 ||
    value > 65535
  ) {
    throw new Error(`${field} must be an integer from 1 to 65535`);
  }

  return value;
}

const SOURCE_TYPES = new Set<AgentSourceType>([
  "local",
  "remote-connect",
  "remote-tmux-discovered",
]);

function requireSourceType(input: Record<string, unknown>): AgentSourceType {
  const value = input.sourceType;
  if (typeof value !== "string" || !SOURCE_TYPES.has(value as AgentSourceType)) {
    throw new Error("sourceType must be a valid source type");
  }

  return value as AgentSourceType;
}

const CONNECTION_STATES = new Set<ConnectionState>([
  "online",
  "degraded",
  "offline",
]);

function optionalConnectionState(
  input: Record<string, unknown>,
): ConnectionState | undefined {
  const value = input.connectionState;
  if (value === undefined) {
    return undefined;
  }

  if (
    typeof value !== "string" ||
    !CONNECTION_STATES.has(value as ConnectionState)
  ) {
    throw new Error("connectionState must be a valid connection state");
  }

  return value as ConnectionState;
}

const INTERACTION_STATES = new Set<InteractionState>([
  "running",
  "idle",
  "detached",
  "exited",
]);

function optionalInteractionState(
  input: Record<string, unknown>,
): InteractionState | undefined {
  const value = input.interactionState;
  if (value === undefined) {
    return undefined;
  }

  if (
    typeof value !== "string" ||
    !INTERACTION_STATES.has(value as InteractionState)
  ) {
    throw new Error("interactionState must be a valid interaction state");
  }

  return value as InteractionState;
}

const STATE_CONFIDENCES = new Set<StateConfidence>(["high", "medium", "low"]);

function optionalStateConfidence(
  input: Record<string, unknown>,
): StateConfidence | undefined {
  const value = input.stateConfidence;
  if (value === undefined) {
    return undefined;
  }

  if (
    typeof value !== "string" ||
    !STATE_CONFIDENCES.has(value as StateConfidence)
  ) {
    throw new Error("stateConfidence must be a valid state confidence");
  }

  return value as StateConfidence;
}

const CONTROL_MODES = new Set<AgentControlMode>(["observe", "control"]);

function optionalControlMode(
  input: Record<string, unknown>,
): AgentControlMode | undefined {
  const value = input.controlMode;
  if (value === undefined) {
    return undefined;
  }

  if (
    typeof value !== "string" ||
    !CONTROL_MODES.has(value as AgentControlMode)
  ) {
    throw new Error("controlMode must be a valid control mode");
  }

  return value as AgentControlMode;
}

function optionalSshTarget(
  input: Record<string, unknown>,
): SshTarget | undefined {
  const value = input.sshTarget;
  if (value === undefined) {
    return undefined;
  }

  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("sshTarget must be an object");
  }

  const sshTarget = value as Record<string, unknown>;
  const host = sshTarget.host;
  if (typeof host !== "string" || !host.trim()) {
    throw new Error("sshTarget.host must be a non-empty string");
  }
  if (/[\0\r\n]/.test(host)) {
    throw new Error("sshTarget.host contains invalid characters");
  }

  const port = optionalSshPort(sshTarget);
  const username = optionalSshStringField(sshTarget, "username");
  const identityFile = optionalSshStringField(sshTarget, "identityFile");

  return {
    host,
    ...(port !== undefined ? { port } : {}),
    ...(username !== undefined ? { username } : {}),
    ...(identityFile !== undefined ? { identityFile } : {}),
  };
}

function optionalTransportRef(
  input: Record<string, unknown>,
): AgentTransportRef | undefined {
  const value = input.transportRef;
  if (value === undefined) {
    return undefined;
  }

  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("transportRef must be an object");
  }

  const transportRef = value as Record<string, unknown>;
  const terminalId = optionalStringField(transportRef, "terminalId");
  const processId = optionalSafeIntegerField(transportRef, "processId");
  const tmuxSession = optionalStringField(transportRef, "tmuxSession");
  const tmuxPane = optionalStringField(transportRef, "tmuxPane");
  const runtimeId = optionalStringField(transportRef, "runtimeId");
  const sshHost = optionalStringField(transportRef, "sshHost");
  const sshPort = optionalTcpPortField(transportRef, "sshPort");
  const sshUsername = optionalStringField(transportRef, "sshUsername");

  return {
    ...(terminalId !== undefined ? { terminalId } : {}),
    ...(processId !== undefined ? { processId } : {}),
    ...(tmuxSession !== undefined ? { tmuxSession } : {}),
    ...(tmuxPane !== undefined ? { tmuxPane } : {}),
    ...(runtimeId !== undefined ? { runtimeId } : {}),
    ...(sshHost !== undefined ? { sshHost } : {}),
    ...(sshPort !== undefined ? { sshPort } : {}),
    ...(sshUsername !== undefined ? { sshUsername } : {}),
  };
}

function requireSshTarget(input: Record<string, unknown>): SshTarget {
  const sshTarget = optionalSshTarget(input);
  if (!sshTarget) {
    throw new Error("sshTarget is required");
  }

  return sshTarget;
}

function requireCommandField(
  input: Record<string, unknown>,
  field: string,
  { allowEmpty }: { allowEmpty: boolean },
): string {
  const value = input[field];
  if (typeof value !== "string" || (!allowEmpty && !value.trim())) {
    throw new Error(
      allowEmpty
        ? `${field} must be a string`
        : `${field} must be a non-empty string`,
    );
  }

  return value;
}

function validateLaunchLocalAgentInput(
  input: LaunchLocalAgentInput | undefined,
  { allowEmptyCommand }: { allowEmptyCommand: boolean },
): LaunchLocalAgentInput {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new Error("request body must be an object");
  }

  const record = input as unknown as Record<string, unknown>;
  const workingDirectory = optionalStringField(record, "workingDirectory");
  const hostId = optionalStringField(record, "hostId");
  const tmuxSessionName = optionalStringField(record, "tmuxSessionName");
  const tmuxPaneId = optionalStringField(record, "tmuxPaneId");

  return {
    workspaceId: requireStringField(record, "workspaceId"),
    displayName: requireStringField(record, "displayName"),
    agentKind: requireStringField(record, "agentKind"),
    command: requireCommandField(record, "command", {
      allowEmpty: allowEmptyCommand,
    }),
    ...(workingDirectory !== undefined ? { workingDirectory } : {}),
    ...(hostId !== undefined ? { hostId } : {}),
    ...(tmuxSessionName !== undefined ? { tmuxSessionName } : {}),
    ...(tmuxPaneId !== undefined ? { tmuxPaneId } : {}),
  };
}

function validateLaunchRemoteAgentInput(
  input: LaunchRemoteAgentInput | undefined,
): LaunchRemoteAgentInput {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new Error("request body must be an object");
  }

  const record = input as unknown as Record<string, unknown>;
  const workingDirectory = optionalStringField(record, "workingDirectory");

  return {
    workspaceId: requireStringField(record, "workspaceId"),
    displayName: requireStringField(record, "displayName"),
    agentKind: requireStringField(record, "agentKind"),
    command: requireCommandField(record, "command", { allowEmpty: false }),
    sshTarget: requireSshTarget(record),
    ...(workingDirectory !== undefined ? { workingDirectory } : {}),
  };
}

function validateLaunchSshPtyInput(
  input: LaunchSshPtyInput | undefined,
): LaunchSshPtyInput {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new Error("request body must be an object");
  }

  const record = input as unknown as Record<string, unknown>;
  const workingDirectory = optionalStringField(record, "workingDirectory");
  const agentSessionId = optionalStringField(record, "agentSessionId");
  const tmuxSessionName = optionalStringField(record, "tmuxSessionName");
  const tmuxPaneId = optionalStringField(record, "tmuxPaneId");

  return {
    workspaceId: requireStringField(record, "workspaceId"),
    displayName: requireStringField(record, "displayName"),
    agentKind: requireStringField(record, "agentKind"),
    sshTarget: requireSshTarget(record),
    remoteCommand: requireCommandField(record, "remoteCommand", {
      allowEmpty: false,
    }),
    ...(workingDirectory !== undefined ? { workingDirectory } : {}),
    ...(agentSessionId !== undefined ? { agentSessionId } : {}),
    ...(tmuxSessionName !== undefined ? { tmuxSessionName } : {}),
    ...(tmuxPaneId !== undefined ? { tmuxPaneId } : {}),
  };
}

function validateDiscoverTmuxInput(
  input: DiscoverTmuxInput | undefined,
): DiscoverTmuxInput {
  if (input === undefined) {
    return {};
  }

  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new Error("request body must be an object");
  }

  const record = input as unknown as Record<string, unknown>;
  const sshTarget = optionalSshTarget(record);

  return {
    ...(sshTarget !== undefined ? { sshTarget } : {}),
  };
}

function validateScanDirectoryInput(
  input: ScanDirectoryInput | undefined,
): ScanDirectoryInput {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new Error("request body must be an object");
  }

  const record = input as unknown as Record<string, unknown>;
  const hostId = optionalStringField(record, "hostId");
  const sshTarget = optionalSshTarget(record);

  return {
    path: requireStringField(record, "path"),
    ...(hostId !== undefined ? { hostId } : {}),
    ...(sshTarget !== undefined ? { sshTarget } : {}),
  };
}

function validateRegisterAgentSessionInput(
  input: RegisterAgentSessionInput | undefined,
): RegisterAgentSessionInput {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new Error("request body must be an object");
  }

  const record = input as unknown as Record<string, unknown>;
  const hostId = optionalStringField(record, "hostId");
  const workingDirectory = optionalStringField(record, "workingDirectory");
  const connectionState = optionalConnectionState(record);
  const interactionState = optionalInteractionState(record);
  const stateConfidence = optionalStateConfidence(record);
  const controlMode = optionalControlMode(record);
  const outputPreview = optionalStringField(record, "outputPreview");
  const transportRef = optionalTransportRef(record);
  const agentSessionId = optionalStringField(record, "agentSessionId");
  const sshTarget = optionalSshTarget(record);
  const remoteCommand = optionalStringField(record, "remoteCommand");

  return {
    workspaceId: requireStringField(record, "workspaceId"),
    sourceType: requireSourceType(record),
    agentKind: requireStringField(record, "agentKind"),
    displayName: requireStringField(record, "displayName"),
    ...(hostId !== undefined ? { hostId } : {}),
    ...(workingDirectory !== undefined ? { workingDirectory } : {}),
    ...(connectionState !== undefined ? { connectionState } : {}),
    ...(interactionState !== undefined ? { interactionState } : {}),
    ...(stateConfidence !== undefined ? { stateConfidence } : {}),
    ...(controlMode !== undefined ? { controlMode } : {}),
    ...(outputPreview !== undefined ? { outputPreview } : {}),
    ...(transportRef !== undefined ? { transportRef } : {}),
    ...(agentSessionId !== undefined ? { agentSessionId } : {}),
    ...(sshTarget !== undefined ? { sshTarget } : {}),
    ...(remoteCommand !== undefined ? { remoteCommand } : {}),
  };
}

function validateAddDiscoveredTmuxInput(
  input: AddDiscoveredTmuxInput | undefined,
): AddDiscoveredTmuxInput {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new Error("request body must be an object");
  }

  const record = input as unknown as Record<string, unknown>;
  const tmuxPane = optionalStringField(record, "tmuxPane");
  const interactionState = optionalInteractionState(record);
  const outputPreview = optionalStringField(record, "outputPreview");
  const sshTarget = optionalSshTarget(record);

  return {
    tmuxSession: requireStringField(record, "tmuxSession"),
    displayName: requireStringField(record, "displayName"),
    workingDirectory: requireStringField(record, "workingDirectory"),
    agentKind: requireStringField(record, "agentKind"),
    ...(tmuxPane !== undefined ? { tmuxPane } : {}),
    ...(interactionState !== undefined ? { interactionState } : {}),
    ...(outputPreview !== undefined ? { outputPreview } : {}),
    ...(sshTarget !== undefined ? { sshTarget } : {}),
  };
}

function isUnknownAgentSessionError(error: unknown): error is Error {
  return (
    error instanceof Error && error.message.startsWith("Unknown agent session:")
  );
}

interface AgentSessionRoutesOptions {
  registry: AgentSessionRegistry;
  processRuntimeManager: LocalProcessRuntimeManager;
  tmuxAdapter: LocalTmuxAdapter;
  sshRuntimeManager: SshRuntimeManager;
  ptyRuntimeManager: PtyRuntimeManager;
  vsCodeWebManager: VsCodeWebManager;
}

export async function registerAgentSessionRoutes(
  fastify: FastifyInstance,
  options: AgentSessionRoutesOptions,
): Promise<void> {
  const {
    registry,
    processRuntimeManager,
    tmuxAdapter,
    sshRuntimeManager,
    ptyRuntimeManager,
    vsCodeWebManager,
  } = options;

  fastify.setErrorHandler((error, _request, reply) => {
    if (isUnknownAgentSessionError(error)) {
      reply.code(404).send({ error: error.message });
      return;
    }

    throw error;
  });

  fastify.get("/api/health", async () => ({ status: "ok" }));

  fastify.get("/api/agent-sessions", async () => registry.list());

  fastify.get<{ Params: { id: string } }>(
    "/api/agent-sessions/:id",
    async (request) => {
      const agentSession = registry.get(request.params.id);

      if (agentSession.sourceType === "remote-tmux-discovered") {
        return tmuxAdapter.getDetail(agentSession);
      }

      return registry.getDetail(request.params.id);
    },
  );

  fastify.post<{ Body: RegisterAgentSessionInput }>(
    "/api/agent-sessions/register",
    async (request, reply) => {
      let input: RegisterAgentSessionInput;

      try {
        input = validateRegisterAgentSessionInput(request.body);
      } catch (error) {
        reply.code(400);
        return { error: (error as Error).message };
      }

      const agentSession = registry.register(input);
      reply.code(201);
      return agentSession;
    },
  );

  fastify.post<{ Body: FocusAgentSessionInput }>(
    "/api/agent-sessions/focus",
    async (request, reply) => {
      try {
        return registry.focus(validateFocusInput(request.body));
      } catch (error) {
        if ((error as Error).message === "agentSessionId must be a string") {
          reply.code(400);
          return { error: (error as Error).message };
        }

        throw error;
      }
    },
  );

  fastify.patch<{ Params: { id: string }; Body: UpdateAgentSessionInput }>(
    "/api/agent-sessions/:id",
    async (request, reply) => {
      if (
        !request.body ||
        typeof request.body !== "object" ||
        Array.isArray(request.body)
      ) {
        reply.code(400);
        return { error: "request body must be an object" };
      }

      const { displayName, hidden } = request.body;
      const updates: Partial<AgentSessionRecord> = {};
      let normalizedDisplayName: string | undefined;

      if (displayName !== undefined) {
        if (typeof displayName !== "string") {
          reply.code(400);
          return { error: "displayName must be a string" };
        }

        const trimmed = displayName.trim();
        if (!trimmed) {
          reply.code(400);
          return { error: "displayName cannot be empty" };
        }

        normalizedDisplayName = trimmed;
      }

      if (hidden !== undefined) {
        if (typeof hidden !== "boolean") {
          reply.code(400);
          return { error: "hidden must be a boolean" };
        }

        updates.hidden = hidden;
      }

      let agentSession = registry.get(request.params.id);
      if (normalizedDisplayName !== undefined) {
        if (agentSession.transportRef?.tmuxSession) {
          agentSession = await tmuxAdapter.renameSession(
            agentSession,
            normalizedDisplayName,
          );
        } else {
          updates.displayName = normalizedDisplayName;
        }
      }

      if (Object.keys(updates).length === 0) {
        return agentSession;
      }

      return registry.updateSession(agentSession.id, updates);
    },
  );

  fastify.post<{ Body: LaunchLocalAgentInput }>(
    "/api/agent-launch/local",
    async (request, reply) => {
      let input: LaunchLocalAgentInput;

      try {
        input = validateLaunchLocalAgentInput(request.body, {
          allowEmptyCommand: false,
        });
      } catch (error) {
        reply.code(400);
        return { error: (error as Error).message };
      }

      const agentSession = processRuntimeManager.launch(input);
      reply.code(201);
      return agentSession;
    },
  );

  fastify.post<{ Body: LaunchRemoteAgentInput }>(
    "/api/agent-launch/remote",
    async (request, reply) => {
      let input: LaunchRemoteAgentInput;

      try {
        input = validateLaunchRemoteAgentInput(request.body);
      } catch (error) {
        reply.code(400);
        return { error: (error as Error).message };
      }

      const agentSession = sshRuntimeManager.launch(input);
      reply.code(201);
      return agentSession;
    },
  );

  fastify.post<{ Body: LaunchLocalAgentInput }>(
    "/api/agent-launch/pty",
    async (request, reply) => {
      let input: LaunchLocalAgentInput;

      try {
        input = validateLaunchLocalAgentInput(request.body, {
          allowEmptyCommand: true,
        });
      } catch (error) {
        reply.code(400);
        return { error: (error as Error).message };
      }

      const agentSession = ptyRuntimeManager.launch(input);
      reply.code(201);
      return agentSession;
    },
  );

  fastify.post<{ Body: LaunchSshPtyInput }>(
    "/api/agent-launch/ssh-pty",
    async (request, reply) => {
      let input: LaunchSshPtyInput;

      try {
        input = validateLaunchSshPtyInput(request.body);
      } catch (error) {
        reply.code(400);
        return { error: (error as Error).message };
      }

      const agentSession = ptyRuntimeManager.launchRemote(input);
      reply.code(201);
      return agentSession;
    },
  );

  fastify.post<{ Params: { id: string }; Body: PtyResizeInput }>(
    "/api/agent-sessions/:id/resize",
    async (request, reply) => {
      let resizeInput: { cols: number; rows: number };

      try {
        resizeInput = validatePtyResizeInput(request.body);
      } catch (error) {
        reply.code(400);
        return { error: (error as Error).message };
      }

      ptyRuntimeManager.resize(
        request.params.id,
        resizeInput.cols,
        resizeInput.rows,
      );

      return { ok: true };
    },
  );

  fastify.post<{ Body: DiscoverTmuxInput }>(
    "/api/agent-discovery/tmux/scan",
    async (request, reply) => {
      let input: DiscoverTmuxInput;

      try {
        input = validateDiscoverTmuxInput(request.body);
      } catch (error) {
        reply.code(400);
        return { error: (error as Error).message };
      }

      const { sshTarget } = input;
      if (sshTarget) {
        return tmuxAdapter.discoverRemote(sshTarget);
      }
      return tmuxAdapter.discover();
    },
  );

  fastify.post<{ Body: AddDiscoveredTmuxInput }>(
    "/api/agent-discovery/tmux/add",
    async (request, reply) => {
      let input: AddDiscoveredTmuxInput;

      try {
        input = validateAddDiscoveredTmuxInput(request.body);
      } catch (error) {
        reply.code(400);
        return { error: (error as Error).message };
      }

      const {
        tmuxSession,
        tmuxPane,
        displayName,
        workingDirectory,
        agentKind,
        interactionState,
        outputPreview,
        sshTarget,
      } = input;

      const hostId = sshTarget?.host ?? "local";
      const runtimeId = sshTarget
        ? `tmux:${hostId}:${tmuxSession}`
        : `tmux:${tmuxSession}`;

      if (interactionState === "running") {
        const existingSession = registry.findByRuntimeId(runtimeId);

        if (existingSession && ptyRuntimeManager.has(existingSession.id)) {
          reply.code(201);
          return existingSession;
        }

        if (existingSession) {
          registry.remove(existingSession.id);
        }

        const attachedSession = sshTarget
          ? ptyRuntimeManager.launchRemote({
              workspaceId: tmuxSession,
              displayName,
              agentKind,
              sshTarget,
              remoteCommand: buildInteractiveShellCommand(
                buildTmuxAttachCommand(
                  tmuxSession,
                  tmuxPane,
                  tmuxAdapter.getCaptureLines(),
                ),
              ),
              workingDirectory,
              tmuxSessionName: tmuxSession,
              tmuxPaneId: tmuxPane,
            })
          : ptyRuntimeManager.launch({
              workspaceId: tmuxSession,
              hostId,
              displayName,
              agentKind,
              command: buildTmuxAttachCommand(
                tmuxSession,
                tmuxPane,
                tmuxAdapter.getCaptureLines(),
              ),
              workingDirectory,
              tmuxSessionName: tmuxSession,
              tmuxPaneId: tmuxPane,
            });

        reply.code(201);
        return attachedSession;
      }

      const agentSession = registry.upsertByTransportRef(runtimeId, {
        workspaceId: tmuxSession,
        hostId,
        sourceType: "remote-tmux-discovered",
        agentKind,
        displayName,
        workingDirectory,
        connectionState: "online",
        interactionState: interactionState ?? "detached",
        stateConfidence: "medium",
        outputPreview,
        controlMode: "observe",
        transportRef: {
          tmuxSession,
          ...(tmuxPane ? { tmuxPane } : {}),
          runtimeId,
          ...(sshTarget && {
            sshHost: sshTarget.host,
            sshPort: sshTarget.port,
            sshUsername: sshTarget.username,
          }),
        },
        ...(sshTarget && { sshTarget }),
      });

      reply.code(201);
      return agentSession;
    },
  );

  fastify.post<{ Params: { id: string } }>(
    "/api/agent-sessions/:id/tmux/kill",
    async (request, reply) => {
      const { id } = request.params;
      const session = registry.get(id);
      const tmuxSessionName = session.transportRef?.tmuxSession;
      if (!tmuxSessionName) {
        reply.code(400);
        return { error: "Session has no tmux session reference" };
      }
      ptyRuntimeManager.kill(id);
      await tmuxAdapter.killSession(tmuxSessionName, session.sshTarget);
      registry.remove(id);
      reply.code(204);
    },
  );

  fastify.post<{ Params: { id: string } }>(
    "/api/agent-sessions/:id/tmux/takeover",
    async (request) => {
      const agentSession = registry.get(request.params.id);
      return tmuxAdapter.takeOver(agentSession);
    },
  );

  fastify.post<{ Params: { id: string } }>(
    "/api/agent-sessions/:id/tmux/release",
    async (request) => {
      const agentSession = registry.get(request.params.id);
      return tmuxAdapter.release(agentSession);
    },
  );

  fastify.post<{ Params: { id: string } }>(
    "/api/agent-sessions/:id/tmux/refresh",
    async (request) => {
      const agentSession = registry.get(request.params.id);
      return tmuxAdapter.refresh(agentSession);
    },
  );

  fastify.post<{ Params: { id: string }; Body: StdinAgentSessionInput }>(
    "/api/agent-sessions/:id/stdin",
    async (request, reply) => {
      let stdinInput: string;

      try {
        stdinInput = validateStdinInput(request.body);
      } catch (error) {
        reply.code(400);
        return {
          error: error instanceof Error ? error.message : "Invalid request",
        };
      }

      const agentSession = registry.get(request.params.id);

      if (agentSession.sourceType === "remote-tmux-discovered") {
        return tmuxAdapter.writeInput(agentSession, request.body);
      }

      if (
        agentSession.sourceType === "remote-connect" &&
        agentSession.transportRef?.runtimeId?.startsWith("ssh:")
      ) {
        return sshRuntimeManager.writeInput(request.params.id, request.body);
      }

      if (ptyRuntimeManager.has(request.params.id)) {
        ptyRuntimeManager.write(request.params.id, stdinInput);
        return registry.get(request.params.id);
      }

      return processRuntimeManager.writeInput(request.params.id, request.body);
    },
  );

  fastify.post<{ Body: ScanDirectoryInput }>(
    "/api/agent-discovery/scan",
    async (request, reply) => {
      let input: ScanDirectoryInput;

      try {
        input = validateScanDirectoryInput(request.body);
      } catch (error) {
        reply.code(400);
        return { error: (error as Error).message };
      }

      return scanAgentDirectory(input);
    },
  );

  fastify.post<{ Params: { id: string } }>(
    "/api/agent-sessions/:id/vscode-web",
    async (
      request,
      reply,
    ): Promise<OpenVsCodeWebResponse | { error: string }> => {
      const session = registry.get(request.params.id);
      const { requestHost, requestProtocol } =
        resolveVsCodeWebRequestTarget(request);

      try {
        return await vsCodeWebManager.ensureSession(session, {
          requestHost,
          requestProtocol,
        });
      } catch (error) {
        if (error instanceof UnsupportedVsCodeWebSessionError) {
          reply.code(400);
          return { error: error.message };
        }

        if (error instanceof VsCodeWebUnavailableError) {
          reply.code(503);
          return { error: error.message };
        }

        throw error;
      }
    },
  );

  fastify.delete<{ Params: { id: string } }>(
    "/api/agent-sessions/:id",
    async (request, reply) => {
      const { id } = request.params;
      const session = registry.get(id);

      await vsCodeWebManager.stopSession(id);

      if (
        session.sourceType === "remote-tmux-discovered" &&
        session.controlMode === "control"
      ) {
        await tmuxAdapter.release(session);
      }

      ptyRuntimeManager.kill(id);
      registry.remove(id);
      reply.code(204);
    },
  );

  fastify.post<{ Params: { id: string } }>(
    "/api/agent-sessions/:id/reconnect",
    async (request) => {
      const session = registry.get(request.params.id);
      if (session.sshTarget && session.transportRef?.tmuxSession) {
        return ptyRuntimeManager.reconnectRemote(request.params.id, {
          workspaceId: session.workspaceId,
          displayName: session.displayName,
          agentKind: session.agentKind,
          sshTarget: session.sshTarget,
          remoteCommand: buildTmuxAttachCommand(
            session.transportRef.tmuxSession,
            session.transportRef.tmuxPane,
            tmuxAdapter.getCaptureLines(),
          ),
          workingDirectory: session.workingDirectory,
          tmuxSessionName: session.transportRef.tmuxSession,
          tmuxPaneId: session.transportRef.tmuxPane,
        });
      }

      if (session.sshTarget && session.remoteCommand) {
        return ptyRuntimeManager.reconnectRemote(request.params.id, {
          workspaceId: session.workspaceId,
          displayName: session.displayName,
          agentKind: session.agentKind,
          sshTarget: session.sshTarget,
          remoteCommand: session.remoteCommand,
          workingDirectory: session.workingDirectory,
          tmuxSessionName: session.transportRef?.tmuxSession,
          tmuxPaneId: session.transportRef?.tmuxPane,
        });
      }
      const cmd = session.transportRef?.tmuxSession
        ? buildTmuxAttachCommand(
            session.transportRef.tmuxSession,
            session.transportRef.tmuxPane,
            tmuxAdapter.getCaptureLines(),
          )
        : session.agentSessionId
          ? buildDirectLaunchCommand(
              session.agentKind,
              session.workingDirectory ?? "~",
              session.displayName,
              session.agentSessionId,
            )
          : buildDirectLaunchCommand(
              session.agentKind,
              session.workingDirectory ?? "~",
              session.displayName,
            );
      return ptyRuntimeManager.reconnectLocal(request.params.id, {
        workspaceId: session.workspaceId,
        displayName: session.displayName,
        agentKind: session.agentKind,
        command: cmd,
        workingDirectory: session.workingDirectory,
        tmuxSessionName: session.transportRef?.tmuxSession,
        tmuxPaneId: session.transportRef?.tmuxPane,
      });
    },
  );
}
