import { pathToFileURL } from "node:url";

import { chromium } from "@playwright/test";

const missingLibraryPattern =
  /error while loading shared libraries:\s*([^:\s]+):\s*cannot open shared object file/i;

export function formatPlaywrightPreflightError(error) {
  const message = error instanceof Error ? error.message : String(error);
  const missingLibrary = message.match(missingLibraryPattern)?.[1];

  if (missingLibrary) {
    return [
      `Playwright Chromium cannot start because the system library ${missingLibrary} is missing.`,
      "Install the browser and OS dependencies, then rerun e2e:",
      "  npx playwright install",
      "  sudo npx playwright install-deps",
      "If this machine cannot install system packages, run e2e on an environment with Playwright browser dependencies.",
    ].join("\n");
  }

  return [
    "Playwright Chromium preflight failed before running e2e tests.",
    message,
  ].join("\n");
}

export async function runPlaywrightPreflight() {
  const browser = await chromium.launch({ headless: true });
  await browser.close();
}

async function main() {
  try {
    await runPlaywrightPreflight();
  } catch (error) {
    console.error(formatPlaywrightPreflightError(error));
    process.exitCode = 1;
  }
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
