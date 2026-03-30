import assert from "node:assert/strict";
import { chmodSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import test from "node:test";

import { buildInteractiveShellCommand } from "./runtime-compat.js";

function createShellStub(
  directory: string,
  name: string,
  marker: string,
): string {
  const filePath = join(directory, name);
  writeFileSync(
    filePath,
    [
      "#!/bin/sh",
      `export SELECTED_SHELL=${marker}`,
      'if [ "$1" = "-i" ]; then',
      "  shift",
      "fi",
      'if [ "$1" = "-c" ]; then',
      "  shift",
      '  exec /bin/sh -c "$1"',
      "fi",
      'exec /bin/sh "$@"',
      "",
    ].join("\n"),
  );
  chmodSync(filePath, 0o755);
  return filePath;
}

function runInteractiveCommand(shellPath: string, pathValue: string): string {
  return execFileSync(
    "/bin/sh",
    ["-c", buildInteractiveShellCommand('printf %s "$SELECTED_SHELL"')],
    {
      encoding: "utf8",
      env: {
        ...process.env,
        PATH: pathValue,
        SHELL: shellPath,
      },
    },
  );
}

test("prefers bash when login shell is plain sh", () => {
  const tempDirectory = mkdtempSync(join(tmpdir(), "runtime-compat-"));

  try {
    const shPath = createShellStub(tempDirectory, "sh", "sh");
    createShellStub(tempDirectory, "bash", "bash");

    const result = runInteractiveCommand(shPath, tempDirectory);

    assert.equal(result, "bash");
  } finally {
    rmSync(tempDirectory, { force: true, recursive: true });
  }
});

test("keeps the configured shell when it is not plain sh", () => {
  const tempDirectory = mkdtempSync(join(tmpdir(), "runtime-compat-"));

  try {
    const zshPath = createShellStub(tempDirectory, "zsh", "zsh");
    createShellStub(tempDirectory, "bash", "bash");

    const result = runInteractiveCommand(zshPath, tempDirectory);

    assert.equal(result, "zsh");
  } finally {
    rmSync(tempDirectory, { force: true, recursive: true });
  }
});
