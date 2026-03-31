import { expect, test, type Page } from "@playwright/test";

import type {
  AgentSessionRecord,
  LaunchLocalAgentInput,
  ListAgentSessionsResponse,
  ScanResult,
} from "@agent-orchestrator/shared";

function buildSnapshot(items: AgentSessionRecord[]): ListAgentSessionsResponse {
  return {
    items,
    activeAgentSessionId: null,
    updatedAt: new Date().toISOString(),
  };
}

function cloneSessions(items: AgentSessionRecord[]): AgentSessionRecord[] {
  return JSON.parse(JSON.stringify(items)) as AgentSessionRecord[];
}

async function installMockWebSocket(page: Page): Promise<void> {
  await page.addInitScript(() => {
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
          const event = new Event("open");
          this.dispatchEvent(event);
          this.onopen?.(event);
        });
      }

      send(_data?: unknown) {}

      close() {
        this.readyState = MockWebSocket.CLOSED;
        const event = new Event("close");
        this.dispatchEvent(event);
        this.onclose?.(event);
      }
    }

    Object.defineProperty(window, "WebSocket", {
      configurable: true,
      writable: true,
      value: MockWebSocket,
    });
  });
}

function makeSession(
  overrides: Partial<AgentSessionRecord>,
): AgentSessionRecord {
  return {
    id: "session-default",
    workspaceId: "default",
    sourceType: "local",
    agentKind: "copilot",
    displayName: "Default Session",
    workingDirectory: "/Users/hx/project",
    connectionState: "online",
    interactionState: "running",
    outputPreview: "ready",
    hostId: "local",
    ...overrides,
  };
}

async function mockAppDiscovery(
  page: Page,
  initialSessions: AgentSessionRecord[],
  scanResults: ScanResult[],
) {
  let sessions = cloneSessions(initialSessions);
  const launchBodies: LaunchLocalAgentInput[] = [];
  let scanCount = 0;

  await installMockWebSocket(page);

  await page.route("**/api/ssh-hosts", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ hosts: [] }),
    });
  });

  await page.route("**/api/agent-sessions", async (route) => {
    if (route.request().method() !== "GET") {
      await route.continue();
      return;
    }

    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify(buildSnapshot(sessions)),
    });
  });

  await page.route("**/api/agent-discovery/scan", async (route) => {
    scanCount += 1;
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        results: scanResults,
        scannedPath: "/Users/hx/projects",
        hostId: "local",
      }),
    });
  });

  await page.route("**/api/agent-launch/pty", async (route) => {
    const body = route.request().postDataJSON() as LaunchLocalAgentInput;
    launchBodies.push(body);

    const nextSession = makeSession({
      id: `added-${launchBodies.length}`,
      displayName: body.displayName,
      agentKind: body.agentKind,
      workingDirectory: body.workingDirectory,
      transportRef: body.tmuxSessionName
        ? { tmuxSession: body.tmuxSessionName }
        : undefined,
    });
    sessions = [...sessions, nextSession];

    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify(nextSession),
    });
  });

  return {
    getLaunchBodies: () => launchBodies,
    getScanCount: () => scanCount,
  };
}

async function openAppDiscovery(page: Page): Promise<void> {
  await page.goto("/");
  await page.getByTestId("btn-扫描会话").click();
  await page.locator(".host-dropdown-item", { hasText: "本机" }).click();
  await expect(page.locator(".discovery-dialog")).toBeVisible();
}

async function scanCurrentPath(page: Page): Promise<void> {
  await page.locator(".discovery-path-input").fill("/Users/hx/projects");
  await page.locator(".discovery-scan-btn").click();
}

test("app discovery can batch-add selected new scan results", async ({
  page,
}) => {
  const store = await mockAppDiscovery(
    page,
    [],
    [
      {
        agentKind: "copilot",
        status: "running",
        displayName: "Project Alpha",
        workingDirectory: "/Users/hx/projects/alpha",
      },
      {
        agentKind: "codex",
        status: "running",
        displayName: "Project Beta",
        workingDirectory: "/Users/hx/projects/beta",
      },
      {
        agentKind: "shell",
        status: "stopped",
        displayName: "Project Gamma",
        workingDirectory: "/Users/hx/projects/gamma",
      },
    ],
  );

  await openAppDiscovery(page);
  await scanCurrentPath(page);

  await expect.poll(store.getScanCount).toBe(1);
  await expect(page.locator(".discovery-item")).toHaveCount(3);

  await page.locator('.discovery-item input[type="checkbox"]').nth(0).check();
  await page.locator('.discovery-item input[type="checkbox"]').nth(2).check();

  await expect(page.locator(".discovery-count")).toContainText("已选 2 项");

  await page.locator(".discovery-add-selected-btn").click();

  await expect
    .poll(() => store.getLaunchBodies().map((item) => item.displayName))
    .toEqual(["Project Alpha", "Project Gamma"]);
});

test("app discovery can hide already joined results with the only-new filter", async ({
  page,
}) => {
  await mockAppDiscovery(
    page,
    [
      makeSession({
        id: "existing-alpha",
        displayName: "Existing Alpha",
        agentKind: "copilot",
        workingDirectory: "/Users/hx/projects/alpha",
      }),
    ],
    [
      {
        agentKind: "copilot",
        status: "running",
        displayName: "Project Alpha Scan",
        workingDirectory: "/Users/hx/projects/alpha",
      },
      {
        agentKind: "codex",
        status: "running",
        displayName: "Project Beta Scan",
        workingDirectory: "/Users/hx/projects/beta",
      },
    ],
  );

  await openAppDiscovery(page);
  await scanCurrentPath(page);

  await expect(page.locator(".discovery-item")).toHaveCount(2);
  await expect(page.getByRole("button", { name: "聚焦到宫格" })).toHaveCount(1);
  await expect(page.locator(".discovery-item-name")).toHaveText([
    "Project Alpha Scan",
    "Project Beta Scan",
  ]);

  await page.getByRole("checkbox", { name: "仅未加入" }).check();

  await expect(page.locator(".discovery-item")).toHaveCount(1);
  await expect(page.locator(".discovery-item-name")).toHaveText(
    "Project Beta Scan",
  );
  await expect(page.locator(".discovery-count")).toContainText("已选 0 项");
});
