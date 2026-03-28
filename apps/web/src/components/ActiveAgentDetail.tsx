import { FormEvent, useState } from "react";

import type {
  AgentOutputEntry,
  AgentSessionRecord,
} from "@agent-orchestrator/shared";

interface ActiveAgentDetailProps {
  activeAgentSession: AgentSessionRecord | null;
  onSendInput: (value: string) => Promise<void>;
  outputEntries: AgentOutputEntry[];
  onTakeOverTmux: () => Promise<void>;
  onReleaseTmux: () => Promise<void>;
  onRefreshTmux: () => Promise<void>;
}

export function ActiveAgentDetail({
  activeAgentSession,
  onSendInput,
  outputEntries,
  onTakeOverTmux,
  onReleaseTmux,
  onRefreshTmux,
}: ActiveAgentDetailProps) {
  const [inputValue, setInputValue] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!activeAgentSession || !inputValue.trim()) {
      return;
    }

    setIsSubmitting(true);

    try {
      await onSendInput(inputValue);
      setInputValue("");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <section className="panel panel-detail">
      <div className="panel-header">
        <h2>Active Agent</h2>
      </div>
      {activeAgentSession ? (
        <>
          <div className="detail-meta">
            <h3>{activeAgentSession.displayName}</h3>
            <p>{activeAgentSession.agentKind}</p>
            <p>{activeAgentSession.hostId ?? "local host"}</p>
            <p>
              {activeAgentSession.workingDirectory ?? "No working directory"}
            </p>
            <p>Control mode: {activeAgentSession.controlMode ?? "control"}</p>
          </div>
          {activeAgentSession.sourceType === "remote-tmux-discovered" ? (
            <div className="tmux-actions">
              <button
                data-testid="tmux-refresh"
                onClick={() => void onRefreshTmux()}
                type="button"
              >
                Refresh tmux
              </button>
              {activeAgentSession.controlMode === "control" ? (
                <button
                  data-testid="tmux-release"
                  onClick={() => void onReleaseTmux()}
                  type="button"
                >
                  Release tmux
                </button>
              ) : (
                <button
                  data-testid="tmux-takeover"
                  onClick={() => void onTakeOverTmux()}
                  type="button"
                >
                  Take control
                </button>
              )}
            </div>
          ) : null}
          <div className="detail-output">
            <div className="detail-output-log" data-testid="active-output-log">
              {outputEntries.length ? (
                outputEntries.map((outputEntry) => (
                  <pre
                    className={`log-entry log-${outputEntry.stream}`}
                    key={outputEntry.id}
                  >
                    {outputEntry.text}
                  </pre>
                ))
              ) : (
                <p>
                  {activeAgentSession.outputPreview ??
                    "No output received yet."}
                </p>
              )}
            </div>
          </div>
          <form className="detail-input" onSubmit={handleSubmit}>
            <textarea
              data-testid="active-agent-input"
              disabled={
                isSubmitting ||
                (activeAgentSession.sourceType === "remote-tmux-discovered" &&
                  activeAgentSession.controlMode !== "control")
              }
              onChange={(event) => setInputValue(event.target.value)}
              placeholder="Send input to the active agent"
              rows={6}
              value={inputValue}
            />
            <button
              data-testid="send-agent-input"
              disabled={
                isSubmitting ||
                (activeAgentSession.sourceType === "remote-tmux-discovered" &&
                  activeAgentSession.controlMode !== "control")
              }
              type="submit"
            >
              {isSubmitting ? "Sending…" : "Send input"}
            </button>
          </form>
        </>
      ) : (
        <div className="detail-empty">
          Select an agent session to inspect it.
        </div>
      )}
    </section>
  );
}
