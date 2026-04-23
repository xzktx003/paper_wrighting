import { useEffect } from "react";

import type { AgentSessionRecord } from "@agent-orchestrator/shared";

import { TerminalView } from "./TerminalView";

interface AgentFocusViewProps {
  focusedSession: AgentSessionRecord;
  sessions: AgentSessionRecord[];
  onSwitchFocus: (id: string) => void;
  onExit: () => void;
  onReconnect: (id: string) => void;
  onRename?: (id: string) => void;
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
  onRename,
}: AgentFocusViewProps) {
  useEffect(() => {
    function isInTerminal(node: HTMLElement | null): boolean {
      return Boolean(
        node?.closest(".focus-main-terminal") ||
        node?.classList.contains("xterm-helper-textarea"),
      );
    }

    function handleKeyDown(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null;
      const active = document.activeElement as HTMLElement | null;

      if (e.key === "Escape") {
        // Esc is reserved for dialog-like interactions; never use it to exit focus mode.
        if (!isInTerminal(target) && !isInTerminal(active)) {
          e.stopPropagation();
        }
        return;
      }

      const isExitShortcut =
        e.altKey &&
        !e.ctrlKey &&
        !e.shiftKey &&
        !e.metaKey &&
        (e.code === "KeyQ" || e.key.toLowerCase() === "q");

      if (isExitShortcut) {
        e.preventDefault();
        e.stopPropagation();
        onExit();
        return;
      }

      const inInput =
        active instanceof HTMLInputElement ||
        active instanceof HTMLTextAreaElement ||
        active instanceof HTMLButtonElement ||
        active instanceof HTMLSelectElement ||
        active instanceof HTMLAnchorElement ||
        active?.isContentEditable ||
        active?.closest('[role="dialog"]') !== null ||
        active?.closest('[role="alertdialog"]') !== null;
      if (!inInput && !isInTerminal(target) && !isInTerminal(active)) {
        const textarea = document.querySelector(
          ".focus-main-terminal .xterm-helper-textarea",
        ) as HTMLTextAreaElement | null;
        if (textarea) {
          textarea.focus();
          const forwarded = new KeyboardEvent("keydown", {
            key: e.key,
            code: e.code,
            keyCode: e.keyCode,
            which: e.which,
            ctrlKey: e.ctrlKey,
            altKey: e.altKey,
            shiftKey: e.shiftKey,
            metaKey: e.metaKey,
            repeat: e.repeat,
            bubbles: true,
            cancelable: true,
            composed: true,
          });
          textarea.dispatchEvent(forwarded);
          e.stopPropagation();
        }
      }
    }

    window.addEventListener("keydown", handleKeyDown, true);
    return () => window.removeEventListener("keydown", handleKeyDown, true);
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
          <button
            className="focus-rename-btn"
            onClick={() => onRename?.(focusedSession.id)}
            type="button"
          >
            ✎ 改名
          </button>
          <button className="focus-exit-btn" onClick={onExit} title="Alt+Q">
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
                <div className="focus-sidebar-card-actions">
                  <button
                    className="grid-card-rename"
                    onClick={(event) => {
                      event.stopPropagation();
                      onRename?.(session.id);
                    }}
                    title="修改名称"
                    type="button"
                  >
                    ✎
                  </button>
                  <span
                    className={`grid-card-badge badge-${session.interactionState}`}
                  >
                    {stateLabels[session.interactionState] ??
                      session.interactionState}
                  </span>
                </div>
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
