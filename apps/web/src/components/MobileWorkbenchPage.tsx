import { Suspense, useLayoutEffect, useMemo, useState } from "react";

import type { AgentSessionRecord } from "@agent-orchestrator/shared";

import { sendAgentInput } from "../lib/api";
import { LazyTerminalView } from "./LazyTerminalView";
import { MobileAgentComposer } from "./MobileAgentComposer";
import { MobileTerminalToolbar } from "./MobileTerminalToolbar";

interface MobileWorkbenchPageProps {
  activeSessionId: string | null;
  isLoading: boolean;
  sessions: AgentSessionRecord[];
  onSwitchSession: (id: string) => void;
}

const stateLabels: Record<string, string> = {
  running: "运行中",
  idle: "空闲",
  awaiting_input: "等待输入",
  detached: "已分离",
  exited: "已退出",
};

export function MobileWorkbenchPage({
  activeSessionId,
  isLoading,
  sessions,
  onSwitchSession,
}: MobileWorkbenchPageProps) {
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const visibleSessions = useMemo(
    () => sessions.filter((session) => !session.hidden),
    [sessions],
  );
  const activeSession = useMemo(
    () =>
      visibleSessions.find((session) => session.id === activeSessionId) ??
      visibleSessions[0],
    [activeSessionId, visibleSessions],
  );

  useLayoutEffect(() => {
    document.documentElement.classList.add("mobile-terminal-route");
    document.body.classList.add("mobile-terminal-route");
    return () => {
      document.documentElement.classList.remove("mobile-terminal-route");
      document.body.classList.remove("mobile-terminal-route");
    };
  }, []);

  const handleSendInput = async (input: string) => {
    if (!activeSession) {
      return;
    }

    setErrorMessage(null);
    try {
      await sendAgentInput(activeSession.id, { input });
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "发送失败");
    }
  };

  return (
    <main className="mobile-workbench-page">
      <header className="mobile-workbench-header">
        <a className="mobile-workbench-desktop-link" href="/">
          桌面
        </a>
        <div className="mobile-workbench-title">
          <strong>{activeSession?.displayName ?? "手机终端"}</strong>
          <span>
            {activeSession
              ? `${stateLabels[activeSession.interactionState] ?? activeSession.interactionState} · ${activeSession.agentKind}`
              : "无可用会话"}
          </span>
        </div>
        <label className="mobile-session-switcher">
          <span>会话</span>
          <select
            disabled={!activeSession}
            onChange={(event) => onSwitchSession(event.target.value)}
            value={activeSession?.id ?? ""}
          >
            {visibleSessions.map((session) => (
              <option key={session.id} value={session.id}>
                {session.displayName}
              </option>
            ))}
          </select>
        </label>
      </header>

      <section className="mobile-terminal-surface">
        <div className="mobile-terminal-frame">
          {isLoading ? (
            <div className="grid-empty">
              <p>正在加载...</p>
            </div>
          ) : activeSession ? (
            <Suspense
              fallback={
                <div className="grid-empty">
                  <p>正在加载终端...</p>
                </div>
              }
            >
              <LazyTerminalView
                agentSessionId={activeSession.id}
                inputEnabled={false}
                interactive
                mobileTouchMode
              />
            </Suspense>
          ) : (
            <div className="grid-empty">
              <p>没有可用会话。请先回到桌面端新建或接入一个会话。</p>
            </div>
          )}
        </div>
      </section>

      {errorMessage && (
        <div className="mobile-workbench-error" role="alert">
          {errorMessage}
        </div>
      )}

      <MobileTerminalToolbar
        disabled={!activeSession}
        onSendInput={handleSendInput}
      />
      <MobileAgentComposer
        disabled={!activeSession}
        onSendInput={handleSendInput}
      />
    </main>
  );
}
