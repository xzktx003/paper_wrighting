import assert from "node:assert/strict";
import test from "node:test";

import { buildServer } from "../app.js";

interface WaitForTerminalTextResult {
  close: () => void;
  getBuffer: () => string;
  send: (payload: string) => void;
  waitFor: (marker: string, timeoutMs?: number) => Promise<void>;
}

async function openTerminal(
  terminalUrl: string,
): Promise<WaitForTerminalTextResult> {
  const socket = new WebSocket(terminalUrl);
  let buffer = "";

  await new Promise<void>((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      reject(new Error("terminal websocket did not open in time"));
    }, 3_000);

    socket.addEventListener("open", () => {
      clearTimeout(timeoutId);
      resolve();
    });
    socket.addEventListener("error", () => {
      clearTimeout(timeoutId);
      reject(new Error("terminal websocket connection failed"));
    });
  });

  socket.addEventListener("message", async (event) => {
    const payload =
      typeof event.data === "string" ? event.data : await event.data.text();

    try {
      const parsed = JSON.parse(payload) as {
        __agentOrchestrator?: string;
        data?: string;
      };

      if (parsed.__agentOrchestrator === "terminal-control") {
        if (typeof parsed.data === "string") {
          buffer += parsed.data;
        }
        return;
      }
    } catch {
      // plain terminal payload
    }

    buffer += payload;
  });

  return {
    close: () => socket.close(),
    getBuffer: () => buffer,
    send: (payload: string) => socket.send(payload),
    waitFor: (marker: string, timeoutMs = 3_000) =>
      new Promise((resolve, reject) => {
        const deadline = Date.now() + timeoutMs;

        const poll = () => {
          if (buffer.includes(marker)) {
            resolve();
            return;
          }

          if (Date.now() >= deadline) {
            reject(
              new Error(`terminal websocket did not receive marker ${marker}`),
            );
            return;
          }

          setTimeout(poll, 25);
        };

        poll();
      }),
  };
}

test("terminal websocket forwards primary device-attribute replies so TUIs can finish their capability handshake", async () => {
  const { app } = buildServer();
  let agentSessionId: string | undefined;
  let terminal: WaitForTerminalTextResult | undefined;

  await app.listen({ port: 0, host: "127.0.0.1" });
  const address = app.server.address();

  assert.ok(address && typeof address === "object");

  const baseUrl = `http://127.0.0.1:${address.port}`;
  const terminalBaseUrl = `ws://127.0.0.1:${address.port}`;

  try {
    const createRes = await fetch(`${baseUrl}/api/agent-launch/pty`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        workspaceId: "default",
        displayName: "terminal-filter",
        agentKind: "shell",
        workingDirectory: process.cwd(),
        command: "printf '__READY__\\n'",
      }),
    });

    assert.equal(createRes.status, 201);

    const payload = (await createRes.json()) as { id: string };
    agentSessionId = payload.id;

    terminal = await openTerminal(
      `${terminalBaseUrl}/ws/agent-sessions/${agentSessionId}/terminal`,
    );
    await terminal.waitFor("__READY__");

    terminal.send("\u001b[?1;2cprintf '__FILTER_OK__\\n'\n");
    await terminal.waitFor("__FILTER_OK__");

    const output = terminal.getBuffer();
    assert.match(output, /__FILTER_OK__/);
    assert.match(output, /\?1;2c/);
  } finally {
    terminal?.close();

    if (agentSessionId) {
      await fetch(`${baseUrl}/api/agent-sessions/${agentSessionId}`, {
        method: "DELETE",
      }).catch(() => {});
    }

    await app.close();
  }
});

test("terminal websocket strips secondary device-attribute replies so shell prompts do not echo terminal version noise", async () => {
  const { app } = buildServer();
  let agentSessionId: string | undefined;
  let terminal: WaitForTerminalTextResult | undefined;

  await app.listen({ port: 0, host: "127.0.0.1" });
  const address = app.server.address();

  assert.ok(address && typeof address === "object");

  const baseUrl = `http://127.0.0.1:${address.port}`;
  const terminalBaseUrl = `ws://127.0.0.1:${address.port}`;

  try {
    const createRes = await fetch(`${baseUrl}/api/agent-launch/pty`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        workspaceId: "default",
        displayName: "terminal-secondary-da-filter",
        agentKind: "shell",
        workingDirectory: process.cwd(),
        command: "printf '__READY__\\n'",
      }),
    });

    assert.equal(createRes.status, 201);

    const payload = (await createRes.json()) as { id: string };
    agentSessionId = payload.id;

    terminal = await openTerminal(
      `${terminalBaseUrl}/ws/agent-sessions/${agentSessionId}/terminal`,
    );
    await terminal.waitFor("__READY__");

    terminal.send("\u001b[>0;276;0cprintf '__FILTER_OK__\\n'\n");
    await terminal.waitFor("__FILTER_OK__");

    const output = terminal.getBuffer();
    assert.match(output, /__FILTER_OK__/);
    assert.doesNotMatch(output, /0;276;0c/);
  } finally {
    terminal?.close();

    if (agentSessionId) {
      await fetch(`${baseUrl}/api/agent-sessions/${agentSessionId}`, {
        method: "DELETE",
      }).catch(() => {});
    }

    await app.close();
  }
});

test("terminal websocket strips OSC color-query replies so rgb payload noise never echoes into the terminal", async () => {
  const { app } = buildServer();
  let agentSessionId: string | undefined;
  let terminal: WaitForTerminalTextResult | undefined;

  await app.listen({ port: 0, host: "127.0.0.1" });
  const address = app.server.address();

  assert.ok(address && typeof address === "object");

  const baseUrl = `http://127.0.0.1:${address.port}`;
  const terminalBaseUrl = `ws://127.0.0.1:${address.port}`;

  try {
    const createRes = await fetch(`${baseUrl}/api/agent-launch/pty`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        workspaceId: "default",
        displayName: "terminal-osc-color-filter",
        agentKind: "shell",
        workingDirectory: process.cwd(),
        command: "printf '__READY__\\n'",
      }),
    });

    assert.equal(createRes.status, 201);

    const payload = (await createRes.json()) as { id: string };
    agentSessionId = payload.id;

    terminal = await openTerminal(
      `${terminalBaseUrl}/ws/agent-sessions/${agentSessionId}/terminal`,
    );
    await terminal.waitFor("__READY__");

    terminal.send(
      "\u001b]11;rgb:0e0e/1212/1717\u0007\u001b]10;rgb:f4f4/f1f1/eaea\u0007\u001b]4;0;rgb:0000/0000/0000\u0007printf '__FILTER_OK__\\n'\n",
    );
    await terminal.waitFor("__FILTER_OK__");

    const output = terminal.getBuffer();
    assert.match(output, /__FILTER_OK__/);
    assert.doesNotMatch(output, /rgb:/);
  } finally {
    terminal?.close();

    if (agentSessionId) {
      await fetch(`${baseUrl}/api/agent-sessions/${agentSessionId}`, {
        method: "DELETE",
      }).catch(() => {});
    }

    await app.close();
  }
});
