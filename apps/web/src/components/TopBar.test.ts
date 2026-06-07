import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import type { AgentSessionRecord } from "@agent-orchestrator/shared";

import { TopBar } from "./TopBar.js";

function installDocumentStub() {
  Object.defineProperty(globalThis, "document", {
    configurable: true,
    value: {
      fullscreenElement: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      documentElement: {
        requestFullscreen: () => Promise.resolve(),
      },
      exitFullscreen: () => Promise.resolve(),
    },
  });
}

function makeSession(id: string): AgentSessionRecord {
  return {
    id,
    workspaceId: "default",
    sourceType: "local",
    agentKind: "codex",
    displayName: id,
    connectionState: "online",
    interactionState: "running",
  };
}

function renderTopBar() {
  installDocumentStub();

  return renderToStaticMarkup(
    createElement(TopBar, {
      sessions: [makeSession("alpha"), makeSession("beta")],
      collapsed: false,
      sshHosts: [],
      fileBrowserAvailable: true,
      fileBrowserOpen: false,
      vscodeAvailable: true,
      vscodeOpen: false,
      vscodeIframeCacheMode: "memory-saving",
      vscodeCacheReleaseAvailable: false,
      useLightweightTerminalPreview: true,
      onToggleCollapsed: () => {},
      onToggleFileBrowser: () => {},
      onToggleVsCode: () => {},
      onToggleVsCodeIframeCacheMode: () => {},
      onReleaseVsCodeIframeCache: () => {},
      onToggleTerminalPreviewMode: () => {},
      onOpenNewSession: () => {},
      onScanTmux: () => {},
      onScanApps: () => {},
    }),
  );
}

describe("TopBar", () => {
  it("keeps only grouped high-level actions visible by default", () => {
    const markup = renderTopBar();

    assert.match(markup, /Coding Kanban/);
    assert.match(markup, /共 <strong>2<\/strong> 个会话/);
    assert.match(markup, /data-testid="new-session-toggle"/);
    assert.match(markup, /data-testid="scan-menu-toggle"/);
    assert.match(markup, /data-testid="display-menu-toggle"/);
    assert.match(markup, /data-testid="tools-menu-toggle"/);
    assert.match(markup, /data-testid="file-browser-toggle"/);
    assert.match(markup, /data-testid="vscode-toggle"/);
    assert.doesNotMatch(markup, /VS Code 省内存/);
    assert.doesNotMatch(markup, /释放 VS Code 缓存/);
    assert.doesNotMatch(markup, />资源诊断</);
    assert.doesNotMatch(markup, />手机端</);
    assert.doesNotMatch(markup, />轻量预览：开</);
  });
});
