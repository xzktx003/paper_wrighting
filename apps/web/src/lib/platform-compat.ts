function shellQuote(value: string): string {
  return `'${value.replace(/'/g, `'\\''`)}'`;
}

function buildExecCommand(command: string, args: string[] = []): string {
  const quotedArgs = args.map((arg) => shellQuote(arg)).join(" ");
  return quotedArgs ? `exec ${command} ${quotedArgs}` : `exec ${command}`;
}

function buildRemoteInteractiveShellBootstrap(finalCommand: string): string {
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

type NavigatorWithUserAgentData = Navigator & {
  userAgentData?: {
    platform?: string;
  };
};

function detectPlatform(): string {
  if (typeof navigator === "undefined") {
    return "";
  }

  const browserNavigator = navigator as NavigatorWithUserAgentData;
  return (
    browserNavigator.userAgentData?.platform ??
    browserNavigator.platform ??
    ""
  ).toLowerCase();
}

export function buildRemoteInteractiveShellCommand(command: string): string {
  return buildRemoteInteractiveShellBootstrap(
    `exec "$SHELL_BIN" -i -c ${shellQuote(command)}`,
  );
}

export function buildRemoteTmuxCommand(
  command: string,
  keepPaneOpen = false,
): string {
  const paneCommand = keepPaneOpen
    ? `${command}; exec "$SHELL_BIN" -i`
    : command;

  return shellQuote(buildRemoteInteractiveShellCommand(paneCommand));
}

export function buildRemoteInteractiveShellExecCommand(): string {
  return buildRemoteInteractiveShellBootstrap('exec "$SHELL_BIN" -i');
}

export function buildResilientCopilotInvocation(args: string[] = []): string {
  return [
    "if command -v copilot >/dev/null 2>&1; then",
    '  COPILOT_BIN="$(command -v copilot)";',
    '  COPILOT_DIR="$(dirname "$COPILOT_BIN")";',
    '  COPILOT_SHEBANG="$(sed -n \'1p\' "$COPILOT_BIN" 2>/dev/null || true)";',
    '  if [ "$COPILOT_SHEBANG" != "#!/usr/bin/env node" ] || [ -f "$COPILOT_DIR/index.js" ]; then',
    `    ${buildExecCommand('"$COPILOT_BIN"', args)};`,
    "  fi;",
    "fi;",
    "if command -v node >/dev/null 2>&1; then",
    '  NODE_BIN="$(command -v node)";',
    '  NODE_DIR="$(dirname "$NODE_BIN")";',
    '  COPILOT_LOADER="$NODE_DIR/../lib/node_modules/@github/copilot/npm-loader.js";',
    '  if [ -f "$COPILOT_LOADER" ]; then',
    `    ${buildExecCommand('"$NODE_BIN" "$COPILOT_LOADER"', args)};`,
    "  fi;",
    "fi;",
    buildExecCommand("copilot", args),
  ].join(" ");
}

export function getQuickTmuxShortcutLabel(): string {
  return detectPlatform().includes("mac") ? "⌘+E" : "Ctrl+E";
}
