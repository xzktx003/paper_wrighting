import type {
  AgentSessionRecord,
  ScanResult,
  SshHostPreset,
} from "@agent-orchestrator/shared";

import { findExistingSession } from "./session-matching";

export type TmuxDiscoveryHost =
  | { type: "local" }
  | {
      type: "ssh";
      preset: Pick<
        SshHostPreset,
        "host" | "identityFile" | "name" | "port" | "username"
      >;
    };

export interface TmuxDiscoveryItem {
  session: AgentSessionRecord;
  existingId?: string;
}

export function buildTmuxDiscoveryHostKey(host: TmuxDiscoveryHost): string {
  if (host.type === "local") {
    return "local";
  }

  const { host: sshHost, identityFile, name, port, username } = host.preset;
  return [
    "ssh",
    name,
    sshHost,
    String(port),
    username ?? "",
    identityFile ?? "",
  ].join("\u0000");
}

export function toTmuxDiscoveryScanResult(
  session: AgentSessionRecord,
): ScanResult {
  return {
    agentKind: session.agentKind,
    status: session.interactionState === "running" ? "running" : "stopped",
    displayName: session.displayName,
    workingDirectory: session.workingDirectory ?? "~",
    tmuxSession: session.transportRef?.tmuxSession,
    tmuxPane: session.transportRef?.tmuxPane,
    sshTarget: session.sshTarget,
  };
}

export function buildTmuxDiscoveryItems(
  discoveredSessions: AgentSessionRecord[],
  sessions: AgentSessionRecord[],
): TmuxDiscoveryItem[] {
  return discoveredSessions.map((session) => {
    const existing = findExistingSession(
      toTmuxDiscoveryScanResult(session),
      sessions,
    );
    return { session, existingId: existing?.id };
  });
}

export function isCurrentTmuxDiscoveryRequest({
  currentHostKey,
  latestRequestId,
  requestHostKey,
  requestId,
}: {
  currentHostKey: string;
  latestRequestId: number;
  requestHostKey: string;
  requestId: number;
}): boolean {
  return requestId === latestRequestId && requestHostKey === currentHostKey;
}
