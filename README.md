# Paper Writer / Pepper Agent

Paper Writer, also called Pepper Agent in this workspace, is a local paper-writing assistant for research workflows. It focuses on evidence-grounded writing instead of generic chat: upload or import paper evidence, diagnose whether PDF/RAG content is actually usable, choose the right writing Skill from Chinese-first task entries, review AI output against evidence, and only then produce a human-applied adoption package.

This repository is not the old Coding Kanban project. It still contains some shared development infrastructure from that history, but the active product surface is the Paper Writer backend, RAG service, Skill engine, writing workbench API, and the static Paper Writer workbench UI.

## What It Does

- **Paper evidence library**: Upload PDF, BibTeX, Markdown, TXT, and manual evidence notes into a project corpus.
- **RAG/PDF diagnostics**: Detect empty evidence libraries, parsing failures, metadata-only PDFs, scanned PDFs, encrypted/damaged PDFs, missing text extraction, and no-hit evidence queries.
- **OCR/manual text recovery**: Preview and import checked OCR/manual excerpts for PDFs that cannot provide reliable extracted text.
- **Chinese-first Skill navigation**: Recommend paper-writing Skills from natural Chinese tasks, not internal Skill names.
- **Task starters**: Start from common research tasks such as related work, paper planning, polishing, rebuttal, LaTeX debugging, submission material checks, statistics, slides, posters, and grant proposals.
- **Chat / Agent / Tools routing**: Route explanation tasks to Chat, draft/rewrite/review tasks to Agent, and explicit command/plot/statistical execution tasks to Tools.
- **Evidence review**: Check AI output for missing source numbers, unknown citations, evidence drift, unsupported bibliographic details, unsupported quantitative claims, and contradictions.
- **Single-claim review**: Review one claim against the current evidence pack before it is used in the paper.
- **Safe adoption package**: Produce a non-writing, human-applied adoption package with target section, citations used, manual diff guidance, and explicit "do not auto-write" constraints.
- **Production readiness gates**: Surface whether OCR/PDF extraction and real browser E2E readiness are actually available on the current machine.

## Privacy Boundary

Research papers are private by default.

- `papers/` is intentionally ignored by git.
- `.openprism/`, `.paper-agent-runtime/`, `.env`, temporary coverage/codegraph folders, and local runtime state are ignored.
- Do not commit PDFs, paper drafts, private manuscripts, API keys, tokens, SSH keys, or local machine configuration.
- Use `.env` for local secrets and paths. `.env.example` is the safe template that can be committed.

Before pushing, verify:

```bash
git check-ignore -v papers papers/torq .openprism .paper-agent-runtime .env
git ls-tree -r --name-only github/v1.3.0 | rg '(^|/)papers(/|$)|(^|/)paperers(/|$)' || true
```

The second command should print nothing.

## Main User Flow

1. Open the Paper Writer workbench.
2. Select or enter a project.
3. Upload evidence or import checked OCR/manual text.
4. Run RAG indexing and inspect document readiness.
5. Describe the paper task in natural language.
6. Let the workbench recommend mode, Skill, missing context, and next actions.
7. Generate or paste AI output.
8. Run evidence review or single-claim review.
9. Create a safe adoption package.
10. Manually apply the accepted draft to the paper after human review.

The system should never silently overwrite paper files. Adoption packages are previews and manual application guides, not automatic write operations.

## Quick Start

### Requirements

Required:

- Node.js 20 or newer.
- pnpm, matching the workspace package manager.

Recommended for production-quality PDF/OCR handling:

- `pdftotext` for PDF text extraction.
- `tesseract` for OCR.
- `ocrmypdf` for OCR recovery workflows.
- Playwright browser dependencies for real browser E2E validation.

Current known gate on this machine: Chromium cannot start until the system library `libatk-1.0.so.0` is installed.

### Install

```bash
pnpm install
```

### Configure

Copy the environment template:

```bash
cp .env.example .env
```

Important environment variables:

| Variable | Purpose |
| --- | --- |
| `HOST` | Backend bind host. Use `0.0.0.0` for LAN access. |
| `PORT` / `SERVER_PORT` | Backend API port used by the dev script. |
| `WEB_HOST` | Frontend bind host. Use `0.0.0.0` for LAN access. |
| `WEB_PORT` | Frontend dev server port. |
| `WEB_BACKEND_HOST` / `WEB_BACKEND_PORT` | Frontend proxy target. |
| `OPENPRISM_DATA_DIR` | Backend data directory. Default is outside this repo. |
| `OPENPRISM_PROJECTS_DIR` | Project directory used by OpenPrism/Paper Writer settings. |
| `OPENPRISM_API_TOKEN` | Optional API token for the static workbench UI. |
| `OPENPRISM_LLM_*` | OpenAI-compatible LLM provider configuration. |
| `OPENPRISM_MINERU_TOKEN` | Optional MinerU integration token. |

Do not commit `.env`.

### Run Development Servers

Recommended:

```bash
./scripts/restart-dev.sh
```

The script starts the backend and frontend, binds the frontend to `0.0.0.0`, and prints local/network URLs.

You can also run:

```bash
pnpm dev
```

Open the Paper Writer workbench:

```text
http://<host>:<web-port>/writing-workbench
```

The same static page is also available as:

```text
/paper-writer-workbench.html
```

## Workbench API

The key endpoint is:

```http
POST /api/projects/:id/writing-workbench/context
```

Example request:

```json
{
  "task": "帮我根据这些 PDF 写 related work 和 research gap",
  "evidenceQuery": "retrieval augmented generation writing limitation research gap",
  "contextAnswers": {
    "target_section_or_file": "chapters/related_work.tex",
    "paper_claims": "本文强调可审查的 RAG 证据写作流程。"
  },
  "skillLimit": 5,
  "evidenceLimit": 3
}
```

Related endpoints:

```http
POST /api/projects/:id/writing-workbench/review-answer
POST /api/projects/:id/writing-workbench/claim-review
POST /api/projects/:id/writing-workbench/adoption-package
```

RAG and recovery endpoints:

```http
POST /api/projects/:id/rag/upload
POST /api/projects/:id/rag/index
GET  /api/projects/:id/rag/search?q=<query>&limit=8
GET  /api/projects/:id/rag/documents
DELETE /api/projects/:id/rag/documents?path=<path>

POST /api/projects/:id/rag/text-import/preview
POST /api/projects/:id/rag/text-import
GET  /api/projects/:id/rag/ocr-jobs
POST /api/projects/:id/rag/ocr-jobs
POST /api/projects/:id/rag/ocr-jobs/run
```

Skill navigation endpoints:

```http
GET  /api/skills/:name
GET  /api/skills/navigation
POST /api/skills/recommend
POST /api/skills/navigation
```

## Skills

Built-in Paper Writer Skills include:

- `literature-review`: related work, survey, research gap.
- `nature-academic-search`: academic search and query expansion.
- `paper-planning`: paper outline, story line, roadmap, reviewer risk.
- `writing-introduction`: introduction logic, motivation, contribution.
- `writing-methodology`: method, algorithm, notation, proof sketch.
- `writing-results`: results, experiments, datasets, ablation text.
- `writing-discussion`: discussion, limitations, threats to validity.
- `writing-abstract`: abstract, title, highlights, keywords.
- `writing-conclusion`: conclusion and future work.
- `writing-polish`: local polish, translation, tense, compression, AI-trace reduction.
- `evidence-review`: AI output review, claim/citation grounding, safe adoption.
- `latex-debugging`: LaTeX/Overleaf/latexmk error triage.
- `reference-management`: BibTeX, citation keys, DOI, references cleanup.
- `nature-figure`: figures, captions, flow diagrams, visual abstracts.
- `statistical-analysis`: t-test, p-value, mean/std, confidence interval.
- `conference-submission`: anonymity, checklist, cover letter, statements, supplementary material.
- `reviewer-response`: rebuttal, response table, revision plan, over-promise checks.
- `grant-proposal`: research proposal and grant writing.
- `nature-paper2ppt`: slides, Beamer, conference talk.
- `poster-design`: academic poster layout and content hierarchy.

The UI should show Chinese primary titles and English subtitles, with hover/focus guidance for inputs, outputs, best-for, not-for, risk boundaries, and safe first prompts.

## Safety Model

Paper Writer deliberately separates "AI can draft" from "AI can write into the paper".

Important rules:

- Citation-sensitive tasks require an evidence pack.
- Evidence-based answers must use source numbers such as `[1]`, `[2]`.
- Unknown source numbers block adoption.
- Evidence pack drift blocks adoption.
- Unsupported author/year/venue/DOI claims are flagged.
- Unsupported quantitative claims are flagged.
- Adoption packages always set `canWriteToPaper: false` and `willWrite: false`.
- The user manually applies any accepted text after review.

## Validation

Run the related test suite:

```bash
node --test \
  scripts/playwright-preflight.test.mjs \
  scripts/playwright-e2e-acceptance.test.mjs \
  app/apps/backend/src/services/__tests__/paperRagService.test.js \
  app/apps/backend/src/services/__tests__/skillEngine.test.js \
  app/apps/backend/src/services/__tests__/paperWorkbenchService.test.js \
  app/apps/backend/src/routes/__tests__/ai.test.js \
  app/apps/backend/src/routes/__tests__/paperAgentE2e.test.js \
  app/apps/backend/src/routes/__tests__/paperRag.test.js \
  app/apps/backend/src/routes/__tests__/skills.test.js \
  app/apps/backend/src/routes/__tests__/paperWorkbench.test.js \
  app/apps/backend/src/routes/__tests__/workbenchPrototype.test.js
```

Static workbench check:

```bash
node - <<'NODE'
const { readFileSync } = require('fs');
const html = readFileSync('app/apps/frontend/public/paper-writer-workbench.html', 'utf8');
const required = [
  'productionGates', '生产验收 Gate',
  'writing-polish', '论文润色 / 语言编辑',
  'evidence-review', '审查 AI 输出 / 证据核对',
  'paper-planning', '论文规划 / Outline',
  'latex-debug', '修复 LaTeX / Overleaf 报错',
  'reviewer-response', '审稿回复 / Rebuttal',
  'submission-materials', '投稿材料 / 声明检查',
  'contenteditable="true"',
  'data-import-text-evidence'
];
const missing = required.filter(item => !html.includes(item));
const forbidden = ['importTextEvidenceFromPrompt', 'window.prompt', 'window.confirm', 'window.alert'].filter(item => html.includes(item));
const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(match => match[1]);
new Function(scripts[0]);
console.log(JSON.stringify({ scripts: scripts.length, missing, forbidden }, null, 2));
if (missing.length || forbidden.length || scripts.length !== 1) process.exit(1);
NODE
```

General checks:

```bash
git diff --check
git check-ignore -v papers papers/torq .openprism .paper-agent-runtime .env
```

Production runtime preflight:

```bash
command -v ocrmypdf || true
command -v tesseract || true
command -v pdftotext || true
node scripts/playwright-preflight.mjs
```

## Current Production Status

The code path has automated coverage for the Paper Writer workbench, RAG recovery, Skill routing, evidence review, claim review, and non-writing adoption packages.

This machine is not yet production-release ready until these environment gates pass:

- `ocrmypdf` available.
- `tesseract` available.
- `pdftotext` available.
- Playwright Chromium starts successfully with all required system libraries.
- Full real-browser E2E acceptance passes in an environment with Playwright browser dependencies.

## Repository Layout

```text
app/apps/backend/                 Paper Writer backend
app/apps/backend/src/routes/      API routes
app/apps/backend/src/services/    RAG, Skill, workbench, review, adoption services
app/apps/backend/skills/          YAML Skill definitions
app/apps/frontend/public/         Static Paper Writer workbench
docs/                             Product notes, UX contract, function/debug lists
memories/repo/                    Repository-level function/debug memory
scripts/                          Dev, preflight, and E2E scripts
```

Legacy root-level `apps/`, `packages/`, and some scripts may still exist from the earlier Coding Kanban foundation. Treat the Paper Writer files under `app/apps/backend`, `app/apps/frontend/public/paper-writer-workbench.html`, and `docs/paper_writer_ux_contract.md` as the current product surface unless a task explicitly says otherwise.

## More Documentation

- [Paper Writer UX Contract](docs/paper_writer_ux_contract.md)
- [Function List](docs/func_list.md)
- [Debug List](docs/debug_list.md)

