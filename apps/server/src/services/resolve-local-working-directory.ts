import os from "node:os";
import path from "node:path";
import { statSync } from "node:fs";

import { assertSafeFilesystemPath } from "./file-system-utils.js";

function resolveExistingDirectory(candidate: string): string {
  try {
    if (statSync(candidate).isDirectory()) {
      return candidate;
    }
  } catch {
    // Fall through to the process cwd when the requested directory is stale.
  }

  return process.cwd();
}

export function resolveLocalWorkingDirectory(
  workingDirectory?: string,
): string {
  if (!workingDirectory) {
    return process.cwd();
  }

  try {
    assertSafeFilesystemPath(workingDirectory, "workingDirectory");
  } catch {
    return process.cwd();
  }

  if (workingDirectory === "~" || workingDirectory === "~/") {
    return os.homedir();
  }

  if (workingDirectory.startsWith("~/")) {
    return resolveExistingDirectory(
      path.join(os.homedir(), workingDirectory.slice(2)),
    );
  }

  if (path.isAbsolute(workingDirectory)) {
    return resolveExistingDirectory(workingDirectory);
  }

  return resolveExistingDirectory(
    path.resolve(process.cwd(), workingDirectory),
  );
}
