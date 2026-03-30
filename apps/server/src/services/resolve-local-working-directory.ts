import os from "node:os";
import path from "node:path";

export function resolveLocalWorkingDirectory(
  workingDirectory?: string,
): string {
  if (!workingDirectory) {
    return process.cwd();
  }

  if (workingDirectory === "~" || workingDirectory === "~/") {
    return os.homedir();
  }

  if (workingDirectory.startsWith("~/")) {
    return path.join(os.homedir(), workingDirectory.slice(2));
  }

  if (path.isAbsolute(workingDirectory)) {
    return workingDirectory;
  }

  return path.resolve(process.cwd(), workingDirectory);
}
