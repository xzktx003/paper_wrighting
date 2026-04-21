import type { OpenVsCodeWebResponse } from "@agent-orchestrator/shared";

const inflightOpenRequests = new Map<string, Promise<OpenVsCodeWebResponse>>();

export function openVsCodeWebOnce(
  agentSessionId: string,
  openSession: (agentSessionId: string) => Promise<OpenVsCodeWebResponse>,
): Promise<OpenVsCodeWebResponse> {
  const existing = inflightOpenRequests.get(agentSessionId);
  if (existing) {
    return existing;
  }

  const requestPromise = openSession(agentSessionId).finally(() => {
    if (inflightOpenRequests.get(agentSessionId) === requestPromise) {
      inflightOpenRequests.delete(agentSessionId);
    }
  });

  inflightOpenRequests.set(agentSessionId, requestPromise);
  return requestPromise;
}

export function clearInflightVsCodeWebRequests(): void {
  inflightOpenRequests.clear();
}
