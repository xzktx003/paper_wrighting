import type { OpenVsCodeWebResponse } from "@agent-orchestrator/shared";

const inflightOpenRequests = new Map<string, Promise<OpenVsCodeWebResponse>>();
const cachedOpenResponses = new Map<string, OpenVsCodeWebResponse>();

interface OpenVsCodeWebOnceOptions {
  allowCachedResponse?: boolean;
}

export function openVsCodeWebOnce(
  agentSessionId: string,
  openSession: (agentSessionId: string) => Promise<OpenVsCodeWebResponse>,
  options: OpenVsCodeWebOnceOptions = {},
): Promise<OpenVsCodeWebResponse> {
  const existing = inflightOpenRequests.get(agentSessionId);
  if (existing) {
    return existing;
  }

  if (options.allowCachedResponse) {
    const cached = cachedOpenResponses.get(agentSessionId);
    if (cached) {
      return Promise.resolve(cached);
    }
  }

  const requestPromise = openSession(agentSessionId).finally(() => {
    if (inflightOpenRequests.get(agentSessionId) === requestPromise) {
      inflightOpenRequests.delete(agentSessionId);
    }
  });

  requestPromise.then((response) => {
    cachedOpenResponses.set(agentSessionId, response);
  });

  inflightOpenRequests.set(agentSessionId, requestPromise);
  return requestPromise;
}

export function primeVsCodeWebOpenResponse(
  agentSessionId: string,
  response: OpenVsCodeWebResponse,
): void {
  cachedOpenResponses.set(agentSessionId, response);
}

export function clearInflightVsCodeWebRequests(): void {
  inflightOpenRequests.clear();
  cachedOpenResponses.clear();
}
