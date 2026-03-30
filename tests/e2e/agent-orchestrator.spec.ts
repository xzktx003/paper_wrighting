import { expect, test, type APIRequestContext } from '@playwright/test';

declare const process: {
  cwd(): string;
};

async function launchMockSession(
  request: APIRequestContext,
  displayName: string,
): Promise<string> {
  const response = await request.post('/api/agent-launch/pty', {
    data: {
      workspaceId: 'default',
      displayName,
      agentKind: 'copilot',
      command: 'node ./scripts/mock-terminal-agent.mjs scroll',
      workingDirectory: process.cwd(),
    },
  });

  expect(response.ok()).toBeTruthy();
  return (await response.json()).id;
}

async function deleteSessionIfPresent(
  request: APIRequestContext,
  agentSessionId?: string,
): Promise<void> {
  if (!agentSessionId) {
    return;
  }

  await request.delete(`/api/agent-sessions/${agentSessionId}`);
}

test('v2: 启动 PTY Agent 并在宫格中显示', async ({ page, request }) => {
  const displayName = `测试终端-E2E-${Date.now()}`;
  let sessionId: string | undefined;

  try {
    sessionId = await launchMockSession(request, displayName);

    await page.goto('/');
    await expect(page.locator('.top-bar-title')).toContainText('Agent 控制台');

    const myCard = page.locator('.grid-card', {
      has: page.locator('.grid-card-name', { hasText: displayName }),
    });
    await expect(myCard).toBeVisible({ timeout: 15000 });
    await expect(myCard.locator('.grid-card-name')).toContainText(displayName);
  } finally {
    await deleteSessionIfPresent(request, sessionId);
  }
});

test('v2: 双击放大终端并可交互', async ({ page, request }) => {
  const displayName = `交互测试-${Date.now()}`;
  let sessionId: string | undefined;

  try {
    sessionId = await launchMockSession(request, displayName);

    await page.goto('/');

    const targetCard = page.locator('.grid-card', {
      has: page.locator('.grid-card-name', { hasText: displayName }),
    });
    await expect(targetCard).toBeVisible({ timeout: 15000 });
    await targetCard.dblclick();

    await expect(page.locator('.focus-main')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('.focus-main-name')).toContainText(displayName);
    await expect(page.locator('.focus-exit-btn')).toContainText('返回宫格');

    await page.locator('.focus-exit-btn').click();

    await expect(page.locator('.focus-main')).not.toBeVisible();
    await expect(targetCard).toBeVisible();
  } finally {
    await deleteSessionIfPresent(request, sessionId);
  }
});

test('v2: 扫描本地目录', async ({ page }) => {
  await page.goto('/');

  await page.getByTestId('scan-path-input').fill(process.cwd());
  await page.getByTestId('scan-button').click();

  await expect(page.locator('.drawer-message')).toContainText('扫描完成', {
    timeout: 15000,
  });
});

test('v2: 侧边栏收起和展开', async ({ page }) => {
  await page.goto('/');

  await expect(page.locator('.side-drawer')).toBeVisible();

  await page.locator('.drawer-toggle').click();
  await expect(page.locator('.side-drawer')).not.toBeVisible();

  await page.locator('.drawer-toggle').click();
  await expect(page.locator('.side-drawer')).toBeVisible();
});

test('v2: 顶栏显示会话统计', async ({ page, request }) => {
  const displayName = `统计测试-${Date.now()}`;
  let sessionId: string | undefined;

  try {
    await page.goto('/');
    await expect(page.locator('.top-bar-title')).toContainText('Agent 控制台');

    const statsText = await page.locator('.stat-item').first().textContent();
    const currentCount = parseInt(
      statsText?.match(/共 (\d+) 个会话/)?.[1] ?? '0',
      10,
    );

    sessionId = await launchMockSession(request, displayName);

    await expect(page.locator('.stat-item').first()).toContainText(
      `共 ${currentCount + 1} 个会话`,
      { timeout: 15000 },
    );
  } finally {
    await deleteSessionIfPresent(request, sessionId);
  }
});