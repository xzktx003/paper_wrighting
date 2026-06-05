import { useCallback, useEffect, useRef, useState } from "react";

import type {
  AgentSessionRecord,
  SshHostPreset,
} from "@agent-orchestrator/shared";

import { getQuickTmuxShortcutLabel } from "../lib/platform-compat";
import {
  classifyResourcePressure,
  getResourceDiagnosticsSnapshot,
  type ResourceDiagnosticsSnapshot,
} from "../lib/resource-diagnostics";
import type { VsCodeIframeCacheMode } from "../lib/vscode-cache";

import { HostDropdown, type SelectedHost } from "./HostDropdown";

const RESOURCE_DIAGNOSTICS_POLL_MS = 1_000;

function formatKilobytes(value: number): string {
  return `${value.toFixed(value >= 100 ? 0 : 1)} KB`;
}

function formatKilobytesPerSecond(value: number): string {
  return `${value.toFixed(value >= 100 ? 0 : 1)} KB/s`;
}

function formatMessagesPerSecond(value: number): string {
  return `${value.toFixed(value >= 10 ? 1 : 2)} msg/s`;
}

function formatMegabytes(value: number | undefined): string {
  if (value === undefined) {
    return "浏览器未暴露";
  }

  return `${value.toFixed(value >= 100 ? 0 : 1)} MB`;
}

function getHeapSummary(snapshot: ResourceDiagnosticsSnapshot): string {
  const { memory } = snapshot;

  if (memory.usedJSHeapMegabytes === undefined) {
    return "浏览器未暴露";
  }

  return [
    formatMegabytes(memory.usedJSHeapMegabytes),
    memory.totalJSHeapMegabytes === undefined
      ? null
      : `已分配 ${formatMegabytes(memory.totalJSHeapMegabytes)}`,
    memory.jsHeapLimitMegabytes === undefined
      ? null
      : `上限 ${formatMegabytes(memory.jsHeapLimitMegabytes)}`,
  ]
    .filter(Boolean)
    .join(" / ");
}

interface TopBarProps {
  sessions: AgentSessionRecord[];
  collapsed: boolean;
  sshHosts: SshHostPreset[];
  fileBrowserAvailable: boolean;
  fileBrowserOpen: boolean;
  vscodeAvailable: boolean;
  vscodeOpen: boolean;
  vscodeIframeCacheMode: VsCodeIframeCacheMode;
  vscodeCacheReleaseAvailable: boolean;
  useLightweightTerminalPreview: boolean;
  onToggleCollapsed: () => void;
  onToggleFileBrowser: () => void;
  onToggleVsCode: () => void;
  onToggleVsCodeIframeCacheMode: () => void;
  onReleaseVsCodeIframeCache: () => void;
  onToggleTerminalPreviewMode: () => void;
  onOpenNewSession: (host: SelectedHost) => void;
  onScanTmux: (host: SelectedHost) => void;
  onScanApps: (host: SelectedHost) => void;
}

export function TopBar({
  sessions,
  collapsed,
  sshHosts,
  fileBrowserAvailable,
  fileBrowserOpen,
  vscodeAvailable,
  vscodeOpen,
  vscodeIframeCacheMode,
  vscodeCacheReleaseAvailable,
  useLightweightTerminalPreview,
  onToggleCollapsed,
  onToggleFileBrowser,
  onToggleVsCode,
  onToggleVsCodeIframeCacheMode,
  onReleaseVsCodeIframeCache,
  onToggleTerminalPreviewMode,
  onOpenNewSession,
  onScanTmux,
  onScanApps,
}: TopBarProps) {
  const quickTmuxShortcutLabel = getQuickTmuxShortcutLabel();
  const [showHints, setShowHints] = useState(false);
  const [showDiagnostics, setShowDiagnostics] = useState(false);
  const [diagnosticsSnapshot, setDiagnosticsSnapshot] =
    useState<ResourceDiagnosticsSnapshot>(() =>
      getResourceDiagnosticsSnapshot(),
    );
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
  const topBarUtilityRef = useRef<HTMLDivElement | null>(null);
  const hintsPopoverId = "operation-hints-popover";
  const diagnosticsPopoverId = "resource-diagnostics-popover";
  const totalCount = sessions.length;
  const resourceFindings = classifyResourcePressure({
    snapshot: diagnosticsSnapshot,
    useLightweightTerminalPreview,
  });

  useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      const target = event.target as Node | null;
      if (
        topBarUtilityRef.current &&
        target &&
        !topBarUtilityRef.current.contains(target)
      ) {
        setShowHints(false);
        setShowDiagnostics(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setShowHints(false);
        setShowDiagnostics(false);
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
  }, [toggleFullscreen]);

  useEffect(() => {
    if (!showDiagnostics) {
      return;
    }

    const refreshDiagnostics = () => {
      setDiagnosticsSnapshot(getResourceDiagnosticsSnapshot());
    };

    refreshDiagnostics();
    const intervalId = window.setInterval(
      refreshDiagnostics,
      RESOURCE_DIAGNOSTICS_POLL_MS,
    );

    return () => {
      window.clearInterval(intervalId);
    };
  }, [showDiagnostics]);

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
        <button
          className={`top-bar-action top-bar-action--ghost${vscodeIframeCacheMode === "memory-saving" ? " top-bar-action--active" : ""}`}
          data-testid="vscode-cache-mode-toggle"
          onClick={onToggleVsCodeIframeCacheMode}
          title={
            vscodeIframeCacheMode === "memory-saving"
              ? "当前为 VS Code 省内存模式：只保留当前 iframe"
              : "当前为 VS Code 保持状态模式：最多保留最近 6 个 iframe"
          }
          type="button"
        >
          {vscodeIframeCacheMode === "memory-saving"
            ? "VS Code省内存"
            : "VS Code保持状态"}
        </button>
        <button
          className="top-bar-action top-bar-action--ghost"
          data-testid="vscode-cache-release"
          disabled={!vscodeCacheReleaseAvailable}
          onClick={onReleaseVsCodeIframeCache}
          title="卸载非当前 VS Code iframe，释放浏览器内存"
          type="button"
        >
          释放VS Code缓存
        </button>
      </div>
      <div className="top-bar-hints" ref={topBarUtilityRef}>
        <button
          aria-controls={hintsPopoverId}
          aria-expanded={showHints}
          className={`top-bar-action top-bar-action--ghost${showHints ? " top-bar-action--active" : ""}`}
          data-testid="help-hints-toggle"
          onClick={() => {
            setShowHints((current) => !current);
            setShowDiagnostics(false);
          }}
          type="button"
        >
          操作提示
        </button>
        <button
          aria-controls={diagnosticsPopoverId}
          aria-expanded={showDiagnostics}
          className={`top-bar-action top-bar-action--ghost${showDiagnostics ? " top-bar-action--active" : ""}`}
          data-testid="resource-diagnostics-toggle"
          onClick={() => {
            setShowDiagnostics((current) => !current);
            setShowHints(false);
          }}
          title="查看浏览器内存、终端实例和 WebSocket 吞吐指标"
          type="button"
        >
          资源诊断
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
        {showDiagnostics && (
          <div
            aria-label="资源诊断"
            className="top-bar-resource-popover"
            data-testid="resource-diagnostics-popover"
            id={diagnosticsPopoverId}
            role="dialog"
          >
            <div className="resource-diagnostics-header">
              <strong>浏览器资源诊断</strong>
              <span>打开时每秒刷新，不保存历史</span>
            </div>
            <div className="resource-diagnostics-grid">
              <span>预览模式</span>
              <strong>
                {useLightweightTerminalPreview ? "轻量预览" : "完整预览"}
              </strong>
              <span>xterm 实例</span>
              <strong>{diagnosticsSnapshot.dom.xtermCount}</strong>
              <span>终端视图</span>
              <strong>
                {diagnosticsSnapshot.dom.terminalViewCount}（主终端{" "}
                {diagnosticsSnapshot.dom.liveTerminalViewCount} / 预览{" "}
                {diagnosticsSnapshot.dom.previewTerminalViewCount}）
              </strong>
              <span>轻量预览 DOM</span>
              <strong>{diagnosticsSnapshot.dom.lightweightPreviewCount}</strong>
              <span>终端 WebSocket</span>
              <strong>
                {diagnosticsSnapshot.terminalSockets.total}（open{" "}
                {diagnosticsSnapshot.terminalSockets.open} / connecting{" "}
                {diagnosticsSnapshot.terminalSockets.connecting}）
              </strong>
              <span>会话快照 WS</span>
              <strong>
                {formatMessagesPerSecond(
                  diagnosticsSnapshot.agentSessionSocket.messagesPerSecond,
                )}
                {" · "}
                {formatKilobytesPerSecond(
                  diagnosticsSnapshot.agentSessionSocket.kilobytesPerSecond,
                )}
              </strong>
              <span>快照累计/单帧</span>
              <strong>
                {diagnosticsSnapshot.agentSessionSocket.totalMessages} 条 / 累计{" "}
                {formatKilobytes(
                  diagnosticsSnapshot.agentSessionSocket.totalKilobytes,
                )}{" "}
                / 单帧{" "}
                {formatKilobytes(
                  diagnosticsSnapshot.agentSessionSocket.lastPayloadKilobytes,
                )}
              </strong>
              <span>终端实时流</span>
              <strong>
                {formatMessagesPerSecond(
                  diagnosticsSnapshot.terminalFrames.messagesPerSecond,
                )}
                {" · "}
                {formatKilobytesPerSecond(
                  diagnosticsSnapshot.terminalFrames.kilobytesPerSecond,
                )}
              </strong>
              <span>VS Code iframe</span>
              <strong>{diagnosticsSnapshot.dom.vscodeIframeCount}</strong>
              <span>JS heap</span>
              <strong>{getHeapSummary(diagnosticsSnapshot)}</strong>
            </div>
            <div className="resource-diagnostics-findings">
              <strong>当前判读</strong>
              <ul>
                {resourceFindings.map((finding) => (
                  <li key={finding}>{finding}</li>
                ))}
              </ul>
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
        <span className="stat-item">
          共 <strong>{totalCount}</strong> 个会话
        </span>
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
