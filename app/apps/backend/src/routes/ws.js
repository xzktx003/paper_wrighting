import { watchDirectory, unwatchDirectory } from '../services/fileManager.js';

const clients = new Set();

export function registerWsRoutes(fastify) {
  fastify.get('/api/ws/watch', { websocket: true }, (connection, request) => {
    const ws = connection.socket;
    const projectPath = request.query.projectPath;
    clients.add(ws);

    if (projectPath) {
      watchDirectory(projectPath, (event) => {
        const msg = JSON.stringify({ type: 'file_change', ...event });
        for (const client of clients) {
          try { client.send(msg); } catch (e) { clients.delete(client); }
        }
      });
    }

    ws.on('close', () => {
      clients.delete(ws);
      if (clients.size === 0 && projectPath) {
        unwatchDirectory(projectPath);
      }
    });
  });
}
