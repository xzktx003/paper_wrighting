import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import {
  clampFileBrowserPreviewHeight,
  FILE_BROWSER_PREVIEW_DEFAULT_HEIGHT,
  FILE_BROWSER_PREVIEW_MIN_HEIGHT,
  FILE_BROWSER_PREVIEW_MIN_LIST_HEIGHT,
  FileBrowserDrawer,
  parseFileBrowserPreviewHeight,
} from "./FileBrowserDrawer.js";

describe("FileBrowserDrawer", () => {
  it("renders the file list without the legacy side directory tree", () => {
    const markup = renderToStaticMarkup(
      createElement(FileBrowserDrawer, {
        open: true,
        scopeKey: "test-scope",
        defaultPath: "/workspace",
        sshHosts: [],
        selectedHost: { type: "local" },
        onSelectHost: () => {},
      }),
    );

    assert.doesNotMatch(markup, /file-browser-tree/);
    assert.doesNotMatch(markup, /目录树/);
    assert.match(markup, /class="file-browser-content"/);
  });

  it("shows an up-level arrow next to the name header", () => {
    const markup = renderToStaticMarkup(
      createElement(FileBrowserDrawer, {
        open: true,
        scopeKey: "test-scope",
        defaultPath: "/workspace",
        sshHosts: [],
        selectedHost: { type: "local" },
        onSelectHost: () => {},
      }),
    );

    assert.match(markup, /class="file-browser-name-header"/);
    assert.match(
      markup,
      /class="file-browser-name-sort-button"[^>]*>名称<\/button>/,
    );
    assert.doesNotMatch(markup, /file-browser-sort-indicator/);
    assert.doesNotMatch(markup, /升序|降序/);
    assert.match(markup, /aria-label="返回上一级目录"/);
    assert.match(markup, /class="file-browser-up-one-level"[^>]*>↑<\/button>/);
  });

  it("does not render the directory tree sidebar", () => {
    const markup = renderToStaticMarkup(
      createElement(FileBrowserDrawer, {
        open: true,
        scopeKey: "test-scope",
        defaultPath: "/workspace",
        sshHosts: [],
        selectedHost: { type: "local" },
        onSelectHost: () => {},
      }),
    );

    assert.doesNotMatch(markup, /file-browser-tree/);
    assert.doesNotMatch(markup, /目录树/);
  });
});

describe("parseFileBrowserPreviewHeight", () => {
  it("restores valid persisted preview heights", () => {
    assert.equal(parseFileBrowserPreviewHeight("320"), 320);
  });

  it("falls back when persisted preview height is too small", () => {
    assert.equal(
      parseFileBrowserPreviewHeight(String(FILE_BROWSER_PREVIEW_MIN_HEIGHT - 1)),
      FILE_BROWSER_PREVIEW_DEFAULT_HEIGHT,
    );
  });

  it("falls back on non-numeric persisted preview heights", () => {
    assert.equal(
      parseFileBrowserPreviewHeight("not-a-number"),
      FILE_BROWSER_PREVIEW_DEFAULT_HEIGHT,
    );
  });

  it("falls back when no preview height was saved", () => {
    assert.equal(
      parseFileBrowserPreviewHeight(null),
      FILE_BROWSER_PREVIEW_DEFAULT_HEIGHT,
    );
  });
});

describe("clampFileBrowserPreviewHeight", () => {
  it("keeps restored preview height inside the available file browser layout", () => {
    assert.equal(
      clampFileBrowserPreviewHeight(10_000, 640),
      640 - FILE_BROWSER_PREVIEW_MIN_LIST_HEIGHT,
    );
  });

  it("keeps restored preview height above the preview minimum", () => {
    assert.equal(
      clampFileBrowserPreviewHeight(1, 640),
      FILE_BROWSER_PREVIEW_MIN_HEIGHT,
    );
  });
});
