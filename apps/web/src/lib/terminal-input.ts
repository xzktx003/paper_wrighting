const TERMINAL_RESPONSE_PATTERNS = [
  /\u001b\[(?:[?>])?[\d;]*c/g,
  /\u001b\[\??[\d;]*n/g,
  /\u001b\[\??[\d;]*R/g,
  /\u001b\[[\d;]*t/g,
  /\u001b\][^\u0007]*(?:\u0007|\u001b\\)/g,
  /\u001bP[\s\S]*?\u001b\\/g,
];

export function stripTerminalResponsePayload(payload: string): string {
  return TERMINAL_RESPONSE_PATTERNS.reduce(
    (sanitized, pattern) => sanitized.replace(pattern, ""),
    payload,
  );
}
