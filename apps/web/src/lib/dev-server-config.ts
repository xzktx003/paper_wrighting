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

function resolveBackendPort(env: Record<string, string | undefined>): number {
  if (env.WEB_BACKEND_PORT?.trim()) {
    return parsePort(env.WEB_BACKEND_PORT, 3200, "WEB_BACKEND_PORT");
  }

  if (env.SERVER_PORT?.trim()) {
    return parsePort(env.SERVER_PORT, 3200, "SERVER_PORT");
  }

  if (env.PORT?.trim()) {
    return parsePort(env.PORT, 3200, "PORT");
  }

  return 3200;
}

export function resolveWebDevConfig(
  env: Record<string, string | undefined>,
): WebDevConfig {
  const webPort = parsePort(env.WEB_PORT, 3100, "WEB_PORT");
  const serverPort = resolveBackendPort(env);
  const backendHost = env.WEB_BACKEND_HOST?.trim() || "localhost";

  return {
    webPort,
    serverPort,
    apiTarget: `http://${backendHost}:${serverPort}`,
    wsTarget: `ws://${backendHost}:${serverPort}`,
  };
}
