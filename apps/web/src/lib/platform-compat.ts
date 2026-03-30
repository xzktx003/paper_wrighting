function shellQuote(value: string): string {
  return `'${value.replace(/'/g, `'\\''`)}'`;
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
  return [
    'if [ -n "${SHELL:-}" ] && [ -x "$SHELL" ]; then',
    '  SHELL_BIN="$SHELL";',
    "elif command -v bash >/dev/null 2>&1; then",
    '  SHELL_BIN="$(command -v bash)";',
    "elif command -v zsh >/dev/null 2>&1; then",
    '  SHELL_BIN="$(command -v zsh)";',
    "elif command -v sh >/dev/null 2>&1; then",
    '  SHELL_BIN="$(command -v sh)";',
    "else",
    '  SHELL_BIN="/bin/sh";',
    "fi;",
    `exec "$SHELL_BIN" -i -c ${shellQuote(command)}`,
  ].join(" ");
}

export function getQuickTmuxShortcutLabel(): string {
  return detectPlatform().includes("mac") ? "⌘+E" : "Ctrl+E";
}
