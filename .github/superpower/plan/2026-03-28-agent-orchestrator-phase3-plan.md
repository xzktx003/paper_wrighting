# Agent Orchestrator Phase 3 Plan

## Goal

Extend the current runnable product with:

- real SSH-based remote launch
- explicit tmux takeover and release controls
- tmux output refresh controls
- end-to-end verification of the new flows where the local environment supports them

## Scope Rules

- Keep all implementation in the repository root.
- Do not modify `vibe-kanban/`.
- Implement remote launch using the system `ssh` client for this phase.
- Treat discovered tmux sessions as observe-only until the user explicitly takes control.
- Use local tmux sessions for deterministic end-to-end coverage.
- If no reachable SSH server is available in the environment, implement and verify SSH support via build/runtime checks and document that runtime E2E for SSH was blocked by environment.

## Tasks

1. Extend shared types for SSH host config, remote launch input, tmux takeover state, and refresh DTOs.
2. Add a server-side SSH runtime manager that launches remote commands through `ssh`, streams output, and forwards stdin.
3. Add explicit tmux takeover, release, and refresh operations in the tmux adapter and registry state.
4. Expand backend routes to support remote launch, tmux takeover/release/refresh, and host-aware session writes.
5. Enhance the frontend control panel to launch remote sessions and expose tmux control actions in the detail panel.
6. Add a deterministic tmux test setup script and update Playwright automation to cover tmux discovery, takeover, input, and output refresh.
7. Run formatting, build checks, real local app verification, and Playwright end-to-end tests.

## Task Batches

### Batch 1

1. Extend shared types.
2. Add SSH runtime manager.
3. Add tmux takeover/release/refresh support.

### Batch 2

4. Expand backend routes.
5. Enhance frontend controls.
6. Add tmux E2E test setup and Playwright coverage.

### Batch 3

7. Run verification.

## Verification Commands

- `pnpm format`
- `pnpm --filter @agent-orchestrator/shared build`
- `pnpm --filter server build`
- `pnpm --filter web build`
- `pnpm check`
- `pnpm exec playwright test`
