import type { FastifyInstance } from "fastify";

import { parseSshConfig } from "../services/ssh-config-parser.js";

export async function registerSshHostsRoutes(
  fastify: FastifyInstance,
): Promise<void> {
  fastify.get("/api/ssh-hosts", async () => {
    const hosts = parseSshConfig();
    return { hosts };
  });
}
