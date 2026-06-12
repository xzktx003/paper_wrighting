# Coding Kanban Bug 修复记录

本文档根据现有仓库记忆整理历史 bug 修复记录。后续每次修复 bug，都应在本文件追加简短记录，说明现象、根因和关键修复点。

- `local-fs-service.test.ts` 中 chmod 测试使用 `640` 但 `validateChmodMode` 要求八进制模式必须以 `0` 开头（如 `0640`）。修复为更新测试值为 `0640`。
- `relativePaths` 解析后直接用于 `path.join(targetDirectory, relativePaths[fileIndex])`，未校验 `..` 分段，可构造 `../../../etc/passwd` 实现目录穿越上传。修复为在解析后逐条调用 `assertSafeFilesystemPath` 校验路径条目。
- `buildRemoteCommand` 对 `input.command` 仅做单引号包裹，未拦截反引号 `$() \"` 等危险 shell 元字符，攻击者可注入命令。修复为执行前用正则 `[\x00-\x1f\x7f`$\"\\]` 检测危险字符，超标则拒绝执行。
- `chmod` 路由对 mode 参数只做了 `assertSafeFilesystemPath`，但文件系统工具层的 `assertSafeFilesystemPath` 只检查 `..` 和控制字符，不校验 mode 格式（如 `0777`/`0x755`）或危险权限位（setuid/setgid/world-writable 组合）。修复为 `LocalFsService` 新增 `validateChmodMode` 校验八进制格式并阻断危险权限位组合。
- SFTP `chmod` 路由只调用 `assertSafeFilesystemPath`，未复用 `LocalFsService` 的 `validateChmodMode` 校验，导致远端 chmod 仍可接受非八进制格式和危险权限位组合。修复为将 `validateChmodMode` 提取到 `file-system-utils.ts` 共享模块，SFTP 和本地服务均使用同一校验。
- `App.tsx` 的 `handleCopyConnectCommand` 直接调用 `navigator.clipboard.writeText`，在 HTTP 页面或权限受限时失败。修复为使用已有的 `copyTextToClipboard` 工具，优先 API 失败时回退到 textarea + execCommand。
## 验证与开发环境

- `pnpm e2e` 在缺少 Playwright Chromium 系统库（如 `libatk-1.0.so.0`）的机器上会把全部浏览器用例刷成 90+ 个失败，难以判断是否为真实产品回归。根因是 e2e 入口没有浏览器启动前置检查。修复为在正式运行 Playwright 前先启动一次 headless Chromium；若缺系统库，直接输出缺失库名和 `npx playwright install` / `sudo npx playwright install-deps` 修复步骤。

## 文件浏览器

- 文件浏览器 chmod 接口会接受 `777abc` 这类非完整八进制权限字符串，并因 `parseInt(mode, 8)` 截断而实际按 `0777` 执行；路由层还会把部分参数错误归为 500。修复为新增严格权限解析，只接受 3 或 4 位八进制权限，本地和 SFTP chmod 共用同一规则，并把非法 mode、空路径、非法路径字符等参数错误映射为 400。
- 文件上传接口遇到非法 multipart JSON 字段（如损坏的 `relativePaths` 或非字符串数组）会抛出解析异常并按 500 返回。修复为对 `sshTarget`、`relativePaths` 做显式 JSON 字段解析和类型校验，非法上传参数统一按 400 返回。
- 前端文件上传在 HTTP 2xx 但响应体为空、非 JSON 或缺少 `uploadedPaths` 时，会在 `xhr.onload` 回调里直接 `JSON.parse` 或类型断言，异常逃逸出 Promise，调用方可能只看到上传卡住或泛化错误。修复为集中解析并校验上传响应结构，非法响应通过 Promise reject 返回明确错误。
- 前端通用 API helper 对所有成功响应都调用 `response.json()`，导致 `killTmuxSession` 这类后端返回 `204 No Content` 的成功操作在客户端仍抛出 JSON 解析错误。修复为成功响应解析器显式支持 204 和空响应体，同时保留非空响应的 JSON 校验。
- 前端通用 API helper 在 HTTP 失败且响应头为 JSON 时直接调用 `response.json()`，如果后端或代理返回空 JSON、损坏 JSON，会把语法错误暴露给调用方而不是稳定的 HTTP 状态错误。修复为失败响应解析器只在合法 `{ error: string }` 时使用服务端错误文案，空/损坏 JSON 回退到 `Request failed: <status>`，纯文本错误仍保留原文。
- 前端 agent session snapshot WebSocket 对每条消息都直接 `JSON.parse` 并按 snapshot 断言，代理噪声、损坏帧或未来非 snapshot 事件都可能让消息处理器抛错，导致看板停留在旧会话状态。修复为新增快照事件解析器，非法 JSON、非 snapshot 事件和畸形 payload 都被安全忽略，合法 snapshot 才更新 UI。
- 目录建议接口 `/api/directory-suggestions` 在请求体缺少 `prefix` 或 `prefix` 不是字符串时，会在 service 内调用 `.trim()` 触发 500。修复为在 service 入口校验 `prefix`，路由将该类客户端输入错误映射为 400，并补缺失/非字符串前缀回归。
- 文件浏览器 JSON 接口 `/api/fs/list`、`/api/fs/operation`、`/api/fs/preview`、`/api/fs/chmod`、`/api/fs/download` 仍有多处直接读取请求体字段，非字符串 `path`、非法 `showHidden` / `maxBytes`、错误类型的 `newPath` 或非法 SSH 端口会触发内部异常，或把坏参数交给本地文件/SFTP 服务。修复为在路由入口统一校验请求体、路径、布尔值、预览大小、操作类型和 SSH 目标；multipart 上传中的 `sshTarget` 元数据也复用同一校验。
- 文件浏览器预览区高度从 localStorage 恢复时只校验最小值，旧缓存中的超大高度会让预览区挤占文件列表；而用户拖拽时已有按容器高度夹紧的规则。修复为把预览高度夹紧逻辑抽成共用 helper，打开抽屉和容器尺寸变化时按当前布局重新夹紧，避免 stale storage 破坏列表可用空间。

## SSH 与命令参数

- SSH 命令参数构造只校验了 host、username、identityFile 等字符串字段，没有运行时校验 `port`、本地转发端口和连接超时；JSON 请求可传入字符串端口、0 或越界值并被透传给 `ssh -p` / `-L`。修复为在 `buildSshArgs` 边界强制端口为 1-65535 的整数，连接超时为正整数，并补非法端口回归测试。
- SSH 主机列表解析 `Host gpu22 gpu22-lan *.internal` 这类多 alias 配置时，会把 `gpu22 gpu22-lan *.internal` 当成一个主机名，或因为同一行含通配符而跳过可用 alias；非法 `Port` 还会解析成 `NaN` 并在 JSON 响应里变成 `null`。修复为按 alias 展开 `Host` 行、单独过滤通配 alias，并把非法端口回退到 22。

## 本地运行时

- 本地 agent / PTY 启动时，`workingDirectory` 解析没有复用文件系统路径安全规则，包含 `..` 段、空字节或换行的脏路径会进入 `statSync` / spawn cwd 解析路径。修复为在 `resolveLocalWorkingDirectory` 入口复用 `assertSafeFilesystemPath`，非法 cwd 直接回退到当前工作目录，并补路径穿越与非法字符回归。
- `/api/agent-sessions/:id/stdin` 在请求体缺少 `input` 或 `input` 不是字符串时，会把坏输入透传到 tmux、SSH、PTY 或本地 runtime，触发内部异常或 500。修复为在 stdin 路由入口统一校验 `input`，非法请求返回 400，并补缺失/非字符串输入回归。
- `PATCH /api/agent-sessions/:id` 改名接口在 `displayName` 为数字或对象时会直接调用 `.trim()`，导致内部异常和 500。修复为先校验 `displayName` 必须是字符串，非字符串返回 400，并补回归测试。
- `PATCH /api/agent-sessions/:id` 的隐藏会话字段用 `Boolean(hidden)` 强制转换，客户端误传字符串 `"false"` 也会被当作 `true` 并隐藏会话。修复为 `hidden` 只接受真实 boolean，其他类型返回 400，且不改变原会话状态。
- 多个会话详情、聚焦、stdin、删除等路由在传入不存在的 session id 时直接透传 `registry.get/focus` 的 `Unknown agent session` 异常，客户端会收到泛化 500。修复为 agent session 路由插件统一把该已知 registry 错误映射为 404，同时保留其他异常的默认处理，并补常见路由回归。

## 焦点与输入

- 文件浏览器右键文件或文件夹后点击“复制路径”在局域网 HTTP 页面会失败。根因是代码直接调用 `navigator.clipboard.writeText`，而 Clipboard API 在非安全上下文或权限受限时不可用。修复为增加剪贴板 helper，优先使用 Clipboard API，不可用或被拒绝时回退到隐藏 textarea + `execCommand('copy')`，并补右键文件/目录复制路径回归测试。
- 多屏聚焦视图中，选中不同终端后顶部标题栏和“改名”按钮仍指向最初进入聚焦页的终端。根因是标题栏直接读取 App 层 `focusedSession`，而多屏切换输入窗格在侧栏工具未打开时不会同步外层 focused session。修复为标题、状态、改名和重连按钮优先使用当前 active monitor slot 对应的 session，找不到时再回退到 `focusedSession`。
- 多屏聚焦视图从“其他会话”拖入屏幕时，浏览器拖拽缩影会混入多个其他会话预览。根因是未显式设置 drag image，浏览器默认截图包含终端预览的侧栏卡片时容易把相邻缩影一起带入拖影。修复为拖拽开始时创建只包含当前会话名称和少量输出的专用单会话拖影，拖拽结束或 drop 后清理。
- 聚焦视图静态区域点击后，Copilot CLI 会出现“界面还在但无法继续输入”或首字符重复。根因是 `AgentFocusView` 过度依赖 `keydown` 阶段补发事件，且把按钮/链接当作输入控件。修复为在静态区域 `pointerdown` 直接把焦点还给 xterm，并避免重复转发首字符。**修复：已在本版本实现。`handleKeyDown` 在转发前先检查 `active === document.body || active === null`，在点击静态区域后的短暂过渡期间（`focusActiveTerminalTextarea()` 异步调度 focus）跳过转发，由 textarea 原生 input handler 自然处理按键，避免同一按键被发两次。**
- 分栏模式下，从终端点击回 VS Code iframe 后，终端会把焦点抢回。根因是 `TerminalView` 只把原生表单控件视为“有意外部焦点”。修复为把 `iframe` 纳入允许外部焦点的白名单。
  - **修复**: `TerminalView.tsx:1104` — 在 `handlePointerDownCapture` 中增加 `isProtectedExternalFocusTarget` 检查，防止把 `iframe` 等受保护元素的点击事件误判为终端意图而抢回焦点。
- 分栏模式下，从终端切到文件浏览器编辑器或 VS Code 后，输入过程中焦点仍可能被终端抢走。根因是终端只看当前 `document.activeElement`，在 blur/focus 交接瞬间看到 `body` 就误判需要抢焦点；同时 VS Code 抽屉把 `reused` 变化当成新实例。修复为增加外部输入焦点保护窗口，并忽略 `reused` 单独变化带来的 iframe 重载。
  - **修复**: `TerminalView.tsx:1109` — 在 `handlePointerDownCapture` 保护返回分支中也调用 `rememberExternalPointerIntent`，让受保护元素（iframe）的点击同样启动 750ms 焦点保护窗口，防止后续 `scheduleFocusInteractiveTerminal` 把焦点从 VS Code 抢回。同时 `vscode-drawer-state.ts` 的 `applyVsCodeWebOpenResponse` 已忽略 `reused` 单独变化（`isSameResponse` 只比对 url/provider/workingDirectory）。
- VS Code 分栏打开时，用户已经点回终端输入，过一会仍可能再次失焦，必须再点一次终端才能继续。根因是 `TerminalView` 只在离散 blur/focus 事件上补救，缺少对“最近一次本来就是终端”的被动失焦修复；当 VS Code iframe 生命周期让焦点短暂掉到 `body` 时，终端不会自动补回。修复为记录最近一次终端/外部焦点意图，并仅在“最近一次是终端”时启动轻量焦点修复守护。
- 终端已经进入可输入状态时，空闲一阵后仍可能再次失焦，必须补点一下才能继续输入。根因是被动焦点修复把“从未有外部输入控件接管过焦点”的场景也判成了“没有足够证据归还终端”，导致活动终端在默认输入 owner 身份下发生焦点漂移时不会自动修复。修复为让 `TerminalView` 在没有受保护外部焦点记录时默认继续修复活动终端的 helper textarea。
- VS Code / 文件浏览器分栏打开时，用户点回终端后仍可能被后台 iframe 或编辑器的程序化 `focus()` 抢走，表现为过一会又要补点终端。根因是 `TerminalView` 把当前 `document.activeElement` 是 iframe/input 直接等价为“用户有意选择外部输入”，没有区分用户点击和后台被动 focus；隐藏保活的侧栏面板也仍可参与焦点竞争。修复为把焦点所有权改成最近一次用户意图模型：只有外部指针、外部键盘输入或带用户激活的 iframe focus 才能接管；终端点击后后台 focus 不再覆盖；非 active 侧栏面板加 `inert` 并在隐藏时释放内部焦点。
- 本机连接其他服务器时，看板文件浏览器报 `All configured authentication methods failed`、看不到远端文件列表。根因是终端会走系统 `ssh`，能自动使用默认私钥；但文件浏览器走后端 `ssh2` 的 SFTP 直连，只会在 `identityFile` 显式配置时携带私钥，导致未写 `IdentityFile` 的主机全部认证失败。修复为 SFTP 认证优先使用显式 `identityFile`，否则回退到标准默认私钥，并兼容 `SSH_AUTH_SOCK`。
- 远端 SSH 会话已在线时，打开文件浏览器仍偶发空白并报 `write ECONNRESET` / `No response from server`。根因是 `SftpService` 在 SSH 连接 `ready` 前就把连接对象放进池里，导致并发的首批 `/api/fs/list` 请求复用了半初始化连接。修复为复用现有连接前先等待 `ready` 完成，并在连接失败时及时从池里移除。
- 远端 SSH 会话已退出或目标并不提供 shell（如 Gerrit SSH 接口）时，kanban 卡片终端只显示 `[连接已断开]`，看不到真实错误。根因是 PTY 退出后 runtime handle 立即删除，terminal websocket 再连接时拿不到历史回放，只能 4004 关闭并让前端退化成泛化断开提示。修复为 terminal websocket 在 runtime 已退出但 session 仍存在时，回退到 registry 的历史输出回放。

## 终端协议与 TUI 握手

- live stdin 过滤掉 DA/DSR/OSC/DCS 应答时，Copilot CLI 等 TUI 会卡在能力握手阶段并静默丢输入。修复为只清洗 replay 内容，不过滤 live stdin 的握手/状态应答。
- 终端 focus-report mock 没有先进入 raw mode，会导致 `CSI I/O` 焦点事件被行缓冲，产生假红测试。修复为在断言聚焦输入前显式把 mock stdin 切到 raw mode。
- shell/prompt 行编辑态触发的 Secondary DA 原样转发会把终端版本串回显到提示符。修复为仅过滤这类会污染 shell 提示符的 Secondary DA，应答性能力握手仍保留。
- kanban 终端偶发回显 `11;rgb:... 10;rgb:... 4;...`。根因是 OSC 10/11/4 color-query replies 通过 live stdin 泄漏到 PTY。修复为在 live stdin 路径做窄化过滤，只屏蔽这类 rgb 回包，同时保留 DA/DSR/CPR 等握手回复。

## tmux 与终端渲染

- tmux mouse mode 下直接拖拽会被 tmux/TUI 接管，浏览器侧 xterm 不会产生可复制 selection，导致 kanban 无法把 pane 内选择自动写入剪贴板。修复为 `TerminalView` 消费 OSC 52 clipboard 请求并调用浏览器剪贴板 API，让 tmux copy-mode 负责 pane 内选择边界，普通鼠标/二进制事件转发保持不变。
- 手机浏览器打开 Codex 长上下文终端时，用户在终端区域下拉查看历史会触发浏览器下拉刷新，或者滑动的是页面而不是 xterm 历史。根因是移动端仍复用桌面页面滚动结构，浏览器根滚动链路没有被锁住；首版终端 touch 监听只在冒泡阶段接管，遇到 xterm 内部 viewport/浏览器手势竞争时拦截不够早，且用户停留在桌面聚焦页时没有启用手机触控模式。修复为新增 `/mobile` 手机终端页，挂载时锁定 `html/body/#root` 滚动，并让 `TerminalView` 在手机触控模式下用捕获阶段的非 passive `touchstart/touchmove` 拦截单指滑动、滚动 xterm 历史，双指缩放字号；触屏设备的桌面聚焦页也启用同一逻辑。
- 手机访问 `/mobile` 进不去或 404。根因是部分当前运行入口只暴露根页面或只启动了后端，`/mobile` 这种 history route 依赖前端开发服务/静态服务提供 SPA fallback。修复为移动端按钮改用 `/?view=mobile` 根路径 query 入口，并保留 `/mobile`、`/m`、`#/mobile` 兼容解析。
- 手机端 Tab、Esc、Ctrl+C、方向键等快捷键在部分会话里会变成”控制键 + Enter”或不能作为真实按键送入 Codex。根因是手机端快捷键走已有 stdin 路由，而旧的非 PTY runtime 会给任意输入追加换行，tmux 控制路径也把输入按行拆分并总是补 Enter。修复为对 stdin payload 做控制字符识别：普通文本仍可补换行提交，Tab/Esc/Ctrl/方向键和多行粘贴按原始输入转发；tmux 接入路径把通用控制字符转换成 `send-keys` 按键名但不增加 tmux 专用快捷键按钮。
- 手机端快捷键缺少 Claude / Copilot CLI 常用控制键，`Shift+Tab`、`Ctrl+O`、`Ctrl+E` 以及行编辑组合无法从手机触发；同时新增类型里残留旧 `line-start/line-end` id，存在构建失败风险。修复为扩展快捷键表到 `Shift+Tab`、`Ctrl+U/W/K/Y/A/O/E`，并让本地 tmux 转换层把对应控制字符映射到 `BTab`、`C-o`、`C-e` 等 tmux key name，避免注入不可见 literal。
- 手机端快捷键说明弹窗缺少 `aria-modal`、`aria-labelledby` 和 Tab 聚焦陷阱，屏幕阅读器用户无法正确聚焦弹窗。修复为弹窗增加 `aria-modal=”true”`、`aria-labelledby` 指向标题、Tab 循环限制和 Escape 关闭，卸载时还原页面焦点。
- 手机端快捷键工具栏一度改成多行平铺后占用手机纵向空间，且不符合用户希望“单行左右滑动选择”的操作预期。修复为保持 `flex` 单行横向选择器，使用 `overflow-x: auto` 和 `touch-action: pan-x` 支持左右滑动，并把 `EOF` 按钮展示为真实快捷键名 `Ctrl+D`。
- 手机端输入框点“发送”后，Copilot、Claude 和 Codex 只把文字填进 Agent 输入框，需要再手动点一次 Enter 才真正提交任务。根因是移动端把文本和回车合并在同一个 stdin payload 里，部分 Agent TUI 只消费文本输入，没有把同批次的回车当作提交键。修复为“发送”和“粘贴执行”分两帧发送：第一帧 bracketed paste 文本，第二帧单独发送真实 Enter；“粘贴”仍保持只写入文本。
- 轻量预览下未开启完整小终端时，浏览器资源诊断仍显示 `/ws/agent-sessions` 达到数百 msg/s、数 MB/s，内存和网络持续增长。根因是每个终端输出帧都会触发后端发送一次全量会话 snapshot，前端必须持续 JSON 解析并刷新 React 状态。修复为对高频输出触发的全量看板快照做 trailing 合并广播，结构性操作仍即时刷新，同时避免 observe-only 会话输出时创建无效 awaiting_input timer。
- 加入大量 tmux 会话后，宫格页鼠标上下滚动明显卡顿，完整预览模式下更严重。根因是宫格一次性挂载所有卡片，完整预览会同步创建所有非交互 xterm 和 terminal WebSocket。修复为 `AgentGrid` 超过阈值后按可视区域虚拟化渲染，只挂载当前视口附近的卡片，并让虚拟行高与 CSS 卡片高度保持一致。
- Codex 产生很长输出后，切换/重开终端或从 tmux observe 刷新时只能看到最近一小段，像是丢了几百行。根因是 live PTY replay 只保留 256 KiB，tmux capture 固定 `-S -200` 且 detail 再截 200 行，registry fallback 也只留 200 条。修复为把 PTY replay、tmux capture、registry fallback 和前端 xterm scrollback 上限改成可配置默认值，并在资源诊断中展示 PTY 历史裁剪状态。
- 选定机器扫描 tmux 会话后，按钮会在“扫描中...”和“刷新”之间频繁交替。根因是 `TmuxDiscoveryPanel` 把全局 `sessions` 列表放进自动扫描 effect 依赖，WebSocket snapshot 刷新会话列表时会反复触发 `/api/agent-discovery/tmux/scan`；并发 scan 的旧请求也可能提前把 `loading` 改回 false。修复为扫描触发只依赖稳定 host key，`sessions` 更新只重新计算已加入标记，并用请求序号/host key 丢弃过期扫描结果。
- 非交互缩略图把真实 tmux 会话 resize 成小终端，导致布局和状态栏错乱。修复为缓存主终端几何尺寸，在前端做本地缩放预览，不把缩略图尺寸回写到后端。
- SSH -> tmux 场景中，仅调用 `node-pty.resize()` 不足以让远端 tmux 感知尺寸变化。修复为补发 `SIGWINCH`，确保 ssh 把尺寸变化转发给远端 client。
- 远端新建 tmux 会话时，`copilot` / `codex` / `claude` 这类非 shell agent 会在启动命令退出后把整个 tmux session 一起带没，看起来像“只能建 shell，不能建远端 tmux”。根因是前端 `buildTmuxLaunchCommand` 与服务端实现漂移，非 shell 分支少了 keep-pane-open 包装。修复为复用带 `exec "$SHELL_BIN" -i` 的 tmux pane 命令构造，保证 agent 退出后 pane 仍留在交互 shell 中。
- 远端 `10.30.0.24` 上从看板启动 Copilot 会话时，看起来像“tmux 创建失败”，实际是该主机把 `copilot` 解析到了一个缺少 `index.js` 的 `~/.nvm/.../bin/copilot` node shim。修复为远端 Copilot 启动命令先尝试健康的 `copilot` 可执行文件；若命中损坏 shim，则回退到 `node ../lib/node_modules/@github/copilot/npm-loader.js` 直接启动 CLI。
- 远端 `10.30.0.24` 上直接创建 shell tmux 时，默认名 `10.30.0.24_shell_tmux` 会被旧版 tmux 3.0a 拒绝并报 `bad session name`。根因是默认会话名生成器在 tmux 模式下仍保留 `.`。修复为 tmux 模式下对 host label 使用更严格的名字规范化，把 `.` 一并收敛成 `_`，生成 `10_30_0_24_shell_tmux` 这类 tmux-safe 名称。
- 本地 tmux 会话刚进入 focus view 后，浏览器已经通过 terminal WebSocket 发出了输入帧，但 tmux pane 里收不到 `stdin:<marker>`。根因是 WebSocket stdin 只写入 `tmux attach` 所在 PTY，attach 竞态或 pane 目标缺失时早期输入会丢失。修复为本地 tmux 会话优先通过已有 `LocalTmuxAdapter.writeInput` 的 `tmux send-keys` 队列写入目标 session/pane，并在失败时回退 PTY 写入。
- 本地 tmux 开启 mouse mode 后，在 kanban focus view 点击终端会把 `ESC[<...M` / `ESC[M...` 这类鼠标报告直接写进 pane，表现成字符码输入，点击无法被 tmux 处理。根因是 terminal WebSocket 对本地 tmux 会话统一优先走 `tmux send-keys`，鼠标报告绕过了 `tmux attach` client。修复为识别 xterm mouse report，有附着 PTY 时写回 PTY 让 tmux client 处理，没有 PTY 时不再把 mouse report 注入 pane；普通文本仍保持 `send-keys` 路径。
- 顶栏“终端字号”滑杆拖动时页面明显卡顿。根因是每个 range `input` 中间值都会立刻更新全局 `terminalFontSize`，所有挂载的 xterm 都同步执行 `fontSize`、`fit()` 和 `refresh()`。修复为拖动时只更新顶栏草稿值，鼠标松开、键盘调整结束或失焦提交后才应用到真实终端并持久化。
- 拖动顶栏“终端字号”滑杆后，Codex-like TUI 会收到 `focus-out`，松手后直接打字没有进入终端。根因是 `input[type=range]` 被终端焦点保护逻辑视为真实输入控件，鼠标提交字号后焦点仍停留在滑杆上。修复为鼠标提交字号后主动恢复当前 active terminal 的 xterm helper textarea 焦点，键盘调整滑杆仍保留控件焦点。
- 多屏 focus view 里把 sidebar session 拖到当前输入 pane，或在当前输入 pane 的下拉框切换 session 后，pane 会短暂变化又被恢复成原 focused session。根因是 `normalizeTerminalMonitorSlots` 会把 App 级 `focusedSession` 强制放回 active slot，而 active slot select/drag 在 `syncActiveTerminalWithFocus=false` 时没有同步 focused session。修复为 active slot select、拖入 active slot、从 active slot 拖出时同步 active slot/focused session，并让 sidebar 卡片单击即可切换 focus。

## 文件浏览器

- 新建文件/目录弹窗把草稿名称字符串当作开关，输入框清空时弹窗直接卸载。修复为显式维护弹窗状态，并在名称为空时仅禁用提交而不关闭对话框。
- 多会话聚焦视图中，某个终端的文件浏览器折叠后，切到其他会话再切回时会自动展开。根因是折叠状态保存在全局 UI 状态里，并在当前会话没有侧栏打开时被清零；修复为把左右分栏折叠状态保存到对应 `agentSession` 的侧栏状态中，切换会话不再互相覆盖。
- 多屏聚焦视图里，切换输入终端时文件系统/VS Code 侧栏的跟随规则不符合预期：工具已打开时没有稳定切到对应终端的工具状态，工具未打开时又可能把外层 focused session 一起切走。根因是多屏 active slot 和 App 级 `focusedSession` 总是强绑定。修复为只有文件系统或 VS Code 已打开时才把 active terminal 同步到 `focusedSession`，并把当前工具类型带到目标 session；未打开工具时只切多屏输入窗格，不切侧栏绑定。
- 多屏中快速切换终端时，文件系统侧栏偶发出现、消失或未加载到对应终端路径。根因是每个会话各自保留 `activeTool`，切换时又通过 active slot effect 和 focused session 派生侧栏开关，多个旧会话状态会抢当前抽屉归属。修复为在 App 层维护全局单一 `openSidePanelTool`，切换终端时只把该工具独占写入当前输入终端，并清空其他会话的 `activeTool`。
- 进一步排查发现，`onActiveTerminalSessionChange` 的 React effect 也参与侧栏 retarget，会和用户点击 pane 时的同步 `onSwitchFocus` 路径竞争，导致快速切换时最终目标偶发被较晚提交的 effect 覆盖。修复为 effect 只记录当前 active terminal id，文件系统/VS Code 跟随只由用户激活 pane 的同步路径执行，并补快速 A/B/A/B 切换回归。
- 文件系统/VS Code 侧栏是否显示仍被误建模成“某个终端是否开启过工具”，导致全局文件系统已经打开时，切到一个从未开过文件系统的终端仍可能不显示或按旧会话状态判断。修复为完全移除 session 级 `activeTool` 作为运行时状态，文件系统/VS Code 是否显示只由全局 `openSidePanelTool` 和用户工具按钮控制；每个 session 只保存 host、折叠等配置，切换终端只更换侧栏目标内容。
- 文件系统/VS Code 侧栏折叠状态仍然绑定到 `focusedSession` 的 per-session `sideCollapsed/mainCollapsed`，导致多屏切换终端时一会儿折叠、一会儿展开。修复为把左右分栏折叠状态收回全局 `fileBrowserUiState`，只有用户点击折叠/展开按钮才改变折叠状态，切换终端只更新侧栏内容目标。
- 服务端构建在文件下载路由处报 `archiver` 没有导出 `ZipArchive`，改成默认导入后又在 Node ESM 运行时报 no default export。根因是 `archiver` v8 运行时导出 `ZipArchive`，但当前类型声明仍按旧的 `export = archiver` 函数形态暴露。修复为使用 namespace runtime import，并在类型层显式声明 `ZipArchive` 构造器，保留本地/远端目录下载逻辑。

## VS Code Web 与 WebSocket 生命周期

- kanban 里的内嵌 VS Code Web 在自签 HTTPS 下会出现 PNG 预览 / webview 打不开。根因不是 PNG 本身，而是 code-server 的 webview / 预览链路依赖 service worker；浏览器虽然允许你“继续访问”自签页面，但仍会因为证书不受信任而拒绝给 `/vscode/.../service-worker.js` 注册 service worker。修复为让 `restart-dev.sh` 在本机装有 `mkcert` 时优先生成浏览器信任的本地证书，并在只能回退到 OpenSSL 自签证书时明确告警。
- React StrictMode 下，CONNECTING 阶段的 WebSocket 在 effect cleanup 中被关闭，会制造“连接尚未建立就关闭”的假断开提示。修复为在 dev-only 清理路径上延后关闭，等到 `onopen` 后再真正回收。
- SSH 远端会话打开 VS Code Web 时总被判定为“不支持”。根因是 `VsCodeWebManager` 之前只实现了本地 editor 生命周期。修复为补充 SSH 远端 `code-server` 的启动/复用、健康检查，以及 `/vscode/` 代理目标切换，先支持像 `10.30.0.24` 这类可被后端直连的远端主机。
- `10.30.0.24` 上 SSH 远端会话虽然能返回 VS Code URL，但 iframe 仍然只显示 404：根因有三层叠加——tunnel helper 继承了 ssh config 里的 `RemoteForward 18888`、远端优先复用了 `.vscode-server/.../code-server` 这类返回 404 的 agent binary、而旧错误进程还持续占着 `13338` 端口。修复为让 VS Code tunnel 使用 configless ssh、远端只启动 standalone `code-server`、并在健康检查失败时先清理目标端口上的陈旧监听进程，再拉起新实例。
- SSH 远端会话在前端里依然打不开 VS Code，只剩文件浏览器可用。根因是 `App.tsx` 仍把 `vscodeAvailable` 写成了“仅本地会话可用”的布尔门禁，导致即便后端远端 `/vscode-web` 已经打通，SSH session 的 VS Code 按钮也会被禁掉。修复为让聚焦态 SSH 会话同样允许打开 VS Code Web，并同步修正文案。
- `10.30.0.23` / `10.30.0.21_host` 这类远端主机仍然打不开 VS Code：一层根因是部分机器根本没装 standalone `code-server`；另一层根因是 remote VS Code 的 configless tunnel 只规避了 ssh config 里的 `RemoteForward` 污染，却没有先解析 ssh config 里的 alias / port / identity，于是 `10.30.0.21_host` 这类别名和 `10.30.0.23` 这类靠 ssh config 改端口的主机都会把 tunnel 连错。修复为在目标机补装 standalone `code-server`，并让 tunnel 在 `ssh -F /dev/null` 前先通过 `ssh -G` 解析出真实 `hostname/port/identityfile` 再发起连接。
- 看板通过本地 `/vscode` 代理打开 VS Code Web 时，HTTPS 页面里的图片预览仍可能加载失败。根因是代理层之前只把后端看到的 `request.protocol/host` 原样转发给上游 `code-server`；当前端开发页经由 HTTPS 访问、后端实际走本地 HTTP 代理时，上游收到的却是错误的 `http + 本地端口`，从而生成了错误的预览资源来源。修复为让 `/vscode` 代理和 `/api/agent-sessions/:id/vscode-web` 一样，优先从浏览器的 `Origin/Referer` 或现有转发头推导公开 `host/protocol`，再转发给上游。
- 本地 HTTPS 开发证书已经回退到 OpenSSL 自签时，VS Code Web 的 webview / 图片预览仍会报 `Could not register service worker ... An SSL certificate error occurred`。根因是浏览器不会为不受信任的自签证书注册 service worker，而旧脚本在“复用现有证书”路径上既不会持续告警，也不会在后续装上 `mkcert` 后自动升级证书。修复为：1）修正现有证书 SAN 匹配，避免 IP SAN 误判导致行为漂移；2）为脚本生成的证书写入 metadata，复用 OpenSSL 自签证书时持续输出 VS Code 预览受限告警；3）一旦检测到 `mkcert` 已可用，自动淘汰旧自签证书并重签为受信任证书。

- 点击 `VS Code保持状态` 后，运行中的非聚焦终端窗格仍只显示轻量预览。根因是 `vscodeIframeCacheMode` 只保留 VS Code iframe，未同步切换 `useLightweightTerminalPreview`，两个内存/保真度开关在用户工作流里分裂。修复为把 VS Code cache profile 与终端预览保真度联动：保持状态时完整渲染运行终端窗格，省内存时恢复轻量预览。

## 开发环境与测试基础设施

- Paper Writer 前端打开后不稳定或打不开。根因是临时加入 `dist/index.html` 的自动同步脚本每 2 秒枚举并 HEAD 轮询所有已加载资源，真实浏览器会持续制造大量请求并可能触发 reload/卡顿。修复为移除当前运行入口里的轮询脚本，让静态页面恢复为只加载主 JS 和 CSS；后续热同步应放到受控开发模式实现。
- Paper Writer 进入任意编辑器页后显示 `Something went wrong / missing ) after argument list`。根因是手改当前运行构建产物新增预览翻译 hook 时，多写了一个闭合大括号，`EditorPage` 懒加载模块在 Chromium 中解析失败。修复为删除多余 `}`，并用 Playwright 直接动态 import `EditorPage` 与打开 `/editor/moe_prune` 做回归验证。
- Paper Writer 预览翻译点击后报 `ENOENT ... conversations/<project>/preview-translate-*.json`。根因是前端把随机生成的临时字符串当作 conversation id 传给 `/api/ai/send`，但后端会按该 id 读取已有会话 JSON。修复为翻译前优先复用当前会话；没有当前会话时先通过 `/api/conversations/:projectId` 创建真实 `Preview Translate` 会话，再把返回的 id 传给 AI 接口。
- Paper Writer 8787 服务停掉后无法重启，导致前端完全打不开。根因是当前运行目录里的 `app/apps/backend/src` 和 ESM `package.json` 缺失，且本地 LLM 配置没有落到后端会读取的 `.env`，服务启动时先遇到源码缺失/语法恢复噪音，随后因空 API key 直接退出。修复为从覆盖率产物恢复后端源码、清理 Istanbul 标记、补回 backend ESM package 声明，并把本机 Paper Writer 配置同步到被 git 忽略的 `app/apps/backend/.env` 后用 `setsid` 后台启动。
- Paper Writer 项目页侧栏同时显示 `所有项目`、`我的项目`、`已归档`、`回收站`，分类过多且 `所有项目` 与 `我的项目` 在常规场景含义重叠。修复为当前运行构建产物只展示 `开放项目` 和 `归档项目` 两类；开放项目过滤 `!archived && !trashed`，归档项目过滤 `archived && !trashed`。
- `papers/paper-agent` 投稿目录同时保留了最终上传文件和一份重复的源码工作副本，容易让人误以为需要上传散乱的 `sec/`、`main.tex`、`references.bib`。修复为只保留三个实际投稿文件 `cover-letter.pdf`、`main.pdf`、`paper-agent-spe-latex-source.zip`，删除重复源码树，并把 `README.md` 改成投稿清单。
- Playwright 只复用前端 Vite 服务时，可能在 `/api` 代理已经坏掉的情况下误以为测试环境可用。修复为前后端分别做健康检查，避免复用损坏环境。
- 多轮 Playwright e2e 后，Vite 或后端 `tsx watch` webServer 可能因 `EMFILE` / `ENOSPC: System limit for number of file watchers reached` 启动失败。根因是测试环境反复启动 watcher，命中本机 fd/watch 上限。修复为 Playwright 启动的 web dev server 默认设置 `CHOKIDAR_USEPOLLING=1`，后端 e2e 服务改用非 watch 的 `tsx src/index.ts`，且只有显式 `PLAYWRIGHT_REUSE_EXISTING_SERVER=1` 时才复用旧服务。
- HTTPS dev server 已在 `3333` 端口运行时，Playwright e2e 仍等待 `http://127.0.0.1:3333` 直到 webServer 超时，或者浏览器因本地开发证书报 `ERR_CERT_AUTHORITY_INVALID`。根因是 e2e 配置没有按前端 HTTPS 模式切换探测协议，且 `terminal-preview` 用例缺少本地证书忽略设置。修复为支持 `PLAYWRIGHT_FRONTEND_PROTOCOL`，HTTPS 协议下开启 `ignoreHTTPSErrors`，并给终端预览 e2e 补齐 HTTPS 测试约定。
- `pnpm dev` / `restart-dev.sh` 能启动页面但 API 代理可能连错端口。根因是后端和脚本默认使用 `3200/3100`，但 `apps/web/vite.config.ts` 仍写死前端 `3000`、后端代理 `4000`，且没有复用已有的 `resolveWebDevConfig`。修复为让 Vite 配置统一走 `resolveWebDevConfig`，按 `WEB_BACKEND_PORT -> SERVER_PORT -> PORT -> 3200` 解析后端代理，并同步 `.env.example` 默认值。
- `scripts/restart-dev.sh` 重启失败，先报缺少 `scripts/dev-https-cert.mjs`，补齐后又因 Vite/tsx native watcher 命中 `EMFILE`。根因是 HTTPS 证书生成 helper 在合并后缺失，且开发脚本没有为前后端 watch 模式设置 polling。修复为恢复 `dev-https-cert.mjs`，并在后端和前端启动环境都设置 `CHOKIDAR_USEPOLLING=1`。
- Ubuntu 主机缺少 Playwright Chromium 运行库时，浏览器测试无法启动。现有 workaround 是下载所需 `.deb`、提取到本地目录，并通过 `LD_LIBRARY_PATH` 注入依赖。
- `pnpm -r test` 全部断言通过后仍不退出。根因是多个服务级 idle timer 没有 `.unref()`，导致 Node event loop 一直存活。修复为所有仅用于空闲清理的 timer 创建后立即 `.unref()`，并补 `hasRef() === false` 回归。
- `awaiting_input` 相关单测在高负载下可能偶发超时。修复策略是调小测试专用的 `awaitingInputIdleMs` 覆盖值，而不是放大全局默认值。
- `awaiting-input timer retries when the first idle check fires early` 测试在引入 timer `.unref()` 纪律后失败，报假 timer handle 没有 `unref`。根因是测试 mock 的 `setTimeout` 返回数字句柄，已经不符合生产代码对 Node timeout 的最小契约。修复为让假 timeout 提供并断言 `unref()`，继续覆盖早触发重试逻辑。
- `launch does not surface npm config warnings before local Copilot starts` 单测稳定超时。根因是测试直接依赖当前机器真实 `copilot` 启动文案，而不是仓库已有的 `.playwright-bin/copilot` stub。修复为在该测试内显式启用 `PLAYWRIGHT_TEST=1` 并把 stub 目录加入 `PATH`，断言 fake 或真实 Copilot 启动均不得出现 `Unknown env config`。

## 兼容性与环境探测

- shell 解析逻辑曾默认依赖 zsh，导致 Linux/macOS 某些环境无法正常启动。修复为优先读 `SHELL`，再回退到 `bash -> zsh -> sh`。
- tmux 路径曾只假设单一路径，导致 Homebrew Intel/Apple Silicon 或 PATH 安装下行为不稳定。修复为支持 `TMUX_BINARY`、Homebrew 常见路径和 `PATH` 自动探测。
- 前后端端口和 Vite 代理目标曾被硬编码，切换环境后容易错连。修复为统一改成 `HOST`、`PORT`、`WEB_HOST`、`WEB_PORT`、`WEB_BACKEND_*` 等环境变量驱动。

## 终端焦点保留

- Codex CLI 运行后，鼠标滚轮有时滚动上下文，有时变成输入框历史记录上下翻页。根因是 xterm.js 在 TUI 开启鼠标追踪或无 scrollback 路径时会把 wheel 事件转换为鼠标协议或 Up/Down 方向键序列转发给 PTY。修复为前端接管 `attachCustomWheelEventHandler`，自己计算并滚动 xterm scrollback，返回 `false` 阻止 wheel 进入 stdin；输入历史翻页只保留给键盘上下箭头。
- 多屏或完整预览场景里，某个终端偶发无法用鼠标滚轮浏览上下文。根因是滚轮接管只挂在 xterm 内部自定义 wheel handler 上，事件落在终端外层容器、缩放后的空白区域或非输入预览终端时可能漏掉。修复为在 `TerminalView` 容器捕获阶段统一接管 wheel，所有终端视图都滚动自己的 xterm scrollback，并阻止 wheel 进入 stdin。
- 运行中的终端已经接收到滚轮事件后，仍可能刚滚上去就被实时输出拉回底部，表现为“滚轮滑不动上下文”。根因是 live `term.write()` 在持续输出时会刷新底部跟随，覆盖用户刚选择的 scrollback 视口。修复为滚轮离开底部后短暂锁定用户查看的 viewport，新输出写入完成后恢复到该行；用户滚回底部或点击“底部”按钮后解除锁定。
- 仍有很多运行中终端滚轮控制不了上下文：一层根因是旧用户滚动锁只有 10 秒，长输出终端停留阅读超过 10 秒后又会被 live output 拉回底部；另一层根因是 wheel 事件可能落在终端上方的遮罩、空白层或其他 document-level 目标上，没进入 `.terminal-view` 容器。修复为把用户滚动锁改成“只要未回到底部就持续锁定”，并增加 document capture 兜底，鼠标坐标落在真实 xterm 区域内时一律滚动对应终端 scrollback。
- commit `fc57a80` 引入的"保留显式用户焦点"修复过度：`rememberExternalPointerIntent` 只对"受保护目标"（input、iframe、dialog 等）记录外部点击意图，导致点击普通 div、按钮等非保护元素时终端立刻抢回焦点。`hasIntentionalExternalFocus` 里对非保护、非 body 元素直接返回 `false`，进一步放大了这个问题。修复为：1）`rememberExternalPointerIntent` 对 `.terminal-view` 以外的任意 `pointerdown` 都记录意图；2）`hasIntentionalExternalFocus` 简化为纯时间戳比较，不再区分 active element 类型。
- VS Code Web 与终端来回切换两轮后，点击 VS Code iframe 内部无法重新输入。上一轮修复只覆盖父文档能收到 `pointerdown` 的外部点击；真实 iframe 内点击不会稳定冒到父页面，导致 `lastTerminalIntentAt` 仍然更新于外部意图之后，`handleWindowFocus` / 被动焦点修复又把 xterm-helper textarea 抢回。修复为在父窗口 `blur`、被动终端聚焦前，基于当前 `document.activeElement` 补记 hovered iframe 的外部焦点意图，并补 VS Code -> 终端 -> VS Code round-trip e2e 回归用例。
- tmux attach 类型终端有时只能滚动当前窗口可见内容，像是没有上文。根因是浏览器 xterm 只收到 `tmux attach` 后绘制的当前屏幕，旧的 tmux pane 历史没有进入 PTY replay；tmux client 初始绘制还会发送 `CSI ?1049h` 进入 xterm alternate screen，使普通 scrollback 不可见；同时默认 tmux capture/registry 上限低于前端 xterm 上限。修复为tmux attach 前先 `capture-pane` 预灌 pane 历史到 PTY replay（本地直接 capture，SSH 远端通过非交互 ssh capture），并把 tmux capture 默认提升到 20000 行、registry fallback 默认提升到 5000 条，同时在接管已有 tmux session 前设置更大的 `history-limit`。
- tmux 扫描弹层覆盖单屏终端时，在扫描结果卡片上滚轮会误滚动后方终端上下文。根因是 `TerminalView` 的 document-level wheel 兜底只按鼠标坐标命中终端区域，没排除上层 discovery 弹层；弹层覆盖在终端上时 wheel 被后方终端接管并 `preventDefault`。修复为 document-level 终端滚轮兜底遇到 `.discovery-overlay` 事件目标时直接放行，让 discovery list 自己滚动。
- `scripts/restart-dev.sh` 启动后短时间内前后端端口又断开。根因是脚本用普通 `nohup` 启动 dev server，调用 shell 结束后进程仍可能跟随 session 掉线；同时脚本没有把后端代理 host/port 显式传给 Vite。修复为用 `setsid` 脱离调用 shell、保留 HTTPS 前端默认启动，并显式把后端代理 host/port 传给 Vite。
- focus view 点击按钮后，Copilot-like TUI 会收到 `focus-out` 并丢掉紧随其后的输入。根因是按钮等非文本控件被纯时间戳逻辑误判为有意外部焦点，且 keydown 补救路径可能先发送 stdin、后发送 `focus-in`；修复为 `hasIntentionalExternalFocus` 只保护真实输入面/iframe/dialog 和短暂 body handoff，并在 `TerminalView` 发送 stdin 前同步补齐已聚焦 helper 的 focus report。
- HTTPS 前端里扫描并加入本机 tmux 后，focus view 终端可能全部黑屏。根因是前端 WebSocket URL 构造在同源默认路径下固定使用 `ws://`，而 `restart-dev.sh` 默认启动 HTTPS 页面，浏览器会阻止 insecure WebSocket mixed content。修复为 HTTPS 页面默认生成 `wss://.../ws/...`，HTTP 页面仍生成 `ws://...`，并补 URL 回归测试。
- 多屏中把已打开 Codex 的会话切入终端窗格后，输入框会多出 `[I` / `[O`，方向键会输入 `OA` / `OB` / `OC` / `OD`。根因是 active PTY replay 把历史 `focus tracking`、application cursor、mouse、bracketed paste、keypad 等终端模式开关重新发送给新挂载的 xterm，导致浏览器端模式状态被污染；同时本地 tmux stdin 优先走 `tmux send-keys` 后，focus report 和 application-cursor 箭头序列没有分别进入正确路径，前者会被注入 pane，后者会被拆成 Esc + 字面量。修复为 replay 只保留显示内容并清理模式开关，focus/mouse 控制报告改走 attached PTY，application-cursor 箭头在 tmux send-keys 路径映射成真实方向键。
- `./scripts/restart-dev.sh` 重启后仍跑到 HTTPS/3100，而不是预期的 HTTP/8484。根因是脚本和 `.env.example` 仍保留旧的 `WEB_HTTPS=1`、`WEB_PORT=3100` 默认值，前端 dev proxy 也残留后端 `3200` 默认值；同时 restart 脚本测试没有纳入根 `pnpm test`。修复为默认 HTTP、前端 8484、后端 4000，并把脚本测试加入根测试链路。
- 多屏 sidebar 双击其他会话替换当前输入 pane 时，当前 Codex 终端仍会出现 `[I`，且双击替换有时失效。根因有两层：1）本地 tmux terminal WebSocket 仍把手动 focus report `ESC [ I/O` 作为控制输入写回 attached tmux client，部分 Codex/tmux 组合会把它落成 prompt 字面量；2）sidebar card 同时绑定 click 和 dblclick，真实双击会先触发单击替换，DOM 换位后第二次点击可能落到刚换出的旧会话上，把 pane 又替换回去。修复为本地 tmux 会话直接丢弃 focus report、只保留 mouse report 走 attached PTY；sidebar 单击改为短延迟执行，双击取消单击并只替换一次。
- 当前终端右键粘贴后，Codex 输入框会出现 `[200~` / `[201~`：根因是 xterm 在 bracketed paste 模式下发送 `ESC[200~` / `ESC[201~` 起止符，本地 tmux WebSocket 路径又优先走 `tmux send-keys`，旧解析器把 `ESC` 当成 Escape 键、把 `[200~` / `[201~` 当成普通文本写进 pane。修复为在 `LocalTmuxAdapter.buildTmuxSendKeySteps` 中仅对本地 tmux send-keys 路径剥离 bracketed paste 起止符，保留粘贴正文和既有控制键映射，并补单元与真实 WebSocket+tmux 回归。
- 当前看板终端里按 `Shift+Left` 会在 Codex 输入框里出现 `[1;2D` / `D` 并可能伴随换行，同类 `Ctrl/Alt/Shift` 方向键和 Home/End/Delete/PageUp/PageDown 也存在字面量泄漏风险。根因是本地 tmux WebSocket 输入优先走 `tmux send-keys` 后，`LocalTmuxAdapter.buildTmuxSendKeySteps` 只识别普通箭头和 application-cursor 箭头，不识别 xterm 的修饰键 CSI 序列（如 `ESC[1;2D`）及常见导航键序列，于是把 `ESC` 当 Escape 键、把余下内容当普通文本注入 pane。修复为在 tmux send-keys 转换层解析 xterm 修饰键方向键、Home/End、Insert/Delete、PageUp/PageDown 和 F1-F12 tilde 序列，映射成 tmux key name；前后端过滤层补测试确保这些键序列不会被误删。
- 当前看板终端里对 Codex 会话右键粘贴多行内容时，每一行都会被当成一次回车提交：根因是上一版为避免 `[200~` / `[201~` 泄漏而剥离 bracketed paste 起止符，导致区块内真实换行继续被 `buildTmuxSendKeySteps` 映射成 tmux `Enter`。修复为完整保留 `ESC[200~ ... ESC[201~` bracketed paste 区块并整体通过 `tmux send-keys -l` 注入，区块外的 `\r` / `\n` 仍按普通 Enter 处理，确保 Codex/TUI 能按一次粘贴接收多行文本。
- Codex 会话中右键粘贴多行内容仍可能被逐行提交：根因是 xterm/WebSocket 可能把一次 bracketed paste 分成多帧发送，上一版只在单帧内识别完整 `ESC[200~ ... ESC[201~`，第一帧之后的裸文本帧失去了 paste 上下文，里面的 `\r` 又被映射成 tmux `Enter`。修复为 `LocalTmuxAdapter` 按 agent session 记录 bracketed paste open 状态，直到收到结束符前所有输入帧都走 literal；新增 WebSocket+真实 tmux 回归，断言 split paste 三帧最终按原始字节进入 pane。
- 扫描 tmux 会话时，工作目录包含 `:` 的 pane 会被漏扫或归到错误路径。根因是 `agent-scanner` 用冒号拼接 `session/pane/path/command`，而 POSIX 路径允许冒号。修复为改用 tab 分隔 tmux 输出字段，本地 `TMUX_BINARY` 进入 shell 命令前也做引用，并补真实 tmux 含冒号路径回归。
- 扫描已有 tmux 会话时，名为 `codex-*` 的 session 如果当前 pane 命令是 `sh`、`sleep` 等普通命令，会被错误标成 `sh` / `sleep` 这类非 agent kind。根因是扫描逻辑只用 session/command 判断“像 agent”，但落结果时直接保存原始 `pane_current_command`。修复为集中返回已知 agent kind 或 `shell`，并补真实 tmux session 归类回归。
- 终端 resize 接口直接信任 `cols` / `rows`，缺失、字符串、0 或超出安全整数范围的值可能传入 `node-pty.resize()`，造成运行时异常或无效终端尺寸。修复为路由层要求两个字段都是正安全整数，非法请求返回 400，并补 resize 输入校验回归。
- 加入已发现 tmux 会话接口直接解构请求体，缺失 body 会触发 500，非法 `interactionState` / `sshTarget.port` 还可能写入畸形会话记录。修复为 `/api/agent-discovery/tmux/add` 先校验必填字符串、可选字符串、合法交互状态和 SSH 端口范围，非法请求统一返回 400，并补 malformed payload 回归。
- 聚焦会话接口 `/api/agent-sessions/focus` 会把缺失或非字符串 `agentSessionId` 直接传给 registry，导致客户端输入错误走内部异常路径。修复为路由层先校验 `agentSessionId` 必须是字符串，非法请求返回 400，并补 focus payload 回归。
- 注册会话接口 `/api/agent-sessions/register` 直接把请求体写入 registry，缺失必填字段、非法 `sourceType` / `connectionState` 或错误类型的 `transportRef.processId` 都可能创建畸形 session。修复为注册路由校验必填字符串、已知枚举、可选 SSH 目标和 transport 引用字段，非法请求返回 400，并补“不创建畸形会话”回归。
- agent 启动接口 `/api/agent-launch/local`、`/api/agent-launch/remote`、`/api/agent-launch/pty`、`/api/agent-launch/ssh-pty` 直接把请求体透传给 runtime manager，缺失命令、错误类型字段或非法 SSH 端口会触发内部异常，甚至进入畸形启动流程。修复为在路由入口校验必填字符串、命令字段、SSH 目标和端口范围，非法请求返回 400 且不注册会话。
- agent 发现接口 `/api/agent-discovery/tmux/scan` 和 `/api/agent-discovery/scan` 会解构或扫描原始请求体，缺失 `path`、错误类型字段或非法 SSH 端口会触发内部异常或把坏参数交给 shell/SSH 扫描。修复为在路由入口校验发现请求体、扫描路径和 SSH 目标，非法请求返回 400。
- VS Code Web 启动时如果持久化的 `user-data/User/settings.json` 损坏，合并终端 profile 设置会直接抛出 JSON 解析异常，导致会话打不开。修复为把损坏设置按空对象恢复并重写受管终端 profile，补 malformed settings 回归。
- shell 启动环境探测如果输出标记之间是损坏 JSON，会把底层 `SyntaxError` 直接向上传播，诊断不稳定且暴露 parser 细节。修复为将 malformed startup env JSON 转换为受控的运行时探测错误，并补 malformed marked output 回归。
- terminal WebSocket 的 `{ "type": "binary" }` 控制帧直接使用 Node 宽松 base64 解码，带合法前缀和非法后缀的 `data` 仍会被部分解码并写入 PTY，客户端损坏帧可能变成真实终端输入。修复为只接受规范 base64 字符串，非法 binary frame 直接忽略，并补“不转发部分 base64”回归。
- terminal WebSocket 的 `{ "type": "resize" }` 控制帧只做 `JSON.parse` 类型断言，字符串、0 或超过安全整数范围的 `cols/rows` 会进入 PTY resize 路径，和 REST resize 接口的输入边界不一致。修复为 WebSocket resize 复用 REST 正整数校验，非法 resize 帧直接忽略，并补解析器回归。
- 前端终端接收服务端控制帧时，只要 JSON 标记了 `__agentOrchestrator: "terminal-control"` 但事件未知或 replay 数据类型错误，就会静默吞帧且不解除输入禁用状态，用户可能要等 8 秒 safety timeout 才能输入。修复为抽出控制帧解析器，未知/畸形控制帧按普通终端输出处理并立即走输入解锁路径。
- 前端布局状态恢复时用 `Boolean(parsed.sidebarCollapsed)` / `Boolean(parsed.topbarCollapsed)` 解析本地存储，字符串 `"false"` 或数字 `1` 这类陈旧/损坏值会被误当作折叠状态，导致页面启动后错误进入紧凑或沉浸布局。修复为只接受真实 boolean，其他值回退默认展开，并补本地存储回归。
- 文件浏览器按作用域恢复本地状态时用 `Boolean(parsed.showHidden)` 解析“显示隐藏文件”，陈旧存储里的字符串 `"false"` 会被误当作 `true`，导致隐藏文件意外显示。修复为抽出持久化状态解析器，只接受真实 boolean，并补合法偏好、陈旧值和损坏 JSON 回归。
- 文件浏览器侧栏 UI 状态恢复时同样用 `Boolean(parsed.mainCollapsed)` / `Boolean(parsed.sideCollapsed)` 解析折叠标记，并直接接受任意有限 `width`；陈旧字符串 `"false"` 会误折叠侧栏，`0` 或负数宽度会生成不可用布局。修复为抽出面板 UI 状态解析器，只接受真实 boolean 和不小于最小宽度的数值，并让启动恢复与拖拽 resize 共用同一最小宽度常量。
- 文件浏览器预览区高度从本地存储恢复时接受任意有限数字，`0`、负数或过小高度会把预览区压到不可用状态，而拖拽路径本身已有最小值。修复为抽出预览高度解析器，恢复时同样要求不小于最小预览高度，并补有效值、过小值、非数字和空值回归。
- 文件浏览器侧栏按会话恢复选中主机时，只检查 `selectedHost.type === "ssh"` 和 `preset` 存在，损坏缓存里的非字符串 host、字符串 port 或空 defaultPath 会被当作真实 SSH 主机继续传给文件浏览器。修复为抽出 side-panel session state 解析器，只有完整合法的 SSH preset 才恢复，否则回退本机，并补 malformed cache 回归。
- 文件浏览器/VS Code 侧栏打开状态已从会话级 `activeTool` 迁移到 App 级全局状态，但启动时仍会从旧的 `side-panel-session-state` localStorage 里读取 `activeTool`，导致 stale cache 让焦点页自动打开文件或 VS Code 侧栏。修复为集中解析初始侧栏工具并忽略 legacy `activeTool`，启动默认不从会话缓存恢复打开状态。
- 文件浏览器按作用域恢复当前路径时只用 `trim()` 判断非空，却把原始字符串写回状态；localStorage 中 `"  /workspace/project  "` 会让文件列表请求带空格的不存在路径。修复为恢复前先 trim 当前路径，全空白仍回退默认路径，并补 stale path 回归。
- agent 扫描进程列表时用 `parseInt` 解析 `pgrep` PID 字段，`123abc` 这类损坏行会被当成 PID 123 并误报运行中的 agent。修复为进程扫描和 Copilot lock 探测只接受完整的正安全整数 PID，并补 malformed PID 回归。
- SSH config 解析 `Port` 时用 `Number.parseInt`，`2222abc` 这类部分数字值会被截断成 2222 并进入 SSH 预设。修复为端口字段必须是完整数字字符串且在 1-65535 内，否则回退默认 22，并补 partial port 回归。
- tmux pane 元数据解析 attached count 时用 `Number.parseInt`，`1abc` 这类损坏值会被截断成 1，导致发现弹层把实际无法确认 attached 的会话误标为运行中。修复为 attached count 只接受完整非负安全整数，非法值按 0 处理，并补 malformed count 回归。
- VS Code Web 远程隧道解析 `ssh -G` 输出端口时也用 `Number.parseInt`，`port 10022abc` 会被截断成 10022 并覆盖调用方原始端口。修复为隧道目标端口只接受完整的 1-65535 数字字符串，非法端口行被忽略并保留原端口，并补 partial port 回归。
- `VSCODE_WEB_REMOTE_PORT` 远程 VS Code Web 首选端口解析使用 `Number.parseInt`，`14444abc` 会被截断成 14444 并进入远程启动命令和 SSH tunnel。修复为环境变量只接受完整的 1-65535 数字字符串，非法值回退默认 13338，并补 partial env port 回归。
- 远程 agent 历史扫描解析 `stat` 时间戳时使用 `parseInt`，`1710000000abc` 这类损坏输出会被截断成合法时间并显示错误 last activity。修复为远程历史 mtime 只接受完整的非负安全整数秒，非法值不写入 `lastActivity`，并补 fake SSH 回归。
- VS Code Web 本地 `port.json` 持久化端口只检查正整数，`70000` 这类越界端口会被当作 preferred port 传给分配器，可能导致启动失败或无法绑定。修复为持久化端口同样必须在 1-65535 内，非法缓存忽略并用新分配端口覆盖。
- VS Code Web 复用当前用户进程时，从 `--bind-addr` / `--port` 解析出的端口只检查正数，`70000` 这类越界端口会被误当成可复用服务，导致代理目标指向无效 TCP 端口。修复为进程列表端口也复用完整 1-65535 校验，非法进程被忽略并启动新的有效实例。
- 多屏终端监控窗格的 drop 解析会把普通 `text/plain` 拖拽内容当成 session id，外部文本拖到终端网格上可能触发布局/focus 变更路径。修复为只接受自定义 terminal monitor MIME 类型的 JSON payload，普通文本和畸形 payload 都忽略，并补解析器回归。
- VS Code Web 抽屉会立即用 localStorage 中缓存的 `url` 渲染 iframe，但缓存解析器只校验字段是字符串，损坏或被篡改的 `javascript:` / 非 Web scheme 会在后端确认前进入 iframe `src`。修复为缓存恢复只接受 HTTP(S) 绝对 URL 或根相对路径，其他 scheme 直接丢弃，并补 stale cache 回归。
- 手机端终端触摸滚动依赖测得的行高，若浏览器返回的 computed `line-height` 不可解析为数字，滚动计算会产生 `NaN`，导致滑动历史上下文失效。修复为移动端滚动 helper 在行高非有限或过小时回退到稳定默认行高，并补不可用行高回归。
- 桌面端终端滚轮接管同样假设 line height / page height 一定是有限数字；当测量值不可用时，滚轮计算会产生 `NaN`，导致滚动上下文失效或残留状态异常。修复为 terminal wheel helper 对行高和页高分别使用有限数字兜底，并补 page-mode 测量缺失回归。
- agent 宫格虚拟化窗口直接用 DOM 测量值参与列数、行数和 slice 边界计算，若宽高、scrollTop、rowHeight、gap 或 overscan 短暂变成 `NaN`，会生成 `NaN` 索引并让虚拟列表渲染空白。修复为虚拟化 helper 对所有数值输入做有限数兜底，保持稳定首屏 slice，并补坏测量回归。
- 轻量终端预览的 `maxLines` / `maxLineLength` 选项用 `Math.max(1, value)` 兜底，遇到 `NaN` 时仍会得到 `NaN`，从而取消行数和单行长度上限，可能让终端卡片渲染过多输出。修复为只接受有限正数并向下取整，非法值回退默认限制，并补无效限制回归。
- 远程 SFTP 文件预览在 `maxBytes: 0` 时仍创建 `start: 0, end: 0` 的读取流，实际会读回第一个字节，和本地预览的零字节语义不一致。修复为远程预览在零字节上限时只读取 stat 并直接返回空内容，避免发起一字节 range 读取，并补 SFTP 回归。
- 本地和 SFTP 文件预览服务直接调用时仍信任 `maxBytes` 是有限数字；`NaN` 会让本地 `Buffer.alloc(NaN)` 抛异常，远程 SFTP 则会构造非有限 range 并读回首字节。修复为抽出预览字节上限归一化，非有限、负数或 0 都按空预览处理，正数向下取整，并补本地/SFTP 服务回归。
- 文件下载响应头直接把 basename 放进 `filename="..."`；文件名包含引号时会生成畸形 `Content-Disposition`。修复为统一清洗下载文件名中的引号、反斜杠、分号和控制字符，覆盖本地/远程文件与目录 zip 下载，并补 quoted filename 回归。
- 前端下载文件名解析只识别 `filename="..."`，遇到标准 `filename*=UTF-8''...` 响应头会忽略服务端提供的 UTF-8 文件名并回退到路径 basename。修复为抽出下载文件名解析器，优先解析 RFC 5987 UTF-8 编码名，再回退 quoted/unquoted filename 和路径名，并补 encoded filename 回归。
- 前端下载文件名解析会直接采用响应头中的路径分隔符；`filename*=UTF-8''..%2Fnested%5Creport.txt` 这类值可能让浏览器收到带目录语义的建议文件名。修复为所有响应头和路径回退文件名在写入 `anchor.download` 前统一替换 `/`、`\` 和控制字符，并补 header separator 回归。
- 多屏终端监控窗格的自定义 drag payload 只检查 `sessionId` 类型，空字符串或全空白字符串也会被当成真实会话 id 进入 pane placement。修复为读取 custom MIME 后 trim 并要求非空 session id，空白 `sourceSlotId` 也丢弃，并补 malformed custom payload 回归。
- terminal WebSocket 控制帧入口用 `text.startsWith('{"type":"resize"')` / `{"type":"binary"` 判断，等价 JSON 只要字段顺序不同就会被当成普通终端输入。修复为统一解析客户端控制帧，按 `type` 分派 resize/binary，非法控制帧忽略，并补 reordered resize frame 回归。
- terminal WebSocket 客户端控制帧解析在遇到未知 `type` 的 JSON 对象时返回普通输入路径，未来扩展帧或畸形 typed 控制帧会把整段 JSON 写进 shell。修复为只要 JSON 对象带字符串 `type` 且不是已支持的 resize/binary，就按控制帧忽略；无 `type` 的 JSON 仍保留为普通终端输入。
- VS Code Web 代理直接信任 `x-forwarded-host`，`bad host` 这类畸形值会被原样转发给上游，且代理层还有解析失败后复制原始 `Host` 的旁路。修复为集中校验请求 Host：拒绝空白、路径分隔符、控制字符和无法作为 URL authority 解析的值；代理头部只使用解析层返回的安全 Host，并补 malformed forwarded host 回退 Origin 的回归。
- 文件上传接口在处理 multipart `relativePaths` 时先按相对路径创建父目录，再由写入流做本地路径校验；`../escape/file.txt` 这类值会在写入失败前先创建目标目录外的父目录，甚至可成功落到意外位置。修复为解析 `relativePaths` 时立即 trim 并复用文件系统安全路径校验，同时拒绝 POSIX/Windows 绝对路径，非法上传在任何父目录创建前返回 400，并补“不创建逃逸目录”回归。
- 焦点视图启动状态恢复时只用 `trim()` 判断 cached `focusedId` 非空，却把原始字符串写回状态；localStorage 中 `"  session-id  "` 会让应用进入 focus 模式但找不到真实会话，表现为焦点页/侧栏状态异常。修复为抽出 `parseFocusViewState`，恢复前 trim `focusedId`，损坏 JSON 或空白 id 回退默认 grid 状态，并补 stale focused id 回归。
- 目录建议接口只校验 `prefix`，但把 `sshTarget` 原样传给远程建议路径；字符串 `sshTarget`、空 host 或字符串端口会被 SSH helper 吞成“远程建议不可用”的 200 响应，掩盖客户端请求错误。修复为在 directory-suggestions 服务入口校验 SSH 目标对象、必填 host、可选字符串字段和 1-65535 端口，非法请求返回 400，并补 malformed sshTarget 回归。
- agent session 更新接口在校验 `displayName` 后会立刻重命名 tmux session，随后才校验 `hidden`；带合法 `displayName` 和非法 `hidden` 的 PATCH 会返回 400，但 tmux 会话名已经被改掉。修复为先完整校验并归一化 payload，再执行 tmux rename 和 registry update，并补“非法字段不触发 rename 副作用”回归。
- tmux attach 历史回放回归测试在全量并行测试负载下只给 fixture 5 秒输出 80 行，tmux server 繁忙时会在待测逻辑执行前超时，造成误报。修复为只放宽该 fixture readiness wait，保持后续历史回放断言不变。
- agent session 更新接口没有要求 PATCH body 必须是对象，字符串或数组这类畸形 JSON 会被当成空更新并返回 200。修复为入口先校验 request body 是普通对象，非法 body 返回 400，并补 non-object body 回归。
- 文件上传接口无 `relativePaths` 时会直接使用 multipart filename 拼接目标路径，空文件名这类畸形 metadata 会落到目录写入路径并暴露成底层文件错误。修复为 fallback filename 也复用相对上传路径校验，空白、traversal 或绝对路径在打开写流前返回 400。
- 目录建议接口已校验 `sshTarget` 字段类型，但仍允许字符串字段中包含换行、回车或 NUL；这类 payload 会被 SSH helper 拒绝后吞成“远程建议不可用”的 200 响应，掩盖客户端错误。修复为在 request-side SSH 目标解析阶段拒绝 host/username/identityFile 控制字符，非法请求直接返回 400，并补 malformed SSH string field 回归。
- 远程 SFTP 递归删除目录时没有跳过服务端可能返回的 `.` / `..` 目录项，会尝试删除当前目录或父目录路径，轻则报错，重则在异常 SFTP server 行为下越界递归。修复为 `removePathRecursive` 和递归列表一样跳过 dot entries，并补包含 `.` / `..` 的删除回归。
- 文件系统 JSON 与上传接口的 `sshTarget` 解析已校验对象、必填 host 和端口范围，但仍允许 host/username/identityFile 包含换行、回车或 NUL；坏 metadata 会进入 SFTP 路径并暴露成 500 或在 multipart 上传中被误判成功。修复为 filesystem 路由 SSH target 解析阶段拒绝控制字符，JSON 与 multipart metadata 均返回 400，并补 malformed SSH string field 回归。
- agent session 启动、发现和 tmux add 路由各自复用的 `sshTarget` 解析同样只校验类型和端口，未拒绝 host/username/identityFile 控制字符；坏 host 可在 remote launch 中冒出 500，tmux scan 可被吞成 200，tmux add 可注册出异常 SSH metadata。修复为 agent-sessions SSH target 解析阶段拒绝 NUL/CR/LF，相关启动、发现和注册入口统一返回 400，并补红绿灯回归。
- agent session 注册接口校验 `transportRef.sshPort` 时只要求 safe integer，`70000` 这类无效 TCP 端口会被写入 session metadata。修复为 nested transportRef 端口同样要求 1-65535，非法注册返回 400 且不创建畸形会话，并补 register 路由回归。
- 文件浏览器侧栏会话缓存恢复 SSH 主机时已校验字段类型和端口范围，但未拒绝 host/username/identityFile 等 preset 字符串中的换行、回车或 NUL；损坏 localStorage 可恢复出会被后端 400 拒绝的 SSH 选中主机。修复为 side-panel session state 解析阶段丢弃含控制字符的 cached SSH preset，回退本机，并补 stale cache 回归。
- 文件浏览器真实浏览器上传和“新建文件”流程中，XHR 已设置 `responseType = "json"` 却仍在成功回调读取 `responseText`；Chromium 会抛出异常，导致上传/创建实际写入成功但前端 Promise reject，列表不刷新，用户看不到新文件。修复为优先使用已解析的 `xhr.response`，只有没有 JSON 响应时才读取文本回退，并补 XHR 回归与 Playwright 本地/SSH 上传场景。
- 多屏终端在侧栏关闭时允许用户切换当前输入 pane，但焦点页标题直接显示 active terminal session；点击第二屏会让标题从原 focused session 跳到另一会话，用户还未打开文件/VS Code 侧栏就看到焦点上下文变化。修复为标题会话解析显式受 `syncActiveTerminalWithFocus` 控制：侧栏关闭时标题保持 focused session，侧栏打开时才跟随 active terminal，并补单元与 Playwright 回归。
- Copilot/Codex 类 TUI 启动时会发 DA/DSR 终端能力查询；旧路径依赖浏览器 xterm 订阅和前端时序，Playwright 串跑中 mock 会停在 `copilot-mock-handshake-timeout` 或 ready 后首轮输入无响应。修复为 PTY runtime 在服务端输出层直接识别 `ESC[c` / `ESC[6n` 并写回 `ESC[?1;2c` / `ESC[1;1R`，保证 TUI 能完成握手，并补服务端能力查询回归。
- 焦点页终端在 WebSocket replay 尚未完成、LazyTerminalView 尚未挂载或按钮/body 暂时持有焦点时，快速键入会被 xterm/input gate 丢弃，Copilot mock 表现为没有收到 `hello`/`before`，或 focus-out 后首字母被丢成 `fter`。修复为 TerminalView 对 replay 前输入做 pending 缓冲并在冲刷前同步 focus-in，AgentFocusView 通过 session bridge 队列把非编辑 UI 上的按键交还活动终端，并补 bridge/键盘映射回归与 Copilot Playwright 场景。
- 服务端已自动回答 PTY 能力查询后，浏览器端仍把 `ESC[6n` 写入 xterm 会触发 xterm 再生成一次 CPR，双击进入焦点视图时会话收到两次 cursor position reply 并退出。修复为前端渲染终端输出前剥离已由 PTY runtime 处理的 DA/DSR 查询序列，只显示可见输出，不再让浏览器生成重复协议回复。
