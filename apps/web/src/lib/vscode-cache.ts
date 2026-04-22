export function touchVsCodeCacheSessionIds(
  current: string[],
  sessionId: string,
  maxEntries: number,
): string[] {
  if (current.includes(sessionId)) {
    return current;
  }

  return [...current, sessionId].slice(-maxEntries);
}
