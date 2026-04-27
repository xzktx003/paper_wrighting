# Terminal OSC Color Reply Filter Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stop noisy OSC 10/11/4 color-query replies from appearing in the kanban terminal without breaking Copilot CLI and other TUI capability handshakes.

**Architecture:** Extend the existing narrow live-stdin filters instead of broadening replay sanitization. Keep the frontend and backend `stripTerminalResponsePayload` behavior aligned so xterm-originated input is filtered consistently before PTY writes, then prove the behavior with unit and websocket regression tests.

**Tech Stack:** TypeScript, React, Fastify, WebSocket, node:test, pnpm

---

### Task 1: Add failing frontend regression coverage

**Files:**
- Modify: `apps/web/src/lib/terminal-input.test.ts`
- Test: `apps/web/src/lib/terminal-input.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
  it('strips OSC color-query replies so rgb payload noise never reaches the PTY', () => {
    assert.equal(
      stripTerminalResponsePayload(
        '\u001b]11;rgb:0e0e/1212/1717\u0007\u001b]10;rgb:f4f4/f1f1/eaea\u0007',
      ),
      '',
    );
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter web exec tsx --test src/lib/terminal-input.test.ts`
Expected: FAIL because `stripTerminalResponsePayload(...)` still returns the OSC payload unchanged.

- [ ] **Step 3: Write minimal implementation**

```ts
const FOCUS_REPORT_PATTERN = /\u001b\[[IO]/g;
const OSC_COLOR_REPLY_PATTERN =
  /\u001b\](?:10|11|4);[^\u0007\u001b]*(?:\u0007|\u001b\\)/g;

export function stripTerminalResponsePayload(payload: string): string {
  return payload
    .replace(FOCUS_REPORT_PATTERN, '')
    .replace(OSC_COLOR_REPLY_PATTERN, '');
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter web exec tsx --test src/lib/terminal-input.test.ts`
Expected: PASS, including the existing focus-report and DA/DSR/CPR assertions.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/terminal-input.ts apps/web/src/lib/terminal-input.test.ts
git commit -m "fix: filter noisy OSC color replies"
```

### Task 2: Add failing backend regression coverage and implementation

**Files:**
- Modify: `apps/server/src/services/terminal-control-filter.ts`
- Modify: `apps/server/src/services/terminal-control-filter.test.ts`
- Test: `apps/server/src/services/terminal-control-filter.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
test('strip OSC color-query replies so shell prompts do not echo rgb payload noise', () => {
  const sanitized = stripTerminalResponsePayload(
    '\u001b]11;rgb:0e0e/1212/1717\u0007\u001b]10;rgb:f4f4/f1f1/eaea\u0007',
  );

  assert.equal(sanitized, '');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter server exec tsx --test src/services/terminal-control-filter.test.ts`
Expected: FAIL because the backend currently strips only Secondary DA replies.

- [ ] **Step 3: Write minimal implementation**

```ts
const TERMINAL_INPUT_PATTERNS = [
  /\u001b\[>[\d;]*c/g,
  /\u001b\](?:10|11|4);[^\u0007\u001b]*(?:\u0007|\u001b\\)/g,
];

export function stripTerminalResponsePayload(payload: string): string {
  return stripPatterns(payload, TERMINAL_INPUT_PATTERNS);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter server exec tsx --test src/services/terminal-control-filter.test.ts`
Expected: PASS, while the existing Primary DA, DSR, CPR, replay-sanitization, and Secondary DA assertions remain green.

- [ ] **Step 5: Commit**

```bash
git add apps/server/src/services/terminal-control-filter.ts apps/server/src/services/terminal-control-filter.test.ts
git commit -m "fix: drop OSC color reply noise in terminal input"
```

### Task 3: Prove websocket behavior and document the bugfix

**Files:**
- Modify: `apps/server/src/routes/terminal-websocket.test.ts`
- Modify: `docs/debug_list.md`
- Test: `apps/server/src/routes/terminal-websocket.test.ts`

- [ ] **Step 1: Write the failing websocket regression**

```ts
test('terminal websocket strips OSC color-query replies so rgb payload noise does not echo into the terminal', async () => {
  const { app } = buildServer();
  let agentSessionId: string | undefined;
  let terminal: WaitForTerminalTextResult | undefined;

  await app.listen({ port: 0, host: '127.0.0.1' });
  const address = app.server.address();

  assert.ok(address && typeof address === 'object');

  const baseUrl = `http://127.0.0.1:${address.port}`;
  const terminalBaseUrl = `ws://127.0.0.1:${address.port}`;

  try {
    const createRes = await fetch(`${baseUrl}/api/agent-launch/pty`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        workspaceId: 'default',
        displayName: 'terminal-osc-color-filter',
        agentKind: 'shell',
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
    await terminal.waitFor('__READY__');

    terminal.send(
      "\u001b]11;rgb:0e0e/1212/1717\u0007printf '__FILTER_OK__\\n'\n",
    );
    await terminal.waitFor('__FILTER_OK__');

    const output = terminal.getBuffer();
    assert.match(output, /__FILTER_OK__/);
    assert.doesNotMatch(output, /rgb:/);
  } finally {
    terminal?.close();

    if (agentSessionId) {
      await fetch(`${baseUrl}/api/agent-sessions/${agentSessionId}`, {
        method: 'DELETE',
      }).catch(() => {});
    }

    await app.close();
  }
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter server exec tsx --test src/routes/terminal-websocket.test.ts`
Expected: FAIL because the live input path still lets the OSC color reply through.

- [ ] **Step 3: Update the bug log**

```md
- shell/prompt 或 TUI 触发的 OSC 10/11/4 颜色查询应答会偶发把 `rgb:` 串回显到 kanban 终端。修复为仅在 live stdin 额外过滤这类明确的颜色查询回包，保留 DA/DSR/CPR 与其他 TUI 握手应答。
```

- [ ] **Step 4: Run targeted verification**

Run: `pnpm --filter server exec tsx --test src/routes/terminal-websocket.test.ts src/services/terminal-control-filter.test.ts && pnpm --filter web exec tsx --test src/lib/terminal-input.test.ts`
Expected: PASS, and the websocket test confirms `rgb:` no longer appears in terminal output.

- [ ] **Step 5: Commit**

```bash
git add apps/server/src/routes/terminal-websocket.test.ts docs/debug_list.md
git commit -m "test: cover OSC color reply terminal filtering"
```

### Task 4: Run repo-required formatting and affected validation

**Files:**
- Modify: `apps/web/src/lib/terminal-input.ts`
- Modify: `apps/web/src/lib/terminal-input.test.ts`
- Modify: `apps/server/src/services/terminal-control-filter.ts`
- Modify: `apps/server/src/services/terminal-control-filter.test.ts`
- Modify: `apps/server/src/routes/terminal-websocket.test.ts`
- Modify: `docs/debug_list.md`

- [ ] **Step 1: Format the touched files**

Run: `pnpm format`
Expected: formatting completes without introducing unrelated changes that need manual rollback.

- [ ] **Step 2: Run the affected checks**

Run: `pnpm --filter web exec tsx --test src/lib/terminal-input.test.ts && pnpm --filter server exec tsx --test src/services/terminal-control-filter.test.ts src/routes/terminal-websocket.test.ts`
Expected: PASS for all touched frontend and backend regression suites.

- [ ] **Step 3: Run the cross-repo safety net**

Run: `pnpm check`
Expected: PASS for shared typing across the affected frontend and backend code paths.

- [ ] **Step 4: Review the final diff**

Run: `git --no-pager diff --stat && git --no-pager diff -- apps/web/src/lib/terminal-input.ts apps/web/src/lib/terminal-input.test.ts apps/server/src/services/terminal-control-filter.ts apps/server/src/services/terminal-control-filter.test.ts apps/server/src/routes/terminal-websocket.test.ts docs/debug_list.md`
Expected: Only the planned frontend filter, backend filter, tests, and bug-log entry are changed.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/terminal-input.ts apps/web/src/lib/terminal-input.test.ts apps/server/src/services/terminal-control-filter.ts apps/server/src/services/terminal-control-filter.test.ts apps/server/src/routes/terminal-websocket.test.ts docs/debug_list.md
git commit -m "fix: suppress terminal OSC color reply noise"
```
