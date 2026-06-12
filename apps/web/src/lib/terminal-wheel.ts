export const TERMINAL_WHEEL_DELTA_PIXEL = 0;
export const TERMINAL_WHEEL_DELTA_LINE = 1;
export const TERMINAL_WHEEL_DELTA_PAGE = 2;
const DEFAULT_TERMINAL_WHEEL_LINE_HEIGHT = 16;
const DEFAULT_TERMINAL_WHEEL_PAGE_HEIGHT = 160;

interface TerminalWheelScrollOptions {
  deltaMode: number;
  deltaY: number;
  lineHeight: number;
  pageHeight: number;
  previousDeltaY: number;
}

interface TerminalWheelScrollResult {
  remainingDeltaY: number;
  scrollLines: number;
}

export function normalizeTerminalWheelDeltaY({
  deltaMode,
  deltaY,
  lineHeight,
  pageHeight,
}: Omit<TerminalWheelScrollOptions, "previousDeltaY">): number {
  const safeLineHeight =
    Number.isFinite(lineHeight) && lineHeight >= 1
      ? lineHeight
      : DEFAULT_TERMINAL_WHEEL_LINE_HEIGHT;
  const safePageHeight =
    Number.isFinite(pageHeight) && pageHeight >= safeLineHeight
      ? pageHeight
      : DEFAULT_TERMINAL_WHEEL_PAGE_HEIGHT;

  if (deltaMode === TERMINAL_WHEEL_DELTA_LINE) {
    return deltaY * safeLineHeight;
  }

  if (deltaMode === TERMINAL_WHEEL_DELTA_PAGE) {
    return deltaY * safePageHeight;
  }

  return deltaY;
}

export function computeTerminalWheelScrollLines({
  deltaMode,
  deltaY,
  lineHeight,
  pageHeight,
  previousDeltaY,
}: TerminalWheelScrollOptions): TerminalWheelScrollResult {
  const safeLineHeight =
    Number.isFinite(lineHeight) && lineHeight >= 1
      ? lineHeight
      : DEFAULT_TERMINAL_WHEEL_LINE_HEIGHT;
  const accumulatedDeltaY =
    previousDeltaY +
    normalizeTerminalWheelDeltaY({
      deltaMode,
      deltaY,
      lineHeight: safeLineHeight,
      pageHeight,
    });
  const scrollLines = Math.trunc(accumulatedDeltaY / safeLineHeight);

  return {
    remainingDeltaY: accumulatedDeltaY - scrollLines * safeLineHeight,
    scrollLines,
  };
}
