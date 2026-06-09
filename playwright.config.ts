import { defineConfig } from '@playwright/test';

import { loadRootEnv, resolvePortDefaults } from './scripts/dev-port-config.mjs';

declare const process: {
  cwd(): string;
  env: Record<string, string | undefined>;
};

loadRootEnv();

const { webPort, serverPort } = resolvePortDefaults(process.env);

const testPath = [
  `${process.cwd()}/.playwright-bin`,
  process.env.PATH ?? '',
].join(':');

const skipWebServer = process.env.PLAYWRIGHT_SKIP_WEBSERVER === '1';
const frontendHost = process.env.PLAYWRIGHT_FRONTEND_HOST ?? '127.0.0.1';
const frontendPort = process.env.PLAYWRIGHT_FRONTEND_PORT ?? webPort;
const frontendProtocol =
  process.env.PLAYWRIGHT_FRONTEND_PROTOCOL ??
  (process.env.WEB_HTTPS === '1' || process.env.VITE_DEV_HTTPS === '1'
    ? 'https'
    : 'http');

if (frontendProtocol !== 'http' && frontendProtocol !== 'https') {
  throw new Error(
    `PLAYWRIGHT_FRONTEND_PROTOCOL must be "http" or "https", got: ${frontendProtocol}`,
  );
}

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 30_000,
  workers: 1,
  use: {
    baseURL:
      process.env.PLAYWRIGHT_BASE_URL ??
      `${frontendProtocol}://127.0.0.1:${webPort}`,
    headless: true,
    ignoreHTTPSErrors: frontendProtocol === 'https',
  },
  webServer: skipWebServer
    ? undefined
    : [
        {
          command: 'pnpm --filter server run dev:app',
          env: {
            ...process.env,
            PATH: testPath,
            PLAYWRIGHT_TEST: '1',
          },
          url: `http://127.0.0.1:${serverPort}/api/health`,
          reuseExistingServer: true,
          timeout: 60_000,
        },
        {
          command: `pnpm --filter web exec vite --host ${frontendHost} --port ${frontendPort}`,
          env: {
            ...process.env,
            PATH: testPath,
          },
          url: `${frontendProtocol}://${frontendHost}:${frontendPort}`,
          ignoreHTTPSErrors: frontendProtocol === 'https',
          reuseExistingServer: true,
          timeout: 60_000,
        },
      ],
});
