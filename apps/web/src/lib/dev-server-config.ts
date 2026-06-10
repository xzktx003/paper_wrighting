export type WebDevConfig = {
  webPort: number;
  serverPort: number;
  apiTarget: string;
  wsTarget: string;
};

function parsePort(
  value: string | undefined,
  fallback: number,
  envName: string,
): number {
  const normalized = value?.trim();
  if (!normalized) {
    return fallback;
  }

  const parsed = Number(normalized);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 65535) {
    throw new Error(
      `${envName} must be a positive integer between 1 and 65535`,
    );
  }

  return parsed;
}

export function resolveWebDevConfig(
  env: Record<string, string | undefined>,
): WebDevConfig {
  const webPort = parsePort(env.WEB_PORT, 8484, "WEB_PORT");
  const serverPort = parsePort(env.SERVER_PORT, 4000, "SERVER_PORT");

  return {
    webPort,
    serverPort,
    apiTarget: `http://localhost:${serverPort}`,
    wsTarget: `ws://localhost:${serverPort}`,
  };
}
