import { useEffect, useRef } from "react";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { WebLinksAddon } from "@xterm/addon-web-links";
import "@xterm/xterm/css/xterm.css";

import { buildTerminalWebSocketUrl } from "../lib/api";

interface TerminalViewProps {
  agentSessionId: string;
  interactive?: boolean;
}

export function TerminalView({
  agentSessionId,
  interactive = true,
}: TerminalViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const termRef = useRef<Terminal | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const fitRef = useRef<FitAddon | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const term = new Terminal({
      cursorBlink: interactive,
      fontSize: interactive ? 14 : 10,
      fontFamily: '"IBM Plex Mono", "SFMono-Regular", monospace',
      theme: {
        background: "#0e1217",
        foreground: "#f4f1ea",
        cursor: "#ff8f1f",
        selectionBackground: "rgba(255, 152, 0, 0.3)",
      },
      scrollback: 5000,
      disableStdin: !interactive,
    });

    const fitAddon = new FitAddon();
    const webLinksAddon = new WebLinksAddon();
    term.loadAddon(fitAddon);
    term.loadAddon(webLinksAddon);
    term.open(container);

    termRef.current = term;
    fitRef.current = fitAddon;

    try {
      fitAddon.fit();
    } catch {
      /* container may not be visible yet */
    }

    const wsUrl = buildTerminalWebSocketUrl(agentSessionId);
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onmessage = (event) => {
      if (typeof event.data === "string") {
        term.write(event.data);
      } else if (event.data instanceof Blob) {
        event.data.text().then((text) => term.write(text));
      }
    };

    ws.onclose = () => {
      term.write("\r\n\x1b[33m[连接已断开]\x1b[0m\r\n");
    };

    if (interactive) {
      term.onData((data) => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(data);
        }
      });
    }

    term.onResize(({ cols, rows }) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: "resize", cols, rows }));
      }
    });

    const resizeObserver = new ResizeObserver(() => {
      try {
        fitAddon.fit();
      } catch {
        /* ignore */
      }
    });
    resizeObserver.observe(container);

    return () => {
      resizeObserver.disconnect();
      ws.close();
      term.dispose();
      termRef.current = null;
      wsRef.current = null;
      fitRef.current = null;
    };
  }, [agentSessionId, interactive]);

  return (
    <div
      ref={containerRef}
      className="terminal-view"
      style={{
        width: "100%",
        height: "100%",
        overflow: "hidden",
      }}
    />
  );
}
