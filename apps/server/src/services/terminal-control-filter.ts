const TERMINAL_REPORT_PATTERNS = [
  /\u001b\[(?:[?>])?[\d;]*c/g,
  /\u001b\[\??[\d;]*n/g,
  /\u001b\[\??[\d;]*R/g,
  /\u001b\[[\d;]*t/g,
  /\u001b\][^\u0007]*(?:\u0007|\u001b\\)/g,
  /\u001bP[\s\S]*?\u001b\\/g,
];

function stripPatterns(text: string, patterns: RegExp[]): string {
  return patterns.reduce(
    (sanitized, pattern) => sanitized.replace(pattern, ""),
    text,
  );
}

export function sanitizeReplayForTerminal(data: string): string {
  return stripPatterns(data, TERMINAL_REPORT_PATTERNS);
}

export function stripTerminalResponsePayload(payload: string): string {
  return stripPatterns(payload, TERMINAL_REPORT_PATTERNS);
}
