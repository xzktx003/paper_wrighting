import assert from "node:assert/strict";
import test from "node:test";

import { buildServer } from "../app.js";

async function waitForReplayFrame(
  terminalUrl: string,
  timeoutMs = 3_000,
): Promise<{ event: string; data?: string }> {
  return new Promise((resolve, reject) => {
    const socket = new WebSocket(terminalUrl);
    const timeoutId = setTimeout(() => {
      socket.close();
      reject(new Error("terminal websocket did not emit a replay frame"));
    }, timeoutMs);

    const cleanup = () => {
      clearTimeout(timeoutId);
      socket.close();
    };

    socket.addEventListener("message", async (event) => {
      const payload =
        typeof event.data === "string" ? event.data : await event.data.text();
      const parsed = JSON.parse(payload) as {
        __agentOrchestrator?: string;
        event?: string;
        data?: string;
      };

      if (parsed.__agentOrchestrator !== "terminal-control") {
        return;
      }

      if (parsed.event !== "replay") {
        return;
      }

      cleanup();
      resolve({ event: parsed.event, data: parsed.data });
    });

    socket.addEventListener("close", (event) => {
      clearTimeout(timeoutId);
      reject(
        new Error(
          `terminal websocket closed before replay: ${event.code} ${event.reason}`,
        ),
      );
    });

    socket.addEventListener("error", () => {
      clearTimeout(timeoutId);
      reject(new Error("terminal websocket connection failed"));
    });
  });
}

test("terminal websocket replay strips CPR queries before sending scrollback to new clients", async () => {
  const { app } = buildServer();
  let agentSessionId: string | undefined;

  await app.listen({ port: 0, host: "127.0.0.1" });
  const address = app.server.address();

  assert.ok(address && typeof address === "object");

  const baseUrl = `http://127.0.0.1:${address.port}`;
  const terminalUrl = `ws://127.0.0.1:${address.port}`;

  try {
    const launchResponse = await fetch(`${baseUrl}/api/agent-launch/pty`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        workspaceId: "default",
        displayName: `terminal-replay-${Date.now()}`,
        agentKind: "shell",
        command: "printf 'cpr-burst-start\\n'; printf '\\033[6n'; sleep 5",
        workingDirectory: process.cwd(),
      }),
    });

    assert.equal(launchResponse.status, 201);

    const payload = (await launchResponse.json()) as { id: string };
    agentSessionId = payload.id;

    await new Promise((resolve) => setTimeout(resolve, 350));

    const replayFrame = await waitForReplayFrame(
      `${terminalUrl}/ws/agent-sessions/${agentSessionId}/terminal`,
    );

    assert.equal(replayFrame.event, "replay");
    assert.match(replayFrame.data ?? "", /cpr-burst-start/);
    assert.doesNotMatch(replayFrame.data ?? "", /\[6n|\[6n/);
  } finally {
    if (agentSessionId) {
      await fetch(`${baseUrl}/api/agent-sessions/${agentSessionId}`, {
        method: "DELETE",
      }).catch(() => {});
    }

    await app.close();
  }
});
