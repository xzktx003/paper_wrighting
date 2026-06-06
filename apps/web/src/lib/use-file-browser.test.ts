import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { getFileBrowserParentPath } from "./use-file-browser.js";

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
