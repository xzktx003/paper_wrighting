import { chromium, request } from 'playwright';
import { promises as fs } from 'fs';
import path from 'path';

const BASE = process.env.PAPER_WRITER_URL || 'http://10.30.0.22:8787';
const DATA_DIR = '/data01/home/xuzk/workspace/ai_agent/paper_wrighting/papers';
const CHROMIUM_PATH = '/data01/home/xuzk/.cache/ms-playwright/chromium-1217/chrome-linux64/chrome';

const projectName = `Playwright missing-meta delete ${Date.now()}`;
let project;
let browser;

async function deleteWithPlaywrightRequest(projectDir) {
  const context = await request.newContext({ baseURL: BASE });
  try {
    await fs.rm(path.join(projectDir, 'project.json'), { force: true });
    console.log(`removed metadata for ${project.id}`);
    const deleteResponse = await context.delete(`/api/projects/${project.id}`);
    const deleteBody = await deleteResponse.text();
    console.log(`delete response: ${deleteResponse.status()} ${deleteBody}`);
    if (deleteResponse.status() !== 200) {
      throw new Error(`expected delete status 200, got ${deleteResponse.status()}`);
    }
    const meta = JSON.parse(await fs.readFile(path.join(projectDir, 'project.json'), 'utf8'));
    if (meta.id !== project.id || meta.trashed !== true || !meta.trashedAt) {
      throw new Error(`unexpected recreated metadata: ${JSON.stringify(meta)}`);
    }
    console.log(`playwright request delete flow passed for ${project.id}`);
  } finally {
    await context.dispose();
  }
}

try {
  const createRes = await fetch(`${BASE}/api/projects`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: projectName }),
  });
  if (!createRes.ok) {
    throw new Error(`create project failed: ${createRes.status} ${await createRes.text()}`);
  }
  project = await createRes.json();
  const projectDir = path.join(DATA_DIR, project.id);

  let usedRequestFallback = false;
  try {
    browser = await chromium.launch({
      executablePath: CHROMIUM_PATH,
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });
  } catch (err) {
    console.log(`browser launch unavailable: ${String(err.message).split('\n')[0]}`);
    await deleteWithPlaywrightRequest(projectDir);
    usedRequestFallback = true;
  }

  if (!usedRequestFallback) {
    const page = await browser.newPage();
    const pageErrors = [];
    const failedRequests = [];

    page.on('pageerror', (err) => pageErrors.push(err.message));
    page.on('requestfailed', (req) => {
      failedRequests.push(`${req.method()} ${req.url()} ${req.failure()?.errorText || ''}`);
    });
    page.on('dialog', async (dialog) => {
      console.log(`dialog: ${dialog.message()}`);
      await dialog.accept();
    });

    await page.goto(`${BASE}/projects`, { waitUntil: 'networkidle' });
    const row = page.locator('tr', { hasText: projectName });
    await row.waitFor({ timeout: 10_000 });

    await fs.rm(path.join(projectDir, 'project.json'), { force: true });
    console.log(`removed metadata for ${project.id}`);

    const deleteResponsePromise = page.waitForResponse((response) => (
      response.url() === `${BASE}/api/projects/${project.id}` &&
      response.request().method() === 'DELETE'
    ));

    await row.getByRole('button', { name: '删除' }).click();
    const deleteResponse = await deleteResponsePromise;
    const deleteBody = await deleteResponse.text();
    console.log(`delete response: ${deleteResponse.status()} ${deleteBody}`);

    if (deleteResponse.status() !== 200) {
      throw new Error(`expected delete status 200, got ${deleteResponse.status()}`);
    }

    await page.waitForLoadState('networkidle');
    const bodyText = await page.locator('body').innerText();
    if (bodyText.includes('删除失败')) {
      throw new Error('page still shows delete failure status');
    }
    await row.waitFor({ state: 'detached', timeout: 10_000 });

    const meta = JSON.parse(await fs.readFile(path.join(projectDir, 'project.json'), 'utf8'));
    if (meta.id !== project.id || meta.trashed !== true || !meta.trashedAt) {
      throw new Error(`unexpected recreated metadata: ${JSON.stringify(meta)}`);
    }
    if (pageErrors.length) {
      throw new Error(`page errors: ${pageErrors.join('; ')}`);
    }
    if (failedRequests.length) {
      throw new Error(`failed requests: ${failedRequests.join('; ')}`);
    }

    console.log(`playwright browser delete flow passed for ${project.id}`);
  }
} finally {
  if (browser) await browser.close();
  if (project?.id) {
    await fs.rm(path.join(DATA_DIR, project.id), { recursive: true, force: true });
  }
}
