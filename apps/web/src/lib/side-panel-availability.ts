import type { AgentSessionRecord } from "@agent-orchestrator/shared";

interface IsVsCodeAvailableInput {
  focusedSession?: Pick<AgentSessionRecord, "sshTarget"> | null;
  panelAvailable: boolean;
}

export function isVsCodeAvailable({
  focusedSession,
  panelAvailable,
}: IsVsCodeAvailableInput): boolean {
  return panelAvailable && Boolean(focusedSession);
}
