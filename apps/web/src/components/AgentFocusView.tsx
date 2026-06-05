import { Suspense, useEffect, useState } from "react";

import type { AgentSessionRecord } from "@agent-orchestrator/shared";

import { FocusSidebarSessionCard } from "./FocusSidebarSessionCard";
import { LazyTerminalView } from "./LazyTerminalView";
import { TerminalPreview } from "./TerminalPreview";

interface AgentFocusViewProps {
  focusedSession: AgentSessionRecord;
  sessions: AgentSessionRecord[];
  onSwitchFocus: (id: string) => void;
  onExit: () => void;
  onReconnect: (id: string) => void;
  onRename?: (id: string) => void;
  useLightweightTerminalPreview?: boolean;
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
  useLightweightTerminalPreview = true,
}: AgentFocusViewProps) {
  function handleFocusViewPointerDownCapture(
    event: React.PointerEvent<HTMLDivElement>,
  ) {
    const target = event.target as HTMLElement | null;
    if (!target) {
      return;
    }

    // Static header/text regions inside focus view are effectively part of the
    // terminal workspace. If the user clicks them, keep the terminal ready for
    // immediate typing instead of leaving focus on the document body and
    // relying on synthetic key forwarding.
    if (target.closest(".focus-main-terminal")) {
      return;
    }

    if (
      target.closest(
        'button, input, textarea, select, a, [contenteditable="true"], [contenteditable=""], [role="dialog"], [role="alertdialog"]',
      )
    ) {
      return;
    }

    const textarea = document.querySelector(
      ".focus-main-terminal .xterm-helper-textarea",
    ) as HTMLTextAreaElement | null;
    textarea?.focus();
  }

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

      // Buttons and anchors are not text-entry surfaces. If they keep focus,
      // printable keys must be redirected back into the active terminal
      // instead of being dropped on the floor while a TUI like Copilot is
      // waiting for stdin.
      const inInput =
        active instanceof HTMLInputElement ||
        active instanceof HTMLTextAreaElement ||
        active instanceof HTMLSelectElement ||
        active?.isContentEditable ||
        active?.closest('[role="dialog"]') !== null ||
        active?.closest('[role="alertdialog"]') !== null;
      if (!inInput && !isInTerminal(target) && !isInTerminal(active)) {
        const textarea = document.querySelector(
          ".focus-main-terminal .xterm-helper-textarea",
        ) as HTMLTextAreaElement | null;
        if (textarea) {
          e.preventDefault();
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
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  return (
    <div
      className={`focus-view${sidebarCollapsed ? " focus-view--sidebar-collapsed" : ""}`}
      onPointerDownCapture={handleFocusViewPointerDownCapture}
    >
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
          <Suspense fallback={<TerminalPreview session={focusedSession} />}>
            <LazyTerminalView
              agentSessionId={focusedSession.id}
              interactive={true}
            />
          </Suspense>
        </div>
      </div>

      {otherSessions.length > 0 && (
        <>
          <div className="focus-sidebar-toggle">
            <button
              className="focus-sidebar-toggle-btn"
              data-testid="focus-sidebar-collapse-toggle"
              onClick={() => setSidebarCollapsed((current) => !current)}
              title={sidebarCollapsed ? "展开右侧其他会话" : "折叠右侧其他会话"}
              type="button"
            >
              {sidebarCollapsed ? "⟨" : "⟩"}
            </button>
          </div>
          {!sidebarCollapsed && (
            <div className="focus-sidebar">
              <h3 className="focus-sidebar-title">其他会话</h3>
              {otherSessions.map((session) => (
                <FocusSidebarSessionCard
                  key={session.id}
                  session={session}
                  onRename={onRename}
                  onSwitchFocus={onSwitchFocus}
                  useLightweightTerminalPreview={useLightweightTerminalPreview}
                />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
