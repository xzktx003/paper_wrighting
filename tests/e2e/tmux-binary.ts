import { accessSync, constants } from 'node:fs';

function isExecutablePath(filePath: string): boolean {
  try {
    accessSync(filePath, constants.X_OK);
    return true;
  } catch {
    return false;
  }
}

export function resolveTmuxBinary(): string {
  const configured = process.env.TMUX_BINARY?.trim();

  if (configured) {
    return configured;
  }

  const candidates = [
    '/opt/homebrew/bin/tmux',
    '/usr/local/bin/tmux',
    '/usr/bin/tmux',
    '/bin/tmux',
  ];

  return candidates.find(isExecutablePath) ?? 'tmux';
}