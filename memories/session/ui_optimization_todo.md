# UI 优化 TODO

## Phase 0: 渲染准确性（优先级最高）

### P0-1: 前端 LaTeX 预览准确性提升
**目标**: 让 `LatexPreview.tsx` 的正则渲染更接近真实编译结果
**预计工作量**: 2-3 天
**改动文件**: `app/apps/frontend/src/app/components/LatexPreview.tsx`

#### 已识别的差距（按优先级排序）:

| 优先级 | 语法/特性 | 当前行为 | 期望行为 |
|--------|-----------|----------|----------|
| 🔴 高 | `\input{}` / `\include{}` | 被静默移除 | 递归展开子文件并渲染内容 |
| 🔴 高 | `\newcommand{\cmd}[n]{body}` 带参数宏 | 仅支持无参宏 | 支持带参数宏展开 |
| 🔴 高 | `\ref{}` / `\label{}` 交叉引用 | 显示 `[ref]` | 解析为正确编号 `[1]` `[Fig. 2]` |
| 🔴 高 | `\cite{}` 引用解析 | 显示 `[key]` | 解析 bib 文件显示实际引用 |
| 🟡 中 | `minipage` 环境 | 不支持 | 支持内联布局 |
| 🟡 中 | `subfig` / `subcaption` 子图 | 不支持 | 支持子图渲染 |
| 🟡 中 | `wrapfig` 环绕排版 | 不支持 | 基础支持 |
| 🟡 中 | `multicols` 多栏 | 不支持 | 基础支持 |
| 🟢 低 | `float` / `[H]` 位置 | 不支持 | 支持浮动体定位 |
| 🟢 低 | `appendix` 附录 | 不处理 | 支持附录环境 |
| 🟢 低 | `hyperref` 超链接 | 仅文本 | 支持书签跳转 |
| 🟢 低 | `todonotes` 批注 | 不渲染 | 显示批注内容 |

#### 实施步骤:
1. **Step 1**: 实现 `\input{}` / `\include{}` 递归展开
   - 在 `renderLatex()` 开头添加子文件展开逻辑
   - 通过 `projectId` 和文件路径递归读取子文件内容
   - 需要前端 API 支持读取项目文件

2. **Step 2**: 实现 `\newcommand` 带参数宏展开
   - 解析 `\newcommand{\name}[n]{body}` 语法
   - 在宏展开时替换参数占位符 `#1`, `#2` 等

3. **Step 3**: 实现 `\ref{}` / `\label{}` 交叉引用
   - 第一遍扫描收集所有 `\label{key}` 及其位置
   - 第二遍替换 `\ref{key}` 为正确编号

4. **Step 4**: 实现 `\cite{}` 引用（可选）
   - 解析 `.bib` 文件
   - 根据引用键显示作者-年份或编号

### P0-2: 后端编译 PDF 持久化（推荐）
**目标**: 编译后 PDF 保存到固定路径，前端可获取
**预计工作量**: 1 天
**改动文件**: 
- `app/apps/backend/src/services/compileService.js`
- `app/apps/backend/src/routes/compile.js`
- `app/apps/frontend/src/api/client.ts`

#### 实施步骤:
1. **Step 1**: 修改 `compileService.js` 的 `runCompile()`
   - 编译后将 PDF 保存到 `.compile/latest/main.pdf`（不删除）
   - 同时保存 `main.synctex.gz`
   - 返回值增加 `pdfUrl` 字段

2. **Step 2**: 修改 `compile.js` 路由
   - 返回 `pdfUrl` 给前端

3. **Step 3**: 修改前端 `client.ts`
   - `compileProject()` 返回类型增加 `pdfUrl`

### P0-3: 前端 PDF 渲染组件（推荐）
**目标**: 用 `pdfjs-dist` 渲染编译后的 PDF
**预计工作量**: 2-3 天
**改动文件**:
- 新建 `app/apps/frontend/src/app/components/PdfPreviewView.tsx`
- 修改 `app/apps/frontend/src/app/components/RenderedPreviewPane.tsx`
- 修改 `app/apps/frontend/src/app/components/CenterPanel.tsx`

#### 实施步骤:
1. **Step 1**: 创建 `PdfPreviewView.tsx` 组件
   - 使用 `pdfjs-dist` 渲染 PDF
   - 支持缩放、滚动、分页
   - 支持 SyncTeX 双向跳转

2. **Step 2**: 修改 `RenderedPreviewPane.tsx`
   - `.tex` 文件有编译 PDF 时用 `PdfPreviewView`
   - 无编译 PDF 时降级到 `LatexPreview`

3. **Step 3**: 修改 `CenterPanel.tsx`
   - 编译完成后自动刷新 PDF 预览
   - 显示编译状态（编译中/成功/失败）

---

## Phase 1: 欢迎页美化（优先级高）

### P1-1: 视觉效果优化
**目标**: 提升第一眼吸引力
**预计工作量**: 1-2 天
**改动文件**: `app/apps/frontend/src/app/components/LandingPage.tsx`, `app/apps/frontend/src/app/App.css`

#### 具体改动:
1. **Hero 区域**: 添加渐变动画背景、粒子效果
2. **Feature 卡片**: 添加悬停动画、图标动画
3. **Logo**: 添加呼吸动画效果
4. **按钮**: 添加点击涟漪效果
5. **滚动动画**: 添加滚动触发的入场动画

---

## Phase 2: 编辑器体验（优先级中）

### P2-1: 编辑器增强
**目标**: 提升编辑体验
**预计工作量**: 2-3 天

#### 具体改动:
1. **自动编译**: 编辑后 debounce 自动触发编译
2. **实时预览同步**: 编辑时实时更新预览
3. **错误高亮**: 编译错误在源码中标注
4. **快捷键**: 添加常用快捷键支持
5. **多光标**: 支持多光标编辑

---

## Phase 3: 交互体验（优先级中）

### P3-1: 交互优化
**目标**: 提升操作流畅度
**预计工作量**: 1-2 天

#### 具体改动:
1. **拖拽上传**: 支持拖拽文件到项目
2. **右键菜单**: 添加上下文菜单
3. **键盘导航**: 支持键盘快速切换文件
4. **搜索替换**: 增强搜索替换功能
5. **撤销重做**: 优化撤销重做体验

---

## 实施优先级

1. **立即实施**: P0-1 (渲染准确性) + P0-2 (PDF 持久化)
2. **短期实施**: P0-3 (PDF 渲染) + P1-1 (欢迎页美化)
3. **中期实施**: P2-1 (编辑器增强) + P3-1 (交互优化)

---

## 技术细节

### P0-1 Step 1: `\input{}` / `\include{}` 展开

```typescript
// 在 renderLatex() 开头添加
function expandInputCommands(text: string, options: RenderOptions): string {
  const inputPattern = /\\(?:input|include)\{([^}]+)\}/g;
  return text.replace(inputPattern, (_, path) => {
    // 通过 API 读取子文件内容
    // 递归调用 renderLatex()
    return expandedContent;
  });
}
```

### P0-1 Step 2: `\newcommand` 带参数宏

```typescript
function expandCommandsWithArgs(text: string): string {
  const macroPattern = /\\(?:re)?newcommand\{\\([A-Za-z]+)\}\[(\d+)\]\{([^{}]*(?:\{[^{}]*\}[^{}]*)*)\}/g;
  const macros: Array<{name: string, args: number, body: string}> = [];
  
  // 收集所有宏定义
  text = text.replace(macroPattern, (_, name, args, body) => {
    macros.push({name, args: parseInt(args), body});
    return '';
  });
  
  // 展开宏调用
  for (const macro of macros) {
    const callPattern = new RegExp(`\\\\${macro.name}\\b(?:\\{([^{}]*)\\}){${macro.args}}`, 'g');
    text = text.replace(callPattern, (...matches) => {
      let body = macro.body;
      for (let i = 0; i < macro.args; i++) {
        body = body.replace(new RegExp(`#${i+1}`, 'g'), matches[i+1] || '');
      }
      return body;
    });
  }
  
  return text;
}
```

### P0-1 Step 3: `\ref{}` / `\label{}` 交叉引用

```typescript
function resolveCrossReferences(text: string): string {
  const labels: Map<string, string> = new Map();
  
  // 第一遍: 收集所有 label
  text = text.replace(/\\label\{([^}]+)\}/g, (_, key) => {
    // 根据 label 位置确定编号类型
    labels.set(key, `[${labels.size + 1}]`);
    return '';
  });
  
  // 第二遍: 替换 ref
  text = text.replace(/\\ref\{([^}]+)\}/g, (_, key) => {
    return labels.get(key) || '[?]';
  });
  
  return text;
}
```

### P0-2: PDF 持久化

```javascript
// compileService.js 修改
export async function runCompile({ projectId, mainFile, engine = 'pdflatex' }) {
  // ... 现有编译逻辑 ...
  
  // 保存 PDF 到固定路径（不删除）
  const latestDir = path.join(projectRoot, '.compile', 'latest');
  await ensureDir(latestDir);
  const latestPdfPath = path.join(latestDir, `${base}.pdf`);
  const latestSynctexPath = path.join(latestDir, `${base}.synctex.gz`);
  
  await fs.copyFile(pdfPath, latestPdfPath);
  await fs.copyFile(synctexPath, latestSynctexPath).catch(() => {});
  
  // 返回值增加 pdfUrl
  return { 
    ok: true, 
    pdf: pdfBase64, 
    pdfUrl: `/api/projects/${projectId}/blob?path=.compile/${base}.pdf`,
    log, 
    status: code ?? 0, 
    synctex 
  };
}
```

### P0-3: PdfPreviewView 组件

```tsx
// PdfPreviewView.tsx
import React, { useEffect, useRef, useState } from 'react';
import * as pdfjsLib from 'pdfjs-dist';

// 设置 worker
pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';

interface PdfPreviewViewProps {
  pdfUrl: string;
  onScroll?: (ratio: number) => void;
  scrollRatio?: number;
}

export function PdfPreviewView({ pdfUrl, onScroll, scrollRatio }: PdfPreviewViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [pdf, setPdf] = useState<pdfjsLib.PDFDocumentProxy | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [scale, setScale] = useState(1.5);

  useEffect(() => {
    const loadPdf = async () => {
      const doc = await pdfjsLib.getDocument(pdfUrl).promise;
      setPdf(doc);
    };
    loadPdf();
  }, [pdfUrl]);

  useEffect(() => {
    if (!pdf || !containerRef.current) return;
    
    const renderPage = async (pageNum: number) => {
      const page = await pdf.getPage(pageNum);
      const viewport = page.getViewport({ scale });
      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d')!;
      
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      
      await page.render({ canvasContext: context, viewport }).promise;
      
      containerRef.current!.innerHTML = '';
      containerRef.current!.appendChild(canvas);
    };
    
    renderPage(currentPage);
  }, [pdf, currentPage, scale]);

  return (
    <div 
      ref={containerRef}
      style={{ overflow: 'auto', height: '100%', background: '#f5f5f0' }}
    />
  );
}
```

---

## 下一步行动

1. **确认优先级**: 你希望先实施哪个 Phase？
2. **分配任务**: 我可以开始实施 P0-1 (渲染准确性) 或 P0-2 (PDF 持久化)
3. **技术评审**: 需要我先做技术方案评审吗？

请告诉我下一步计划！
