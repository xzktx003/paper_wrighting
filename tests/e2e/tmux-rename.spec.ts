import { execFileSync } from 'node:child_process';

import { expect, test, type APIRequestContext } from '@playwright/test';

import { resolveTmuxBinary } from './tmux-binary';

test.use({ ignoreHTTPSErrors: true });

const TMUX_BINARY = resolveTmuxBinary();
const backendBaseUrl = process.env.PLAYWRIGHT_BACKEND_URL ?? '';

function backendPath(pathname: string): string {
  if (!backendBaseUrl) {
    return pathname;
  }

  return new URL(pathname, backendBaseUrl).toString();
}

function runTmux(args: string[]): string {
  return execFileSync(TMUX_BINARY, args, {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore'],
  }).trim();
}

function killTmuxSession(sessionName: string): void {
  try {
    execFileSync(TMUX_BINARY, ['kill-session', '-t', sessionName], {
      stdio: 'ignore',
    });
  } catch {
    // ignore cleanup failures
  }
}

function firstPaneId(sessionName: string): string {
  return runTmux(['list-panes', '-t', sessionName, '-F', '#{pane_id}'])
    .split('\n')
    .find(Boolean) as string;
}

function paneFormat(paneId: string, format: string): string {
  return runTmux(['display-message', '-p', '-t', paneId, format]);
}

async function deleteSession(
  request: APIRequestContext,
  agentSessionId: string | undefined,
): Promise<void> {
  if (!agentSessionId) {
    return;
  }

  await request.delete(backendPath(`/api/agent-sessions/${agentSessionId}`));
}

test('renaming a tmux card also renames the tmux session and pane title', async ({
  page,
  request,
}) => {
  const sessionName = `e2e-tmux-rename-${Date.now()}`;
  const renamedSession = `${sessionName}-renamed`;
  let agentSessionId: string | undefined;

  killTmuxSession(sessionName);
  killTmuxSession(renamedSession);

  runTmux([
    'new-session',
    '-d',
    '-s',
    sessionName,
    '-c',
    process.cwd(),
    `sh -lc 'sleep 30'`,
  ]);

  const tmuxPane = firstPaneId(sessionName);

  try {
    const addResponse = await request.post(
      backendPath('/api/agent-discovery/tmux/add'),
      {
        data: {
          tmuxSession: sessionName,
          tmuxPane,
          displayName: sessionName,
          workingDirectory: process.cwd(),
          agentKind: 'shell',
        },
      },
    );

    expect(addResponse.ok()).toBeTruthy();
    const addedSession = (await addResponse.json()) as { id: string };
    agentSessionId = addedSession.id;

    await page.goto('/');

    const card = page.locator('.grid-card', {
      has: page.locator('.grid-card-name', { hasText: sessionName }),
    });
    await expect(card).toBeVisible();

    page.once('dialog', (dialog) => dialog.accept(renamedSession));
    await card.locator('.grid-card-rename').click();

    await expect(
      page.locator('.grid-card-name', { hasText: renamedSession }),
    ).toBeVisible();
    expect(paneFormat(tmuxPane, '#{session_name}')).toBe(renamedSession);
    expect(paneFormat(tmuxPane, '#{pane_title}')).toBe(renamedSession);
  } finally {
    await deleteSession(request, agentSessionId);
    killTmuxSession(sessionName);
    killTmuxSession(renamedSession);
  }
});
