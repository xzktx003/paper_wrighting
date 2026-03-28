#!/usr/bin/env node

import { spawnSync } from 'node:child_process';

const tmuxBinary = '/opt/homebrew/bin/tmux';
const sessionName = 'agent-orchestrator-e2e';

function runTmux(args) {
  const result = spawnSync(tmuxBinary, args, { encoding: 'utf8' });

  if (result.status !== 0) {
    throw new Error(result.stderr.trim() || `tmux ${args.join(' ')} failed`);
  }
}

try {
  spawnSync(tmuxBinary, ['kill-session', '-t', sessionName], {
    encoding: 'utf8',
  });
  runTmux([
    'new-session',
    '-d',
    '-s',
    sessionName,
    'node scripts/mock-agent.mjs',
  ]);
  console.log(sessionName);
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}