import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

import { resolveWebDevConfig } from "./src/lib/dev-server-config";

function readHttpsConfig(env: Record<string, string | undefined>) {
  if (env.VITE_DEV_HTTPS !== "1") {
    return undefined;
  }

  const certPath = env.VITE_DEV_HTTPS_CERT;
  const keyPath = env.VITE_DEV_HTTPS_KEY;

  if (!certPath || !keyPath) {
    throw new Error(
      "VITE_DEV_HTTPS=1 requires VITE_DEV_HTTPS_CERT and VITE_DEV_HTTPS_KEY",
    );
  }

  return {
    cert: readFileSync(certPath),
    key: readFileSync(keyPath),
  };
}

// Backend host:port is looked up from .env (WEB_BACKEND_HOST / WEB_BACKEND_PORT)
// so users can redirect API/WebSocket traffic without editing source code.
// See .env.example at repo root.
export default defineConfig(({ mode }) => {
  const env = {
    ...process.env,
    ...loadEnv(mode, resolve(__dirname, "../.."), ""),
  };

  const webConfig = resolveWebDevConfig(env);
  const WEB_HOST = env.WEB_HOST?.trim() || "0.0.0.0";

  return {
    plugins: [react()],
    server: {
      host: WEB_HOST,
      port: webConfig.webPort,
      https: readHttpsConfig(env),
      proxy: {
        "/api": webConfig.apiTarget,
        "/vscode": {
          target: webConfig.apiTarget,
          ws: true,
        },
        "/ws": {
          target: webConfig.wsTarget,
          ws: true,
        },
      },
    },
  };
});
