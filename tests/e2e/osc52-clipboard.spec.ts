import { expect, test, type BrowserContext, type Page } from "@playwright/test";

import type {
  AgentSessionRecord,
  ListAgentSessionsResponse,
} from "@agent-orchestrator/shared";

test.use({ ignoreHTTPSErrors: true });

function makeSession(
  overrides: Partial<AgentSessionRecord>,
): AgentSessionRecord {
  return {
    id: "osc52-session",
    workspaceId: "default",
    sourceType: "local",
    agentKind: "codex",
    displayName: "OSC52 Session",
    workingDirectory: process.cwd(),
    connectionState: "online",
    interactionState: "running",
    outputPreview: "ready",
    ...overrides,
  };
}

function buildSnapshot(items: AgentSessionRecord[]): ListAgentSessionsResponse {
  return {
    items,
    activeAgentSessionId: items[0]?.id ?? null,
    updatedAt: new Date().toISOString(),
  };
}

async function grantClipboardPermissions(context: BrowserContext) {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
}

async function installOsc52TerminalMock(page: Page, clipboardText: string) {
  await page.addInitScript((nextClipboardText) => {
    const encoded = btoa(
      String.fromCodePoint(...new TextEncoder().encode(nextClipboardText)),
    );
    const osc52 = `\u001b]52;c;${encoded}\u0007`;

    class MockWebSocket extends EventTarget {
      static CONNECTING = 0;
      static OPEN = 1;
      static CLOSING = 2;
      static CLOSED = 3;

      url: string;
      readyState = MockWebSocket.OPEN;
      bufferedAmount = 0;
      extensions = "";
      protocol = "";
      binaryType: BinaryType = "blob";
      onopen: ((event: Event) => void) | null = null;
      onerror: ((event: Event) => void) | null = null;
      onclose: ((event: Event) => void) | null = null;
      onmessage: ((event: MessageEvent) => void) | null = null;

      constructor(url: string | URL) {
        super();
        this.url = String(url);

        queueMicrotask(() => {
          const openEvent = new Event("open");
          this.dispatchEvent(openEvent);
          this.onopen?.(openEvent);

          if (!this.url.includes("/terminal")) {
            return;
          }

          const oscEvent = new MessageEvent("message", { data: osc52 });
          this.dispatchEvent(oscEvent);
          this.onmessage?.(oscEvent);

          const replayCompleteEvent = new MessageEvent("message", {
            data: JSON.stringify({
              __agentOrchestrator: "terminal-control",
              event: "replay-complete",
            }),
          });
          this.dispatchEvent(replayCompleteEvent);
          this.onmessage?.(replayCompleteEvent);
        });
      }

      send(_data?: unknown) {}

      close() {
        this.readyState = MockWebSocket.CLOSED;
        const closeEvent = new CloseEvent("close");
        this.dispatchEvent(closeEvent);
        this.onclose?.(closeEvent);
      }
    }

    window.WebSocket = MockWebSocket as unknown as typeof WebSocket;
    localStorage.clear();
  }, clipboardText);
}

async function mockSessions(page: Page, sessions: AgentSessionRecord[]) {
  await page.route("**/api/ssh-hosts", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ hosts: [] }),
    });
  });

  await page.route("**/api/agent-sessions", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify(buildSnapshot(sessions)),
    });
  });
}

test("OSC 52 clipboard requests from the terminal write to the browser clipboard", async ({
  context,
  page,
}) => {
  const clipboardText = `osc52-copy-${Date.now()}`;
  await grantClipboardPermissions(context);
  await installOsc52TerminalMock(page, clipboardText);
  await mockSessions(page, [makeSession({ id: "osc52-session" })]);

  await page.goto("/");
  await page.locator(".grid-card", { hasText: "OSC52 Session" }).dblclick();
  await expect(page.locator(".terminal-view .xterm")).toBeVisible();

  await expect
    .poll(() => page.evaluate(() => navigator.clipboard.readText()))
    .toBe(clipboardText);
});
