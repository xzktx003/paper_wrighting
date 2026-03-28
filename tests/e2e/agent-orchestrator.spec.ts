import { expect, test } from '@playwright/test';

test('v2: 启动 PTY Agent 并在宫格中显示', async ({ page }) => {
  await page.goto('/');

  // 等待页面加载完成
  await expect(page.locator('.top-bar-title')).toContainText(
    'Agent 控制台',
  );

  // 点击启动 tab
  await page.locator('.drawer-tab').filter({ hasText: '启动' }).click();

  // 填写启动表单
  await page
    .locator('.drawer-section input')
    .nth(0)
    .fill('测试终端-E2E');
  await page
    .locator('.drawer-section input')
    .nth(1)
    .fill('echo HELLO_E2E_TEST && sleep 5');
  await page
    .locator('.drawer-section input')
    .nth(2)
    .fill('shell');

  // 点击启动按钮
  await page.locator('.drawer-btn.primary').first().click();

  // 等待宫格卡片出现
  const myCard = page.locator('.grid-card', {
    has: page.locator('.grid-card-name', { hasText: '测试终端-E2E' }),
  });
  await expect(myCard.first()).toBeVisible({
    timeout: 10000,
  });

  // 验证卡片名称
  await expect(
    myCard.first().locator('.grid-card-name'),
  ).toContainText('测试终端-E2E');
});

test('v2: 双击放大终端并可交互', async ({ page }) => {
  await page.goto('/');

  // 先启动一个 agent
  await page.locator('.drawer-tab').filter({ hasText: '启动' }).click();
  await page
    .locator('.drawer-section input')
    .nth(0)
    .fill('交互测试');
  await page
    .locator('.drawer-section input')
    .nth(1)
    .fill('echo 准备就绪');
  await page
    .locator('.drawer-section input')
    .nth(2)
    .fill('shell');
  await page.locator('.drawer-btn.primary').first().click();

  // 等待卡片出现
  const myCard = page.locator('.grid-card', {
    has: page.locator('.grid-card-name', { hasText: '交互测试' }),
  });
  await expect(myCard.first()).toBeVisible({
    timeout: 10000,
  });

  // 找到刚刚启动的卡片并双击
  const targetCard = page.locator('.grid-card', {
    has: page.locator('.grid-card-name', { hasText: '交互测试' }),
  });
  await targetCard.first().dblclick();

  // 验证进入放大视图
  await expect(page.locator('.focus-main')).toBeVisible({
    timeout: 5000,
  });
  await expect(page.locator('.focus-main-name')).toContainText(
    '交互测试',
  );

  // 验证返回按钮
  await expect(
    page.locator('.focus-exit-btn'),
  ).toContainText('返回宫格');

  // 点击返回
  await page.locator('.focus-exit-btn').click();

  // 验证回到宫格视图
  await expect(page.locator('.grid-card').first()).toBeVisible();
  await expect(page.locator('.focus-main')).not.toBeVisible();
});

test('v2: 扫描本地目录', async ({ page }) => {
  await page.goto('/');

  // 切换到扫描 tab
  await page.locator('.drawer-tab').filter({ hasText: '扫描' }).click();

  // 输入项目路径
  await page
    .locator('.drawer-section input')
    .first()
    .fill(process.cwd());

  // 点击扫描
  await page.locator('.drawer-btn.primary').first().click();

  // 等待扫描完成
  await expect(page.locator('.drawer-message')).toContainText(
    '扫描完成',
    { timeout: 10000 },
  );
});

test('v2: 侧边栏收起和展开', async ({ page }) => {
  await page.goto('/');

  // 验证侧边栏默认展开
  await expect(page.locator('.side-drawer')).toBeVisible();

  // 点击收起
  await page.locator('.drawer-toggle').click();

  // 验证侧边栏隐藏
  await expect(page.locator('.side-drawer')).not.toBeVisible();

  // 点击展开
  await page.locator('.drawer-toggle').click();

  // 验证侧边栏显示
  await expect(page.locator('.side-drawer')).toBeVisible();
});

test('v2: 顶栏显示会话统计', async ({ page }) => {
  await page.goto('/');

  // 验证顶栏
  await expect(page.locator('.top-bar-title')).toContainText(
    'Agent 控制台',
  );

  // 记录当前会话数
  const statsText = await page
    .locator('.stat-item')
    .first()
    .textContent();
  const currentCount = parseInt(
    statsText?.match(/共 (\d+) 个会话/)?.[1] ?? '0',
    10,
  );

  // 启动一个 agent
  await page.locator('.drawer-tab').filter({ hasText: '启动' }).click();
  await page
    .locator('.drawer-section input')
    .nth(0)
    .fill('统计测试');
  await page
    .locator('.drawer-section input')
    .nth(1)
    .fill('sleep 30');
  await page
    .locator('.drawer-section input')
    .nth(2)
    .fill('shell');
  await page.locator('.drawer-btn.primary').first().click();

  // 等待统计增加
  await expect(page.locator('.stat-item').first()).toContainText(
    `共 ${currentCount + 1} 个会话`,
    { timeout: 10000 },
  );
});