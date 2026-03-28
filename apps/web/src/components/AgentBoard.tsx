import type { AgentSessionRecord } from "@agent-orchestrator/shared";

interface AgentBoardProps {
  sessions: AgentSessionRecord[];
  activeAgentSessionId: string | null;
  onSelectAgentSession: (agentSessionId: string) => void;
}

export function AgentBoard({
  sessions,
  activeAgentSessionId,
  onSelectAgentSession,
}: AgentBoardProps) {
  return (
    <section className="panel panel-board">
      <div className="panel-header">
        <h2>Agent Board</h2>
      </div>
      <div className="board-grid">
        {sessions.map((agentSession) => {
          const isActive = agentSession.id === activeAgentSessionId;

          return (
            <button
              key={agentSession.id}
              className={`agent-card ${isActive ? "active" : ""}`}
              data-testid={`agent-card-${agentSession.id}`}
              onClick={() => onSelectAgentSession(agentSession.id)}
              type="button"
            >
              <div className="agent-card-header">
                <strong>{agentSession.displayName}</strong>
                <span
                  className={`state-pill state-${agentSession.interactionState}`}
                >
                  {agentSession.interactionState}
                </span>
              </div>
              <p>{agentSession.agentKind}</p>
              <p>{agentSession.sourceType}</p>
              <p>{agentSession.workingDirectory ?? "No path"}</p>
              <p>{agentSession.outputPreview ?? "No output yet"}</p>
              <p>{agentSession.lastOutputAt ?? "No activity yet"}</p>
            </button>
          );
        })}
      </div>
    </section>
  );
}
