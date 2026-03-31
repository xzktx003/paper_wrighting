import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { buildDefaultSessionName } from "./session-naming.js";

describe("buildDefaultSessionName", () => {
  it("includes host, agent kind, and shell transport for direct mode", () => {
    const name = buildDefaultSessionName({
      hostLabel: "10.30.0.21",
      agentKind: "codex",
      launchMode: "direct",
    });

    assert.equal(name, "10.30.0.21_codex_shell");
  });

  it("uses tmux as the transport label for tmux mode", () => {
    const name = buildDefaultSessionName({
      hostLabel: "10.30.0.21",
      agentKind: "codex",
      launchMode: "tmux",
    });

    assert.equal(name, "10.30.0.21_codex_tmux");
  });

  it("adds a numeric suffix when the base name already exists", () => {
    const name = buildDefaultSessionName({
      hostLabel: "10.30.0.21",
      agentKind: "codex",
      launchMode: "tmux",
      existingNames: ["10.30.0.21_codex_tmux", "10.30.0.21_codex_tmux_2"],
    });

    assert.equal(name, "10.30.0.21_codex_tmux_3");
  });
});
