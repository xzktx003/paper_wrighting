export const MOBILE_TERMINAL_MIN_FONT_SIZE = 11;
export const MOBILE_TERMINAL_MAX_FONT_SIZE = 24;
export const MOBILE_TERMINAL_DEFAULT_FONT_SIZE = 15;
const MOBILE_TERMINAL_DEFAULT_LINE_HEIGHT = 16;
export const MOBILE_TERMINAL_FONT_SIZE_STORAGE_KEY =
  "mobile-terminal-font-size";

export interface TouchPointLike {
  clientX: number;
  clientY: number;
}

export interface MobileTerminalScrollState {
  accumulatedDeltaY: number;
  lineHeight: number;
}

export function clampMobileTerminalFontSize(fontSize: number): number {
  if (!Number.isFinite(fontSize)) {
    return MOBILE_TERMINAL_DEFAULT_FONT_SIZE;
  }

  return Math.min(
    MOBILE_TERMINAL_MAX_FONT_SIZE,
    Math.max(MOBILE_TERMINAL_MIN_FONT_SIZE, Math.round(fontSize)),
  );
}

export function measureTouchDistance(
  first: TouchPointLike,
  second: TouchPointLike,
): number {
  return Math.hypot(
    first.clientX - second.clientX,
    first.clientY - second.clientY,
  );
}

export function computeMobilePinchFontSize({
  currentDistance,
  startDistance,
  startFontSize,
}: {
  currentDistance: number;
  startDistance: number;
  startFontSize: number;
}): number {
  if (startDistance <= 0) {
    return clampMobileTerminalFontSize(startFontSize);
  }

  return clampMobileTerminalFontSize(
    startFontSize * (currentDistance / startDistance),
  );
}

export function computeMobileTerminalScrollLines({
  accumulatedDeltaY,
  lineHeight,
}: MobileTerminalScrollState): {
  remainingDeltaY: number;
  scrollLines: number;
} {
  const safeLineHeight =
    Number.isFinite(lineHeight) && lineHeight >= 1
      ? lineHeight
      : MOBILE_TERMINAL_DEFAULT_LINE_HEIGHT;
  const movedLines = Math.trunc(accumulatedDeltaY / safeLineHeight);

  return {
    remainingDeltaY: accumulatedDeltaY - movedLines * safeLineHeight,
    scrollLines: movedLines === 0 ? 0 : -movedLines,
  };
}

export function loadMobileTerminalFontSize(): number {
  try {
    const raw = localStorage.getItem(MOBILE_TERMINAL_FONT_SIZE_STORAGE_KEY);
    return clampMobileTerminalFontSize(raw ? Number(raw) : NaN);
  } catch {
    return MOBILE_TERMINAL_DEFAULT_FONT_SIZE;
  }
}

export function saveMobileTerminalFontSize(fontSize: number): void {
  try {
    localStorage.setItem(
      MOBILE_TERMINAL_FONT_SIZE_STORAGE_KEY,
      String(clampMobileTerminalFontSize(fontSize)),
    );
  } catch {
    // ignore storage failures
  }
}
