# Env-driven default ports

## Problem

The project currently hardcodes the frontend development port to `3000` and
the backend port to `4000` in multiple places. The user wants both services to
take their default ports from a single repository-root `.env` file, with local
defaults such as `WEB_PORT=3100` and `SERVER_PORT=3200`.

## Goals

- Read frontend and backend default ports from one root `.env` file.
- Keep `pnpm dev` working without requiring per-app environment files.
- Keep the frontend proxy targets aligned with the backend port.
- Keep test and support tooling aligned with the same port defaults.

## Non-goals

- Changing unrelated runtime settings.
- Reworking deployment or production configuration.
- Introducing a broader configuration system beyond local port loading.

## Options considered

### 1. Root `.env` with `WEB_PORT` and `SERVER_PORT` (recommended)

Use explicit port variables in one repository-root `.env` file, load them in
both app entry points, and update auxiliary tooling to follow the same values.

**Pros**
- Clear separation between frontend and backend settings.
- Avoids collisions with generic `PORT`.
- Matches the user's request for one shared `.env`.

**Cons**
- Requires touching both app startup paths and related tooling.

### 2. Root `.env` with `VITE_PORT` and `PORT`

Reuse common variable names and wire each app to those values.

**Pros**
- Slightly less naming design work.

**Cons**
- Naming is asymmetric.
- Generic `PORT` is easier to conflict with external tools or shells.

### 3. Root `.env` with full origin URLs

Store full frontend/backend origins instead of ports and derive ports from them.

**Pros**
- Flexible for future hostname changes.

**Cons**
- Over-configured for a local port-only need.
- Adds parsing complexity without user value right now.

## Chosen design

Use a repository-root `.env` file as the single source of truth for:

```env
WEB_PORT=3100
SERVER_PORT=3200
```

Implementation will:

1. Load the root `.env` for the frontend Vite config and backend startup.
2. Bind the frontend dev server to `WEB_PORT`.
3. Point the frontend `/api`, `/ws`, and `/vscode` proxies to `SERVER_PORT`.
4. Bind the backend HTTP server to `SERVER_PORT`.
5. Update Playwright and existing dev-support scripts that currently assume
   `3000`/`4000` so they follow the same defaults.

## Implementation notes

- Frontend config should read the root `.env` explicitly rather than relying on
  shell-exported variables.
- Backend startup should load the same root `.env` before reading
  `process.env`.
- Existing explicit CLI overrides should continue to work where supported by
  the underlying tools.
- Any checked-in documentation that describes the default local ports should be
  updated to reflect the new defaults and `.env` source of truth.

## Testing

- Add or update focused tests for any extracted port-resolution logic.
- Verify the frontend config resolves `WEB_PORT` and backend proxy targets
  correctly.
- Verify backend startup resolves `SERVER_PORT` correctly.
- Update affected tooling expectations if they assert the old defaults.
