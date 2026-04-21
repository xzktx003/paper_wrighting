import { useEffect, useState } from "react";

import type { OpenVsCodeWebResponse } from "@agent-orchestrator/shared";

import { openVsCodeWeb } from "../lib/api";

interface VSCodeDrawerProps {
  agentSessionId: string;
  displayName: string;
  open: boolean;
}

export function VSCodeDrawer({
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
    setLoading(true);
    setError(null);

    openVsCodeWeb(agentSessionId)
      .then((response) => {
        if (cancelled) {
          return;
        }
        setEditorState(response);
      })
      .catch((requestError) => {
        if (cancelled) {
          return;
        }

        setEditorState(null);
        setError(
          requestError instanceof Error
            ? requestError.message
            : "VS Code Web 打开失败",
        );
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [agentSessionId, open, reloadSeed]);

  return (
    <aside className="vscode-drawer" data-testid="vscode-web-drawer">
      <div className="vscode-drawer-header">
        <div>
          <div className="vscode-drawer-title">VS Code</div>
          <div className="vscode-drawer-subtitle">{displayName}</div>
        </div>
        <button
          className="vscode-drawer-reload"
          onClick={() => setReloadSeed((value) => value + 1)}
          type="button"
        >
          重新加载
        </button>
      </div>

      {editorState && (
        <div className="vscode-drawer-meta">
          <span>{editorState.provider}</span>
          <span className="vscode-drawer-path">
            {editorState.workingDirectory}
          </span>
          {editorState.reused && <span>复用实例</span>}
        </div>
      )}

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
            data-testid="vscode-web-frame"
            key={`${reloadSeed}:${editorState.url}`}
            src={editorState.url}
            title={`VS Code - ${displayName}`}
          />
        )}
      </div>
    </aside>
  );
}
