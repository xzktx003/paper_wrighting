import { expect, test, type Page } from "@playwright/test";

import type {
  AgentSessionRecord,
  ListAgentSessionsResponse,
  UpdateAgentSessionInput,
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

async function mockSessionGrid(
  page: Page,
  initialSessions: AgentSessionRecord[],
) {
  let sessions = cloneSessions(initialSessions);
  const patchCalls: Array<{ id: string; body: UpdateAgentSessionInput }> = [];
  const hideCalls: string[] = [];
  const deleteCalls: string[] = [];
  const killCalls: string[] = [];

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

  await page.route("**/api/agent-sessions/*", async (route) => {
    if (route.request().method() !== "DELETE") {
      await route.fallback();
      return;
    }

    const parts = new URL(route.request().url()).pathname.split("/");
    const id = parts.at(-1) ?? "";

    deleteCalls.push(id);
    sessions = sessions.filter((item) => item.id !== id);

    await route.fulfill({ status: 204, body: "" });
  });

  await page.route("**/api/agent-sessions/*/tmux/kill", async (route) => {
    const parts = new URL(route.request().url()).pathname.split("/");
    const id = parts.at(-3) ?? "";

    killCalls.push(id);
    sessions = sessions.map((item) =>
      item.id === id
        ? {
            ...item,
            interactionState: "exited",
            connectionState: "offline",
          }
        : item,
    );

    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ ok: true }),
    });
  });

  await page.route("**/api/agent-sessions/*", async (route) => {
    if (route.request().method() !== "PATCH") {
      await route.fallback();
      return;
    }

    const parts = new URL(route.request().url()).pathname.split("/");
    const id = parts.at(-1) ?? "";
    const body = route.request().postDataJSON() as UpdateAgentSessionInput;

    patchCalls.push({ id, body });
    if (body.hidden !== undefined) {
      hideCalls.push(id);
      sessions = sessions.map((item) =>
        item.id === id ? { ...item, hidden: body.hidden } : item,
      );
    }
    if (body.displayName !== undefined) {
      sessions = sessions.map((item) =>
        item.id === id ? { ...item, displayName: body.displayName } : item,
      );
    }

    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify(
        sessions.find((item) => item.id === id) ?? sessions[0] ?? {},
      ),
    });
  });

  return {
    getSessions: () => sessions,
    patchCalls,
    hideCalls,
    deleteCalls,
    killCalls,
  };
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
    ...overrides,
  };
}

test("filter bar narrows sessions by host, kind, transport, and directory, then reset restores all cards", async ({
  page,
}) => {
  await mockSessionGrid(page, [
    makeSession({
      id: "local-copilot",
      displayName: "Local Copilot",
      hostId: "local",
      agentKind: "copilot",
      workingDirectory: "/Users/hx/project-alpha",
    }),
    makeSession({
      id: "remote-codex-tmux",
      sourceType: "remote-connect",
      displayName: "Remote Codex Tmux",
      hostId: "hm15",
      agentKind: "codex",
      workingDirectory: "/data01/home/houmo/project-beta",
      transportRef: { tmuxSession: "remote-codex-tmux" },
    }),
    makeSession({
      id: "remote-shell-direct",
      sourceType: "remote-connect",
      displayName: "Remote Shell Direct",
      hostId: "hm15",
      agentKind: "shell",
      interactionState: "idle",
      workingDirectory: "/data01/home/houmo/scripts",
    }),
  ]);

  await page.goto("/");

  await expect(page.locator(".grid-card")).toHaveCount(3);

  await page.getByRole("combobox", { name: "服务器" }).selectOption("hm15");
  await expect(page.locator(".grid-card")).toHaveCount(2);

  await page.getByRole("combobox", { name: "类型" }).selectOption("codex");
  await expect(page.locator(".grid-card")).toHaveCount(1);
  await expect(page.locator(".grid-card-name")).toHaveText("Remote Codex Tmux");

  await page.getByRole("combobox", { name: "类别" }).selectOption("tmux");
  await expect(page.locator(".grid-card")).toHaveCount(1);

  await page.getByRole("button", { name: "重置筛选" }).click();
  await expect(page.locator(".grid-card")).toHaveCount(3);

  await page.getByRole("textbox", { name: "目录" }).fill("scripts");
  await expect(page.locator(".grid-card")).toHaveCount(1);
  await expect(page.locator(".grid-card-name")).toHaveText(
    "Remote Shell Direct",
  );
});

test("filter bar shows empty-state guidance when no session matches and reset recovers the grid", async ({
  page,
}) => {
  await mockSessionGrid(page, [
    makeSession({
      id: "only-session",
      displayName: "Only Session",
      hostId: "local",
      workingDirectory: "/Users/hx/kanban",
    }),
  ]);

  await page.goto("/");

  await page.getByRole("textbox", { name: "目录" }).fill("does-not-exist");

  await expect(page.locator(".grid-card")).toHaveCount(0);
  await expect(page.locator(".grid-empty")).toContainText(
    "没有匹配的会话，试试调整筛选条件",
  );

  await page.getByRole("button", { name: "重置筛选" }).click();
  await expect(page.locator(".grid-card")).toHaveCount(1);
  await expect(page.locator(".grid-card-name")).toHaveText("Only Session");
});

test("hide button hides the card and hidden count shows in toolbar", async ({
  page,
}) => {
  const store = await mockSessionGrid(page, [
    makeSession({
      id: "tmux-session",
      sourceType: "remote-connect",
      displayName: "Tmux Session",
      hostId: "hm15",
      transportRef: { tmuxSession: "tmux-session" },
    }),
    makeSession({
      id: "plain-session",
      displayName: "Plain Session",
      hostId: "local",
    }),
  ]);

  await page.goto("/");
  await expect(page.locator(".grid-card")).toHaveCount(2);

  const tmuxCard = page.locator(".grid-card", {
    has: page.locator(".grid-card-name", { hasText: "Tmux Session" }),
  });

  await tmuxCard.locator(".grid-card-hide").click();

  expect(store.hideCalls).toEqual(["tmux-session"]);

  // After hiding, only the non-hidden session remains visible
  await expect(page.locator(".grid-card")).toHaveCount(1);
  await expect(page.locator(".grid-card-name")).toHaveText("Plain Session");
});

test("tmux card kill button terminates the session then close removes it", async ({
  page,
}) => {
  const store = await mockSessionGrid(page, [
    makeSession({
      id: "tmux-session",
      sourceType: "remote-connect",
      displayName: "Tmux Session",
      hostId: "hm15",
      transportRef: { tmuxSession: "tmux-session" },
    }),
    makeSession({
      id: "plain-session",
      displayName: "Plain Session",
      hostId: "local",
    }),
  ]);

  await page.goto("/");

  const tmuxCard = page.locator(".grid-card", {
    has: page.locator(".grid-card-name", { hasText: "Tmux Session" }),
  });

  // Kill tmux via 🗑 button (with confirmation)
  let confirmMessage = "";
  page.once("dialog", async (dialog) => {
    confirmMessage = dialog.message();
    await dialog.accept();
  });
  await tmuxCard.locator(".grid-card-kill-tmux").click();

  await expect(tmuxCard.locator(".grid-card-badge")).toHaveText("已退出");
  expect(confirmMessage).toContain("确定要终止此 tmux 会话吗");
  expect(store.killCalls).toEqual(["tmux-session"]);

  // Close (×) removes the card via DELETE
  await tmuxCard.locator(".grid-card-close").click();

  await expect(page.locator(".grid-card")).toHaveCount(1);
  await expect(page.locator(".grid-card-name")).toHaveText("Plain Session");
  expect(store.deleteCalls).toEqual(["tmux-session"]);
});

test("hidden sessions drawer opens and Escape key closes it", async ({
  page,
}) => {
  await mockSessionGrid(page, [
    makeSession({
      id: "visible-session",
      displayName: "Visible Session",
      hostId: "local",
    }),
    makeSession({
      id: "hidden-session",
      displayName: "Hidden Session",
      hostId: "local",
      hidden: true,
      interactionState: "exited",
    }),
  ]);

  await page.goto("/");

  // Only non-hidden session visible in grid
  await expect(page.locator(".grid-card")).toHaveCount(1);

  // "已隐藏 (1)" button should appear
  const hiddenBtn = page.locator(".hidden-sessions-btn");
  await expect(hiddenBtn).toBeVisible();
  await expect(hiddenBtn).toContainText("已隐藏 (1)");

  // Open drawer
  await hiddenBtn.click();
  await expect(page.locator(".hidden-drawer")).toBeVisible();
  await expect(page.locator(".hidden-drawer-name")).toHaveText(
    "Hidden Session",
  );

  // Press Escape to close drawer
  await page.keyboard.press("Escape");
  await expect(page.locator(".hidden-drawer")).not.toBeVisible();
});

test("hidden sessions drawer delete button confirms before closing running session", async ({
  page,
}) => {
  const store = await mockSessionGrid(page, [
    makeSession({
      id: "visible-session",
      displayName: "Visible Session",
      hostId: "local",
    }),
    makeSession({
      id: "hidden-running",
      displayName: "Hidden Running",
      hostId: "local",
      hidden: true,
      interactionState: "running",
    }),
    makeSession({
      id: "hidden-exited",
      displayName: "Hidden Exited",
      hostId: "local",
      hidden: true,
      interactionState: "exited",
    }),
  ]);

  await page.goto("/");

  // Open drawer
  await page.locator(".hidden-sessions-btn").click();
  await expect(page.locator(".hidden-drawer")).toBeVisible();
  await expect(page.locator(".hidden-drawer-item")).toHaveCount(2);

  // Click "关闭" on the running session — should prompt confirmation
  let confirmMessage = "";
  page.once("dialog", async (dialog) => {
    confirmMessage = dialog.message();
    await dialog.dismiss(); // User cancels
  });

  const runningItem = page.locator(".hidden-drawer-item", {
    has: page.locator(".hidden-drawer-name", { hasText: "Hidden Running" }),
  });
  await runningItem.locator(".btn-danger").click();

  // Confirm was shown and user cancelled — no delete should happen
  expect(confirmMessage).toBeTruthy();
  expect(store.deleteCalls).toEqual([]);

  // Now click "关闭" on the exited session — should NOT prompt
  const exitedItem = page.locator(".hidden-drawer-item", {
    has: page.locator(".hidden-drawer-name", { hasText: "Hidden Exited" }),
  });
  await exitedItem.locator(".btn-danger").click();

  // Exited session should be deleted without confirmation
  expect(store.deleteCalls).toEqual(["hidden-exited"]);
});
