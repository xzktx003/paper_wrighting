import type { AgentSessionRecord } from "@agent-orchestrator/shared";

interface FocusBarProps {
  activeAgentSession: AgentSessionRecord | null;
}

export function FocusBar({ activeAgentSession }: FocusBarProps) {
  if (!activeAgentSession) {
    return (
      <div className="focus-bar idle">
        <span>No active agent selected</span>
      </div>
    );
  }

  return (
    <div className="focus-bar active">
      <span className="focus-label">Currently typing to</span>
      <strong>{activeAgentSession.displayName}</strong>
      <span>
        {activeAgentSession.hostId ?? "local"} /{" "}
        {activeAgentSession.workspaceId}
      </span>
    </div>
  );
}
