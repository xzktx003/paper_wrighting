import { useEffect } from "react";

import type { AgentSessionRecord } from "@agent-orchestrator/shared";

import { TerminalView } from "./TerminalView";

interface AgentFocusViewProps {
  focusedSession: AgentSessionRecord;
  sessions: AgentSessionRecord[];
  onSwitchFocus: (id: string) => void;
  onExit: () => void;
  onReconnect: (id: string) => void;
}

const stateLabels: Record<string, string> = {
  running: "运行中",
  idle: "空闲",
  awaiting_input: "等待输入",
  detached: "已分离",
  exited: "已退出",
};

export function AgentFocusView({
  focusedSession,
  sessions,
  onSwitchFocus,
  onExit,
  onReconnect,
}: AgentFocusViewProps) {
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        // Don't intercept Escape when terminal has focus
        const target = e.target as HTMLElement | null;
        const active = document.activeElement;
        const inTerminal =
          target?.closest(".focus-main-terminal") ||
          target?.classList.contains("xterm-helper-textarea") ||
          active?.closest(".focus-main-terminal") ||
          active?.classList.contains("xterm-helper-textarea");
        if (inTerminal) {
          return;
        }

        onExit();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onExit]);

  const otherSessions = sessions.filter((s) => s.id !== focusedSession.id);

  return (
    <div className="focus-view">
      <div className="focus-main">
        <div className="focus-main-header">
          <span className="focus-main-name">{focusedSession.displayName}</span>
          <span
            className={`grid-card-badge badge-${focusedSession.interactionState}`}
          >
            {stateLabels[focusedSession.interactionState] ??
              focusedSession.interactionState}
          </span>
          <button className="focus-exit-btn" onClick={onExit}>
            返回宫格
          </button>
          {focusedSession.interactionState === "exited" &&
            focusedSession.sourceType !== "remote-tmux-discovered" && (
              <button
                className="focus-reconnect-btn"
                onClick={() => onReconnect(focusedSession.id)}
              >
                🔄 重新连接
              </button>
            )}
        </div>
        <div className="focus-main-terminal">
          <TerminalView agentSessionId={focusedSession.id} interactive={true} />
        </div>
      </div>

      {otherSessions.length > 0 && (
        <div className="focus-sidebar">
          <h3 className="focus-sidebar-title">其他会话</h3>
          {otherSessions.map((session) => (
            <div
              key={session.id}
              className={`focus-sidebar-card card-${session.interactionState}`}
              onDoubleClick={() => onSwitchFocus(session.id)}
            >
              <div className="focus-sidebar-card-header">
                <span>{session.displayName}</span>
                <span
                  className={`grid-card-badge badge-${session.interactionState}`}
                >
                  {stateLabels[session.interactionState] ??
                    session.interactionState}
                </span>
              </div>
              <div className="focus-sidebar-terminal">
                <TerminalView agentSessionId={session.id} interactive={false} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
