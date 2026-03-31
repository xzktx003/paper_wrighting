# 实施计划：会话卡片动作重设计

> 设计文档：[docs/specs/2026-03-31-session-actions-redesign.md](../specs/2026-03-31-session-actions-redesign.md)
> 变更顺序：types → backend → frontend api → components → CSS → tests

---

## Task 1: 共享类型变更

**文件**: `packages/shared/src/index.ts`

**变更**:
1. `AgentSessionRecord` 新增 `hidden?: boolean`
2. `UpdateAgentSessionInput` 从仅 `displayName: string` 改为 `displayName?: string; hidden?: boolean`
3. 删除 `RemoveFromGridInput` 接口（L245-L247）

**验证**: `pnpm --filter shared build && pnpm check`

---

## Task 2: 后端 — ObserveSessionManager.stopCapture()

**文件**: `apps/server/src/services/observe-session-manager.ts`

**变更**: 在 `isRunningCapture()` 之后新增方法：
```typescript
stopCapture(sessionId: string): void {
  this.registry.updateSession(sessionId, {
    connectionState: 'offline',
    interactionState: 'exited',
    stateConfidence: 'high',
    outputPreview: '观察已停止',
  });
  this.entries.delete(sessionId);
}
```

**验证**: `pnpm check`

---

## Task 3: 后端 — DELETE 路由重构

**文件**: `apps/server/src/routes/agent-sessions.ts`

**变更**: 修改 `DELETE /api/agent-sessions/:id`（L563-L578）

现有代码：
```typescript
if (observeSessionManager.isRunningCapture(id)) {
  reply.code(409);
  return { error: "运行中的观察会话不能直接删除，请先停止观察" };
}
ptyRuntimeManager.kill(id);
registry.remove(id);
```

改为：
```typescript
const session = registry.get(id);

if (observeSessionManager.isRunningCapture(id)) {
  observeSessionManager.stopCapture(id);
}

if (
  session.sourceType === 'remote-tmux-discovered' &&
  session.controlMode === 'control'
) {
  await tmuxAdapter.release(session);
}

ptyRuntimeManager.kill(id);
registry.remove(id);
```

**验证**: `pnpm check`

---

## Task 4: 后端 — tmux/kill 路由修复

**文件**: `apps/server/src/routes/agent-sessions.ts`

**变更**: 修改 `POST /api/agent-sessions/:id/tmux/kill`（L351-L363）

在 `await tmuxAdapter.killSession(...)` 之前加一行：
```typescript
ptyRuntimeManager.kill(id);
```

**验证**: `pnpm check`

---

## Task 5: 后端 — PATCH 路由扩展 + 删除 remove-from-grid 路由

**文件**: `apps/server/src/routes/agent-sessions.ts`

**变更 5a**: 修改 `PATCH /api/agent-sessions/:id`（L178-L190）

从只接受 `displayName` 改为同时支持 `hidden`：
```typescript
fastify.patch('/api/agent-sessions/:id', async (request, reply) => {
  const { displayName, hidden } = request.body ?? {};
  const updates: Partial<AgentSessionRecord> = {};

  if (displayName !== undefined) {
    const trimmed = displayName.trim();
    if (!trimmed) {
      reply.code(400);
      return { error: 'displayName cannot be empty' };
    }
    updates.displayName = trimmed;
  }

  if (hidden !== undefined) {
    updates.hidden = Boolean(hidden);
  }

  if (Object.keys(updates).length === 0) {
    reply.code(400);
    return { error: 'No valid fields to update' };
  }

  return registry.updateSession(request.params.id, updates);
});
```

**变更 5b**: 删除 `POST /api/agent-sessions/:id/remove-from-grid` 路由（L341-L347）

**验证**: `pnpm check`

---

## Task 6: 前端 API 层

**文件**: `apps/web/src/lib/api.ts`

**变更**:
1. 删除 `removeFromGrid()` 函数（L335-L339）
2. 新增 `hideAgentSession` / `unhideAgentSession`：
```typescript
export function hideAgentSession(
  id: string,
): Promise<AgentSessionRecord> {
  return updateAgentSession(id, { hidden: true });
}

export function unhideAgentSession(
  id: string,
): Promise<AgentSessionRecord> {
  return updateAgentSession(id, { hidden: false });
}
```

**验证**: `pnpm check`

---

## Task 7: AgentGridCard 按钮重设计

**文件**: `apps/web/src/components/AgentGridCard.tsx`

**变更**:

7a. **Props 变更**:
- 删除 `onRemoveFromGrid?: (id: string) => void`
- 新增 `onHide?: (id: string) => void`
- `onKillTmux` 保留

7b. **删除旧逻辑**:
- 删除 `canRemoveFromGrid` 变量
- 删除 `⊟` 按钮及其 `grid-card-remove` className 块

7c. **修改 `canDelete` → 改为所有会话都显示 ×**（不再排除 tmux）:
- 删除 `canDelete = !isTmux && (!isWindowCapture || isExited || isDetached)`
- × 按钮始终渲染

7d. **× 按钮 title 和确认逻辑**:
```typescript
function getCloseTitle(): string {
  if (isTmux || isTmuxManaged) {
    return isExited ? '清除记录' : '脱离会话';
  }
  if (isWindowCapture) {
    return isExited || isDetached ? '清除记录' : '停止观察';
  }
  return isExited ? '清除记录' : '关闭会话';
}

function handleClose(e: React.MouseEvent) {
  e.stopPropagation();
  const needsConfirm =
    !isTmux && !isTmuxManaged && !isWindowCapture && !isExited;
  if (needsConfirm && !window.confirm('会话仍在运行中，确定关闭？')) {
    return;
  }
  onDelete(session.id);
}
```

7e. **新增 🗑 终止 tmux 按钮**（独立红色小按钮，在 × 左侧）:
```tsx
{(isTmux || isTmuxManaged) && (
  <button
    className="grid-card-kill-tmux"
    onClick={(e) => {
      e.stopPropagation();
      if (window.confirm('确定要终止此 tmux 会话吗？这将杀掉底层进程。')) {
        onKillTmux?.(session.id);
      }
    }}
    title="终止 tmux 会话"
    type="button"
  >
    🗑
  </button>
)}
```

7f. **新增 👁 隐藏按钮**（在 🗑 左侧）:
```tsx
<button
  className="grid-card-hide"
  onClick={(e) => {
    e.stopPropagation();
    onHide?.(session.id);
  }}
  title="隐藏"
  type="button"
>
  👁
</button>
```

7g. **按钮排列顺序**（header-actions 内右侧区域）:
```
...badge... [👁] [🗑?] [×]
```

**验证**: `pnpm check`

---

## Task 8: CardMoreMenu 精简

**文件**: `apps/web/src/components/CardMoreMenu.tsx`

**变更**:
1. 删除 `onKillTmux` prop 和 "⚠ 终止 tmux 会话" 菜单项
2. 删除 `onRename` prop 和 "✎ 重命名" 菜单项
3. 仅保留 "📋 复制连接命令"
4. 简化 props 为 `{ sessionId, isTmux, onCopyConnectCommand }`

**验证**: `pnpm check`

---

## Task 9: AgentGrid 适配

**文件**: `apps/web/src/components/AgentGrid.tsx`

**变更**:
1. 删除 `onRemoveFromGrid` prop
2. 新增 `onHide?: (id: string) => void` prop
3. 将 `onHide` 透传给 `AgentGridCard`
4. 从 `AgentGridCard` 删除 `onKillTmux` 透传中的 CardMoreMenu 相关逻辑（`onKillTmux` 现在直接由 AgentGridCard 使用，不再通过 CardMoreMenu）

**验证**: `pnpm check`

---

## Task 10: App.tsx Handler 重构

**文件**: `apps/web/src/App.tsx`

**变更**:
1. 删除 `removeFromGrid` import
2. 删除 `handleRemoveFromGrid` 函数
3. 新增 imports: `hideAgentSession`, `unhideAgentSession`
4. 新增 handlers:
```typescript
async function handleHideSession(id: string) {
  await hideAgentSession(id);
  listAgentSessions().then(setSnapshot).catch(() => {});
}

async function handleUnhideSession(id: string) {
  await unhideAgentSession(id);
  listAgentSessions().then(setSnapshot).catch(() => {});
}
```
5. 隐藏过滤：在 `filteredSessions` 计算中增加 `!s.hidden` 条件
6. 隐藏 active 会话时自动切 focus：在 `handleHideSession` 中如果 `id` 是 active session，调用 `focusAgentSession` 到下一个可见会话（或 null）
7. 更新 `<AgentGrid>` props：删除 `onRemoveFromGrid`，新增 `onHide={handleHideSession}`

**验证**: `pnpm check`

---

## Task 11: CSS 样式

**文件**: `apps/web/src/app.css`

**变更**:
1. 将 `.grid-card-remove` 区块重命名/替换为 `.grid-card-hide`（灰色调，同现有 remove 风格）
2. 将 `.grid-card-delete` 重命名为 `.grid-card-close`（保持现有样式）
3. 新增 `.grid-card-kill-tmux`（红色调）:
```css
.grid-card-kill-tmux {
  padding: 0 4px;
  border: none;
  background: transparent;
  color: rgba(224, 108, 117, 0.5);
  cursor: pointer;
  font-size: 14px;
  line-height: 1;
  border-radius: 4px;
  transition: color 0.15s, background 0.15s;
}

.grid-card-kill-tmux:hover {
  color: #e06c75;
  background: rgba(224, 108, 117, 0.12);
}
```

**验证**: 手动确认 + `pnpm check`

---

## Task 12: HiddenSessionsDrawer 组件

**文件**: `apps/web/src/components/HiddenSessionsDrawer.tsx`（新建）

**内容**:
- Props: `{ sessions: AgentSessionRecord[]; open: boolean; onClose: () => void; onUnhide: (id: string) => void; onDelete: (id: string) => void }`
- 接收已过滤的 `hidden === true` 会话列表
- 按 interactionState 排序（running > idle > awaiting_input > detached > exited），同状态内按 `lastOutputAt` 降序
- 每行显示：`displayName`、`agentKind`、状态 badge、"恢复"和"关闭"按钮
- 渲染为 overlay dialog / modal

**App.tsx 集成**:
1. 新增 `showHiddenDrawer` state
2. FilterBar 旁增加 "已隐藏 (N)" 按钮（N = hidden sessions count），点击切换 drawer
3. N === 0 时按钮不显示或禁用

**验证**: `pnpm check` + 手动确认

---

## Task 13: E2E 测试适配

**文件**:
- `tests/e2e/filter-card-actions.spec.ts`
- `tests/e2e/window-capture-observe.spec.ts`

**变更**:

13a. `filter-card-actions.spec.ts`:
- L100: 将 `remove-from-grid` 路由拦截改为 `DELETE` 拦截
- L341: 将 `.grid-card-remove` 选择器改为 `.grid-card-close`
- 新增对 `.grid-card-hide` 和 `.grid-card-kill-tmux` 按钮的测试用例

13b. `window-capture-observe.spec.ts`:
- L31: 删除 `remove-from-grid` 回退路径，直接使用 `DELETE`

**验证**: `pnpm test` 或 `npx playwright test <file> --reporter=line`

---

## Task 14: 全面验证

**步骤**:
1. `pnpm format`
2. `pnpm check` — 全局类型检查
3. `pnpm lint` — lint 检查
4. 启动干净环境 (4101/3101)：
   - 创建普通 local 会话 → 测试 ×（应杀进程）
   - 创建 tmux-managed 会话 → 测试 ×（应 detach）、🗑（应 kill）
   - 测试 👁 隐藏 → 确认卡片消失
   - 测试 "已隐藏(N)" 抽屉 → 恢复和关闭
5. `npx playwright test tests/e2e/filter-card-actions.spec.ts tests/e2e/window-capture-observe.spec.ts --reporter=line`

---

## 变更顺序 & 依赖图

```
Task 1 (shared types)
  ├─→ Task 2 (stopCapture method)
  │     └─→ Task 3 (DELETE route) ─→ Task 4 (tmux/kill route)
  ├─→ Task 5 (PATCH route + remove route deletion)
  ├─→ Task 6 (frontend api)
  │     ├─→ Task 7 (AgentGridCard)
  │     │     ├─→ Task 8 (CardMoreMenu)
  │     │     └─→ Task 9 (AgentGrid)
  │     │           └─→ Task 10 (App.tsx)
  │     └─→ Task 12 (HiddenSessionsDrawer) → integrates into Task 10
  └─→ Task 11 (CSS) — 可与 Task 7 并行

Task 13 (tests) — 依赖 Task 1-12 全部完成
Task 14 (验证) — 最后
```

总计 14 个任务，建议执行顺序：1 → 2 → 3 → 4 → 5 → 6 → 11 → 7 → 8 → 9 → 12 → 10 → 13 → 14
