import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { SidePanelView } from "./SidePanelView.js";

describe("SidePanelView", () => {
  it("keeps preserved inactive panels mounted while marking them hidden", () => {
    const markup = renderToStaticMarkup(
      createElement(SidePanelView, {
        active: false,
        children: createElement("span", null, "panel"),
        preserveMountedWhenInactive: true,
      }),
    );

    assert.match(markup, /class="side-panel-view side-panel-view--preserved"/);
    assert.match(markup, /aria-hidden="true"/);
    assert.match(markup, /inert=""/);
  });
});
