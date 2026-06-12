type TerminalInputBridge = (input: string) => boolean;

const terminalInputBridges = new Map<string, TerminalInputBridge>();

export function registerTerminalInputBridge(
  sessionId: string,
  bridge: TerminalInputBridge,
): () => void {
  terminalInputBridges.set(sessionId, bridge);

  return () => {
    if (terminalInputBridges.get(sessionId) === bridge) {
      terminalInputBridges.delete(sessionId);
    }
  };
}

export function sendTerminalInputViaBridge(
  sessionId: string,
  input: string,
): boolean {
  return terminalInputBridges.get(sessionId)?.(input) ?? false;
}
