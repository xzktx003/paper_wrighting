import { spawn } from 'child_process';
import path from 'path';
import { existsSync } from 'fs';
import { DATA_DIR } from '../config/constants.js';

const terminals = new Map();
let nextId = 1;

function resolveCwd(cwd) {
  if (cwd && cwd.startsWith('__openprism__:')) {
    const id = cwd.replace('__openprism__:', '');
    return path.join(DATA_DIR, id);
  }
  if (cwd && existsSync(cwd)) return cwd;
  return process.env.HOME;
}

export function registerTerminalRoutes(fastify) {
  fastify.get('/api/terminal/ws', { websocket: true }, (connection, request) => {
    const ws = connection.socket;
    const cwd = resolveCwd(request.query.cwd);
    const cols = parseInt(request.query.cols) || 80;
    const rows = parseInt(request.query.rows) || 24;
    const shell = process.env.SHELL || '/bin/bash';

    const id = String(nextId++);
    const proc = spawn('script', ['-qc', shell, '/dev/null'], {
      cwd,
      env: { ...process.env, TERM: 'xterm-256color', COLUMNS: String(cols), LINES: String(rows) },
    });

    terminals.set(id, proc);
    ws.send(JSON.stringify({ type: 'id', id }));

    proc.stdout.on('data', (data) => {
      try { ws.send(JSON.stringify({ type: 'data', data: data.toString() })); } catch (e) {}
    });

    proc.stderr.on('data', (data) => {
      try { ws.send(JSON.stringify({ type: 'data', data: data.toString() })); } catch (e) {}
    });

    proc.on('exit', (code) => {
      try { ws.send(JSON.stringify({ type: 'exit', code })); } catch (e) {}
      terminals.delete(id);
      ws.close();
    });

    ws.on('message', (msg) => {
      try {
        const parsed = JSON.parse(msg.toString());
        if (parsed.type === 'data') {
          proc.stdin.write(parsed.data);
        } else if (parsed.type === 'resize') {
          // Cannot resize without PTY, but accept the message
        }
      } catch (e) {
        proc.stdin.write(msg.toString());
      }
    });

    ws.on('close', () => {
      proc.kill();
      terminals.delete(id);
    });
  });
}
