export const AGENT_GRID_MIN_CARD_WIDTH = 390;
export const AGENT_GRID_CARD_HEIGHT = 240;
export const AGENT_GRID_GAP = 16;
export const AGENT_GRID_OVERSCAN_ROWS = 1;
export const AGENT_GRID_SINGLE_COLUMN_MAX_WIDTH = 900;
export const AGENT_GRID_VIRTUALIZATION_THRESHOLD = 12;

interface VirtualGridWindowInput {
  itemCount: number;
  containerWidth: number;
  viewportHeight: number;
  scrollTop: number;
  minCardWidth?: number;
  rowHeight?: number;
  gap?: number;
  overscanRows?: number;
}

export interface VirtualGridWindow {
  columns: number;
  totalRows: number;
  totalHeight: number;
  startRow: number;
  endRow: number;
  startIndex: number;
  endIndex: number;
  visibleCount: number;
  offsetY: number;
}

function finiteOrDefault(value: number, fallback: number): number {
  return Number.isFinite(value) ? value : fallback;
}

export function computeGridColumnCount(
  containerWidth: number,
  minCardWidth = AGENT_GRID_MIN_CARD_WIDTH,
  gap = AGENT_GRID_GAP,
): number {
  const safeWidth = Math.max(0, finiteOrDefault(containerWidth, 0));
  const safeMinCardWidth = Math.max(
    1,
    finiteOrDefault(minCardWidth, AGENT_GRID_MIN_CARD_WIDTH),
  );
  const safeGap = Math.max(0, finiteOrDefault(gap, AGENT_GRID_GAP));

  if (safeWidth <= AGENT_GRID_SINGLE_COLUMN_MAX_WIDTH) {
    return 1;
  }

  return Math.max(
    1,
    Math.floor((safeWidth + safeGap) / (safeMinCardWidth + safeGap)),
  );
}

export function computeVirtualGridWindow({
  itemCount,
  containerWidth,
  viewportHeight,
  scrollTop,
  minCardWidth = AGENT_GRID_MIN_CARD_WIDTH,
  rowHeight = AGENT_GRID_CARD_HEIGHT,
  gap = AGENT_GRID_GAP,
  overscanRows = AGENT_GRID_OVERSCAN_ROWS,
}: VirtualGridWindowInput): VirtualGridWindow {
  const safeItemCount = Math.max(0, Math.floor(finiteOrDefault(itemCount, 0)));
  const columns = computeGridColumnCount(containerWidth, minCardWidth, gap);
  const totalRows = Math.ceil(safeItemCount / columns);
  const safeRowHeight = Math.max(
    1,
    finiteOrDefault(rowHeight, AGENT_GRID_CARD_HEIGHT),
  );
  const safeGap = Math.max(0, finiteOrDefault(gap, AGENT_GRID_GAP));
  const rowStride = safeRowHeight + safeGap;
  const totalHeight =
    totalRows * safeRowHeight + Math.max(0, totalRows - 1) * safeGap;

  if (safeItemCount === 0 || totalRows === 0) {
    return {
      columns,
      totalRows,
      totalHeight: 0,
      startRow: 0,
      endRow: -1,
      startIndex: 0,
      endIndex: 0,
      visibleCount: 0,
      offsetY: 0,
    };
  }

  const safeViewportHeight = Math.max(
    0,
    finiteOrDefault(viewportHeight, AGENT_GRID_CARD_HEIGHT),
  );
  const safeScrollTop = Math.max(0, finiteOrDefault(scrollTop, 0));
  const lastPossibleRow = Math.max(0, totalRows - 1);
  const firstVisibleRow = Math.min(
    lastPossibleRow,
    Math.floor(safeScrollTop / rowStride),
  );
  const lastVisibleRow = Math.min(
    lastPossibleRow,
    Math.floor((safeScrollTop + safeViewportHeight) / rowStride),
  );
  const safeOverscanRows = Math.max(
    0,
    Math.floor(finiteOrDefault(overscanRows, AGENT_GRID_OVERSCAN_ROWS)),
  );
  const startRow = Math.max(0, firstVisibleRow - safeOverscanRows);
  const endRow = Math.min(lastPossibleRow, lastVisibleRow + safeOverscanRows);
  const startIndex = startRow * columns;
  const endIndex = Math.min(safeItemCount, (endRow + 1) * columns);

  return {
    columns,
    totalRows,
    totalHeight,
    startRow,
    endRow,
    startIndex,
    endIndex,
    visibleCount: Math.max(0, endIndex - startIndex),
    offsetY: startRow * rowStride,
  };
}
