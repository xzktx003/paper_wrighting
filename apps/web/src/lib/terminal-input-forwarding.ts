import { isTerminalProtocolResponsePayload } from "./terminal-input";

export function shouldAttemptTerminalInputForward({
  inputEnabled,
  sanitizedPayload,
  socketOpen,
}: {
  inputEnabled: boolean;
  sanitizedPayload: string;
  socketOpen: boolean;
}): boolean {
  return (
    sanitizedPayload.length > 0 &&
    socketOpen &&
    (inputEnabled || isTerminalProtocolResponsePayload(sanitizedPayload))
  );
}
