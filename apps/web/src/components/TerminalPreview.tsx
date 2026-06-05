import type { AgentSessionRecord } from "@agent-orchestrator/shared";

import { buildTerminalPreviewLines } from "../lib/terminal-preview";

interface TerminalPreviewProps {
  session: AgentSessionRecord;
  suspended?: boolean;
  variant?: "card" | "sidebar";
}

export function TerminalPreview({
  session,
  suspended = false,
  variant = "card",
}: TerminalPreviewProps) {
  const lines = buildTerminalPreviewLines(session.outputPreview, {
    maxLines: variant === "sidebar" ? 4 : 6,
    suspended,
  });

  return (
    <div
      aria-label={`${session.displayName} 终端轻量预览`}
      className={`terminal-preview terminal-preview-${variant}`}
      data-testid={`terminal-preview-${session.id}`}
    >
      <div className="terminal-preview-toolbar">
        <span aria-hidden="true" className="terminal-preview-led" />
        <span className="terminal-preview-title">轻量预览</span>
      </div>
      <pre className="terminal-preview-content">{lines.join("\n")}</pre>
    </div>
  );
}
