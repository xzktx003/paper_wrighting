# Debug List

## 2026-05-22 - Restart script resolved app paths under `scripts/`

- Symptom: `sh scripts/restart.sh` tried to enter `scripts/app/apps/frontend` and `scripts/app/apps/backend`, then reported success against an already-running service.
- Root cause: the script treated its own directory as the repository root.
- Fix: derive `REPO_ROOT` from `scripts/..`, validate expected directories before restart, detach the backend start with `setsid` when available, and add a shell regression test for root and `scripts/` invocation paths.

## 2026-05-22 - Project delete failed when `project.json` was missing

- Symptom: deleting project `c2b87dfc-af29-42ef-b088-0f28aa9d65c3` returned HTTP 500 with `ENOENT` while opening `papers/<id>/project.json`.
- Root cause: the soft-delete route read `project.json` unconditionally before marking the project as trashed. A follow-up issue also showed project IDs can differ from their directory names, for example `project.json.id=c2b87dfc...` under `papers/torq`, so deleting by ID was a no-op against a non-existent `papers/<id>` directory.
- Fix: make project deletion tolerant of missing or invalid metadata, resolve project roots by scanning `project.json.id` when the direct directory does not exist, and treat already-removed project directories as successful no-ops.
- Regression: added a Fastify route test and a Playwright delete-flow script. On this machine, browser launch is blocked by missing GTK/ATK system libraries, so the Playwright script falls back to Playwright APIRequest validation.

- 2026-05-22: 修复 AI Assistant 在目录名与 project.json id 不一致的 OpenPrism 项目中误访问 `papers/<uuid>/chapters` 的问题；AI 路由改用 `getProjectRoot()` 解析真实项目目录，并增强工具错误处理、`.bib` 自动查找、`list_code` 工具。

- 2026-05-22: 修复 Terminal WS 在缺少系统 `script` 命令时触发 `spawn script ENOENT` 并导致后端进程崩溃；无 `script` 时降级直接启动 shell，并处理 child process error。Terminal cwd 也改用 `getProjectRoot()` 支持目录名与 id 不一致。
- 2026-05-22: 移除 AI 新建对话中的独立 Code scope 半成品入口；Chat/Agent/Tools 改为明确分工，Agent 不再暴露代码写入/执行工具，代码任务统一收敛到 Tools 模式并限制在 `code/` 目录内。

- 2026-05-22: 实现 LLM provider 抽象层，支持 Anthropic 和 OpenAI-compatible 两种后端。默认使用 OpenAI-compatible (gpt-5.5)。配置项：llm_provider、llm_api_key、llm_base_url、llm_model。注意 OpenAI SDK 的 baseURL 需要包含 /v1 后缀。
- 2026-05-22: 修复项目创建和旧项目文件树打开时未确保 `docs/` 支撑目录存在的问题；创建项目和读取文件树都会补齐 `docs/`，避免文件树/项目路由回归测试缺失目录。
- 2026-05-22: 移除项目文件树对 `fig/` 的强制自动创建绑定；新建项目和打开旧项目只补齐 `docs/`，`fig/` 仅在导入、模板或用户手动创建时出现。
