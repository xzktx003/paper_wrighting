import { accessSync, constants } from "node:fs";
import os from "node:os";
import { delimiter, join } from "node:path";

function isExecutablePath(
  commandPath: string | undefined,
): commandPath is string {
  if (!commandPath || !commandPath.includes("/")) {
    return false;
  }

  try {
    accessSync(commandPath, constants.X_OK);
    return true;
  } catch {
    return false;
  }
}

function isExecutableOnPath(
  command: string,
  envPath: string | undefined,
): boolean {
  return (envPath ?? "")
    .split(delimiter)
    .filter(Boolean)
    .some((directory) => isExecutablePath(join(directory, command)));
}

function isResolvableCommand(
  command: string | undefined,
  env: NodeJS.ProcessEnv = process.env,
): command is string {
  if (!command) {
    return false;
  }

  if (!command.includes("/")) {
    return isExecutableOnPath(command, env.PATH);
  }

  return isExecutablePath(command);
}

function readUserShell(): string | undefined {
  try {
    return os.userInfo().shell ?? undefined;
  } catch {
    return undefined;
  }
}

export function quoteForPosixShell(value: string): string {
  return `'${value.replace(/'/g, `'\\''`)}'`;
}

function buildInteractiveShellBootstrap(finalCommand: string): string {
  return [
    'if [ -n "${SHELL:-}" ] && [ -x "$SHELL" ]; then',
    '  SHELL_NAME="${SHELL##*/}";',
    "else",
    '  SHELL_NAME="";',
    "fi;",
    'if [ -n "${SHELL:-}" ] && [ -x "$SHELL" ] && [ "$SHELL_NAME" != "sh" ] && [ "$SHELL_NAME" != "dash" ]; then',
    '  SHELL_BIN="$SHELL";',
    "elif command -v bash >/dev/null 2>&1; then",
    '  SHELL_BIN="$(command -v bash)";',
    "elif command -v zsh >/dev/null 2>&1; then",
    '  SHELL_BIN="$(command -v zsh)";',
    'elif [ -n "${SHELL:-}" ] && [ -x "$SHELL" ]; then',
    '  SHELL_BIN="$SHELL";',
    "elif command -v sh >/dev/null 2>&1; then",
    '  SHELL_BIN="$(command -v sh)";',
    "else",
    '  SHELL_BIN="/bin/sh";',
    "fi;",
    "export SHELL_BIN;",
    finalCommand,
  ].join(" ");
}

export function resolvePreferredShell(
  env: NodeJS.ProcessEnv = process.env,
): string {
  const candidates = [
    env.SHELL,
    readUserShell(),
    "/bin/bash",
    "/usr/bin/bash",
    "/bin/zsh",
    "/usr/bin/zsh",
    "/bin/sh",
    "/usr/bin/sh",
  ];

  return (
    candidates.find((candidate) => isResolvableCommand(candidate, env)) ??
    "/bin/sh"
  );
}

export function buildInteractiveShellCommand(command: string): string {
  return buildInteractiveShellBootstrap(
    `exec "$SHELL_BIN" -i -c ${quoteForPosixShell(command)}`,
  );
}

export function buildTmuxCommand(
  command: string,
  keepPaneOpen = false,
): string {
  const paneCommand = keepPaneOpen
    ? `${command}; exec "$SHELL_BIN" -i`
    : command;

  return quoteForPosixShell(buildInteractiveShellCommand(paneCommand));
}

export function resolveTmuxBinary(
  env: NodeJS.ProcessEnv = process.env,
): string {
  const configured = env.TMUX_BINARY?.trim();

  if (isResolvableCommand(configured, env)) {
    return configured;
  }

  const candidates = [
    "/opt/homebrew/bin/tmux",
    "/usr/local/bin/tmux",
    "/usr/bin/tmux",
    "/bin/tmux",
  ];

  return candidates.find(isExecutablePath) ?? "tmux";
}
