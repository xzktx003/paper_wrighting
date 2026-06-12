import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  getFileBrowserParentPath,
  parsePersistedBrowserScopeState,
} from "./use-file-browser.js";

describe("getFileBrowserParentPath", () => {
  it("stays at root-like locations when no higher directory is available", () => {
    assert.equal(getFileBrowserParentPath("/"), "/");
    assert.equal(getFileBrowserParentPath(""), "/");
    assert.equal(getFileBrowserParentPath("~"), "~");
  });

  it("returns the parent for absolute and relative paths", () => {
    assert.equal(getFileBrowserParentPath("/workspace/project"), "/workspace");
    assert.equal(getFileBrowserParentPath("/workspace/project/"), "/workspace");
    assert.equal(getFileBrowserParentPath("workspace/project"), "workspace");
  });
});

describe("parsePersistedBrowserScopeState", () => {
  it("restores valid persisted file browser preferences", () => {
    const state = parsePersistedBrowserScopeState(
      JSON.stringify({
        currentPath: "/workspace/project",
        showHidden: true,
        filterQuery: "report",
        sortKey: "modifiedAt",
        sortDirection: "desc",
      }),
      "/workspace",
    );

    assert.equal(state.currentPath, "/workspace/project");
    assert.equal(state.showHidden, true);
    assert.equal(state.filterQuery, "report");
    assert.equal(state.sortKey, "modifiedAt");
    assert.equal(state.sortDirection, "desc");
  });

  it("ignores non-boolean showHidden values from stale storage", () => {
    const state = parsePersistedBrowserScopeState(
      JSON.stringify({
        currentPath: "/workspace/project",
        showHidden: "false",
        sortKey: "size",
        sortDirection: "desc",
      }),
      "/workspace",
    );

    assert.equal(state.currentPath, "/workspace/project");
    assert.equal(state.showHidden, false);
    assert.equal(state.sortKey, "size");
    assert.equal(state.sortDirection, "desc");
  });

  it("trims persisted current paths before restoring them", () => {
    const state = parsePersistedBrowserScopeState(
      JSON.stringify({
        currentPath: "  /workspace/project  ",
      }),
      "/workspace",
    );

    assert.equal(state.currentPath, "/workspace/project");
  });

  it("falls back on corrupt persisted file browser state", () => {
    const state = parsePersistedBrowserScopeState("bad-json{{", "/workspace");

    assert.equal(state.currentPath, "/workspace");
    assert.equal(state.showHidden, false);
    assert.equal(state.filterQuery, "");
    assert.equal(state.sortKey, "name");
    assert.equal(state.sortDirection, "asc");
  });
});
