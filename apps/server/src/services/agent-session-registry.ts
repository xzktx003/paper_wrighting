import { randomUUID } from "node:crypto";

import {
  interactionStateOrder,
  type AgentOutputEntry,
  type AgentOutputStream,
  type AgentSessionRecord,
  type AgentSessionDetailResponse,
  type FocusAgentSessionInput,
  type ListAgentSessionsResponse,
  type RegisterAgentSessionInput,
  type StdinAgentSessionInput,
} from "@agent-orchestrator/shared";

type SnapshotListener = (snapshot: ListAgentSessionsResponse) => void;

const MAX_OUTPUT_ENTRIES = 200;

function pickOutputPreview(text: string): string | undefined {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  return lines.at(-1)?.slice(0, 160);
}

function inferInteractionState(text: string): {
  interactionState: AgentSessionRecord["interactionState"];
  stateConfidence: AgentSessionRecord["stateConfidence"];
} {
  if (
    /(awaiting input|ready for your next instruction|waiting for input|enter your instruction|prompt:|type a command)/i.test(
      text,
    )
  ) {
    return {
      interactionState: "awaiting_input",
      stateConfidence: "high",
    };
  }

  return {
    interactionState: "running",
    stateConfidence: "medium",
  };
}

function byInteractionState(
  left: AgentSessionRecord,
  right: AgentSessionRecord,
): number {
  const leftIndex = interactionStateOrder.indexOf(left.interactionState);
  const rightIndex = interactionStateOrder.indexOf(right.interactionState);

  if (leftIndex !== rightIndex) {
    return leftIndex - rightIndex;
  }

  const leftTime = left.lastOutputAt ?? left.lastHeartbeatAt ?? "";
  const rightTime = right.lastOutputAt ?? right.lastHeartbeatAt ?? "";

  return rightTime.localeCompare(leftTime);
}

export class AgentSessionRegistry {
  private readonly sessions = new Map<string, AgentSessionRecord>();
  private readonly outputEntries = new Map<string, AgentOutputEntry[]>();
  private readonly listeners = new Set<SnapshotListener>();
  private activeAgentSessionId: string | null = null;

  list(): ListAgentSessionsResponse {
    return {
      items: [...this.sessions.values()].sort(byInteractionState),
      activeAgentSessionId: this.activeAgentSessionId,
      updatedAt: new Date().toISOString(),
    };
  }

  subscribe(listener: SnapshotListener): () => void {
    this.listeners.add(listener);
    listener(this.list());

    return () => {
      this.listeners.delete(listener);
    };
  }

  get(agentSessionId: string): AgentSessionRecord {
    const agentSession = this.sessions.get(agentSessionId);

    if (!agentSession) {
      throw new Error(`Unknown agent session: ${agentSessionId}`);
    }

    return agentSession;
  }

  getDetail(agentSessionId: string): AgentSessionDetailResponse {
    return {
      agentSession: this.get(agentSessionId),
      outputEntries: this.outputEntries.get(agentSessionId) ?? [],
    };
  }

  register(input: RegisterAgentSessionInput): AgentSessionRecord {
    const now = new Date().toISOString();

    const agentSession: AgentSessionRecord = {
      id: randomUUID(),
      workspaceId: input.workspaceId,
      hostId: input.hostId,
      sourceType: input.sourceType,
      agentKind: input.agentKind,
      displayName: input.displayName,
      workingDirectory: input.workingDirectory,
      connectionState: input.connectionState ?? "online",
      interactionState: input.interactionState ?? "idle",
      stateConfidence: input.stateConfidence,
      outputPreview: input.outputPreview,
      controlMode: input.controlMode,
      lastHeartbeatAt: now,
      lastOutputAt: input.outputPreview ? now : undefined,
      transportRef: input.transportRef,
      agentSessionId: input.agentSessionId,
      sshTarget: input.sshTarget,
      remoteCommand: input.remoteCommand,
    };

    this.sessions.set(agentSession.id, agentSession);
    this.outputEntries.set(agentSession.id, []);

    if (!this.activeAgentSessionId) {
      this.activeAgentSessionId = agentSession.id;
    }

    this.emitSnapshot();

    return agentSession;
  }

  upsertByTransportRef(
    runtimeId: string,
    input: RegisterAgentSessionInput,
  ): AgentSessionRecord {
    const existingSession = [...this.sessions.values()].find(
      ({ transportRef }) => transportRef?.runtimeId === runtimeId,
    );

    if (!existingSession) {
      return this.register(input);
    }

    const nextSession: AgentSessionRecord = {
      ...existingSession,
      ...input,
      id: existingSession.id,
      controlMode: input.controlMode ?? existingSession.controlMode,
      transportRef: {
        ...existingSession.transportRef,
        ...input.transportRef,
      },
      lastHeartbeatAt: new Date().toISOString(),
    };

    this.sessions.set(existingSession.id, nextSession);
    this.emitSnapshot();

    return nextSession;
  }

  focus(input: FocusAgentSessionInput): ListAgentSessionsResponse {
    if (!this.sessions.has(input.agentSessionId)) {
      throw new Error(`Unknown agent session: ${input.agentSessionId}`);
    }

    this.activeAgentSessionId = input.agentSessionId;
    this.emitSnapshot();

    return this.list();
  }

  writeToSession(
    agentSessionId: string,
    input: StdinAgentSessionInput,
  ): AgentSessionRecord {
    const agentSession = this.get(agentSessionId);

    const now = new Date().toISOString();
    const nextSession: AgentSessionRecord = {
      ...agentSession,
      lastHeartbeatAt: now,
      interactionState:
        agentSession.interactionState === "awaiting_input"
          ? "running"
          : agentSession.interactionState,
      outputPreview: input.input.trim()
        ? `Last input: ${input.input.trim()}`
        : agentSession.outputPreview,
    };

    this.sessions.set(agentSessionId, nextSession);
    this.pushOutputEntry(agentSessionId, {
      id: randomUUID(),
      timestamp: now,
      stream: "system",
      text: `> ${input.input.trim() || "[empty input]"}`,
    });
    this.emitSnapshot();

    return nextSession;
  }

  appendOutput(
    agentSessionId: string,
    text: string,
    stream: AgentOutputStream,
  ): AgentSessionRecord {
    const agentSession = this.get(agentSessionId);
    const now = new Date().toISOString();
    const outputPreview = pickOutputPreview(text) ?? agentSession.outputPreview;
    const inferredState = inferInteractionState(text);

    const nextSession: AgentSessionRecord = {
      ...agentSession,
      lastHeartbeatAt: now,
      lastOutputAt: now,
      outputPreview,
      interactionState:
        stream === "system"
          ? agentSession.interactionState
          : inferredState.interactionState,
      stateConfidence:
        stream === "system"
          ? agentSession.stateConfidence
          : inferredState.stateConfidence,
      lastRefreshedAt: now,
    };

    this.sessions.set(agentSessionId, nextSession);
    this.pushOutputEntry(agentSessionId, {
      id: randomUUID(),
      timestamp: now,
      stream,
      text,
    });
    this.emitSnapshot();

    return nextSession;
  }

  replaceOutputEntries(
    agentSessionId: string,
    entries: AgentOutputEntry[],
  ): AgentSessionDetailResponse {
    this.get(agentSessionId);
    this.outputEntries.set(agentSessionId, entries.slice(-MAX_OUTPUT_ENTRIES));
    this.emitSnapshot();

    return this.getDetail(agentSessionId);
  }

  updateSession(
    agentSessionId: string,
    updater: Partial<AgentSessionRecord>,
  ): AgentSessionRecord {
    const agentSession = this.get(agentSessionId);
    const nextSession: AgentSessionRecord = {
      ...agentSession,
      ...updater,
      id: agentSession.id,
      controlMode: updater.controlMode ?? agentSession.controlMode,
      transportRef: {
        ...agentSession.transportRef,
        ...updater.transportRef,
      },
    };

    this.sessions.set(agentSessionId, nextSession);
    this.emitSnapshot();

    return nextSession;
  }

  markExited(
    agentSessionId: string,
    exitCode: number | null,
    signal: NodeJS.Signals | null,
  ): AgentSessionRecord {
    const exitSummary =
      exitCode !== null
        ? `Process exited with code ${exitCode}`
        : `Process exited with signal ${signal ?? "unknown"}`;

    const nextSession = this.updateSession(agentSessionId, {
      connectionState: "offline",
      interactionState: "exited",
      stateConfidence: "high",
      outputPreview: exitSummary,
      lastHeartbeatAt: new Date().toISOString(),
      lastRefreshedAt: new Date().toISOString(),
    });

    this.pushOutputEntry(agentSessionId, {
      id: randomUUID(),
      timestamp: new Date().toISOString(),
      stream: "system",
      text: exitSummary,
    });
    this.emitSnapshot();

    return nextSession;
  }

  remove(agentSessionId: string): void {
    this.sessions.delete(agentSessionId);
    this.outputEntries.delete(agentSessionId);
    if (this.activeAgentSessionId === agentSessionId) {
      this.activeAgentSessionId = null;
    }
    this.emitSnapshot();
  }

  private pushOutputEntry(
    agentSessionId: string,
    outputEntry: AgentOutputEntry,
  ): void {
    const currentEntries = this.outputEntries.get(agentSessionId) ?? [];
    currentEntries.push(outputEntry);
    this.outputEntries.set(
      agentSessionId,
      currentEntries.slice(-MAX_OUTPUT_ENTRIES),
    );
  }

  private emitSnapshot(): void {
    const snapshot = this.list();

    for (const listener of this.listeners) {
      listener(snapshot);
    }
  }
}
