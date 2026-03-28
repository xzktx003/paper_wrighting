#!/usr/bin/env node

import { spawnSync } from 'node:child_process';

const tmuxBinary = '/opt/homebrew/bin/tmux';
const sessionName = 'agent-orchestrator-e2e';

const result = spawnSync(tmuxBinary, ['kill-session', '-t', sessionName], {
  encoding: 'utf8',
});

if (result.status !== 0 && !result.stderr.includes("can't find session")) {
  console.error(result.stderr.trim() || 'Failed to teardown tmux session');
  process.exit(1);
}