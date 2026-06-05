export const TERMINAL_PREVIEW_MODE_STORAGE_KEY = "terminal-preview-mode";

type StorageLike = Pick<Storage, "getItem" | "setItem">;

export function parseTerminalPreviewMode(value: string | null): boolean {
  return value !== "full";
}

export function formatTerminalPreviewMode(lightweight: boolean): string {
  return lightweight ? "lightweight" : "full";
}

export function loadTerminalPreviewLightweightMode(
  storage: StorageLike | undefined = globalThis.localStorage,
): boolean {
  try {
    return parseTerminalPreviewMode(
      storage?.getItem(TERMINAL_PREVIEW_MODE_STORAGE_KEY) ?? null,
    );
  } catch {
    return true;
  }
}

export function saveTerminalPreviewLightweightMode(
  lightweight: boolean,
  storage: StorageLike | undefined = globalThis.localStorage,
): void {
  try {
    storage?.setItem(
      TERMINAL_PREVIEW_MODE_STORAGE_KEY,
      formatTerminalPreviewMode(lightweight),
    );
  } catch {
    // ignore storage failures
  }
}
