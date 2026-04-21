import { useEffect, useState } from "react";

import type { OpenVsCodeWebResponse } from "@agent-orchestrator/shared";

import { openVsCodeWeb } from "../lib/api";

interface VSCodeDrawerProps {
  active: boolean;
  agentSessionId: string;
  displayName: string;
  open: boolean;
}

export function VSCodeDrawer({
  active,
  agentSessionId,
  displayName,
  open,
}: VSCodeDrawerProps) {
  const [editorState, setEditorState] = useState<OpenVsCodeWebResponse | null>(
    null,
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reloadSeed, setReloadSeed] = useState(0);

  useEffect(() => {
    if (!open) {
      return;
    }

    let cancelled = false;
    let heartbeatId: number | null = null;

    async function ensureEditor(showLoading: boolean) {
      if (showLoading) {
        setLoading(true);
      }

      setError(null);

      try {
        const response = await openVsCodeWeb(agentSessionId);
        if (cancelled) {
          return;
        }

        setEditorState((current) => {
          if (
            current &&
            current.url === response.url &&
            current.provider === response.provider &&
            current.workingDirectory === response.workingDirectory &&
            current.reused === response.reused
          ) {
            return current;
          }

          return response;
        });
        setError(null);
      } catch (requestError) {
        if (cancelled) {
          return;
        }

        setEditorState(null);
        setError(
          requestError instanceof Error
            ? requestError.message
            : "VS Code Web 打开失败",
        );
      } finally {
        if (!cancelled && showLoading) {
          setLoading(false);
        }
      }
    }

    void ensureEditor(true);
    heartbeatId = window.setInterval(() => {
      void ensureEditor(false);
    }, 60_000);

    return () => {
      cancelled = true;
      if (heartbeatId !== null) {
        window.clearInterval(heartbeatId);
      }
    };
  }, [agentSessionId, open, reloadSeed]);

  return (
    <aside
      className="vscode-drawer"
      {...(active ? { "data-testid": "vscode-web-drawer" } : {})}
    >
      <div className="vscode-drawer-tools">
        <button
          aria-label={`重新加载 ${displayName}`}
          className="vscode-drawer-reload"
          onClick={() => setReloadSeed((value) => value + 1)}
          title={`重新加载 ${displayName}`}
          type="button"
        >
          ↻
        </button>
        {editorState && (
          <div className="vscode-drawer-badges" aria-label="VS Code Web 状态">
            <span className="vscode-drawer-badge" title="当前嵌入 VS Code Web">
              VS Code
            </span>
            <span
              className="vscode-drawer-badge"
              title="VS Code Web 服务提供方"
            >
              {editorState.provider}
            </span>
            {editorState.reused && (
              <span className="vscode-drawer-badge" title="复用已启动的服务">
                复用
              </span>
            )}
          </div>
        )}
      </div>

      <div className="vscode-drawer-body">
        {loading && (
          <div className="vscode-drawer-state" role="status">
            正在启动 VS Code Web…
          </div>
        )}
        {!loading && error && (
          <div className="vscode-drawer-state vscode-drawer-state--error">
            <div>{error}</div>
            <div className="vscode-drawer-hint">
              会优先复用本机已有安装；如果缺失，会尝试自动安装官方 `code-server`
              standalone。
            </div>
          </div>
        )}
        {!loading && !error && editorState && (
          <iframe
            className="vscode-drawer-frame"
            {...(active ? { "data-testid": "vscode-web-frame" } : {})}
            key={`${reloadSeed}:${editorState.url}`}
            src={editorState.url}
            title={`VS Code - ${displayName}`}
          />
        )}
      </div>
    </aside>
  );
}
