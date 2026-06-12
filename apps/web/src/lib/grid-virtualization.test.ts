import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  computeGridColumnCount,
  computeVirtualGridWindow,
} from "./grid-virtualization.js";

describe("grid virtualization", () => {
  it("limits the rendered slice to the visible rows plus overscan", () => {
    const window = computeVirtualGridWindow({
      itemCount: 30,
      containerWidth: 1280,
      viewportHeight: 520,
      scrollTop: 0,
      overscanRows: 1,
    });

    assert.equal(window.columns, 3);
    assert.equal(window.totalRows, 10);
    assert.equal(window.startIndex, 0);
    assert.equal(window.endIndex, 12);
    assert.equal(window.visibleCount, 12);
    assert.equal(window.totalHeight, 2544);
  });

  it("moves the slice as the user scrolls down the grid", () => {
    const window = computeVirtualGridWindow({
      itemCount: 30,
      containerWidth: 1280,
      viewportHeight: 520,
      scrollTop: 1280,
      overscanRows: 1,
    });

    assert.equal(window.columns, 3);
    assert.equal(window.startRow, 4);
    assert.equal(window.endRow, 8);
    assert.equal(window.startIndex, 12);
    assert.equal(window.endIndex, 27);
    assert.equal(window.offsetY, 1024);
  });

  it("keeps a non-empty slice when the current scroll position exceeds new content", () => {
    const window = computeVirtualGridWindow({
      itemCount: 5,
      containerWidth: 1280,
      viewportHeight: 520,
      scrollTop: 9999,
      overscanRows: 0,
    });

    assert.equal(window.columns, 3);
    assert.equal(window.totalRows, 2);
    assert.equal(window.startRow, 1);
    assert.equal(window.endRow, 1);
    assert.equal(window.startIndex, 3);
    assert.equal(window.endIndex, 5);
    assert.equal(window.visibleCount, 2);
  });

  it("uses one column when the grid is narrower than the card minimum", () => {
    assert.equal(computeGridColumnCount(320), 1);
  });

  it("falls back to a stable slice when layout measurements are unavailable", () => {
    const window = computeVirtualGridWindow({
      itemCount: 20,
      containerWidth: Number.NaN,
      viewportHeight: Number.NaN,
      scrollTop: Number.NaN,
      rowHeight: Number.NaN,
      gap: Number.NaN,
      overscanRows: Number.NaN,
    });

    assert.deepEqual(window, {
      columns: 1,
      totalRows: 20,
      totalHeight: 5104,
      startRow: 0,
      endRow: 1,
      startIndex: 0,
      endIndex: 2,
      visibleCount: 2,
      offsetY: 0,
    });
  });
});
