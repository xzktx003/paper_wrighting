export const MIN_TERMINAL_FONT_SIZE = 10;
export const MAX_TERMINAL_FONT_SIZE = 24;
export const DEFAULT_TERMINAL_FONT_SIZE = 14;
export const TERMINAL_FONT_SIZE_STORAGE_KEY = "terminal-font-size";

interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): unknown;
}

export function clampTerminalFontSize(fontSize: number): number {
  if (!Number.isFinite(fontSize)) {
    return DEFAULT_TERMINAL_FONT_SIZE;
  }

  return Math.min(
    MAX_TERMINAL_FONT_SIZE,
    Math.max(MIN_TERMINAL_FONT_SIZE, Math.round(fontSize)),
  );
}

export function loadTerminalFontSize(
  storage: StorageLike = localStorage,
): number {
  try {
    const raw = storage.getItem(TERMINAL_FONT_SIZE_STORAGE_KEY);
    return clampTerminalFontSize(raw ? Number(raw) : NaN);
  } catch {
    return DEFAULT_TERMINAL_FONT_SIZE;
  }
}

export function saveTerminalFontSize(
  fontSize: number,
  storage: StorageLike = localStorage,
): void {
  try {
    storage.setItem(
      TERMINAL_FONT_SIZE_STORAGE_KEY,
      String(clampTerminalFontSize(fontSize)),
    );
  } catch {
    // ignore storage failures
  }
}
