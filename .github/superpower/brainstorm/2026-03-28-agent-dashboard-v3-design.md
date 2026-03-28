# Agent Dashboard V3 — 功能增强设计

## 概述

对 Agent Orchestrator 控制台进行全面增强，涵盖侧边栏重构（折叠面板 + SSH 预设）、宫格卡片增强（信息展示 + 筛选 + 删除 + 重连）、扫描结果优化（排序 + 去重标记）、新建会话功能。

---

## 1. 侧边栏重构 — 折叠面板

### 结构

侧边栏从 3-tab 改为 **可折叠 section** 布局，所有功能同时可见，每个 section 可独立折叠/展开。

```
┌─ 侧边栏 ─────────────────────────┐
│                                    │
│ ▼ 📡 主机                          │
│ ┌────────────────────────────────┐│
│ │ ● hm24         10.30.0.24     ││
│ │   huxing:10022  ~/            ││
│ │   [扫描]                       ││
│ │                                ││
│ │ ○ 本地                         ││
│ │   [扫描] [扫描 tmux]           ││
│ │                                ││
│ │ + 添加主机                      ││
│ └────────────────────────────────┘│
│                                    │
│ ▼ 🔍 扫描结果 (25)                 │
│   (排序: 运行中优先, 可滚动列表)    │
│   已在宫格的显示 "✓ 已在宫格—聚焦"  │
│                                    │
│ ▼ ➕ 新建会话                       │
│   (名称/类型/目录/主机/连接方式)    │
│                                    │
└────────────────────────────────────┘
```

### 1.1 主机 Section

**数据来源**：启动时后端读取本机 `~/.ssh/config`，解析 Host/HostName/Port/User 字段，返回预设列表。

**新增后端 API**：
```
GET /api/ssh-hosts
Response: { hosts: SshHostPreset[] }

interface SshHostPreset {
  name: string;        // SSH config 中的 Host 名（如 "hm24"）
  host: string;        // HostName（如 "10.30.0.24"）
  port: number;        // Port，默认 22
  username?: string;   // User
  identityFile?: string;
  defaultPath: string; // 默认 "~/"
}
```

**前端行为**：
- 页面加载时调用 `GET /api/ssh-hosts` 获取预设列表
- 列表渲染为 radio 选择，每个主机一行，显示 name + IP + user:port
- 第一项固定为"本地"选项
- 选中主机后点"扫描"按钮触发扫描
- 本地主机额外显示"扫描 tmux"按钮
- 底部"+ 添加主机"打开一个内联表单（host/port/user/path），填完加入临时列表
- 每个远程主机有一个可编辑的"扫描路径"字段，默认 `~/`

### 1.2 扫描结果 Section

**排序规则**（前端排序）：
1. 运行中（running）在前，已停止（stopped）在后
2. 同状态内按 agentKind 分组：copilot > codex > claude > shell(tmux) > 其他
3. 同种类内按 displayName 字母序

**"已在宫格"标记**：
- 扫描时将结果与当前 sessions 列表进行匹配
- 匹配逻辑：
  - copilot/codex：用 `sessionId`（存储在 `AgentSessionRecord` 新字段 `agentSessionId` 中）匹配 `ScanResult.sessionId`
  - tmux：用 `transportRef.tmuxSession` 匹配 `ScanResult.tmuxSession`
  - 其他：用 `hostId + workingDirectory + agentKind` 组合匹配
- 已在宫格的结果：按钮显示"聚焦"而非"接入/恢复"，点击后切换 focus view 到对应卡片
- 强制 resume 已在宫格的 session：不新建窗口，直接聚焦到已有卡片

**结果列表项展示**：
```
🟢 Quantize Qwen35MoE With Autoround   运行中
   copilot · ~/xhquant_llm
   [✓ 已在宫格 — 聚焦]
```

---

## 2. 宫格卡片增强

### 2.1 卡片信息

当前卡片 footer 只显示 `agentKind` 和 `hostId`。增强为：

```
┌────────────────────────────────┐
│ 测试一号           🟢运行中  × │  ← header: 名字 + badge + 删除
│                                │
│ [终端预览区域]                  │  ← 中间: xterm 预览
│                                │
│ copilot   ~/xhquant_llm       │  ← footer 行1: 类型 + 短路径
│ 10.30.0.24                     │  ← footer 行2: 服务器 IP
└────────────────────────────────┘
```

**workingDirectory 短路径处理**（前端）：
- 如果以 `~` 开头，保持原样
- 如果以 `/home/<user>/` 或 `/data01/home/<user>/` 开头，替换为 `~/`
- 截取最后 2 级目录，如 `~/projects/myapp` 或 `~/xhquant_llm`
- 超长则 `~/very-long-na…/sub`

### 2.2 删除功能

**× 按钮**：
- 始终显示在卡片右上角（小尺寸，不影响布局）
- tmux 来源（`sourceType === 'remote-tmux-discovered'`）的卡片：× 按钮不显示
- 点击行为：
  - `interactionState === 'exited'`：直接移除，无确认
  - `interactionState` 为 running/idle/awaiting_input：弹确认对话框 "会话仍在运行中，确定关闭？"
  - 确认后：调用后端 DELETE API 终止 PTY 进程 + 从 registry 移除

**新增后端 API**：
```
DELETE /api/agent-sessions/:id
- 如果 PTY 存在 → kill PTY process → 从 registry 移除
- 如果 PTY 不存在 → 仅从 registry 移除
- Response: 204 No Content
```

### 2.3 重新连接按钮

**适用条件**：
- `interactionState === 'exited'`
- `sourceType !== 'remote-tmux-discovered'`（非 tmux）
- 存在 resume 所需信息（sessionId 或 remoteCommand）

**展示位置**：
- 宫格卡片：在终端预览区域底部叠加一个半透明"🔄 重新连接"按钮
- Focus 放大视图：在 header 区域增加"重新连接"按钮

**重连逻辑**：
- 读取该 session 的存储信息（`agentSessionId`, `sshTarget`, `agentKind`, `workingDirectory`）
- 如果有 `agentSessionId`：用 `--resume=<id>` 重连
- 否则用原始 `agentKind` + `workingDirectory` 重新启动
- 重连后复用同一个 session slot（用新的 PTY 替换旧的），而非新建卡片

**需要扩展 `AgentSessionRecord`**：
```typescript
// 新增字段，用于支持重连
interface AgentSessionRecord {
  // ... 已有字段
  agentSessionId?: string;   // copilot/codex 的 session UUID
  sshTarget?: SshTarget;     // 远程连接信息（重连时需要）
  remoteCommand?: string;    // 原始远程命令（重连时需要）
}
```

`RegisterAgentSessionInput` 也对应增加这些字段。

### 2.4 筛选功能

**筛选栏位置**：宫格区域正上方，固定不滚动。

```
┌─────────────────────────────────────────────────┐
│ 服务器: [全部 ▼]  类型: [全部 ▼]  目录: [___]  │
│                                    [重置筛选]    │
└─────────────────────────────────────────────────┘
```

**筛选项**：
- **服务器**：下拉，选项动态从当前 sessions 中提取唯一 `hostId` 值（"全部" / "本地" / "10.30.0.24" / ...）
- **类型**：下拉（"全部" / "copilot" / "codex" / "claude" / "shell"）
- **目录**：文本输入框，模糊匹配 `workingDirectory`（输入时实时筛选）
- **重置**：一键清除所有筛选条件

**筛选逻辑**（前端，在 App.tsx 中）：
- 维护 `filterState: { host: string | null, kind: string | null, dirQuery: string }`
- 筛选在渲染前应用，不影响底层 sessions 数据
- 筛选结果为空时显示提示："没有匹配的会话，试试调整筛选条件"

---

## 3. 新建会话功能

### 折叠面板中的新建表单

```
▼ ➕ 新建会话
┌────────────────────────────────┐
│ 会话名称                       │
│ [_________________________]    │
│                                │
│ 类型      [copilot         ▼]  │
│           copilot / codex /    │
│           claude               │
│                                │
│ 工作目录  [~/projects/myapp ]  │
│                                │
│ 主机      [hm24 (10.30.0.24)▼]│
│           本地 / hm24 / ...    │
│                                │
│ 连接方式                       │
│ ○ 直接连接  ○ tmux 会话       │
│                                │
│ [创建并连接]                   │
└────────────────────────────────┘
```

**字段说明**：
- **会话名称**：必填，作为 `displayName`
- **类型**：下拉，选项 copilot / codex / claude，决定启动命令
- **工作目录**：可选，默认用选中主机的默认路径
- **主机**：下拉，选项来自 SSH 预设列表 + "本地"
- **连接方式**：
  - 直接连接：`zsh -i -c "cd <dir> && <agent>"`（远程）或 `cd <dir> && <agent>`（本地）
  - tmux 会话：`tmux new-session -s '<name>' 'cd <dir> && <agent>'`

**创建流程**：
1. 验证名称非空
2. 根据主机选择决定本地/远程
3. 根据连接方式构造命令
4. 调用 `launchPtyAgent`（本地）或 `launchSshPtyAgent`（远程）
5. 新 session 出现在宫格中

---

## 4. 数据模型变更

### 4.1 新增类型

```typescript
// packages/shared/src/index.ts

interface SshHostPreset {
  name: string;
  host: string;
  port: number;
  username?: string;
  identityFile?: string;
  defaultPath: string;
}

interface SshHostsResponse {
  hosts: SshHostPreset[];
}
```

### 4.2 AgentSessionRecord 扩展

```typescript
interface AgentSessionRecord {
  // ... 已有字段不变

  // 新增: 重连支持
  agentSessionId?: string;    // copilot/codex session UUID
  sshTarget?: SshTarget;      // 远程 SSH 信息
  remoteCommand?: string;     // 原始远程命令
}
```

`RegisterAgentSessionInput` 同步增加 `agentSessionId`, `sshTarget`, `remoteCommand`。

### 4.3 新增 API

| Method | Path | 说明 |
|--------|------|------|
| GET | `/api/ssh-hosts` | 读取本机 SSH config，返回预设列表 |
| DELETE | `/api/agent-sessions/:id` | 终止 PTY + 移除 session |

---

## 5. 文件变更清单

### 后端 (apps/server)

| 文件 | 变更 |
|------|------|
| `src/services/ssh-config-parser.ts` | **新建** — 解析 `~/.ssh/config` |
| `src/routes/agent-sessions.ts` | 新增 `DELETE /:id` 路由 |
| `src/routes/ssh-hosts.ts` | **新建** — `GET /api/ssh-hosts` |
| `src/app.ts` | 注册新路由 |
| `src/services/pty-runtime-manager.ts` | 新增 `kill(id)` 方法；`launchRemote` 存储 sshTarget/remoteCommand |
| `src/services/agent-session-registry.ts` | 新增 `remove(id)` 方法；record 增加新字段 |

### 共享类型 (packages/shared)

| 文件 | 变更 |
|------|------|
| `src/index.ts` | 新增 `SshHostPreset`, `SshHostsResponse`；扩展 `AgentSessionRecord` 和 `RegisterAgentSessionInput` |

### 前端 (apps/web)

| 文件 | 变更 |
|------|------|
| `src/components/SideDrawer.tsx` | **重写** — 折叠面板布局，主机选择器，新建表单 |
| `src/components/AgentGrid.tsx` | 增加筛选栏，传入筛选 props |
| `src/components/AgentGridCard.tsx` | 增加 × 删除按钮，增加重连按钮，增强 footer 信息 |
| `src/components/AgentFocusView.tsx` | header 增加重连按钮 |
| `src/components/FilterBar.tsx` | **新建** — 筛选栏组件 |
| `src/App.tsx` | 增加筛选 state，传递 props |
| `src/lib/api.ts` | 新增 `getSshHosts()`, `deleteAgentSession()` |
| `src/app.css` | 折叠面板样式、筛选栏样式、删除按钮样式 |

---

## 6. 实施顺序

1. **共享类型** — 扩展 `AgentSessionRecord`，新增 `SshHostPreset` 等
2. **后端: SSH config 解析** — `ssh-config-parser.ts` + `GET /api/ssh-hosts`
3. **后端: 删除 API** — `DELETE /api/agent-sessions/:id` + `pty-runtime-manager.kill()`
4. **后端: 记录重连信息** — `launchRemote` 存储 sshTarget/remoteCommand/agentSessionId
5. **前端: API 层** — `getSshHosts()`, `deleteAgentSession()`
6. **前端: 侧边栏重写** — 折叠面板 + 主机选择 + 新建表单
7. **前端: 宫格增强** — 筛选栏 + 卡片信息增强 + 删除 + 重连
8. **前端: 扫描结果** — 排序 + "已在宫格" 标记 + 聚焦联动
9. **样式** — 折叠面板、筛选栏、新按钮等 CSS
10. **测试验证** — 类型检查 + E2E 测试
