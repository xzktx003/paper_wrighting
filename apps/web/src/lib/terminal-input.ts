// Live stdin is forwarded as-is. xterm.js auto-answers capability queries
// (DA/DSR/OSC/DCS) from TUIs like Copilot CLI via term.onData, and those
// replies MUST reach the PTY — otherwise the TUI blocks on its capability
// handshake and silently ignores keystrokes. Replay content is sanitized on
// the server side (sanitizeReplayForTerminal) before it ever reaches xterm.js,
// so no stale-query auto-reply storm can happen here.
export function stripTerminalResponsePayload(payload: string): string {
  return payload;
}
