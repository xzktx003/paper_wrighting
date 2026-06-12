import { existsSync } from "node:fs";
import { mkdir, stat } from "node:fs/promises";
import { pipeline } from "node:stream/promises";
import path from "node:path";

import * as archiverModule from "archiver";
import type archiver from "archiver";
import multipart from "@fastify/multipart";
import type { FastifyInstance } from "fastify";

import type {
  ChmodInput,
  FileOperationInput,
  FilePreviewInput,
  FileUploadResponse,
  ListFilesInput,
  SshTarget,
} from "@agent-orchestrator/shared";

import { LocalFsService } from "../services/local-fs-service.js";
import { SftpService } from "../services/sftp-service.js";
import { assertSafeFilesystemPath } from "../services/file-system-utils.js";

interface FilesystemRouteOptions {
  localFsService: LocalFsService;
  sftpService: SftpService;
}

type ZipArchiveConstructor = new (
  options?: archiver.ArchiverOptions,
) => archiver.Archiver;

const { ZipArchive } = archiverModule as unknown as {
  ZipArchive: ZipArchiveConstructor;
};

function sanitizeDownloadFilename(filename: string): string {
  return filename.replace(/["\\;]/g, "_").replace(/[\x00-\x1f\x7f]/g, "_");
}

function buildAttachmentDisposition(filename: string): string {
  return `attachment; filename="${sanitizeDownloadFilename(filename)}"`;
}

function parseMaybeSshTarget(value: string | undefined): SshTarget | undefined {
  if (!value) {
    return undefined;
  }

  const parsed = parseJsonField<unknown>(value, "sshTarget");
  return optionalSshTarget({ sshTarget: parsed });
}

function parseJsonField<T>(value: string, fieldName: string): T {
  try {
    return JSON.parse(value) as T;
  } catch {
    throw new Error(`${fieldName} must be valid JSON`);
  }
}

function parseRelativePaths(value: string): string[] {
  const parsed = parseJsonField<unknown>(value, "relativePaths");
  if (
    !Array.isArray(parsed) ||
    parsed.some((entry) => typeof entry !== "string")
  ) {
    throw new Error("relativePaths must be a JSON array of strings");
  }

  return parsed.map((entry) =>
    validateRelativeUploadPath(entry, "relativePaths"),
  );
}

function validateRelativeUploadPath(value: string, field: string): string {
  const trimmed = value.trim();
  assertSafeFilesystemPath(trimmed, field);
  if (path.isAbsolute(trimmed) || path.win32.isAbsolute(trimmed)) {
    throw new Error(`${field} entries must be relative paths`);
  }

  return trimmed;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function optionalStringField(
  input: Record<string, unknown>,
  field: string,
  label = field,
): string | undefined {
  const value = input[field];
  if (value === undefined) {
    return undefined;
  }

  if (typeof value !== "string") {
    throw new Error(`${label} must be a string`);
  }

  if (/[\0\r\n]/.test(value)) {
    throw new Error(`${label} contains invalid characters`);
  }

  return value;
}

function requireStringField(
  input: Record<string, unknown>,
  field: string,
): string {
  const value = optionalStringField(input, field);
  if (!value?.trim()) {
    throw new Error(`${field} is required`);
  }

  return value;
}

function optionalBooleanField(
  input: Record<string, unknown>,
  field: string,
): boolean | undefined {
  const value = input[field];
  if (value === undefined) {
    return undefined;
  }

  if (typeof value !== "boolean") {
    throw new Error(`${field} must be a boolean`);
  }

  return value;
}

function optionalNonNegativeSafeIntegerField(
  input: Record<string, unknown>,
  field: string,
): number | undefined {
  const value = input[field];
  if (value === undefined) {
    return undefined;
  }

  if (
    typeof value !== "number" ||
    !Number.isSafeInteger(value) ||
    value < 0
  ) {
    throw new Error(`${field} must be a non-negative safe integer`);
  }

  return value;
}

function optionalSshPort(input: Record<string, unknown>): number | undefined {
  const value = input.port;
  if (value === undefined) {
    return undefined;
  }

  if (
    typeof value !== "number" ||
    !Number.isSafeInteger(value) ||
    value < 1 ||
    value > 65535
  ) {
    throw new Error("sshTarget.port must be an integer from 1 to 65535");
  }

  return value;
}

function optionalSshTarget(
  input: Record<string, unknown>,
): SshTarget | undefined {
  const value = input.sshTarget;
  if (value === undefined) {
    return undefined;
  }

  if (!isPlainObject(value)) {
    throw new Error("sshTarget must be an object");
  }

  const host = optionalStringField(value, "host", "sshTarget.host");
  if (!host?.trim()) {
    throw new Error("sshTarget.host is required");
  }

  const port = optionalSshPort(value);
  const username = optionalStringField(value, "username", "sshTarget.username");
  const identityFile = optionalStringField(
    value,
    "identityFile",
    "sshTarget.identityFile",
  );

  return {
    host,
    ...(port !== undefined ? { port } : {}),
    ...(username !== undefined ? { username } : {}),
    ...(identityFile !== undefined ? { identityFile } : {}),
  };
}

function validateListFilesInput(input: ListFilesInput | undefined): {
  path?: string;
  sshTarget?: SshTarget;
  showHidden?: boolean;
} {
  if (input === undefined) {
    return {};
  }

  if (!isPlainObject(input)) {
    throw new Error("request body must be an object");
  }

  const pathValue = optionalStringField(input, "path");
  const sshTarget = optionalSshTarget(input);
  const showHidden = optionalBooleanField(input, "showHidden");

  return {
    ...(pathValue !== undefined ? { path: pathValue } : {}),
    ...(sshTarget !== undefined ? { sshTarget } : {}),
    ...(showHidden !== undefined ? { showHidden } : {}),
  };
}

function validateFileOperationInput(
  input: FileOperationInput | undefined,
): FileOperationInput {
  if (!isPlainObject(input)) {
    throw new Error("request body must be an object");
  }

  const operation = input.operation;
  if (
    operation !== "mkdir" &&
    operation !== "rename" &&
    operation !== "delete"
  ) {
    throw new Error("operation must be mkdir, rename, or delete");
  }

  const newPath = optionalStringField(input, "newPath");
  const sshTarget = optionalSshTarget(input);

  return {
    operation,
    path: requireStringField(input, "path"),
    ...(newPath !== undefined ? { newPath } : {}),
    ...(sshTarget !== undefined ? { sshTarget } : {}),
  };
}

function validateFilePreviewInput(
  input: FilePreviewInput | undefined,
): FilePreviewInput {
  if (!isPlainObject(input)) {
    throw new Error("request body must be an object");
  }

  const sshTarget = optionalSshTarget(input);
  const maxBytes = optionalNonNegativeSafeIntegerField(input, "maxBytes");

  return {
    path: requireStringField(input, "path"),
    ...(sshTarget !== undefined ? { sshTarget } : {}),
    ...(maxBytes !== undefined ? { maxBytes } : {}),
  };
}

function validateChmodInput(input: ChmodInput | undefined): ChmodInput {
  if (!isPlainObject(input)) {
    throw new Error("request body must be an object");
  }

  const sshTarget = optionalSshTarget(input);

  return {
    path: requireStringField(input, "path"),
    mode: requireStringField(input, "mode"),
    ...(sshTarget !== undefined ? { sshTarget } : {}),
  };
}

function validateDownloadInput(
  input: { path: string; sshTarget?: SshTarget } | undefined,
): { path: string; sshTarget?: SshTarget } {
  if (!isPlainObject(input)) {
    throw new Error("request body must be an object");
  }

  const sshTarget = optionalSshTarget(input);

  return {
    path: requireStringField(input, "path"),
    ...(sshTarget !== undefined ? { sshTarget } : {}),
  };
}

function resolveDefaultLocalPath(): string {
  if (process.env.FILE_BROWSER_DEFAULT_LOCAL_PATH) {
    return process.env.FILE_BROWSER_DEFAULT_LOCAL_PATH;
  }

  let currentPath = process.cwd();
  while (currentPath !== path.dirname(currentPath)) {
    if (existsSync(path.join(currentPath, "pnpm-workspace.yaml"))) {
      return currentPath;
    }

    currentPath = path.dirname(currentPath);
  }

  return process.cwd();
}

function getErrorStatusCode(error: unknown): number {
  const message = error instanceof Error ? error.message : "";
  if (
    message.includes("no such file") ||
    message.includes("ENOENT") ||
    message.includes("not found")
  ) {
    return 404;
  }

  if (
    message.includes("permission denied") ||
    message.includes("EACCES") ||
    message.includes("EPERM")
  ) {
    return 403;
  }

  if (
    message.includes("is required") ||
    message.includes("contains invalid characters") ||
    message.includes("cannot contain") ||
    message.includes("mode must be") ||
    message.includes("must be valid JSON") ||
    message.includes("must be a JSON array") ||
    message.includes("must be relative paths") ||
    message.includes("must be a string") ||
    message.includes("must be a boolean") ||
    message.includes("must be an object") ||
    message.includes("must be an integer") ||
    message.includes("must be a non-negative safe integer") ||
    message.includes("operation must be")
  ) {
    return 400;
  }

  return 500;
}

export async function registerFilesystemRoutes(
  fastify: FastifyInstance,
  { localFsService, sftpService }: FilesystemRouteOptions,
): Promise<void> {
  await fastify.register(multipart, {
    limits: {
      fileSize: 500 * 1024 * 1024,
    },
  });

  fastify.post<{ Body: ListFilesInput }>(
    "/api/fs/list",
    async (request, reply) => {
      let input: ReturnType<typeof validateListFilesInput>;

      try {
        input = validateListFilesInput(request.body);
      } catch (error) {
        reply.code(400);
        return { error: (error as Error).message };
      }

      const requestedPath = input.path?.trim()
        ? input.path
        : input.sshTarget
          ? "~"
          : resolveDefaultLocalPath();

      try {
        if (input.sshTarget) {
          return await sftpService.list(
            input.sshTarget,
            requestedPath,
            input.showHidden,
          );
        }

        return await localFsService.list(requestedPath, input.showHidden);
      } catch (error) {
        reply.code(getErrorStatusCode(error));
        return {
          error: error instanceof Error ? error.message : "Unknown error",
        };
      }
    },
  );

  fastify.post<{ Body: FileOperationInput }>(
    "/api/fs/operation",
    async (request, reply) => {
      try {
        const {
          operation,
          path: targetPath,
          newPath,
          sshTarget,
        } = validateFileOperationInput(request.body);

        if (operation === "mkdir") {
          const createdPath = sshTarget
            ? await sftpService.mkdir(sshTarget, targetPath)
            : await localFsService.mkdir(targetPath);
          return { ok: true, path: createdPath };
        }

        if (operation === "rename") {
          if (!newPath) {
            reply.code(400);
            return { error: "newPath is required for rename" };
          }

          const renamedPath = sshTarget
            ? await sftpService.rename(sshTarget, targetPath, newPath)
            : await localFsService.rename(targetPath, newPath);
          return { ok: true, path: renamedPath };
        }

        if (operation === "delete") {
          if (sshTarget) {
            await sftpService.remove(sshTarget, targetPath);
          } else {
            await localFsService.remove(targetPath);
          }

          return { ok: true };
        }

        reply.code(400);
        return { error: "Unsupported operation" };
      } catch (error) {
        reply.code(getErrorStatusCode(error));
        return {
          error: error instanceof Error ? error.message : "Unknown error",
        };
      }
    },
  );

  fastify.post<{ Body: FilePreviewInput }>(
    "/api/fs/preview",
    async (request, reply) => {
      try {
        const input = validateFilePreviewInput(request.body);

        if (input.sshTarget) {
          return await sftpService.preview(
            input.sshTarget,
            input.path,
            input.maxBytes,
          );
        }

        return await localFsService.preview(input.path, input.maxBytes);
      } catch (error) {
        reply.code(getErrorStatusCode(error));
        return {
          error: error instanceof Error ? error.message : "Unknown error",
        };
      }
    },
  );

  fastify.post<{ Body: ChmodInput }>(
    "/api/fs/chmod",
    async (request, reply) => {
      try {
        const input = validateChmodInput(request.body);

        if (input.sshTarget) {
          await sftpService.chmod(input.sshTarget, input.path, input.mode);
        } else {
          await localFsService.chmod(input.path, input.mode);
        }

        return { ok: true };
      } catch (error) {
        reply.code(getErrorStatusCode(error));
        return {
          error: error instanceof Error ? error.message : "Unknown error",
        };
      }
    },
  );

  fastify.post<{ Body: { path: string; sshTarget?: SshTarget } }>(
    "/api/fs/download",
    async (request, reply) => {
      try {
        const { path: targetPath, sshTarget } = validateDownloadInput(
          request.body,
        );
        const basename = path.basename(targetPath);

        if (sshTarget) {
          const isDir = await sftpService.isDirectory(sshTarget, targetPath);
          if (isDir) {
            reply.header(
              "Content-Disposition",
              buildAttachmentDisposition(`${basename}.zip`),
            );
            reply.header("Content-Type", "application/zip");
            const archive = new ZipArchive({ zlib: { level: 5 } });
            const entries = await sftpService.listRecursive(
              sshTarget,
              targetPath,
            );
            for (const entry of entries) {
              const relativePath = path.relative(targetPath, entry.path);
              const stream = await sftpService.createReadStream(
                sshTarget,
                entry.path,
              );
              archive.append(stream, { name: relativePath });
            }
            archive.finalize();
            return reply.send(archive);
          }

          const stream = await sftpService.createReadStream(
            sshTarget,
            targetPath,
          );
          reply.header(
            "Content-Disposition",
            buildAttachmentDisposition(basename),
          );
          reply.header("Content-Type", "application/octet-stream");
          return reply.send(stream);
        }

        const resolvedPath = localFsService.resolvePath(targetPath);
        const stats = await stat(resolvedPath);

        if (stats.isDirectory()) {
          reply.header(
            "Content-Disposition",
            buildAttachmentDisposition(`${basename}.zip`),
          );
          reply.header("Content-Type", "application/zip");
          const archive = new ZipArchive({ zlib: { level: 5 } });
          archive.directory(resolvedPath, false);
          archive.finalize();
          return reply.send(archive);
        }

        const stream = localFsService.createReadStream(targetPath);
        reply.header(
          "Content-Disposition",
          buildAttachmentDisposition(basename),
        );
        reply.header("Content-Type", "application/octet-stream");
        return reply.send(stream);
      } catch (error) {
        reply.code(getErrorStatusCode(error));
        return {
          error: error instanceof Error ? error.message : "Unknown error",
        };
      }
    },
  );

  fastify.post("/api/fs/upload", async (request, reply) => {
    const uploadedPaths: string[] = [];
    let targetDirectory: string | null = null;
    let overwritePath: string | null = null;
    let sshTarget: SshTarget | undefined;
    let relativePaths: string[] = [];
    let fileIndex = 0;

    try {
      for await (const part of request.parts()) {
        if (part.type === "field") {
          if (part.fieldname === "path") {
            targetDirectory = String(part.value);
          } else if (part.fieldname === "overwritePath") {
            overwritePath = String(part.value);
          } else if (part.fieldname === "sshTarget") {
            sshTarget = parseMaybeSshTarget(String(part.value));
          } else if (part.fieldname === "relativePaths") {
            relativePaths = parseRelativePaths(String(part.value));
          }
          continue;
        }

        if (!targetDirectory && !overwritePath) {
          reply.code(400);
          return { error: "Upload target path is required before files" };
        }

        let nextPath: string;
        if (overwritePath && uploadedPaths.length === 0) {
          nextPath = overwritePath;
        } else if (relativePaths.length > 0 && relativePaths[fileIndex]) {
          nextPath = path.join(targetDirectory ?? "", relativePaths[fileIndex]);
        } else {
          nextPath = path.join(
            targetDirectory ?? "",
            validateRelativeUploadPath(part.filename, "filename"),
          );
        }

        const parentDir = path.dirname(nextPath);
        if (parentDir && parentDir !== targetDirectory) {
          if (sshTarget) {
            await sftpService.ensureDirectory(sshTarget, parentDir);
          } else {
            await mkdir(localFsService.resolvePath(parentDir), {
              recursive: true,
            });
          }
        }

        const output = sshTarget
          ? await sftpService.createWriteStream(sshTarget, nextPath)
          : localFsService.createWriteStream(nextPath);
        await pipeline(part.file, output);
        uploadedPaths.push(nextPath);
        fileIndex++;
      }

      const response: FileUploadResponse = { uploadedPaths };
      return response;
    } catch (error) {
      reply.code(getErrorStatusCode(error));
      return {
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  });
}
