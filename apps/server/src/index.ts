import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { config as loadDotenv } from "dotenv";

import { buildServer } from "./app.js";
import { resolveServerRuntimeConfig } from "./config/server-runtime-config.js";

const currentDirectory = dirname(fileURLToPath(import.meta.url));
loadDotenv({ path: resolve(currentDirectory, "../../../.env") });

const { app } = buildServer();
const { host, port } = resolveServerRuntimeConfig(process.env);

app.listen({ port, host }).catch((error: unknown) => {
  app.log.error(error);
  process.exit(1);
});
