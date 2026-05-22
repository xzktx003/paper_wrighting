import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import path from 'path';
import { existsSync } from 'fs';
import { getProjectRoot } from '../services/projectService.js';

// node-pty 是原生模块，需从项目根 node_modules 加载
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootRequire = createRequire(path.join(__dirname, '..', '..', '..', '..', 'node_modules', 'noop.txt'));
const pty = rootRequire('node-pty');

const terminals = new Map();
let nextId = 1;

async function resolveCwd(cwd) {
  if (cwd && cwd.startsWith('__openprism__:')) {
    const id = cwd.replace('__openprism__:', '');
    return await getProjectRoot(id);
  }
  if (cwd && existsSync(cwd)) return cwd;
  return process.env.HOME;
}

export function registerTerminalRoutes(fastify) {
  fastify.get('/api/terminal/ws', { websocket: true }, async (connection, request) => {
    const ws = connection.socket;
    const cwd = await resolveCwd(request.query.cwd);
    const cols = parseInt(request.query.cols) || 80;
    const rows = parseInt(request.query.rows) || 24;
    const shell = process.env.SHELL || '/bin/bash';

    const id = String(nextId++);
    const ptyProcess = pty.spawn(shell, [], {
      name: 'xterm-256color',
      cols,
      rows,
      cwd,
      env: process.env,
    });

    terminals.set(id, ptyProcess);
    ws.send(JSON.stringify({ type: 'id', id }));

    ptyProcess.onData((data) => {
      try { ws.send(JSON.stringify({ type: 'data', data })); } catch (e) {}
    });

    ptyProcess.onExit(({ exitCode }) => {
      try { ws.send(JSON.stringify({ type: 'exit', code: exitCode })); } catch (e) {}
      terminals.delete(id);
      ws.close();
    });

    ws.on('message', (msg) => {
      try {
        const parsed = JSON.parse(msg.toString());
        if (parsed.type === 'data') {
          ptyProcess.write(parsed.data);
        } else if (parsed.type === 'resize') {
          ptyProcess.resize(parsed.cols, parsed.rows);
        }
      } catch (e) {
        ptyProcess.write(msg.toString());
      }
    });

    ws.on('close', () => {
      ptyProcess.kill();
      terminals.delete(id);
    });
  });
}
