import { execFileSync } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';

import { chromium } from '@playwright/test';

const baseUrl = process.env.README_BASE_URL ?? 'http://127.0.0.1:3000';
const apiBaseUrl = process.env.README_API_URL ?? 'http://127.0.0.1:4000';
const outputDir = path.resolve(process.cwd(), 'docs/readme-assets');
const tmuxBinary =
  process.platform === 'darwin' ? '/opt/homebrew/bin/tmux' : 'tmux';

const demoSessions = [
  {
    displayName: 'README Copilot Demo',
    agentKind: 'copilot',
    command: 'node ./scripts/mock-terminal-agent.mjs scroll',
    workingDirectory: process.cwd(),
  },
  {
    displayName: 'README Awaiting Demo',
    agentKind: 'copilot',
    command: 'node ./scripts/mock-agent.mjs',
    workingDirectory: process.cwd(),
  },
  {
    displayName: 'README Tmux Demo',
    agentKind: 'shell',
    command: `tmux new-session -A -s readme-demo`,
    workingDirectory: process.cwd(),
    tmuxSessionName: 'readme-demo',
  },
];

function runTmux(args) {
  return execFileSync(tmuxBinary, args, {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore'],
  }).trim();
}

function killTmuxSession(sessionName) {
  try {
    runTmux(['kill-session', '-t', sessionName]);
  } catch {
    // ignore cleanup failures
  }
}

async function requestJson(pathname, init) {
  const headers = { ...(init?.headers ?? {}) };
  if (init?.body && !headers['content-type']) {
    headers['content-type'] = 'application/json';
  }

  const response = await fetch(`${apiBaseUrl}${pathname}`, {
    headers,
    ...init,
  });

  if (!response.ok) {
    throw new Error(`${pathname} failed: ${response.status}`);
  }

  if (response.status === 204) {
    return null;
  }

  return response.json();
}

async function listSessions() {
  const payload = await requestJson('/api/agent-sessions');
  return payload.items;
}

async function deleteSessionByDisplayName(displayName) {
  const sessions = await listSessions();
  const target = sessions.find((session) => session.displayName === displayName);

  if (!target) {
    return;
  }

  await requestJson(`/api/agent-sessions/${target.id}`, {
    method: 'DELETE',
  });
}

async function ensureDemoSessions() {
  for (const session of demoSessions) {
    await deleteSessionByDisplayName(session.displayName);
  }

  killTmuxSession('readme-demo');

  for (const session of demoSessions) {
    await requestJson('/api/agent-launch/pty', {
      method: 'POST',
      body: JSON.stringify({
        workspaceId: 'default',
        ...session,
      }),
    });
  }

  const deadline = Date.now() + 20_000;
  while (Date.now() < deadline) {
    const sessions = await listSessions();
    const ready = demoSessions.every((session) =>
      sessions.some((item) => item.displayName === session.displayName),
    );

    if (ready) {
      return;
    }

    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  throw new Error('demo sessions did not appear in time');
}

async function cleanupDemoSessions() {
  for (const session of demoSessions) {
    try {
      await deleteSessionByDisplayName(session.displayName);
    } catch {
      // ignore cleanup failures
    }
  }

  killTmuxSession('readme-demo');
}

async function main() {
  await mkdir(outputDir, { recursive: true });
  await ensureDemoSessions();

  const sshHostsPayload = await requestJson('/api/ssh-hosts');
  const preferredHost = sshHostsPayload.hosts.find((host) => host.name === 'hm24');

  let browser;

  try {
    browser = await chromium.launch({ headless: true });
    const page = await browser.newPage({ viewport: { width: 1600, height: 1100 } });

    await page.goto(baseUrl, { waitUntil: 'networkidle' });
    await page.waitForSelector('.grid-card');
    await page.waitForTimeout(12_000);

    await page.screenshot({
      path: path.join(outputDir, 'board-overview.png'),
      fullPage: true,
    });

    const copilotCard = page.locator('.grid-card', {
      has: page.locator('.grid-card-name', { hasText: 'README Copilot Demo' }),
    });
    await copilotCard.dblclick();
    await page.waitForSelector('.focus-main');
    await page.waitForTimeout(800);
    await page.screenshot({
      path: path.join(outputDir, 'focus-view.png'),
      fullPage: true,
    });

    await page.getByRole('button', { name: '返回宫格' }).click();
    await page.waitForSelector('.grid-card');

    await page.getByRole('button', { name: /快速连接 tmux/ }).click();
    await page.waitForSelector('[data-testid="quick-tmux-connect-dialog"]');

    const hostSearch = page.getByTestId('quick-tmux-host-search');
    if (preferredHost) {
      await hostSearch.fill(preferredHost.name);
      await page.keyboard.press('Enter');
      await page.waitForSelector('[data-testid="quick-tmux-session-name"]');
      await page.getByTestId('quick-tmux-session-name').fill('demo-docs-tmux');
      await page.getByTestId('quick-tmux-working-directory').fill('~/');
    } else {
      await hostSearch.fill('ssh host');
    }

    await page.screenshot({
      path: path.join(outputDir, 'quick-tmux-connect.png'),
      fullPage: true,
    });
  } finally {
    await browser?.close().catch(() => {});
    await cleanupDemoSessions();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});