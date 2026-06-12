import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { resolve } from "node:path";

import type { SshHostPreset } from "@agent-orchestrator/shared";

interface ParsedHost {
  name: string;
  hostname?: string;
  port?: string;
  user?: string;
  identityFile?: string;
}

function expandHostAliases(value: string): string[] {
  return value
    .split(/\s+/)
    .map((alias) => alias.trim())
    .filter((alias) => alias && !alias.includes("*") && !alias.includes("?"));
}

function parseSshConfigPort(value: string | undefined): number {
  const normalized = value?.trim();
  if (!normalized || !/^\d+$/.test(normalized)) {
    return 22;
  }

  const parsed = Number(normalized);
  return Number.isInteger(parsed) && parsed >= 1 && parsed <= 65535
    ? parsed
    : 22;
}

export function parseSshConfigContent(
  content: string,
  homeDirectory = homedir(),
): SshHostPreset[] {
  const hosts: ParsedHost[] = [];
  let currentHosts: ParsedHost[] = [];

  for (const rawLine of content.split("\n")) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;

    const match = line.match(/^(\w+)\s+(.+)$/);
    if (!match) continue;

    const [, key, value] = match;
    const keyLower = key.toLowerCase();

    if (keyLower === "host") {
      currentHosts = expandHostAliases(value).map((name) => ({ name }));
      hosts.push(...currentHosts);
    } else if (currentHosts.length > 0) {
      for (const current of currentHosts) {
        if (keyLower === "hostname") current.hostname = value;
        else if (keyLower === "port") current.port = value;
        else if (keyLower === "user") current.user = value;
        else if (keyLower === "identityfile") {
          current.identityFile = value.replace(/^~/, homeDirectory);
        }
      }
    }
  }

  return hosts
    .filter((h) => h.hostname)
    .map((h) => ({
      name: h.name,
      host: h.hostname!,
      port: parseSshConfigPort(h.port),
      username: h.user,
      identityFile: h.identityFile,
      defaultPath: "~/",
    }));
}

export function parseSshConfig(): SshHostPreset[] {
  const configPath = resolve(homedir(), ".ssh", "config");
  let content: string;
  try {
    content = readFileSync(configPath, "utf-8");
  } catch {
    return [];
  }

  return parseSshConfigContent(content);
}
