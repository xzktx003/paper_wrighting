# Agent Orchestrator v2 实施计划

## 总览

将 v1（卡片列表 + textarea 输入）升级为 v2（多宫格终端流 + xterm.js 键盘映射 + 文件夹扫描发现）。

全部 UI 使用中文。

## 变更安全顺序

```
types/shared → 后端服务 → 后端路由/WebSocket → 前端组件 → 样式 → e2e 测试
```

## 阶段划分

---

### Phase 1：PTY 基础设施 + xterm.js 最小回路

**目标**：用 xterm.js 替换 `<pre>` 输出和 textarea 输入，跑通一个本地 agent 的完整终端体验。

**新增依赖**：
- 后端：`node-pty`（原生 PTY 分配）
- 前端：`@xterm/xterm`, `@xterm/addon-fit`, `@xterm/addon-web-links`

**Batch 1.1 — 后端 PTY 运行时**
1. `packages/shared/src/index.ts`
   - 新增 `PtyDataEvent` 类型（二进制终端数据 WebSocket 事件）
   - 新增 `PtyResizeInput` 类型（cols/rows）
   - 扩展 `AgentSessionRecord` 加 `ptyCols?`, `ptyRows?`
2. `apps/server/package.json`
   - 添加 `node-pty` 依赖
3. `apps/server/src/services/pty-runtime-manager.ts`（新建）
   - 用 `node-pty` 替代 `child_process.spawn`
   - 启动 PTY 进程，分配真终端
   - 将 PTY data 事件通过回调推送
   - 支持 write（原始键盘输入）和 resize
4. `apps/server/src/services/local-process-runtime-manager.ts`
   - 重构为使用 `PtyRuntimeManager`，保留 launch/write 接口
   - 输出不再走 appendOutput 文本，改为推 PTY 二进制数据

**Batch 1.2 — 后端 WebSocket 终端流**
5. `apps/server/src/app.ts`
   - 新增 `/ws/agent-sessions/:id/terminal` WebSocket 端点
   - 连接时 attach 到对应 session 的 PTY data 流
   - 收到客户端消息时写入 PTY stdin
   - 收到 resize 消息时调 PTY resize
6. `apps/server/src/routes/agent-sessions.ts`
   - 新增 `POST /api/agent-sessions/:id/resize` 路由

**Batch 1.3 — 前端 xterm.js 终端组件**
7. `apps/web/package.json`
   - 添加 `@xterm/xterm`, `@xterm/addon-fit`, `@xterm/addon-web-links`
8. `apps/web/src/components/TerminalView.tsx`（新建）
   - 封装 xterm.js Terminal 实例
   - 连接 `/ws/agent-sessions/:id/terminal` WebSocket
   - 绑定 onData → 发送到 ws
   - 绑定 onResize → 发送 resize 事件
   - 使用 FitAddon 自适应容器尺寸
9. `apps/web/src/components/ActiveAgentDetail.tsx`
   - 用 `<TerminalView>` 替换 `<pre>` 输出区和 `<textarea>` 输入区

**验证 1**：
- `pnpm check` 通过
- 手动启动 → 本地启动 mock-agent → 在 xterm.js 终端中看到输出，打字直接输入
- 更新 e2e 测试适配新交互

---

### Phase 2：多宫格布局 + 1大N小切换

**目标**：将页面从 "左树+中卡片+右详情" 改为 "侧边抽屉 + 多宫格终端"。

**Batch 2.1 — 多宫格默认视图**
10. `apps/web/src/components/AgentGrid.tsx`（新建，替代 AgentBoard）
    - CSS Grid 多宫格布局
    - 每格子包含：标题栏（agent名+状态徽章）+ 迷你终端预览 + 底栏（路径+来源）
    - 每个格子内嵌一个只读的迷你 `<TerminalView>`
    - 双击事件触发放大
11. `apps/web/src/components/AgentGridCard.tsx`（新建）
    - 单个宫格卡片组件
    - 状态高亮边框：绿/黄闪烁/蓝/红/灰
    - 状态变化时 CSS transition 动画
12. `apps/web/src/app.css`
    - 重写布局：移除三栏 layout-grid
    - 新增多宫格 grid 样式
    - 新增状态边框颜色 + 闪烁动画

**Batch 2.2 — 1大+N小放大视图**
13. `apps/web/src/components/AgentFocusView.tsx`（新建）
    - 放大视图：左侧 ~70% 完整终端 + 右侧缩略列
    - 完整终端可交互（键盘映射）
    - 缩略列显示小卡片，双击切换
    - Esc 返回多宫格
14. `apps/web/src/App.tsx`
    - 重构状态管理：`viewMode: 'grid' | 'focus'`
    - `focusedAgentId` 替代旧的 `activeAgentSessionId`
    - 双击 → 进入 focus 模式
    - Esc → 回到 grid 模式

**Batch 2.3 — 侧边抽屉**
15. `apps/web/src/components/SideDrawer.tsx`（新建）
    - 可收起侧边面板
    - 包含：扫描/添加/管理/远程 功能区
    - 收起时显示一个小图标按钮
16. 移除旧组件：
    - 删除 `FocusBar.tsx`
    - 删除 `WorkspaceTree.tsx`
    - 删除 `ControlPanel.tsx`
    - 删除 `AgentBoard.tsx`（被 AgentGrid 替代）
    - 删除 `ActiveAgentDetail.tsx`（被 AgentFocusView 替代）

**Batch 2.4 — 顶栏 + 底栏**
17. `apps/web/src/components/TopBar.tsx`（新建）
    - 产品标题 + 全局状态摘要（N个运行/N个等待输入）
18. `apps/web/src/components/BottomBar.tsx`（新建）
    - 键盘快捷键提示（双击放大 · Esc 返回 · Tab 切换）

**验证 2**：
- `pnpm check` 通过
- 手动验证多宫格布局、双击放大、Esc 返回、缩略列切换
- 状态高亮动画正确
- 全部 UI 文本为中文

---

### Phase 3：文件夹扫描发现（运行时 + 历史）

**目标**：实现"选择文件夹 → 扫描 agent → 选择加入看板"的完整发现流程。

**Batch 3.1 — 后端扫描服务**
19. `apps/server/src/services/agent-scanner.ts`（新建）
    - `scanDirectory(path: string)` 入口
    - 运行时发现：
      - 调用 `ps aux` 或 `pgrep` 查找工作目录匹配的 agent 进程
      - 匹配进程名：`claude`, `copilot`, `codex`, `aider` 等
      - 调用现有 `LocalTmuxAdapter` 查找 tmux pane
    - 历史发现：
      - 检查 `.claude/`, `.copilot/`, `.aider.chat.history.md`, `.codex/` 等
      - 读取最后修改时间作为"最后活动"
    - 返回 `ScanResult[]`

20. `packages/shared/src/index.ts`
    - 新增 `ScanDirectoryInput { path: string; hostId?: string }`
    - 新增 `ScanResult { agentKind, status: 'running' | 'stopped', pid?, lastActivity?, ... }`
    - 新增 `ScanDirectoryResponse { results: ScanResult[] }`

**Batch 3.2 — 后端路由 + 添加到看板**
21. `apps/server/src/routes/agent-sessions.ts`
    - 新增 `POST /api/agent-discovery/scan` — 扫描指定文件夹
    - 新增 `POST /api/agent-discovery/scan/:index/add` — 将扫描结果中的某个添加到看板
    - 对运行中的 agent：attach PTY 并注册 session
    - 对已停止的 agent：resume（启动新进程拉起 agent）并注册

**Batch 3.3 — 前端扫描 UI**
22. `apps/web/src/components/SideDrawer.tsx`
    - 添加"扫描项目"区域
    - 文件夹路径输入框 + 扫描按钮
    - 扫描结果列表：运行中/已停止标签，添加/恢复按钮
23. `apps/web/src/lib/api.ts`
    - 新增 `scanDirectory()`, `addScanResult()` API 调用

**验证 3**：
- `pnpm check` 通过
- 在本机运行一个 mock-agent → 扫描该目录 → 发现运行中 → 添加到看板 → 宫格显示
- 在一个有 `.claude/` 的目录扫描 → 发现已停止 → 恢复并添加

---

### Phase 4：远程扫描 + SSH PTY

**目标**：支持远程服务器的文件夹扫描和 PTY attach。

**Batch 4.1 — SSH PTY 模式**
24. `apps/server/src/services/ssh-runtime-manager.ts`
    - 重构：ssh 添加 `-t` 参数强制分配远端 PTY
    - 输出改为 PTY 二进制流而非文本
    - attach 到 `/ws/agent-sessions/:id/terminal` 流

**Batch 4.2 — 远程扫描**
25. `apps/server/src/services/agent-scanner.ts`
    - 扩展 `scanDirectory` 支持 `sshTarget` 参数
    - 通过 SSH 在远端执行进程扫描和历史文件检查
    - 通过 SSH 在远端执行 tmux list-panes

**Batch 4.3 — 前端远程扫描**
26. `apps/web/src/components/SideDrawer.tsx`
    - 扫描区域添加"远程主机"可选配置（SSH host/username/port）
    - 共用扫描结果列表

**验证 4**：
- `pnpm check` 通过
- SSH 到远端扫描（或 localhost 做验证）
- SSH PTY 接管在 xterm.js 中正常工作

---

### Phase 5：状态感知提示 + 中文化 + 收尾

**目标**：非侵入式状态检测提示条、全部 UI 中文化、清理测试。

**Batch 5.1 — 状态感知提示条**
27. `apps/web/src/components/StatusHint.tsx`（新建）
    - 根据终端输出内容启发式检测：权限请求、等待输入、模式切换
    - 在终端下方显示非侵入式中文提示
    - 不拦截任何键盘输入

**Batch 5.2 — 全面中文化**
28. 所有组件 UI 文字改为中文：
    - TopBar、BottomBar、SideDrawer、AgentGridCard、AgentFocusView、StatusHint
    - 错误消息和状态消息中文化

**Batch 5.3 — 移除 seed 数据 + 清理**
29. 删除 `seed-agent-sessions.ts`（不再需要预置假数据）
30. 清理旧 CSS 样式和未使用的导入
31. 更新 AGENTS.md 反映 v2 架构

**Batch 5.4 — 端到端测试更新**
32. `tests/e2e/agent-orchestrator.spec.ts`
    - 重写测试适配新 UI：
      - 扫描文件夹 → 发现 agent → 添加到看板 → 宫格出现
      - 双击放大 → xterm 终端可交互
      - 状态高亮验证
      - tmux 发现 → takeover → 在终端中操作
33. 添加 tmux 和扫描相关的 e2e helper 脚本

**最终验证**：
- `pnpm format`
- `pnpm check`
- `pnpm exec playwright test`
- 手动浏览器验证完整流程

---

## 文件变更总览

### 新建文件
| 文件 | Phase | 说明 |
|------|-------|------|
| `apps/server/src/services/pty-runtime-manager.ts` | 1 | node-pty 运行时 |
| `apps/web/src/components/TerminalView.tsx` | 1 | xterm.js 终端组件 |
| `apps/web/src/components/AgentGrid.tsx` | 2 | 多宫格主视图 |
| `apps/web/src/components/AgentGridCard.tsx` | 2 | 宫格卡片组件 |
| `apps/web/src/components/AgentFocusView.tsx` | 2 | 1大N小放大视图 |
| `apps/web/src/components/SideDrawer.tsx` | 2 | 侧边抽屉 |
| `apps/web/src/components/TopBar.tsx` | 2 | 顶栏 |
| `apps/web/src/components/BottomBar.tsx` | 2 | 底栏 |
| `apps/server/src/services/agent-scanner.ts` | 3 | 文件夹扫描发现 |
| `apps/web/src/components/StatusHint.tsx` | 5 | 状态感知提示条 |

### 大幅修改文件
| 文件 | Phase | 说明 |
|------|-------|------|
| `packages/shared/src/index.ts` | 1,3 | 新增 PTY/Scan 类型 |
| `apps/server/src/app.ts` | 1 | 终端 WebSocket 端点 |
| `apps/server/src/services/local-process-runtime-manager.ts` | 1 | 改用 PTY |
| `apps/server/src/services/ssh-runtime-manager.ts` | 4 | SSH PTY 模式 |
| `apps/web/src/App.tsx` | 2 | 重构状态管理和布局 |
| `apps/web/src/app.css` | 2 | 重写样式 |
| `apps/web/src/lib/api.ts` | 1,3 | 新增 scan API |
| `apps/server/src/routes/agent-sessions.ts` | 1,3 | 新增路由 |
| `tests/e2e/agent-orchestrator.spec.ts` | 5 | 重写测试 |

### 删除文件
| 文件 | Phase | 说明 |
|------|-------|------|
| `apps/web/src/components/FocusBar.tsx` | 2 | 被 TopBar 替代 |
| `apps/web/src/components/WorkspaceTree.tsx` | 2 | 移入 SideDrawer |
| `apps/web/src/components/ControlPanel.tsx` | 2 | 移入 SideDrawer |
| `apps/web/src/components/AgentBoard.tsx` | 2 | 被 AgentGrid 替代 |
| `apps/web/src/components/ActiveAgentDetail.tsx` | 2 | 被 AgentFocusView 替代 |
| `apps/server/src/services/seed-agent-sessions.ts` | 5 | 不再需要 |

---

## 依赖安装

```bash
# Phase 1 后端
cd apps/server && pnpm add node-pty

# Phase 1 前端
cd apps/web && pnpm add @xterm/xterm @xterm/addon-fit @xterm/addon-web-links
```

## 每阶段验证命令

```bash
pnpm format
pnpm --filter @agent-orchestrator/shared build
pnpm --filter server build
pnpm --filter web build
pnpm check
pnpm exec playwright test
```
