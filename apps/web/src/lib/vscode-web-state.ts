import type { OpenVsCodeWebResponse } from "@agent-orchestrator/shared";

function storageKey(agentSessionId: string): string {
  return `vscode-web-state:${agentSessionId}`;
}

function isResponseLike(value: unknown): value is OpenVsCodeWebResponse {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Partial<OpenVsCodeWebResponse>;
  return (
    (candidate.provider === "code-server" ||
      candidate.provider === "openvscode-server") &&
    typeof candidate.reused === "boolean" &&
    typeof candidate.url === "string" &&
    typeof candidate.workingDirectory === "string"
  );
}

export function loadCachedVsCodeWebState(
  agentSessionId: string,
): OpenVsCodeWebResponse | null {
  try {
    const raw = localStorage.getItem(storageKey(agentSessionId));
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw) as unknown;
    return isResponseLike(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function saveCachedVsCodeWebState(
  agentSessionId: string,
  response: OpenVsCodeWebResponse,
): void {
  try {
    localStorage.setItem(storageKey(agentSessionId), JSON.stringify(response));
  } catch {
    // ignore storage failures
  }
}

export function clearCachedVsCodeWebState(agentSessionId: string): void {
  try {
    localStorage.removeItem(storageKey(agentSessionId));
  } catch {
    // ignore storage failures
  }
}
