import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { chmodSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import {
  buildRemoteInteractiveShellCommand,
  buildRemoteInteractiveShellExecCommand,
  buildRemoteTmuxCommand,
} from "./platform-compat";

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

function runRemoteShellCommand(
  command: string,
  shellPath: string,
  pathValue: string,
): string {
  return execFileSync("/bin/sh", ["-c", command], {
    encoding: "utf8",
    env: {
      ...process.env,
      PATH: pathValue,
      SHELL: shellPath,
    },
  });
}

test("remote wrapper prefers bash when login shell is plain sh", () => {
  const tempDirectory = mkdtempSync(join(tmpdir(), "platform-compat-"));

  try {
    const shPath = createShellStub(tempDirectory, "sh", "sh");
    createShellStub(tempDirectory, "bash", "bash");

    const result = runRemoteShellCommand(
      buildRemoteInteractiveShellCommand('printf %s "$SELECTED_SHELL"'),
      shPath,
      tempDirectory,
    );

    assert.equal(result, "bash");
  } finally {
    rmSync(tempDirectory, { force: true, recursive: true });
  }
});

test("remote shell exec prefers bash when login shell is plain sh", () => {
  const tempDirectory = mkdtempSync(join(tmpdir(), "platform-compat-"));

  try {
    const shPath = createShellStub(tempDirectory, "sh", "sh");
    createShellStub(tempDirectory, "bash", "bash");

    const result = runRemoteShellCommand(
      `${buildRemoteInteractiveShellExecCommand()} -c 'printf %s "$SELECTED_SHELL"'`,
      shPath,
      tempDirectory,
    );

    assert.equal(result, "bash");
  } finally {
    rmSync(tempDirectory, { force: true, recursive: true });
  }
});

test("remote tmux command target still boots through the interactive shell wrapper", () => {
  const tempDirectory = mkdtempSync(join(tmpdir(), "platform-compat-"));

  try {
    const shPath = createShellStub(tempDirectory, "sh", "sh");
    createShellStub(tempDirectory, "bash", "bash");

    const result = runRemoteShellCommand(
      `/bin/sh -c ${buildRemoteTmuxCommand('printf %s "$SELECTED_SHELL"')}`,
      shPath,
      tempDirectory,
    );

    assert.equal(result, "bash");
  } finally {
    rmSync(tempDirectory, { force: true, recursive: true });
  }
});

test("remote tmux command can keep the pane open in the selected shell", () => {
  const command = buildRemoteTmuxCommand('printf "RUN"; exit 0', true);

  assert.match(command, /exec "\$SHELL_BIN" -i/);
  assert.match(command, /printf "RUN"; exit 0/);
});
