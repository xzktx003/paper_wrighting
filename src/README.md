# Source Layout

Coding Kanban is organized as a TypeScript monorepo rather than a single
language package with all source files directly under `src/`.

The publication-relevant source directories are:

- `apps/web/src/` — React/Vite browser workbench, terminal UI, drawers,
  dialogs, and frontend utilities.
- `apps/server/src/` — Fastify backend, WebSocket routes, PTY/SSH/tmux runtime
  managers, filesystem services, SFTP, and VS Code Web proxy management.
- `packages/shared/src/` — transport-neutral DTOs, session records, SSH/file
  payloads, and shared type contracts.
- `tests/e2e/` — Playwright end-to-end scenarios for browser workflows.
- `scripts/` — development and test helper scripts.

This `src/` directory is an index for SoftwareX-style repository inspection.
It does not replace the monorepo package layout used by `pnpm check` and
`pnpm test`.
