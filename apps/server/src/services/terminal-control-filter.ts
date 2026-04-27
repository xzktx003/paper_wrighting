const TERMINAL_REPLAY_PATTERNS = [
  /\u001b\[(?:[?>])?[\d;]*c/g,
  /\u001b\[\??[\d;]*n/g,
  /\u001b\[\??[\d;]*R/g,
  /\u001b\[[\d;]*t/g,
  /\u001b\][^\u0007]*(?:\u0007|\u001b\\)/g,
  /\u001bP[\s\S]*?\u001b\\/g,
];

const TERMINAL_INPUT_PATTERNS = [
  /\u001b\[>[\d;]*c/g,
  /\u001b\](?:10|11|4);rgb:[^\u0007]*(?:\u0007|\u001b\\)/g,
];

function stripPatterns(text: string, patterns: RegExp[]): string {
  return patterns.reduce(
    (sanitized, pattern) => sanitized.replace(pattern, ""),
    text,
  );
}

export function sanitizeReplayForTerminal(data: string): string {
  return stripPatterns(data, TERMINAL_REPLAY_PATTERNS);
}

// Live stdin MUST pass DA/DSR/OSC/DCS replies through to the PTY — xterm.js
// auto-answers capability queries from TUIs like Copilot CLI, and stripping
// those replies here makes the TUI wait forever and stop accepting input.
// The one exception is Secondary DA (`CSI > c`): shell prompts can emit that
// query while they are still in line-editing mode, which causes the raw
// terminal version reply (`0;276;0c`) to be echoed back into the prompt.
export function stripTerminalResponsePayload(payload: string): string {
  return stripPatterns(payload, TERMINAL_INPUT_PATTERNS);
}
