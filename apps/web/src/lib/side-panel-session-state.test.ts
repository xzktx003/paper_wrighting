import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  parseInitialSidePanelTool,
  parseSidePanelSessionStates,
} from "./side-panel-session-state.js";

describe("parseSidePanelSessionStates", () => {
  it("restores valid cached ssh selected hosts", () => {
    const state = parseSidePanelSessionStates(
      JSON.stringify({
        sessionA: {
          selectedHost: {
            type: "ssh",
            preset: {
              name: "gpu",
              host: "10.30.0.22",
              port: 22,
              username: "dev",
              identityFile: "~/.ssh/id_ed25519",
              defaultPath: "~/workspace",
            },
          },
        },
      }),
    );

    assert.deepEqual(state.sessionA, {
      selectedHost: {
        type: "ssh",
        preset: {
          name: "gpu",
          host: "10.30.0.22",
          port: 22,
          username: "dev",
          identityFile: "~/.ssh/id_ed25519",
          defaultPath: "~/workspace",
        },
      },
    });
  });

  it("falls back to local when cached ssh preset is malformed", () => {
    const state = parseSidePanelSessionStates(
      JSON.stringify({
        sessionA: {
          selectedHost: {
            type: "ssh",
            preset: {
              name: "gpu",
              host: 123,
              port: "22",
              defaultPath: null,
            },
          },
        },
      }),
    );

    assert.deepEqual(state.sessionA, {
      selectedHost: { type: "local" },
    });
  });

  it("falls back to local when cached ssh preset contains control characters", () => {
    const state = parseSidePanelSessionStates(
      JSON.stringify({
        sessionA: {
          selectedHost: {
            type: "ssh",
            preset: {
              name: "gpu",
              host: "example.test\n-oProxyCommand=sh",
              port: 22,
              username: "dev",
              identityFile: "~/.ssh/id_ed25519",
              defaultPath: "~/workspace",
            },
          },
        },
        sessionB: {
          selectedHost: {
            type: "ssh",
            preset: {
              name: "gpu",
              host: "example.test",
              port: 22,
              username: "dev\ruser",
              defaultPath: "~/workspace",
            },
          },
        },
      }),
    );

    assert.deepEqual(state.sessionA, {
      selectedHost: { type: "local" },
    });
    assert.deepEqual(state.sessionB, {
      selectedHost: { type: "local" },
    });
  });

  it("falls back to empty state on malformed JSON", () => {
    assert.deepEqual(parseSidePanelSessionStates("{not-json"), {});
  });

  it("does not restore legacy activeTool as an initially open side panel", () => {
    assert.equal(
      parseInitialSidePanelTool(
        JSON.stringify({
          sessionA: {
            activeTool: "files",
            selectedHost: { type: "local" },
          },
        }),
        "sessionA",
      ),
      null,
    );
  });
});
