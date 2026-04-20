# 文件浏览器功能实现计划（MobaXterm 对齐版）

## 目标

为 coding_kanban 项目实现一个对齐 MobaXterm 体验的文件浏览系统：
- 独立侧边面板（可收起/展开），不干扰现有 Agent Session 视图
- 本地文件系统 + 远程 SSH/SFTP 双目标支持
- 双栏布局：左侧目录树 + 右侧文件列表（类 MobaXterm 左右分栏）
- 完整文件操作：浏览、上传/下载、新建文件夹、重命名、删除、多选
- 进阶功能：文件预览、简易文本编辑、权限查看（chmod)、隐藏文件切换、拖拽上传

## 现状分析

| 模块 | 现状 |
|------|------|
| 后端 SSH 基础设施 | `ssh-command.ts` + `SshRuntimeManager` 已有 SSH CLI 调用，无 SFTP 能力 |
| 后端 PTY 运行时 | `node-pty` 已安装，SFTP 需额外引入 `ssh2` 库 |
| 前端 Host 选择 | `SshHostPreset` 类型 + `HostDropdown` 组件已存在 |
| 前端 Side Panel | `SideDrawer` 模式（可收起的左侧面板）可复用 |
| 共享类型 | `SshTarget` 可直接复用，需扩展文件系统 DTO |
| 缺失依赖 | 后端需加 `ssh2` + `@fastify/multipart` |

---

## 功能清单（对照 MobaXterm）

| 功能 | MobaXterm | 本计划 |
|------|-----------|--------|
| 双栏布局（目录树 + 文件列表） | ✅ | ✅ Phase 3 |
| 路径面包屑（可点击跳转） | ✅ | ✅ Phase 3 |
| 工具栏（Home/上级/刷新/新建/上传/下载/删除） | ✅ | ✅ Phase 3 |
| 文件类型图标 | ✅ | ✅ Phase 3 |
| 文件列表列（名称/大小/修改时间/权限） | ✅ | ✅ Phase 3 |
| 列排序 | ✅ | ✅ Phase 3 |
| 多选（Shift+Click / Ctrl+Click） | ✅ | ✅ Phase 3 |
| 右键上下文菜单 | ✅ | ✅ Phase 3 |
| 上传/下载（多文件） | ✅ | ✅ Phase 2+3 |
| 拖拽上传（从桌面拖到浏览器） | ✅ | ✅ Phase 4 |
| 新建文件夹 | ✅ | ✅ Phase 2+3 |
| 重命名 | ✅ | ✅ Phase 2+3 |
| 删除（含确认弹窗） | ✅ | ✅ Phase 3 |
| 隐藏文件切换（显示/隐藏 dotfiles） | ✅ | ✅ Phase 3 |
| 快速搜索（过滤当前目录） | ✅ | ✅ Phase 3 |
| 文本文件预览 | ✅ | ✅ Phase 4 |
| 图片预览 | ✅ | ✅ Phase 4 |
| 双击打开（文本内联编辑） | ✅ | ✅ Phase 4 |
| 权限查看/修改（chmod，SSH 专属） | ✅ | ✅ Phase 4 |
| 连接状态指示器 | ✅ | ✅ Phase 3 |
| 本地文件系统支持 | ✅ | ✅ Phase 2 |
| 远程 SSH/SFTP 支持 | ✅ | ✅ Phase 2 |

---

## Phase 1：共享类型（packages/shared）

**文件**: `packages/shared/src/index.ts`

新增 DTO：

```typescript
// 文件/目录条目
interface FileEntry {
  name: string;
  path: string;
  type: 'file' | 'directory' | 'symlink';
  size: number;           // bytes，目录为 0
  modifiedAt: string;     // ISO 8601
  permissions: string;    // e.g. "drwxr-xr-x"
  isHidden: boolean;      // name 以 . 开头
}

// 列目录
interface ListFilesInput { path: string; sshTarget?: SshTarget; showHidden?: boolean; }
interface ListFilesResponse { entries: FileEntry[]; path: string; }

// 文件内容预览（文本）
interface FilePreviewInput { path: string; sshTarget?: SshTarget; maxBytes?: number; }
interface FilePreviewResponse { content: string; encoding: 'utf8' | 'binary'; truncated: boolean; }

// 权限修改
interface ChmodInput { path: string; mode: string; sshTarget?: SshTarget; }

// 通用文件操作
interface FileOperationInput {
  operation: 'mkdir' | 'rename' | 'delete';
  path: string;
  newPath?: string;       // rename 时用
  sshTarget?: SshTarget;
}
```

---

## Phase 2：后端服务层（apps/server）

### 2.1 安装依赖

```
pnpm --filter server add ssh2
pnpm --filter server add -D @types/ssh2
pnpm --filter server add @fastify/multipart
```

### 2.2 本地文件系统服务

**新文件**: `apps/server/src/services/local-fs-service.ts`

| 方法 | 说明 |
|------|------|
| `list(path, showHidden)` | 读取目录，返回 `FileEntry[]`，stat 每个条目 |
| `mkdir(path)` | 递归创建目录 |
| `rename(oldPath, newPath)` | 重命名/移动 |
| `remove(path)` | 删除文件或递归删除目录 |
| `readStream(path)` | 返回可读流（用于下载） |
| `writeStream(path)` | 返回可写流（用于上传） |
| `preview(path, maxBytes)` | 读取文件前 N 字节，判断文本/二进制 |
| `chmod(path, mode)` | 修改权限 |

### 2.3 SFTP 连接池服务

**新文件**: `apps/server/src/services/sftp-service.ts`

核心设计：
- 按 `${user}@${host}:${port}` 缓存 `ssh2.Client` 连接（连接池）
- 连接创建时 30s 超时，5 分钟空闲自动关闭，错误时自动清出连接池
- 所有操作通过 `getConnection(sshTarget)` 获取或复用连接，再调用 `.sftp()` 子系统

| 方法 | 说明 |
|------|------|
| `list(target, path, showHidden)` | SFTP `readdir` + `stat` |
| `mkdir(target, path)` | SFTP `mkdir` |
| `rename(target, oldPath, newPath)` | SFTP `rename` |
| `remove(target, path)` | SFTP `unlink` 或递归 `rmdir` |
| `download(target, path)` | SFTP `createReadStream` |
| `upload(target, path, stream)` | SFTP `createWriteStream` |
| `preview(target, path, maxBytes)` | SFTP `createReadStream` + 截断读取 |
| `chmod(target, path, mode)` | SFTP `chmod` |

### 2.4 HTTP 路由

**新文件**: `apps/server/src/routes/filesystem.ts`

| Method | Path | 功能 |
|--------|------|------|
| POST | `/api/fs/list` | 列目录（支持隐藏文件开关） |
| POST | `/api/fs/operation` | 统一文件操作（mkdir/rename/delete） |
| POST | `/api/fs/download` | 下载文件（二进制流，触发浏览器下载） |
| POST | `/api/fs/upload` | 上传文件（multipart，支持多文件） |
| POST | `/api/fs/preview` | 获取文件预览内容 |
| POST | `/api/fs/chmod` | 修改文件权限（SSH 目标专属） |

安全要求（所有路由强制执行）：
- 路径规范化 + 检测 `../` 路径遍历
- `@fastify/multipart` 限制单文件最大 500MB
- SFTP 操作错误统一映射到 HTTP 状态码（404/403/500）

### 2.5 注册路由

修改 `apps/server/src/app.ts`，引入并注册 `registerFilesystemRoutes`。

---

## Phase 3：前端核心 UI（apps/web）

### 3.1 前端 API 客户端

**修改**: `apps/web/src/lib/api.ts`

新增：`listFiles`, `fileOperation`, `downloadFile`, `uploadFiles`, `previewFile`, `chmodFile`

### 3.2 状态管理 Hook

**新文件**: `apps/web/src/lib/use-file-browser.ts`

管理面板的所有本地状态：
- `currentPath`、`entries`（含排序）、`loading`、`error`
- `selectedPaths`（多选集合，`Set<string>`）
- `showHidden`（隐藏文件开关）
- `filterQuery`（当前目录搜索过滤）
- `sshTarget`（当前连接目标）
- 操作方法：`navigate`, `refresh`, `select`, `toggleHidden`

### 3.3 前端组件树

```
FileBrowserDrawer.tsx          # 可收起侧边抽屉（复用 SideDrawer 模式）
└─ FileBrowserPanel.tsx        # 主面板容器，双栏布局
   ├─ FileBrowserToolbar.tsx   # 工具栏（Home/上级/刷新/新建/上传/下载/删除/隐藏切换/过滤框）
   ├─ FileBrowserBreadcrumb.tsx# 路径面包屑（可点击各级跳转）
   ├─ FileBrowserTree.tsx      # 左侧目录树（折叠/展开，点击导航）
   ├─ FileBrowserList.tsx      # 右侧文件列表（列头+条目，支持列排序）
   │  └─ FileBrowserEntry.tsx  # 单行文件/目录（图标+多选checkbox+右键菜单触发区）
   ├─ FileBrowserContextMenu.tsx # 右键菜单（下载/重命名/删除/属性/复制路径）
   ├─ FileBrowserRenameDialog.tsx # 重命名内联弹窗
   └─ FileBrowserUploadZone.tsx  # 拖拽上传覆盖层（拖入时高亮）
```

**文件类型图标映射**（纯 CSS + Unicode emoji 方案，无需图标库）：

| 类型 | 示例 |
|------|------|
| 目录 | 📁 / 📂（展开） |
| 文本 | 📄（.txt .md .log） |
| 代码 | 🔧（.ts .js .py .go） |
| 图片 | 🖼（.png .jpg .gif .svg） |
| 压缩包 | 📦（.zip .tar .gz） |
| 可执行 | ⚙️ |
| 其他 | 📋 |

### 3.4 集成到 App

**修改**: `apps/web/src/App.tsx`

- 在 `BottomBar` 增加「📁 文件」切换按钮
- 点击后在 `SideDrawer` 旁边展开 `FileBrowserDrawer`（两个抽屉可并存或互斥，视 UI 空间决定）
- 新增 `fileBrowserOpen` state

---

## Phase 4：进阶功能

### 4.1 文件预览面板

**新文件**: `apps/web/src/components/FileBrowserPreview.tsx`

- 单击文件 → 右侧预览区出现（或底部弹出条）
- 文本文件：`<pre>` + 语法高亮（可选，用 CSS class 简单实现）
- 图片文件：`<img src="data:...">` 内嵌显示
- 其他：显示文件信息（大小、权限、修改时间）
- 预览内容来自 `/api/fs/preview`（截取前 64KB）

### 4.2 双击内联文本编辑

**新文件**: `apps/web/src/components/FileBrowserEditor.tsx`

- 双击文本文件触发
- 弹出模态框，包含 `<textarea>` 编辑区
- 保存时：将内容作为 Blob 通过 `/api/fs/upload` 覆写原文件

### 4.3 权限修改（chmod）

**新文件**: `apps/web/src/components/FileBrowserChmodDialog.tsx`

- 仅对 SSH/SFTP 目标显示
- 展示 rwxrwxrwx 九个 checkbox（owner/group/other）
- 提交后调用 `/api/fs/chmod`

### 4.4 拖拽上传

**FileBrowserUploadZone.tsx**（Phase 3 已列出）实现：
- 监听 `dragover` / `drop` 事件
- 拦截浏览器默认打开文件行为
- 将 `DataTransfer.files` 提取后调用 `uploadFiles`
- 显示上传进度条（XHR 的 `upload.onprogress`）

---

## Phase 5：收尾与验证

- 运行 `pnpm format`
- 运行 `pnpm check`（全工作区类型检查）
- 运行 `pnpm test`
- 在 `docs/` 添加文件浏览器架构说明（后端服务接口 + 前端组件树）

---

## 工作量评估

| 模块 | 预估代码量 | 难度 | 优先级 |
|------|-----------|------|--------|
| 共享类型（Phase 1） | ~120 行 | 低 | P0 |
| 后端依赖 + 本地 FS 服务（Phase 2） | ~180 行 | 低 | P0 |
| SFTP 连接池服务（Phase 2） | ~320 行 | 高（ssh2 异步 API） | P0 |
| HTTP 路由（Phase 2） | ~200 行 | 中 | P0 |
| 前端 API + Hook（Phase 3） | ~200 行 | 低中 | P0 |
| 前端核心组件 Panel/Toolbar/List/Entry（Phase 3） | ~700 行 | 中 | P0 |
| 前端 ContextMenu/Dialogs/Breadcrumb/Tree（Phase 3） | ~400 行 | 中 | P0 |
| App 集成（Phase 3） | ~60 行 | 低 | P0 |
| 文件预览（Phase 4） | ~150 行 | 中 | P1 |
| 内联编辑器（Phase 4） | ~120 行 | 中 | P1 |
| chmod 对话框（Phase 4） | ~80 行 | 低 | P1 |
| 拖拽上传（Phase 4） | ~100 行 | 中 | P1 |
| **合计** | **~2630 行** | **中高** | — |

**总体评估**：
- **Phase 1-3（核心功能）**：约 5-7 天，可交付一个可用的 MobaXterm 基础文件浏览体验
- **Phase 4（进阶功能）**：约 2-3 天，完成预览/编辑/chmod/拖拽
- **最大难点**：SFTP 连接池（连接复用、超时重连、资源释放）+ 前端多选+拖拽交互复杂度

---

## 安全与性能要求

1. **路径安全**：所有路径在后端规范化并检测 `../` 路径遍历，SFTP 路径同样校验
2. **大文件流式传输**：下载/上传均用 Node.js 流（`pipe`），不在内存中缓冲完整文件
3. **SFTP 连接池**：按 `user@host:port` 缓存连接，5 分钟空闲关闭，避免连接泄漏
4. **上传大小限制**：`@fastify/multipart` 配置最大 500MB，超出返回 413
5. **SSH 认证**：复用现有 `SshTarget.identityFile`，不支持密码输入（安全边界）
6. **预览截断**：文本预览最大读取 64KB，防止大文件撑爆内存

---

## 开发顺序建议

```
Phase 1 → Phase 2.1(依赖) → Phase 2.2(本地FS) → Phase 2.4(路由，先本地目标)
       → Phase 3.1(API) → Phase 3.2(Hook) → Phase 3.3(核心组件) → Phase 3.4(集成)
       → Phase 2.3(SFTP，接入远程目标) → Phase 4(进阶) → Phase 5(收尾)
```

> 这样可以先让本地文件浏览功能跑起来，再接入 SFTP，降低调试复杂度。
