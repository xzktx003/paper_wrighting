import assert from "node:assert/strict";
import { chmodSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import test from "node:test";

import {
  buildInteractiveShellCommand,
  buildTmuxCommand,
} from "./runtime-compat.js";

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
      '  if [ "$#" -eq 0 ]; then',
      '    printf %s "$SELECTED_SHELL"',
      "    exit 0",
      "  fi",
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

test("tmux command target still boots through the interactive shell wrapper", () => {
  const tempDirectory = mkdtempSync(join(tmpdir(), "runtime-compat-"));

  try {
    const shPath = createShellStub(tempDirectory, "sh", "sh");
    createShellStub(tempDirectory, "bash", "bash");

    const result = execFileSync(
      "/bin/sh",
      ["-c", `/bin/sh -c ${buildTmuxCommand('printf %s "$SELECTED_SHELL"')}`],
      {
        encoding: "utf8",
        env: {
          ...process.env,
          PATH: tempDirectory,
          SHELL: shPath,
        },
      },
    );

    assert.equal(result, "bash");
  } finally {
    rmSync(tempDirectory, { force: true, recursive: true });
  }
});

test("tmux command can keep the pane open in the selected shell", () => {
  const command = buildTmuxCommand('printf "RUN"; exit 0', true);

  assert.match(command, /exec "\$SHELL_BIN" -i/);
  assert.match(command, /printf "RUN"; exit 0/);
});
