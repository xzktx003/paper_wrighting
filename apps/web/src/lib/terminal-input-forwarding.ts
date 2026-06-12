import { isTerminalProtocolResponsePayload } from "./terminal-input";

interface TerminalInputForwardingOptions {
  inputEnabled: boolean;
  terminalInputReady?: boolean;
  sanitizedPayload: string;
  socketOpen: boolean;
}

export function shouldAttemptTerminalInputForward({
  inputEnabled,
  terminalInputReady = true,
  sanitizedPayload,
  socketOpen,
}: TerminalInputForwardingOptions): boolean {
  return (
    sanitizedPayload.length > 0 &&
    socketOpen &&
    ((inputEnabled && terminalInputReady) ||
      isTerminalProtocolResponsePayload(sanitizedPayload))
  );
}

export function shouldBufferTerminalInputBeforeReady({
  inputEnabled,
  terminalInputReady = true,
  sanitizedPayload,
  socketOpen,
}: TerminalInputForwardingOptions): boolean {
  return (
    sanitizedPayload.length > 0 &&
    socketOpen &&
    inputEnabled &&
    !terminalInputReady &&
    !isTerminalProtocolResponsePayload(sanitizedPayload)
  );
}
