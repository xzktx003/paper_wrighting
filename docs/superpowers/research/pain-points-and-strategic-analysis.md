# Paper Writer 系统痛点与战略扩展分析

> 生成日期: 2025-07-18
> 基于: 内部代码审计 + 外部竞品调研

---

## 一、内部代码缺陷：按影响面排序

### 🔴 紧急 (影响数据正确性与系统稳定性)

| # | 问题 | 文件 | 根因 | 影响 |
|---|------|------|------|------|
| 1 | **对话存储无并发保护** | `conversationStore.js` | 读-改-写非原子操作 | 快速发送多条消息时静默覆盖丢失 |
| 2 | **LaTeX 编译无超时** | `compileService.js` | `\input` 循环引用或交互等待时进程永不退出 | 资源泄漏，编译进程堆积 |
| 3 | **SSE 流式连接泄漏** | `routes/ai.js` | 客户端断开时未 abort LLM 请求 | 浪费 API 配额，dangling response |
| 4 | **project.json 并发写** | `routes/projects.js` | 排序/元数据写操作无锁 | 快速拖拽排序丢失 |

### 🟡 中等 (影响用户体验与可维护性)

| # | 问题 | 涉及范围 | 影响 |
|---|------|---------|------|
| 5 | **多处 `catch(() => {})` 静默失败** | 前端 5+ 组件 | 网络错误时"点了没反应" |
| 6 | **AI 错误分类不够细** | `routes/ai.js` | 401/429/404 都返回通用错误，排查困难 |
| 7 | **防抖 timer 未清理** | `LatexPreview.tsx` | React 卸载后 setState 警告 |
| 8 | **`fs.watch` 清理不彻底** | `fileManager.js` | 长运行后 inotify 耗尽 |

### 🟢 改进 (产品完整性与测试)

| # | 问题 | 影响 |
|---|------|------|
| 9 | 编译服务/LLM服务/SSE端点均无单元测试 | 回归风险高 |
| 10 | 无并发/竞态测试 | 并发 bug 频出靠人工发现 |
| 11 | Rendered 模式写回错位风险未记录 | 用户可能在不知情下损坏源文档 |
| 12 | Agent 模式 `propose_edit` 交互流可能中断 | AI 编辑提案缺少 Accept/Reject UI |

---

## 二、外部竞品定位图谱

```
                   排版能力 →
        弱                     强
    ┌──────────────────────────────┐
  AI │  SciSpace      │  ❌ 空白区   │
  能 │  Paperpal      │  (Paper Writer│
  力 │  Notion AI     │   目标位置)   │
    │                │              │
  ↓ │  Grammarly     │  Overleaf    │
  弱 │  ChatGPT       │  Typst       │
    └──────────────────────────────┘
```

### 关键发现：三个战略空白

1. **AI + 排版深度融合** — 没有任何工具把深度 AI 辅助（不只是一键润色）与专业学术排版真正整合
2. **结构化 AI 审稿管线** — Paper Writer 已独有的 Pipeline + 结构化审稿 + Inline Diff 组合
3. **可执行论文环境** — 代码 + 数据 + 写作一体，让论文真正可复现

---

## 三、优先修复清单 (按 ROI 排序)

### Sprint 1: 止血 (修复数据一致性 + 稳定性) ✅ 已完成 2026-05-25

```
P1 [紧急] conversationStore 并发保护 ─────→ ✅ 引入 per-file Promise 锁队列
P2 [紧急] compileService 超时机制 ───────→ ✅ 120s timeout + SIGKILL
P3 [紧急] SSE 连接泄漏 ─────────────────→ ✅ AbortController + signal 传播到 SDK
P4 [中等] catch(() => {}) 静默失败 ──────→ ✅ 统一 console.error 错误上报
P6 [中等] AI 错误分类 ─────────────────→ ✅ classifyAIError 结构化错误码
```

### Sprint 2: 强化 (测试 + 可观测性) ✅ 已完成 2026-05-25

```
P4 [紧急] project.json 并发写 ──────────→ ✅ per-project 锁 + updateProjectMeta
P7 [中等] 防抖 timer 未清理 ────────────→ ✅ rafRef + cancelAnimationFrame
P8 [中等] fs.watch 清理不彻底 ──────────→ ✅ error handler + unwatchAll + onClose hook
P9 [改进] 编译/LLM/SSE 单元测试 ────────→ ✅ vitest 12 tests (compileService)
P10 [改进] 并发竞态测试 ─────────────────→ ✅ vitest 3 tests (concurrency)
P11 [改进] Rendered 模式写回保护 ────────→ ✅ parsedContentRef 脏检查
P12 [改进] propose_edit Accept/Reject UI →  ✅ InlineDiffViewer + PendingEdit 状态
```

### Sprint 3: 扩展 (差异化功能) ✅ 已完成 2026-05-25

```
外部空白区机会:
  ✅ AI 辅助写作全流程 (Outline → Draft → Polish → Review)
     → Writing Flow preset: 6 stages with human checkpoints
  ✅ Pipeline 管线增强 (多阶段自动工作流 + 人机协同)
     → Pipeline 2.0: 5 typed executors, composable stages, pause/resume/retry
  ✅ 可执行论文环境 (代码/数据/图表/论文一体化)
     → Executable Paper preset: Compute → Figures → Compile
  ✅ 智能引用管理 (自动发现、格式化、去重)
     → Citation Pipeline preset: Verify → Deduplicate → Discover
```

---

## 四、战略建议

Paper Writer 不应试图成为"另一个 Overleaf"。
它的独特定位应该是：

> **"AI-Native 学术写作全生命周期平台"**

- **不是** 排版工具 + AI 插件（Overleaf + ChatGPT 拼凑）
- **而是** 从构思到投稿全流程由 AI 增强的一体化环境

### 三步走路线

```
短期 (1-2 Sprint)    中期 (1-2 月)         长期 (3 月+)
┌──────────────┐   ┌──────────────┐    ┌──────────────┐
│ 修复现有缺陷  │ → │ 强化 AI 管线  │ →  │ 可执行论文    │
│ 打好地基      │   │ Pipeline 2.0 │    │ 代码+数据一体 │
│ 并发/超时/泄漏 │   │ 结构化审稿增强 │    │ 自动复现验证  │
└──────────────┘   └──────────────┘    └──────────────┘
```

---

## 五、附录

- 完整竞品调研: `docs/superpowers/research/academic-writing-tools-comparison.md`
- 已知 Bug 记录: `docs/debug_list.md`
- UI 优化记录: `docs/ui_optimization.md`
