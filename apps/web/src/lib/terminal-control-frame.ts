export type ParsedTerminalControlFrame =
  | { type: "replay"; data: string }
  | { type: "replay-complete" }
  | { type: "output"; data: string };

export function parseTerminalControlFrame(
  payload: string,
): ParsedTerminalControlFrame {
  try {
    const parsed = JSON.parse(payload) as {
      __agentOrchestrator?: unknown;
      event?: unknown;
      data?: unknown;
    };

    if (parsed.__agentOrchestrator !== "terminal-control") {
      return { type: "output", data: payload };
    }

    if (parsed.event === "replay" && typeof parsed.data === "string") {
      return { type: "replay", data: parsed.data };
    }

    if (parsed.event === "replay-complete") {
      return { type: "replay-complete" };
    }

    return { type: "output", data: payload };
  } catch {
    return { type: "output", data: payload };
  }
}
