import { useCallback, useEffect, useRef, useState } from "react";

import type {
  AgentSessionRecord,
  SshHostPreset,
} from "@agent-orchestrator/shared";

import { getQuickTmuxShortcutLabel } from "../lib/platform-compat";

import { HostDropdown, type SelectedHost } from "./HostDropdown";

interface TopBarProps {
  sessions: AgentSessionRecord[];
  collapsed: boolean;
  sshHosts: SshHostPreset[];
  fileBrowserAvailable: boolean;
  fileBrowserOpen: boolean;
  vscodeAvailable: boolean;
  vscodeOpen: boolean;
  useLightweightTerminalPreview: boolean;
  onToggleCollapsed: () => void;
  onToggleFileBrowser: () => void;
  onToggleVsCode: () => void;
  onToggleTerminalPreviewMode: () => void;
  onOpenNewSession: (host: SelectedHost) => void;
  onScanTmux: (host: SelectedHost) => void;
  onScanApps: (host: SelectedHost) => void;
  onOpenQuickTmuxConnect: () => void;
}

export function TopBar({
  sessions,
  collapsed,
  sshHosts,
  fileBrowserAvailable,
  fileBrowserOpen,
  vscodeAvailable,
  vscodeOpen,
  useLightweightTerminalPreview,
  onToggleCollapsed,
  onToggleFileBrowser,
  onToggleVsCode,
  onToggleTerminalPreviewMode,
  onOpenNewSession,
  onScanTmux,
  onScanApps,
  onOpenQuickTmuxConnect,
}: TopBarProps) {
  const quickTmuxShortcutLabel = getQuickTmuxShortcutLabel();
  const [showHints, setShowHints] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(
    Boolean(document.fullscreenElement),
  );

  useEffect(() => {
    function handleFullscreenChange() {
      setIsFullscreen(Boolean(document.fullscreenElement));
    }
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
    };
  }, []);

  const toggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  }, []);
  const hintsRef = useRef<HTMLDivElement | null>(null);
  const hintsPopoverId = "operation-hints-popover";
  const runningCount = sessions.filter(
    (s) => s.interactionState === "running",
  ).length;
  const awaitingCount = sessions.filter(
    (s) => s.interactionState === "awaiting_input",
  ).length;
  const totalCount = sessions.length;

  useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      const target = event.target as Node | null;
      if (hintsRef.current && target && !hintsRef.current.contains(target)) {
        setShowHints(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setShowHints(false);
      }
      if (event.key === "F11") {
        event.preventDefault();
        toggleFullscreen();
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  if (collapsed) {
    return (
      <header className="top-bar top-bar--collapsed">
        <span className="top-bar-collapsed-title">Coding Kanban</span>
        <button
          className="top-bar-expand-btn"
          data-testid="top-bar-expand"
          onClick={onToggleCollapsed}
          title="展开菜单栏"
          type="button"
        >
          ▾ 展开菜单栏
        </button>
      </header>
    );
  }

  return (
    <header className="top-bar">
      <div className="top-bar-left">
        <h1 className="top-bar-title">Coding Kanban</h1>
        <button
          className={`top-bar-action${fileBrowserOpen ? " top-bar-action--active" : ""}`}
          data-testid="file-browser-toggle"
          disabled={!fileBrowserAvailable}
          onClick={onToggleFileBrowser}
          title={
            fileBrowserAvailable
              ? "打开当前终端的文件浏览器"
              : "仅在终端聚焦态可用"
          }
          type="button"
        >
          📁 文件
        </button>
        <button
          className={`top-bar-action${vscodeOpen ? " top-bar-action--active" : ""}`}
          data-testid="vscode-toggle"
          disabled={!vscodeAvailable}
          onClick={onToggleVsCode}
          title={
            vscodeAvailable
              ? "打开当前终端的 VS Code Web"
              : "仅在终端聚焦态可用"
          }
          type="button"
        >
          <span>VS Code</span>
        </button>
      </div>
      <div className="top-bar-hints" ref={hintsRef}>
        <button
          aria-controls={hintsPopoverId}
          aria-expanded={showHints}
          className={`top-bar-action top-bar-action--ghost${showHints ? " top-bar-action--active" : ""}`}
          data-testid="help-hints-toggle"
          onClick={() => setShowHints((current) => !current)}
          type="button"
        >
          操作提示
        </button>
        {showHints && (
          <div
            aria-label="操作提示"
            className="top-bar-hints-popover"
            id={hintsPopoverId}
            role="dialog"
          >
            <div className="top-bar-hint-item">
              <kbd>双击</kbd>
              <span>卡片放大</span>
            </div>
            <div className="top-bar-hint-item">
              <kbd>Alt+Q</kbd>
              <span>返回宫格</span>
            </div>
            <div className="top-bar-hint-item">
              <kbd>{quickTmuxShortcutLabel}</kbd>
              <span>快连 tmux</span>
            </div>
            <div className="top-bar-hint-item">
              <kbd>Tab</kbd>
              <span>切换焦点</span>
            </div>
            <div className="top-bar-hint-item">
              <kbd>F11</kbd>
              <span>全屏切换</span>
            </div>
          </div>
        )}
      </div>
      <div className="top-bar-stats">
        <HostDropdown
          sshHosts={sshHosts}
          onSelectHost={onOpenNewSession}
          triggerLabel="新建会话"
          buttonTestId="new-session-toggle"
          triggerClassName="top-bar-action top-bar-action--primary"
        />
        <HostDropdown
          sshHosts={sshHosts}
          onSelectHost={onScanTmux}
          triggerLabel="扫描 tmux"
        />
        <HostDropdown
          sshHosts={sshHosts}
          onSelectHost={onScanApps}
          triggerLabel="扫描会话"
        />
        <button
          className={`top-bar-action top-bar-action--ghost${useLightweightTerminalPreview ? " top-bar-action--active" : ""}`}
          data-testid="terminal-preview-mode-toggle"
          onClick={onToggleTerminalPreviewMode}
          title={
            useLightweightTerminalPreview
              ? "当前为轻量化预览：非活跃会话不打开终端 WebSocket"
              : "当前为完整终端预览：恢复旧版小终端模式"
          }
          type="button"
        >
          {useLightweightTerminalPreview ? "轻量预览：开" : "完整预览"}
        </button>
        <button
          className="top-bar-action"
          onClick={onOpenQuickTmuxConnect}
          type="button"
        >
          快速连接 tmux
        </button>
        <span className="stat-item">
          共 <strong>{totalCount}</strong> 个会话
        </span>
        {runningCount > 0 && (
          <span className="stat-item stat-running">
            🟢 {runningCount} 运行中
          </span>
        )}
        {awaitingCount > 0 && (
          <span className="stat-item stat-awaiting">
            🟡 {awaitingCount} 等待输入
          </span>
        )}
        <button
          className={`top-bar-action top-bar-action--ghost${isFullscreen ? " top-bar-action--active" : ""}`}
          data-testid="fullscreen-toggle"
          onClick={toggleFullscreen}
          title={isFullscreen ? "退出全屏" : "进入全屏"}
          type="button"
        >
          {isFullscreen ? "⛶ 退出全屏" : "⛶ 全屏"}
        </button>
        <button
          className="top-bar-collapse-btn"
          data-testid="top-bar-collapse"
          onClick={onToggleCollapsed}
          title="折叠菜单栏"
          type="button"
        >
          ▴ 收起菜单栏
        </button>
      </div>
    </header>
  );
}
