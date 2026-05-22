import { useEffect, useRef } from 'react';

interface FileChangeEvent {
  type: 'file_change';
  eventType: string;
  filename: string;
  path: string;
}

export function useFileWatcher(projectPath: string | null, onFileChange: (event: FileChangeEvent) => void) {
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    if (!projectPath) return;

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const url = `${protocol}//${window.location.host}/api/ws/watch?projectPath=${encodeURIComponent(projectPath)}`;
    const ws = new WebSocket(url);

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'file_change') {
          onFileChange(data);
        }
      } catch (e) {
        // ignore parse errors
      }
    };

    wsRef.current = ws;

    return () => {
      ws.close();
      wsRef.current = null;
    };
  }, [projectPath, onFileChange]);
}
