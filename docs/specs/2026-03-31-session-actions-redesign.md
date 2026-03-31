# 会话卡片动作重设计

> 日期：2026-03-31
> 状态：待评审

## 问题陈述

当前 AgentGridCard 上的三个动作（⊟ 从宫格移除、× 删除会话、⚠ 终止 tmux 会话）语义模糊，存在以下问题：

1. **按钮同时出现**：tmux-managed 的 local/remote-connect 会话同时显示 ⊟ 和 ×，用户不知该点哪个。
2. **资源泄漏**：⊟ 仅删 registry 记录，不杀 PTY 进程；× 杀 PTY 但不杀 tmux session；⚠ 杀 tmux session 但不杀 PTY。三个按钮各删一层，没有一个能彻底清理。
3. **命名误导**：「删除会话」让用户以为只是删除一条记录，实际会杀进程；「从宫格移除」让用户以为是隐藏，实际是永久移除且无法恢复。

## 用户期望的模型

用户明确表达了三个动作的语义：

| 动作 | 用户心智模型 |
|---|---|
| **×** (关闭) | tmux 类会话 = 脱离/detach（tmux session 存活）；普通会话 = 关闭进程 |
| **🗑** (终止 tmux) | 仅 tmux 会话可见，彻底杀掉 tmux session |
| **👁** (隐藏) | 从网格中隐藏卡片，但不影响会话本身，可恢复 |

## 选定方案

### 非目标

- 不改变 session 发现、创建、takeover/release 等流程
- 不改变 FilterBar 现有筛选逻辑
- 不引入 soft-delete 或回收站概念
- 不改变 WebSocket 快照推送机制的结构

### 技术设计

#### 一、共享类型变更 (`packages/shared/src/index.ts`)

```typescript
// AgentSessionRecord 新增字段
export interface AgentSessionRecord {
  // ...existing fields...
  hidden?: boolean; // 新增：是否在网格中隐藏
}

// UpdateAgentSessionInput 扩展
export interface UpdateAgentSessionInput {
  displayName?: string; // 从 required 改为 optional
  hidden?: boolean;     // 新增
}
```

#### 二、后端路由变更 (`apps/server/src/routes/agent-sessions.ts`)

**2a. 统一 × 按钮 → 修改 `DELETE /:id` 路由**

现有：
```typescript
// 现有 409 阻塞逻辑 — 需要移除
if (observeSessionManager.isRunningCapture(id)) {
  reply.code(409);
  return { error: '运行中的观察会话不能直接删除，请先停止观察' };
}
ptyRuntimeManager.kill(id);
registry.remove(id);
```

改为按 sourceType 分支（**移除 409 阻塞**）：
```typescript
const session = registry.get(id);

// 窗口观察会话：自动停止观察（不再返回 409）
if (observeSessionManager.isRunningCapture(id)) {
  observeSessionManager.stopCapture(id); // 新增方法，见 2e
}

// tmux-discovered 且 control 模式：release 回 observe
// 注意：本地 tmux-managed (sourceType=local, transportRef.tmuxSession 存在)
// 以及 remote-connect + tmux transport 的会话都不需要 release——
// 杀 PTY 即断开 tmux attach，与 tmux detach 等效。
// 仅 remote-tmux-discovered 需要显式 release（因为它没有 PTY，是通过
// tmux capture-pane 轮询的）。
if (session.sourceType === 'remote-tmux-discovered' &&
    session.controlMode === 'control') {
  await tmuxAdapter.release(session);
}

// 杀 PTY（对没有 PTY handle 的会话是 no-op）
ptyRuntimeManager.kill(id);

// 删除 registry 记录
registry.remove(id);
```

**2b. 修复 `POST …/tmux/kill` 路由**

现有：只杀 tmux session + remove。改为也杀 PTY：
```typescript
ptyRuntimeManager.kill(id); // 新增：杀掉附着的 PTY 进程
await tmuxAdapter.killSession(tmuxSessionName, session.sshTarget);
registry.remove(id);
```

**2e. `ObserveSessionManager` 新增 `stopCapture()` 方法**

当前 `ObserveSessionManager` 没有主动停止的方法。新增：
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

注意：`stopCapture` 仅更新状态并清理 entry，DELETE 路由后续的 `registry.remove()` 会彻底删除记录。

**2c. 修改 `PATCH /:id` 路由**

现有：仅接受 `displayName`。扩展为同时支持 `hidden`：
```typescript
fastify.patch('/api/agent-sessions/:id', async (request, reply) => {
  const { displayName, hidden } = request.body;
  const updates: Partial<AgentSessionRecord> = {};
  
  if (displayName !== undefined) {
    const trimmed = displayName.trim();
    if (!trimmed) { reply.code(400); return { error: 'displayName cannot be empty' }; }
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

**2d. 删除 `POST …/remove-from-grid` 路由**

该路由被 `DELETE /:id` 的新行为完全覆盖，不再需要。

同步删除 `packages/shared/src/index.ts` 中的 `RemoveFromGridInput` 接口（如果存在）。

#### 三、前端 API 变更 (`apps/web/src/lib/api.ts`)

```typescript
// 删除 removeFromGrid()

// 新增 hideAgentSession / unhideAgentSession
export function hideAgentSession(id: string): Promise<AgentSessionRecord> {
  return updateAgentSession(id, { hidden: true });
}

export function unhideAgentSession(id: string): Promise<AgentSessionRecord> {
  return updateAgentSession(id, { hidden: false });
}

// updateAgentSession 的 input 参数类型已随 shared 类型变化自动生效
```

注意：`updateAgentSession` 已存在且调用 `PATCH /api/agent-sessions/:id`，无需新增路由。

#### 四、AgentGridCard 按钮重设计

**卡片右上角按钮区域布局：**

flex 容器 `.grid-card-header-actions`，从左到右排列：
```
[✎ 重命名] [··· 更多?] [状态badge] ...flex-grow... [👁] [🗑?] [×]
```

- `✎` 始终显示
- `···` (CardMoreMenu) 仅 tmux 会话显示（里面只剩"复制连接命令"，见第五节）
- badge 居中偏左
- `👁` `🗑` `×` 靠右紧凑排列，使用 16×16 图标尺寸，间距 4px
- 所有 action 按钮均为 `button` 元素，带 `title` tooltip
- 最多 5 个元素（tmux 场景），空间在现有卡片宽度 (min 280px) 下可容纳

**按钮可见性规则：**

| 按钮 | 何时显示 | CSS class | title 提示 |
|---|---|---|---|
| × | 所有会话 | `grid-card-close` | 见下文 |
| 🗑 | `isTmux \|\| isTmuxManaged` | `grid-card-kill-tmux` (红色) | "终止 tmux 会话" |
| 👁 | 所有会话 | `grid-card-hide` | "隐藏" |

**× 按钮的 title 和确认逻辑：**

| 条件 | title | 确认对话框 |
|---|---|---|
| `isTmux \|\| isTmuxManaged` 且非 exited | "脱离会话" | 无需确认（非破坏性） |
| `isTmux \|\| isTmuxManaged` 且 exited | "清除记录" | 无需确认 |
| `isWindowCapture` 且非 exited/detached | "停止观察" | 无需确认 |
| 非 tmux、非 windowCapture 且非 exited | "关闭会话" | "会话仍在运行中，确定关闭？" |
| 非 tmux、非 windowCapture 且 exited | "清除记录" | 无需确认 |

**× 按钮统一调用 `deleteAgentSession(id)`** — 后端根据 sourceType 自动分支。

**🗑 按钮调用 `killTmuxSession(id)` + 确认**（沿用现有确认文案）。

**旧按钮移除：**
- 删除 `canRemoveFromGrid` 逻辑和 `⊟` 按钮
- 删除 `onRemoveFromGrid` prop
- 删除 CardMoreMenu 中的 "⚠ 终止 tmux 会话" 菜单项（功能移至独立按钮）
- 删除 CardMoreMenu 中的 "✎ 重命名" 菜单项（与 header 中独立 ✎ 按钮重复）

#### 五、CardMoreMenu 精简

移除 "终止 tmux 会话" 和 "重命名" 后，CardMoreMenu 仅保留：
- 📋 复制连接命令（仅 tmux）

因此 CardMoreMenu 仅在 `isTmux || isTmuxManaged` 时渲染，且内部只有一个菜单项。如果后续无新菜单项加入，可考虑将"复制连接命令"改为 header actions 中的独立图标按钮以进一步简化，但本次不做。

#### 六、AgentGrid 隐藏过滤

前端在 `AgentGrid` 渲染前过滤 `hidden === true` 的会话。

App.tsx 中 `filteredSessions` 增加 `!s.hidden` 条件。

**隐藏当前 active 会话时**：调用 `hideAgentSession(id)` 后，如果 `id === activeAgentSessionId`，自动 focus 到 sessions 列表中下一个可见（非 hidden）会话。若无可见会话，设 `activeAgentSessionId = null`。

**隐藏会话生命周期**：隐藏状态仅为前端视觉过滤，会话生命周期不受影响。已退出的隐藏会话在用户主动操作前不会自动清理。这是已知限制，未来可在恢复抽屉中提供批量清除入口。

#### 七、已隐藏会话恢复入口

在 FilterBar 旁或网格区域增加一个按钮：

```
"已隐藏 (N)" → 点击弹出对话框/抽屉
```

对话框列出所有 `hidden === true` 的会话，按 interactionState 排序（running > idle > awaiting_input > detached > exited），同状态内按 lastOutputAt 降序。

每行显示：`displayName`、`agentKind`、状态 badge、右侧有"恢复"和"关闭"两个操作。
- 恢复 → `unhideAgentSession(id)` → 刷新列表
- 关闭 → `deleteAgentSession(id)` → 永久删除（同 × 按钮语义）

不支持批量操作（第一版）。

新组件：`HiddenSessionsDrawer`。

#### 八、App.tsx Handler 精简

```typescript
// 删除 handleRemoveFromGrid

// handleDeleteSession 行为不变（调 deleteAgentSession），但适用于所有会话类型

// 新增 handleHideSession
async function handleHideSession(id: string) {
  await hideAgentSession(id);
  listAgentSessions().then(setSnapshot).catch(() => {});
}

// 新增 handleUnhideSession
async function handleUnhideSession(id: string) {
  await unhideAgentSession(id);
  listAgentSessions().then(setSnapshot).catch(() => {});
}
```

## 变更影响矩阵

| 文件 | 变更类型 | 说明 |
|---|---|---|
| `packages/shared/src/index.ts` | 新增字段 | `hidden` on AgentSessionRecord + UpdateAgentSessionInput |
| `apps/server/src/routes/agent-sessions.ts` | 修改 | DELETE 路由增加分支、PATCH 扩展、删除 remove-from-grid 路由、tmux/kill 增加 pty.kill |
| `apps/web/src/lib/api.ts` | 修改 | 删除 removeFromGrid，新增 hide/unhide helpers |
| `apps/web/src/components/AgentGridCard.tsx` | 重构 | 删除 ⊟，新增 👁 和 🗑 按钮，× 统一化 |
| `apps/web/src/components/AgentGrid.tsx` | 修改 | 删除 onRemoveFromGrid prop，新增 onHide prop |
| `apps/web/src/components/CardMoreMenu.tsx` | 精简 | 删除 "终止 tmux 会话" 菜单项 |
| `apps/web/src/components/HiddenSessionsDrawer.tsx` | 新建 | 已隐藏会话恢复抽屉 |
| `apps/web/src/App.tsx` | 修改 | 删除 handleRemoveFromGrid，新增 handleHide/Unhide |
| CSS 文件 | 新增 | `.grid-card-close`、`.grid-card-kill-tmux`、`.grid-card-hide` 样式 |
| `apps/server/src/services/observe-session-manager.ts` | 新增方法 | `stopCapture()` |
| `tests/e2e/filter-card-actions.spec.ts` | 修改 | 删除 `.grid-card-remove` 选择器引用，适配新按钮 |
| 其他引用 `remove-from-grid` 的 E2E 测试 | 修改 | 适配删除的路由和选择器 |
| `tests/e2e/window-capture-observe.spec.ts` | 修改 | afterAll 中 remove-from-grid 回退路径需移除 |

## 边缘情况

1. **隐藏的 tmux 会话被 rediscover**：`discover()` 中检查 registry 是否已有该 tmux session——已有则跳过。隐藏的会话仍在 registry 中，所以不会重复注册。
2. **隐藏的会话退出**：状态正常更新（通过 PTY onExit 或 tmux 轮询），只是不显示在网格中。用户打开恢复抽屉时可看到最新状态。
3. **WebSocket 快照**：快照包含 hidden 字段，前端据此过滤。不改变推送粒度。
4. **隐藏 active 会话**：自动切换 focus 到下一个可见会话（见第六节）。
5. **tmux/kill 与 PTY onExit 竞态**：`ptyRuntimeManager.kill(id)` 杀 PTY 后，PTY `onExit` 回调中如果调了 `registry.remove(id)`，后续 `tmuxAdapter.killSession()` 结束后的 `registry.remove(id)` 在已不存在的 ID 上执行。经确认，`registry.remove()` 内部使用 `Map.delete()` 对不存在的 key 是幂等 no-op，因此无需额外防御。
6. **本地 tmux-managed 和 remote-connect + tmux 会话的 × 行为**：`sourceType` 为 `local` 或 `remote-connect` 且 `transportRef.tmuxSession` 存在的会话，其 PTY 进程就是 `tmux attach` 客户端。杀 PTY = 断开 tmux attach = 等效 detach。不需要额外调用 `tmuxAdapter.release()`（release 仅适用于不走 PTY 的 `remote-tmux-discovered` 会话）。

## 开放问题

无。
