import { expect, test, type APIRequestContext } from '@playwright/test';

declare const process: {
  cwd(): string;
};

async function findSessionByDisplayName(
  request: APIRequestContext,
  displayName: string,
) {
  const response = await request.get('/api/agent-sessions');
  expect(response.ok()).toBeTruthy();

  const payload = await response.json();
  return payload.items.find(
    (item: { id: string; displayName: string }) =>
      item.displayName === displayName,
  ) as { id: string; displayName: string } | undefined;
}

async function getSessionOutput(
  request: APIRequestContext,
  agentSessionId: string,
): Promise<string> {
  const response = await request.get(`/api/agent-sessions/${agentSessionId}`);
  expect(response.ok()).toBeTruthy();

  const payload = await response.json();
  return payload.outputEntries
    .map((entry: { text: string }) => entry.text)
    .join('\n');
}

test('browser: shell session launches an interactive shell instead of running a nonexistent shell binary', async ({
  page,
  request,
}) => {
  const displayName = `E2E Shell ${Date.now()}`;
  let sessionId: string | undefined;

  try {
    await page.goto('/');

    await page.getByTestId('new-session-toggle').click();
    await page.getByTestId('new-session-name').fill(displayName);
    await page.getByTestId('new-session-kind').selectOption('shell');
    await page.getByTestId('new-session-mode').selectOption('direct');
    await page.getByTestId('new-session-dir').fill(process.cwd());
    await page.getByTestId('create-session').click();

    const shellCard = page.locator('.grid-card', {
      has: page.locator('.grid-card-name', { hasText: displayName }),
    });
    await expect(shellCard).toBeVisible({ timeout: 15000 });

    await expect
      .poll(async () => findSessionByDisplayName(request, displayName), {
        timeout: 15000,
      })
      .toBeTruthy();

    sessionId = (await findSessionByDisplayName(request, displayName))?.id;
    expect(sessionId).toBeTruthy();

    const marker = `__E2E_SHELL_OK_${Date.now()}__`;
    const stdinResponse = await request.post(
      `/api/agent-sessions/${sessionId}/stdin`,
      {
        data: {
          input: `printf '${marker}\\n'`,
        },
      },
    );
    expect(stdinResponse.ok()).toBeTruthy();

    await expect
      .poll(async () => getSessionOutput(request, sessionId!), {
        timeout: 15000,
      })
      .toContain(marker);

    expect(await getSessionOutput(request, sessionId!)).not.toContain(
      'command not found: shell',
    );
  } finally {
    if (sessionId) {
      await request.delete(`/api/agent-sessions/${sessionId}`);
    }
  }
});
