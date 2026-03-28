# Agent Orchestrator Implementation Plan

## Goal

Create a new standalone monorepo in the repository root for an agent orchestrator product using React + TypeScript + Vite on the frontend and Node.js + TypeScript + Fastify on the backend.

The first implementation slice should provide:

- monorepo workspace scaffolding
- shared agent session domain types
- backend in-memory agent session registry and control surface
- frontend orchestration board shell and active-agent detail shell
- live frontend/backend integration for listing sessions and switching active session

## Execution Rules

- Do not modify `vibe-kanban/` as part of this implementation.
- Keep the implementation in the repository root.
- Use `agentSession` as the primary domain model, not terminal ids.
- Start with in-memory storage only.
- Implement the simplest possible launch and discovery placeholders without fake tmux execution.

## Tasks

1. Migrate brainstorm artifact to the current project root under `.github/superpower/brainstorm/`.
2. Create this implementation plan under `.github/superpower/plan/`.
3. Scaffold the monorepo root with workspace config, base TypeScript config, and top-level package scripts.
4. Scaffold `packages/shared` with core domain types and API DTOs for agent sessions.
5. Scaffold `apps/server` with Fastify, CORS, WebSocket support, an in-memory registry service, and REST endpoints for list/register/focus/stdin.
6. Scaffold `apps/web` with Vite + React + TypeScript, a three-panel orchestration UI shell, and API integration for session list and active session selection.
7. Connect frontend and backend using shared types and a small API client.
8. Add a lightweight seeded data path in the backend so the UI shows meaningful sessions during development.
9. Run formatting or the nearest available equivalent and then run the narrowest relevant verification commands for root, server, and web.

## Task Batches

### Batch 1

1. Migrate brainstorm artifact.
2. Create implementation plan.
3. Scaffold monorepo root.

### Batch 2

4. Scaffold shared package.
5. Scaffold backend app.
6. Scaffold frontend app.

### Batch 3

7. Connect frontend and backend.
8. Add seed data.
9. Run verification.

## Expected Output

By the end of this plan, the repository root should contain a runnable new project with:

- `apps/web`
- `apps/server`
- `packages/shared`
- root package/workspace config
- a visible agent orchestration dashboard backed by a live API

## Verification Commands

Use these exact commands once the relevant files exist:

- `pnpm install`
- `pnpm --filter shared build`
- `pnpm --filter server build`
- `pnpm --filter web build`

If a root `check` or `format` script is created, run:

- `pnpm format`
- `pnpm check`
