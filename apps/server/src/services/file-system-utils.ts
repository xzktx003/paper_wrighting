import path from "node:path";
import { homedir } from "node:os";

import type { FileEntryType } from "@agent-orchestrator/shared";

const DIRECTORY_MODE = 0o040000;
const SYMLINK_MODE = 0o120000;
const TYPE_MASK = 0o170000;
const EXECUTE_BITS = [0o100, 0o010, 0o001];
const WRITE_BITS = [0o200, 0o020, 0o002];
const READ_BITS = [0o400, 0o040, 0o004];

const MIME_TYPES = new Map<string, string>([
  [".gif", "image/gif"],
  [".jpeg", "image/jpeg"],
  [".jpg", "image/jpeg"],
  [".json", "application/json"],
  [".log", "text/plain"],
  [".md", "text/markdown"],
  [".mjs", "text/javascript"],
  [".png", "image/png"],
  [".svg", "image/svg+xml"],
  [".ts", "text/plain"],
  [".tsx", "text/plain"],
  [".txt", "text/plain"],
  [".webp", "image/webp"],
  [".xml", "application/xml"],
  [".yaml", "application/yaml"],
  [".yml", "application/yaml"],
]);

function hasTraversalSegment(value: string): boolean {
  return value
    .split(/[\\/]+/)
    .map((segment) => segment.trim())
    .includes("..");
}

export function assertSafeFilesystemPath(value: string, field = "path"): void {
  if (!value.trim()) {
    throw new Error(`${field} is required`);
  }

  if (/[\0\r\n]/.test(value)) {
    throw new Error(`${field} contains invalid characters`);
  }

  if (hasTraversalSegment(value)) {
    throw new Error(`${field} cannot contain ".." segments`);
  }
}

export function detectFileEntryType(mode: number): FileEntryType {
  if ((mode & TYPE_MASK) === DIRECTORY_MODE) {
    return "directory";
  }

  if ((mode & TYPE_MASK) === SYMLINK_MODE) {
    return "symlink";
  }

  return "file";
}

export function formatPermissions(mode: number, type: FileEntryType): string {
  const typeChar = type === "directory" ? "d" : type === "symlink" ? "l" : "-";
  const permissionBits = [
    [READ_BITS[0], WRITE_BITS[0], EXECUTE_BITS[0]],
    [READ_BITS[1], WRITE_BITS[1], EXECUTE_BITS[1]],
    [READ_BITS[2], WRITE_BITS[2], EXECUTE_BITS[2]],
  ]
    .map(([readBit, writeBit, executeBit]) =>
      [
        mode & readBit ? "r" : "-",
        mode & writeBit ? "w" : "-",
        mode & executeBit ? "x" : "-",
      ].join(""),
    )
    .join("");

  return `${typeChar}${permissionBits}`;
}

export function guessMimeType(filePath: string): string | null {
  const extension = path.extname(filePath).toLowerCase();
  return MIME_TYPES.get(extension) ?? null;
}

export function isBinaryBuffer(buffer: Buffer): boolean {
  for (const value of buffer.values()) {
    if (value === 0) {
      return true;
    }
  }

  return false;
}

export function normalizeLocalPath(inputPath: string): string {
  assertSafeFilesystemPath(inputPath);
  if (inputPath === "~") {
    return homedir();
  }

  if (inputPath.startsWith("~/")) {
    return path.resolve(homedir(), inputPath.slice(2));
  }

  return path.resolve(inputPath);
}

export function joinRemotePath(basePath: string, nextPath: string): string {
  if (nextPath.startsWith("/")) {
    return nextPath;
  }

  if (basePath === "/") {
    return `/${nextPath}`;
  }

  return `${basePath.replace(/\/+$/, "")}/${nextPath}`;
}
