# Agent Dashboard V3 — Implementation Plan

**Goal:** Implement all 8 features from the V3 design: collapsible sidebar with SSH config presets, scan result sorting + dedup marking, grid card info enhancement, filtering, delete, reconnect, new session creation.

**Architecture:** React + TypeScript frontend (Vite), Node.js + TypeScript + Fastify backend, shared types package, pnpm monorepo.

**Tech Stack:** TypeScript, React, Fastify, node-pty, xterm.js, SSH config parser (custom).

---

## Task 1: Extend shared types

**Step 1: Add new types and extend existing ones**
- File: `packages/shared/src/index.ts`
- Add `SshHostPreset` and `SshHostsResponse` interfaces
- Extend `AgentSessionRecord` with `agentSessionId`, `sshTarget`, `remoteCommand`
- Extend `RegisterAgentSessionInput` with same fields
- Code:
  ```typescript
  // Add after SshTarget interface:

  export interface SshHostPreset {
    name: string;
    host: string;
    port: number;
    username?: string;
    identityFile?: string;
    defaultPath: string;
  }

  export interface SshHostsResponse {
    hosts: SshHostPreset[];
  }

  // Add to AgentSessionRecord (after transportRef):
  agentSessionId?: string;
  sshTarget?: SshTarget;
  remoteCommand?: string;

  // Add to RegisterAgentSessionInput (after transportRef):
  agentSessionId?: string;
  sshTarget?: SshTarget;
  remoteCommand?: string;
  ```

**Step 2: Build shared package**
- Command: `pnpm --filter @agent-orchestrator/shared build`
- Expected: Clean build, no errors

---

## Task 2: Backend — SSH config parser

**Step 1: Create ssh-config-parser.ts**
- File: `apps/server/src/services/ssh-config-parser.ts`
- Code:
  ```typescript
  import { readFileSync } from 'node:fs';
  import { resolve } from 'node:path';
  import { homedir } from 'node:os';

  import type { SshHostPreset } from '@agent-orchestrator/shared';

  interface ParsedHost {
    name: string;
    hostname?: string;
    port?: string;
    user?: string;
    identityFile?: string;
  }

  export function parseSshConfig(): SshHostPreset[] {
    const configPath = resolve(homedir(), '.ssh', 'config');
    let content: string;
    try {
      content = readFileSync(configPath, 'utf-8');
    } catch {
      return [];
    }

    const hosts: ParsedHost[] = [];
    let current: ParsedHost | null = null;

    for (const rawLine of content.split('\n')) {
      const line = rawLine.trim();
      if (!line || line.startsWith('#')) continue;

      const match = line.match(/^(\w+)\s+(.+)$/);
      if (!match) continue;

      const [, key, value] = match;
      const keyLower = key.toLowerCase();

      if (keyLower === 'host') {
        // Skip wildcard hosts
        if (value.includes('*') || value.includes('?')) continue;
        current = { name: value };
        hosts.push(current);
      } else if (current) {
        if (keyLower === 'hostname') current.hostname = value;
        else if (keyLower === 'port') current.port = value;
        else if (keyLower === 'user') current.user = value;
        else if (keyLower === 'identityfile') {
          current.identityFile = value.replace(/^~/, homedir());
        }
      }
    }

    return hosts
      .filter((h) => h.hostname)
      .map((h) => ({
        name: h.name,
        host: h.hostname!,
        port: parseInt(h.port ?? '22', 10),
        username: h.user,
        identityFile: h.identityFile,
        defaultPath: '~/',
      }));
  }
  ```

**Step 2: Type check**
- Command: `pnpm --filter server exec tsc --noEmit`
- Expected: No errors

---

## Task 3: Backend — SSH hosts route

**Step 1: Create ssh-hosts route file**
- File: `apps/server/src/routes/ssh-hosts.ts`
- Code:
  ```typescript
  import type { FastifyInstance } from 'fastify';

  import { parseSshConfig } from '../services/ssh-config-parser.js';

  export async function registerSshHostsRoutes(
    fastify: FastifyInstance,
  ): Promise<void> {
    fastify.get('/api/ssh-hosts', async () => {
      const hosts = parseSshConfig();
      return { hosts };
    });
  }
  ```

**Step 2: Register route in app.ts**
- File: `apps/server/src/app.ts`
- Add import: `import { registerSshHostsRoutes } from './routes/ssh-hosts.js';`
- Add inside `app.register(async (instance) => { ... })`:
  ```typescript
  await registerSshHostsRoutes(instance);
  ```

**Step 3: Type check**
- Command: `pnpm --filter server exec tsc --noEmit`
- Expected: No errors

---

## Task 4: Backend — Delete session API + kill PTY

**Step 1: Add `remove` method to AgentSessionRegistry**
- File: `apps/server/src/services/agent-session-registry.ts`
- Add after `markExited` method:
  ```typescript
  remove(agentSessionId: string): void {
    this.sessions.delete(agentSessionId);
    this.outputEntries.delete(agentSessionId);
    if (this.activeAgentSessionId === agentSessionId) {
      this.activeAgentSessionId = null;
    }
    this.emitSnapshot();
  }
  ```

**Step 2: Add `kill` method to PtyRuntimeManager**
- File: `apps/server/src/services/pty-runtime-manager.ts`
- Add after `has` method, before `private appendScrollback`:
  ```typescript
  kill(agentSessionId: string): void {
    const handle = this.handles.get(agentSessionId);
    if (handle) {
      handle.ptyProcess.kill();
      this.handles.delete(agentSessionId);
    }
  }
  ```

**Step 3: Add reconnect method to PtyRuntimeManager**
- File: `apps/server/src/services/pty-runtime-manager.ts`
- Add after `kill` method:
  ```typescript
  reconnect(agentSessionId: string, input: LaunchSshPtyInput): AgentSessionRecord {
    // Kill existing PTY if still alive
    this.kill(agentSessionId);

    const args = ['-t'];
    if (input.sshTarget.port) {
      args.push('-p', String(input.sshTarget.port));
    }
    if (input.sshTarget.identityFile) {
      args.push('-i', input.sshTarget.identityFile);
    }
    const userHost = input.sshTarget.username
      ? `${input.sshTarget.username}@${input.sshTarget.host}`
      : input.sshTarget.host;
    args.push(userHost, input.remoteCommand);

    const ptyProcess = pty.spawn('ssh', args, {
      name: 'xterm-256color',
      cols: 120,
      rows: 30,
      cwd: process.env.HOME ?? process.cwd(),
      env: process.env as Record<string, string>,
    });

    const handle: PtyHandle = {
      ptyProcess,
      dataListeners: new Set(),
      scrollback: [],
      scrollbackBytes: 0,
    };
    this.handles.set(agentSessionId, handle);

    this.registry.updateSession(agentSessionId, {
      connectionState: 'online',
      interactionState: 'running',
      stateConfidence: 'medium',
      outputPreview: `重新连接中: SSH → ${userHost}`,
      transportRef: {
        processId: ptyProcess.pid,
        runtimeId: `ssh-pty:${ptyProcess.pid}`,
        sshHost: input.sshTarget.host,
        sshPort: input.sshTarget.port,
        sshUsername: input.sshTarget.username,
      },
    });

    ptyProcess.onData((data: string) => {
      this.appendScrollback(handle, data);
      for (const listener of handle.dataListeners) {
        listener(data);
      }
      this.registry.appendOutput(agentSessionId, data, 'stdout');
    });

    ptyProcess.onExit(({ exitCode }) => {
      this.handles.delete(agentSessionId);
      this.registry.markExited(agentSessionId, exitCode, null);
    });

    return this.registry.get(agentSessionId);
  }

  reconnectLocal(agentSessionId: string, input: LaunchLocalAgentInput): AgentSessionRecord {
    this.kill(agentSessionId);

    const shell = process.env.SHELL ?? '/bin/zsh';
    const ptyProcess = pty.spawn(shell, [], {
      name: 'xterm-256color',
      cols: 120,
      rows: 30,
      cwd: input.workingDirectory ?? process.cwd(),
      env: process.env as Record<string, string>,
    });

    const handle: PtyHandle = {
      ptyProcess,
      dataListeners: new Set(),
      scrollback: [],
      scrollbackBytes: 0,
    };
    this.handles.set(agentSessionId, handle);

    this.registry.updateSession(agentSessionId, {
      connectionState: 'online',
      interactionState: 'running',
      stateConfidence: 'medium',
      outputPreview: `重新连接中: ${input.command}`,
      transportRef: {
        processId: ptyProcess.pid,
        runtimeId: `pty:${ptyProcess.pid}`,
      },
    });

    ptyProcess.onData((data: string) => {
      this.appendScrollback(handle, data);
      for (const listener of handle.dataListeners) {
        listener(data);
      }
      this.registry.appendOutput(agentSessionId, data, 'stdout');
    });

    ptyProcess.onExit(({ exitCode }) => {
      this.handles.delete(agentSessionId);
      this.registry.markExited(agentSessionId, exitCode, null);
    });

    if (input.command) {
      ptyProcess.write(input.command + '\n');
    }

    return this.registry.get(agentSessionId);
  }
  ```

**Step 4: Store reconnect info in `launchRemote`**
- File: `apps/server/src/services/pty-runtime-manager.ts`
- In `launchRemote`, after `this.registry.register({...})`, store extra fields:
  The register call should include `agentSessionId`, `sshTarget`, and `remoteCommand` from input.

**Step 5: Add DELETE and reconnect routes**
- File: `apps/server/src/routes/agent-sessions.ts`
- Add at end of `registerAgentSessionRoutes`:
  ```typescript
  fastify.delete<{ Params: { id: string } }>(
    '/api/agent-sessions/:id',
    async (request, reply) => {
      const { id } = request.params;
      ptyRuntimeManager.kill(id);
      registry.remove(id);
      reply.code(204);
    },
  );

  fastify.post<{ Params: { id: string } }>(
    '/api/agent-sessions/:id/reconnect',
    async (request) => {
      const session = registry.get(request.params.id);
      if (session.sshTarget && session.remoteCommand) {
        return ptyRuntimeManager.reconnect(request.params.id, {
          workspaceId: session.workspaceId,
          displayName: session.displayName,
          agentKind: session.agentKind,
          sshTarget: session.sshTarget,
          remoteCommand: session.remoteCommand,
          workingDirectory: session.workingDirectory,
        });
      }
      // Local reconnect
      const cmd = session.agentSessionId
        ? `cd '${session.workingDirectory}' && ${session.agentKind} --resume=${session.agentSessionId}`
        : `cd '${session.workingDirectory}' && ${session.agentKind}`;
      return ptyRuntimeManager.reconnectLocal(request.params.id, {
        workspaceId: session.workspaceId,
        displayName: session.displayName,
        agentKind: session.agentKind,
        command: cmd,
        workingDirectory: session.workingDirectory,
      });
    },
  );
  ```

**Step 6: Type check**
- Command: `pnpm --filter server exec tsc --noEmit`
- Expected: No errors

---

## Task 5: Backend — Store reconnect info on register

**Step 1: Update registry.register to pass through new fields**
- File: `apps/server/src/services/agent-session-registry.ts`
- In `register` method, add to the `agentSession` object construction:
  ```typescript
  agentSessionId: input.agentSessionId,
  sshTarget: input.sshTarget,
  remoteCommand: input.remoteCommand,
  ```

**Step 2: Update pty-runtime-manager.launchRemote to pass reconnect info**
- File: `apps/server/src/services/pty-runtime-manager.ts`
- In `launchRemote`, add to the `this.registry.register({...})` call:
  ```typescript
  agentSessionId: input.agentSessionId,
  sshTarget: input.sshTarget,
  remoteCommand: input.remoteCommand,
  ```
  (Note: `LaunchSshPtyInput` needs `agentSessionId` added.)

**Step 3: Update LaunchSshPtyInput in shared types**
- File: `packages/shared/src/index.ts`
- Add `agentSessionId?: string;` to `LaunchSshPtyInput`

**Step 4: Build and type check**
- Command: `pnpm --filter @agent-orchestrator/shared build && pnpm --filter server exec tsc --noEmit`
- Expected: No errors

---

## Task 6: Frontend — API layer additions

**Step 1: Add new API functions**
- File: `apps/web/src/lib/api.ts`
- Add imports for `SshHostsResponse`
- Add functions:
  ```typescript
  export function getSshHosts(): Promise<SshHostsResponse> {
    return request<SshHostsResponse>('/api/ssh-hosts');
  }

  export function deleteAgentSession(agentSessionId: string): Promise<void> {
    return request<void>(`/api/agent-sessions/${agentSessionId}`, {
      method: 'DELETE',
    });
  }

  export function reconnectAgentSession(
    agentSessionId: string,
  ): Promise<AgentSessionRecord> {
    return request<AgentSessionRecord>(
      `/api/agent-sessions/${agentSessionId}/reconnect`,
      { method: 'POST' },
    );
  }
  ```

**Step 2: Type check**
- Command: `pnpm --filter web exec tsc --noEmit`
- Expected: No errors

---

## Task 7: Frontend — SideDrawer rewrite (collapsible panels)

**Step 1: Rewrite SideDrawer.tsx**
- File: `apps/web/src/components/SideDrawer.tsx`
- Complete rewrite — replace tabs with three collapsible sections:
  1. Hosts section (radio select from SSH config + local + scan buttons)
  2. Scan results section (sorted, with "已在宫格" markers)
  3. New session section (create form)

- The component now needs additional props:
  ```typescript
  interface SideDrawerProps {
    open: boolean;
    sessions: AgentSessionRecord[];
    onLaunched: () => void;
    onFocusSession: (id: string) => void;
  }
  ```

- Key behaviors:
  - On mount, call `getSshHosts()` to load SSH presets
  - Host section: radio list with "本地" first, then SSH hosts
  - Each host has an editable scan path (default `~/`)
  - Scan button triggers local or remote scan based on selected host
  - Scan results sorted: running first, then by agentKind priority, then alphabetically
  - Each result checks against `sessions` prop to detect "已在宫格"
  - Match logic: `sessionId` match on `session.agentSessionId`, or `tmuxSession` match on `transportRef.tmuxSession`, or `hostId + workingDirectory + agentKind` combo match
  - Matched results show "聚焦" button calling `onFocusSession`
  - New session form: name, type dropdown (copilot/codex/claude), directory, host dropdown, connection mode (direct/tmux)

**Step 2: Type check**
- Command: `pnpm --filter web exec tsc --noEmit`
- Expected: No errors

---

## Task 8: Frontend — App.tsx update (filters + session props)

**Step 1: Add filter state and pass props**
- File: `apps/web/src/App.tsx`
- Add filter state:
  ```typescript
  const [filters, setFilters] = useState<{
    host: string | null;
    kind: string | null;
    dirQuery: string;
  }>({ host: null, kind: null, dirQuery: '' });
  ```

- Add filtered sessions computation:
  ```typescript
  const filteredSessions = sessions.filter((s) => {
    if (filters.host && (s.hostId ?? 'local') !== filters.host) return false;
    if (filters.kind && s.agentKind !== filters.kind) return false;
    if (filters.dirQuery && !(s.workingDirectory ?? '').toLowerCase()
      .includes(filters.dirQuery.toLowerCase())) return false;
    return true;
  });
  ```

- Update SideDrawer with new props:
  ```tsx
  <SideDrawer
    open={drawerOpen}
    sessions={sessions}
    onLaunched={handleLaunched}
    onFocusSession={handleFocusSession}
  />
  ```

- Update AgentGrid with new props:
  ```tsx
  <AgentGrid
    sessions={filteredSessions}
    allSessions={sessions}
    filters={filters}
    onFiltersChange={setFilters}
    onFocusSession={handleFocusSession}
    onDeleteSession={handleDeleteSession}
    onReconnectSession={handleReconnectSession}
  />
  ```

- Add handler functions:
  ```typescript
  async function handleDeleteSession(id: string) {
    await deleteAgentSession(id);
    listAgentSessions().then(setSnapshot).catch(() => {});
  }

  async function handleReconnectSession(id: string) {
    await reconnectAgentSession(id);
    listAgentSessions().then(setSnapshot).catch(() => {});
  }
  ```

**Step 2: Type check**
- Command: `pnpm --filter web exec tsc --noEmit`
- Expected: No errors

---

## Task 9: Frontend — FilterBar component

**Step 1: Create FilterBar.tsx**
- File: `apps/web/src/components/FilterBar.tsx`
- Code:
  ```typescript
  import type { AgentSessionRecord } from '@agent-orchestrator/shared';

  export interface FilterState {
    host: string | null;
    kind: string | null;
    dirQuery: string;
  }

  interface FilterBarProps {
    sessions: AgentSessionRecord[];
    filters: FilterState;
    onFiltersChange: (filters: FilterState) => void;
  }

  export function FilterBar({
    sessions,
    filters,
    onFiltersChange,
  }: FilterBarProps) {
    const hosts = Array.from(
      new Set(sessions.map((s) => s.hostId ?? 'local')),
    );
    const kinds = Array.from(new Set(sessions.map((s) => s.agentKind)));

    const hasFilters = filters.host || filters.kind || filters.dirQuery;

    return (
      <div className="filter-bar">
        <label className="filter-item">
          <span className="filter-label">服务器</span>
          <select
            className="filter-select"
            value={filters.host ?? ''}
            onChange={(e) =>
              onFiltersChange({
                ...filters,
                host: e.target.value || null,
              })
            }
          >
            <option value="">全部</option>
            {hosts.map((h) => (
              <option key={h} value={h}>
                {h === 'local' ? '本地' : h}
              </option>
            ))}
          </select>
        </label>

        <label className="filter-item">
          <span className="filter-label">类型</span>
          <select
            className="filter-select"
            value={filters.kind ?? ''}
            onChange={(e) =>
              onFiltersChange({
                ...filters,
                kind: e.target.value || null,
              })
            }
          >
            <option value="">全部</option>
            {kinds.map((k) => (
              <option key={k} value={k}>
                {k}
              </option>
            ))}
          </select>
        </label>

        <label className="filter-item">
          <span className="filter-label">目录</span>
          <input
            className="filter-input"
            placeholder="搜索目录..."
            value={filters.dirQuery}
            onChange={(e) =>
              onFiltersChange({ ...filters, dirQuery: e.target.value })
            }
          />
        </label>

        {hasFilters && (
          <button
            className="filter-reset"
            onClick={() =>
              onFiltersChange({ host: null, kind: null, dirQuery: '' })
            }
          >
            重置筛选
          </button>
        )}
      </div>
    );
  }
  ```

**Step 2: Type check**
- Command: `pnpm --filter web exec tsc --noEmit`
- Expected: No errors

---

## Task 10: Frontend — AgentGrid update (filter bar + new props)

**Step 1: Update AgentGrid.tsx**
- File: `apps/web/src/components/AgentGrid.tsx`
- Add FilterBar, delete and reconnect callbacks:
  ```typescript
  import type { AgentSessionRecord } from '@agent-orchestrator/shared';
  import { AgentGridCard } from './AgentGridCard';
  import { FilterBar, type FilterState } from './FilterBar';

  interface AgentGridProps {
    sessions: AgentSessionRecord[];
    allSessions: AgentSessionRecord[];
    filters: FilterState;
    onFiltersChange: (filters: FilterState) => void;
    onFocusSession: (id: string) => void;
    onDeleteSession: (id: string) => void;
    onReconnectSession: (id: string) => void;
  }

  export function AgentGrid({
    sessions,
    allSessions,
    filters,
    onFiltersChange,
    onFocusSession,
    onDeleteSession,
    onReconnectSession,
  }: AgentGridProps) {
    return (
      <div className="agent-grid-container">
        <FilterBar
          sessions={allSessions}
          filters={filters}
          onFiltersChange={onFiltersChange}
        />
        {sessions.length === 0 ? (
          <div className="grid-empty">
            <p>
              {allSessions.length > 0
                ? '没有匹配的会话，试试调整筛选条件'
                : '暂无 Agent 会话'}
            </p>
            {allSessions.length === 0 && (
              <p>点击左侧面板启动或扫描 Agent</p>
            )}
          </div>
        ) : (
          <div className="agent-grid">
            {sessions.map((session) => (
              <AgentGridCard
                key={session.id}
                session={session}
                onDoubleClick={onFocusSession}
                onDelete={onDeleteSession}
                onReconnect={onReconnectSession}
              />
            ))}
          </div>
        )}
      </div>
    );
  }
  ```

**Step 2: Type check**
- Command: `pnpm --filter web exec tsc --noEmit`
- Expected: No errors

---

## Task 11: Frontend — AgentGridCard enhancement

**Step 1: Update AgentGridCard.tsx**
- File: `apps/web/src/components/AgentGridCard.tsx`
- Add delete button, reconnect button, enhanced footer with working directory:

  ```typescript
  import type { AgentSessionRecord } from '@agent-orchestrator/shared';
  import { TerminalView } from './TerminalView';

  interface AgentGridCardProps {
    session: AgentSessionRecord;
    onDoubleClick: (id: string) => void;
    onDelete: (id: string) => void;
    onReconnect: (id: string) => void;
  }

  const stateLabels: Record<string, string> = {
    running: '运行中',
    idle: '空闲',
    awaiting_input: '等待输入',
    detached: '已分离',
    exited: '已退出',
  };

  const stateColors: Record<string, string> = {
    running: 'card-running',
    idle: 'card-idle',
    awaiting_input: 'card-awaiting',
    detached: 'card-detached',
    exited: 'card-exited',
  };

  function shortenPath(dir?: string): string {
    if (!dir) return '';
    let p = dir;
    p = p.replace(/^\/(?:data\d+\/)?home\/[^/]+\//, '~/');
    if (p.startsWith('~/')) {
      const parts = p.slice(2).split('/').filter(Boolean);
      if (parts.length > 2) {
        return '~/' + parts.slice(-2).join('/');
      }
      return p;
    }
    const parts = p.split('/').filter(Boolean);
    if (parts.length > 2) {
      return '…/' + parts.slice(-2).join('/');
    }
    return p;
  }

  export function AgentGridCard({
    session,
    onDoubleClick,
    onDelete,
    onReconnect,
  }: AgentGridCardProps) {
    const stateClass = stateColors[session.interactionState] ?? '';
    const stateLabel =
      stateLabels[session.interactionState] ?? session.interactionState;
    const isTmux = session.sourceType === 'remote-tmux-discovered';
    const isExited = session.interactionState === 'exited';
    const canReconnect = isExited && !isTmux;
    const canDelete = !isTmux;

    function handleDelete(e: React.MouseEvent) {
      e.stopPropagation();
      if (!isExited) {
        if (!window.confirm('会话仍在运行中，确定关闭？')) return;
      }
      onDelete(session.id);
    }

    function handleReconnect(e: React.MouseEvent) {
      e.stopPropagation();
      onReconnect(session.id);
    }

    return (
      <div
        className={`grid-card ${stateClass}`}
        onDoubleClick={() => onDoubleClick(session.id)}
      >
        <div className="grid-card-header">
          <span className="grid-card-name">{session.displayName}</span>
          <span
            className={`grid-card-badge badge-${session.interactionState}`}
          >
            {stateLabel}
          </span>
          {canDelete && (
            <button
              className="grid-card-delete"
              onClick={handleDelete}
              title="删除会话"
            >
              ×
            </button>
          )}
        </div>
        <div className="grid-card-terminal">
          <TerminalView agentSessionId={session.id} interactive={false} />
          {canReconnect && (
            <button
              className="grid-card-reconnect"
              onClick={handleReconnect}
            >
              🔄 重新连接
            </button>
          )}
        </div>
        <div className="grid-card-footer">
          <span className="grid-card-kind">{session.agentKind}</span>
          <span className="grid-card-dir">
            {shortenPath(session.workingDirectory)}
          </span>
        </div>
        <div className="grid-card-footer">
          <span className="grid-card-host">
            {session.hostId && session.hostId !== 'local'
              ? session.hostId
              : '本地'}
          </span>
        </div>
      </div>
    );
  }
  ```

**Step 2: Type check**
- Command: `pnpm --filter web exec tsc --noEmit`
- Expected: No errors

---

## Task 12: Frontend — AgentFocusView add reconnect button

**Step 1: Update AgentFocusView.tsx**
- File: `apps/web/src/components/AgentFocusView.tsx`
- Add `onReconnect` prop and reconnect button in header:
  ```typescript
  interface AgentFocusViewProps {
    focusedSession: AgentSessionRecord;
    sessions: AgentSessionRecord[];
    onSwitchFocus: (id: string) => void;
    onExit: () => void;
    onReconnect: (id: string) => void;
  }
  ```
- In the header, after the "返回宫格" button:
  ```tsx
  {focusedSession.interactionState === 'exited' &&
    focusedSession.sourceType !== 'remote-tmux-discovered' && (
      <button
        className="focus-reconnect-btn"
        onClick={() => onReconnect(focusedSession.id)}
      >
        🔄 重新连接
      </button>
    )}
  ```

**Step 2: Update App.tsx to pass onReconnect to AgentFocusView**
- Add `onReconnect={handleReconnectSession}` to `<AgentFocusView />`

**Step 3: Type check**
- Command: `pnpm --filter web exec tsc --noEmit`
- Expected: No errors

---

## Task 13: Frontend — CSS additions

**Step 1: Add new styles to app.css**
- File: `apps/web/src/app.css`
- Add styles for:
  - Collapsible sections (`.drawer-collapsible`, `.drawer-collapsible-header`, etc.)
  - Host list (`.host-list`, `.host-item`, `.host-item.selected`)
  - Filter bar (`.filter-bar`, `.filter-item`, `.filter-select`, `.filter-input`, `.filter-reset`)
  - Grid card delete button (`.grid-card-delete`)
  - Grid card reconnect overlay (`.grid-card-reconnect`)
  - Grid card enhanced footer (`.grid-card-dir`)
  - Focus view reconnect button (`.focus-reconnect-btn`)
  - Agent grid container (`.agent-grid-container`)

---

## Task 14: Integration — Pass new props through component tree

**Step 1: Wire everything together in App.tsx**
- Ensure all new callbacks flow correctly:
  - `handleDeleteSession` → `AgentGrid` → `AgentGridCard`
  - `handleReconnectSession` → `AgentGrid` → `AgentGridCard` + `AgentFocusView`
  - `sessions` → `SideDrawer` (for "已在宫格" detection)
  - `onFocusSession` → `SideDrawer` (for "聚焦" action)
  - `filters/onFiltersChange` → `AgentGrid` → `FilterBar`

**Step 2: Full type check**
- Command: `pnpm --filter @agent-orchestrator/shared build && pnpm --filter server exec tsc --noEmit && pnpm --filter web exec tsc --noEmit`
- Expected: All pass

---

## Task 15: Format and verify

**Step 1: Format**
- Command: `pnpm format`
- Expected: Clean format

**Step 2: Full type check**
- Command: `pnpm --filter @agent-orchestrator/shared build && pnpm --filter server exec tsc --noEmit && pnpm --filter web exec tsc --noEmit`
- Expected: No errors

**Step 3: Restart and manual test**
- Restart server and frontend
- Verify: SSH hosts load in sidebar
- Verify: Scan results sorted correctly
- Verify: "已在宫格" markers appear
- Verify: Grid cards show enhanced info
- Verify: Filter bar works
- Verify: Delete button works
- Verify: Reconnect button works
- Verify: New session creation works
