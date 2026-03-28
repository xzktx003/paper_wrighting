# Agent Orchestrator Design

## Summary

Build a single orchestration page that lets the user:

- View all running Codex/Copilot-style agent sessions in one place
- Cover both local and remote runtimes
- Handle two remote entry modes equally:
  - discovered sessions, including existing tmux-based sessions
  - launched sessions created from the frontend against a remote folder
- Route keyboard input to exactly one active agent at a time
- Detect whether each agent is actively producing output, has gone quiet, or is waiting for user input

This design introduces an agent orchestration layer above terminal/process transport so the product is centered on agent sessions rather than raw terminals.

## Goals

- Provide one page to monitor all active agents across workspaces and hosts
- Make focus explicit so keyboard input always targets the intended session
- Support local processes, remote launched agents, and tmux-discovered remote agents
- Normalize status reporting across heterogeneous runtimes
- Preserve enough provenance to distinguish discovered sessions from launched sessions

## Non-Goals

- Full terminal replacement for every transport in the first iteration
- Perfect semantic understanding of every agent CLI prompt format
- Multi-agent broadcast input in the initial version
- Hard-coupling the system to a single provider such as Copilot or Codex

## Core Product Model

The page uses a layered model:

- Workspace is the top-level container
- Each workspace owns many agent sessions
- Each agent session is the primary control object
- Terminal, tmux pane, PTY, or remote command runner are transports behind the session

Primary identity:

- `workspaceId`
- `agentSessionId`

Secondary transport identity:

- terminal id
- process id
- tmux session/pane id
- remote runtime id

This ensures focus, routing, and state are attached to the agent session rather than to an incidental terminal implementation.

## Source Types

Every agent session includes a source label:

- `local`
- `remote-connect`
- `remote-tmux-discovered`

These are first-class and coexist in the same board. They share the same top-level session model while preserving their origin for behavior, attach policy, and UI labeling.

## Architecture

### 1. Agent Orchestrator Layer

Add a new orchestrator layer that sits above execution and terminal providers.

Responsibilities:

- maintain the registry of agent sessions
- map sessions to workspace, host, and path
- track focus and active keyboard target
- aggregate activity telemetry and session state
- expose unified commands for attach, detach, stdin write, interrupt, and restart
- broker discovery and launch flows

This layer becomes the single integration point for the board UI.

### 2. Runtime Adapters

Implement adapters behind the orchestrator instead of letting the UI talk directly to transport primitives.

Initial adapter categories:

- Local process adapter
- Remote launched-session adapter
- Remote tmux discovery/attach adapter
- PTY fallback adapter

The orchestrator consumes normalized events from adapters:

- registration
- heartbeat
- output chunk
- output stopped
- prompt detected
- input requested
- attach state changed
- exited
- error

### 3. Registry + Telemetry + Control Split

Backend capabilities are split into four surfaces:

#### Agent Registry

Stores and serves:

- agent session id
- workspace id
- host id
- source type
- agent kind
- working directory
- display name
- creation time
- last seen time

#### Agent Telemetry

Streams or polls:

- output activity timestamps
- output previews
- state events
- inferred state confidence
- attach status
- runtime health

#### Agent Control

Accepts commands:

- focus attach
- detach
- stdin write
- interrupt
- restart
- optionally create pane/session for tmux-backed agents

#### Discovery and Launch

Supports:

- scanning local processes
- scanning configured remote hosts
- discovering tmux sessions/panes
- launching a new remote agent at a host/path

## State Model

Each agent session has two independent state dimensions.

### Connection State

- `online`
- `degraded`
- `offline`

### Interaction State

- `running`
- `idle`
- `awaiting_input`
- `detached`
- `exited`

For tmux-discovered sessions, attach state is tracked explicitly so a detached but healthy session is not mistaken for a hung one.

## Status Detection Strategy

Use hybrid detection.

Priority order:

1. Explicit runtime signals when available
2. Adapter-specific transport facts
3. Heuristic fallback

### Explicit Signals

Prefer these when emitted by the runtime or adapter:

- prompt event
- input-request event
- paused/complete event
- exit event

### Transport Facts

Used when explicit runtime signals are unavailable:

- stdin writable state
- process still alive
- tmux pane still active
- recent output timestamps
- attach/detach state

### Heuristic Fallback

Infer `awaiting_input` only when explicit signals are missing.

Inputs to inference:

- silence window since last output
- session still online
- stdin path available
- shell or agent prompt-like trailing output
- no current output stream in progress

### Confidence

Expose confidence with inferred states:

- `high`
- `medium`
- `low`

UI should always distinguish explicit and inferred `awaiting_input` so the user can trust the system without assuming perfect certainty.

## Focus and Keyboard Routing

The page has exactly one active agent at a time.

Rules:

- all ordinary keyboard input routes only to the active agent
- page-level shortcuts are minimized and reserved for orchestration actions
- focus change visibly rebinds the current keyboard target
- tmux-backed sessions receive input via pane attach/write path
- launched sessions receive input via runtime stdin path

Recommended retained global shortcuts:

- switch active agent
- open orchestration board
- help overlay

All other input should be treated as agent input by default once the user is in control mode.

The UI must show a persistent indicator such as:

- currently typing to: host / workspace / agent

This prevents accidental input to the wrong runtime.

## Discovery and Launch Model

Two entry paths feed the same registry.

### A. Discover

Find already-running sessions:

- local agent processes
- remote host runtimes
- tmux sessions and panes

Discovered sessions are registered as controllable agent sessions with source metadata.

### B. Launch

Create a new remote or local session from the frontend by specifying:

- host
- workspace or path
- agent type
- launch mode

The launched session is then registered identically to discovered sessions.

### Tmux Attach Policy

Tmux-backed sessions support per-session attach policy:

- observe only
- take control of input
- create a new pane/session instead of hijacking the existing one

This keeps legacy tmux workflows compatible while allowing progressively deeper orchestration.

## Page Design

The orchestration page is a control surface rather than a plain terminal grid.

### Left Column: Workspace Tree

Shows:

- workspaces
- host grouping where relevant
- agent counts
- status summaries

Within each workspace, agents can be grouped by:

- awaiting input
- running
- idle
- detached

### Center Column: Agent Board

Primary overview of all agents as cards.

Each card shows:

- display name
- agent kind
- source label
- host
- path
- interaction state
- connection state
- confidence badge when inferred
- last output time
- short recent output preview

Ordering rules:

- awaiting input first
- running next
- idle after
- exited or offline last

### Right Column: Active Agent Detail

Shows the selected agent in depth:

- live output stream
- input box or terminal input area
- session metadata
- attach/detach controls
- restart/interrupt actions
- source-specific transport details

### Top Focus Bar

A persistent bar indicates the current keyboard target and control mode.

## Key Interactions

- Single click on a card selects the active agent
- Double click opens or expands the detail view
- Enter or Space can move into active input mode
- Agents in `awaiting_input` receive stronger visual emphasis
- Source labels remain visible so tmux-discovered and launched sessions are distinguishable

## Data Model Sketch

```ts
export type AgentSourceType =
  | 'local'
  | 'remote-connect'
  | 'remote-tmux-discovered';

export type ConnectionState = 'online' | 'degraded' | 'offline';

export type InteractionState =
  | 'running'
  | 'idle'
  | 'awaiting_input'
  | 'detached'
  | 'exited';

export type StateConfidence = 'high' | 'medium' | 'low';

export interface AgentSessionRecord {
  id: string;
  workspaceId: string;
  hostId?: string;
  sourceType: AgentSourceType;
  agentKind: string;
  displayName: string;
  workingDirectory?: string;
  connectionState: ConnectionState;
  interactionState: InteractionState;
  stateConfidence?: StateConfidence;
  lastOutputAt?: string;
  lastHeartbeatAt?: string;
  outputPreview?: string;
  transportRef?: {
    terminalId?: string;
    processId?: number;
    tmuxSession?: string;
    tmuxPane?: string;
    runtimeId?: string;
  };
}
```

## Frontend Structure

Recommended frontend split:

- orchestrator store
- board container
- detail view
- source-specific adapter hooks

Guideline:

- board and detail UI should depend on orchestrator state
- transport providers should be wrapped behind orchestrator-facing adapters
- terminal provider remains an implementation detail for certain sources, not the page-level abstraction

## Backend API Sketch

### Registry

- `GET /api/agent-sessions`
- `GET /api/agent-sessions/:id`
- `POST /api/agent-sessions/register`
- `POST /api/agent-sessions/:id/heartbeat`

### Telemetry

- `GET /api/agent-sessions/:id/events`
- `GET /api/agent-sessions/:id/output-preview`
- `POST /api/agent-sessions/:id/state`

### Control

- `POST /api/agent-sessions/:id/focus`
- `POST /api/agent-sessions/:id/stdin`
- `POST /api/agent-sessions/:id/interrupt`
- `POST /api/agent-sessions/:id/detach`
- `POST /api/agent-sessions/:id/restart`

### Discovery and Launch

- `POST /api/agent-discovery/scan`
- `POST /api/agent-discovery/tmux/scan`
- `POST /api/agent-launch`

These routes are conceptual and can be adapted to existing backend conventions.

## Implementation Phasing

### Phase 1

- create agent registry
- create orchestration page shell
- list sessions from manual registration
- support explicit active agent focus
- support basic stdin routing to the active agent

### Phase 2

- add discovery pipeline for local and remote sessions
- add tmux discovery metadata
- add session source labels and attach policy

### Phase 3

- add telemetry normalization
- add `running`, `idle`, and `awaiting_input` derivation
- add confidence-aware UI treatment

### Phase 4

- add deeper tmux control flows
- add restart and attach mode choices
- refine heuristics and observability

## Risks and Mitigations

### Risk: False positive `awaiting_input`

Mitigation:

- separate explicit vs inferred status
- show confidence
- keep recent output preview visible

### Risk: Input sent to the wrong session

Mitigation:

- exactly one active session
- persistent focus indicator
- minimal page-level shortcut interception

### Risk: Tmux takeover disrupts existing workflow

Mitigation:

- support observe-only attach mode
- preserve source labeling
- allow non-destructive attach policies

### Risk: Over-coupling to terminal transport

Mitigation:

- keep session orchestration separate from PTY mechanics
- enforce adapter boundary early

## Recommended Initial Scope

The first shippable slice should include:

- orchestration page shell
- unified session registry
- active agent focus model
- launched remote session registration
- discovered tmux session listing
- simple running vs awaiting_input heuristics

This gives the user immediate value without waiting for full transport unification.

## Approval Outcome

Approved by the user during brainstorming on 2026-03-28.
