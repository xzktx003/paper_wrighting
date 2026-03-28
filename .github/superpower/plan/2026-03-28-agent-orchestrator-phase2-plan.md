# Agent Orchestrator Phase 2 Plan

## Goal

Extend the current scaffold into a genuinely runnable local orchestration product with:

- real local process launch
- real local tmux discovery and input handoff
- richer session output history in the UI
- launch and discovery controls in the product
- automated Playwright end-to-end coverage

## Scope Rules

- Keep all implementation in the repository root.
- Do not modify `vibe-kanban/`.
- Prefer real local execution over fake placeholders.
- Use a bundled mock agent process for deterministic end-to-end testing.
- Implement tmux support against the local machine only in this phase.
- If tmux is unavailable, discovery must fail gracefully instead of breaking the app.

## Tasks

1. Extend shared types to support output events, launch inputs, and tmux discovery DTOs.
2. Add a server-side process runtime manager for real local child process sessions.
3. Add a server-side tmux adapter for local discovery, pane capture, and input forwarding.
4. Expand the agent registry to keep recent output history and session source metadata for runtime-backed sessions.
5. Add backend routes for local launch, tmux discovery, session detail retrieval, and session input writes.
6. Add a deterministic mock agent script under `scripts/` for local launch and automated testing.
7. Enhance the frontend with a launch/discovery control panel, richer board metadata, and a scrollable output detail view.
8. Connect the frontend to the new backend capabilities, including session detail polling or refresh after actions.
9. Add Playwright configuration and an end-to-end test that launches a local mock agent, focuses it, sends input, and verifies output appears.
10. Run the application locally, execute the Playwright end-to-end test, and rerun the relevant build and check commands.

## Task Batches

### Batch 1

1. Extend shared types.
2. Add process runtime manager.
3. Add tmux adapter.

### Batch 2

4. Expand registry.
5. Add backend routes.
6. Add mock agent script.

### Batch 3

7. Enhance frontend UI.
8. Connect frontend to backend.
9. Add Playwright test assets.

### Batch 4

10. Run the app and execute verification, including Playwright.

## Verification Commands

- `pnpm install`
- `pnpm --filter @agent-orchestrator/shared build`
- `pnpm --filter server build`
- `pnpm --filter web build`
- `pnpm check`
- `pnpm exec playwright test`
