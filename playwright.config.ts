import { defineConfig } from '@playwright/test';

declare const process: {
  cwd(): string;
  env: Record<string, string | undefined>;
};

const testPath = [
  `${process.cwd()}/.playwright-bin`,
  process.env.PATH ?? '',
].join(':');

const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://127.0.0.1:3000';
const skipWebServer = process.env.PLAYWRIGHT_SKIP_WEBSERVER === '1';
const frontendHost = process.env.PLAYWRIGHT_FRONTEND_HOST ?? '127.0.0.1';
const frontendPort = process.env.PLAYWRIGHT_FRONTEND_PORT ?? '3000';

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 30_000,
  workers: 1,
  use: {
    baseURL,
    headless: true,
  },
  webServer: skipWebServer
    ? undefined
    : [
        {
          command: 'pnpm --filter server dev',
          env: {
            ...process.env,
            PATH: testPath,
          },
          url: 'http://127.0.0.1:4000/api/health',
          reuseExistingServer: true,
          timeout: 60_000,
        },
        {
          command: `pnpm --filter web exec vite --host ${frontendHost} --port ${frontendPort}`,
          env: {
            ...process.env,
            PATH: testPath,
          },
          url: `http://${frontendHost}:${frontendPort}`,
          reuseExistingServer: true,
          timeout: 60_000,
        },
      ],
});