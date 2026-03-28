import { FormEvent, useState } from "react";

import type {
  LaunchLocalAgentInput,
  LaunchRemoteAgentInput,
} from "@agent-orchestrator/shared";

interface ControlPanelProps {
  onLaunchLocalAgent: (input: LaunchLocalAgentInput) => Promise<void>;
  onLaunchRemoteAgent: (input: LaunchRemoteAgentInput) => Promise<void>;
  onDiscoverTmuxSessions: () => Promise<void>;
  statusMessage: string | null;
}

export function ControlPanel({
  onLaunchLocalAgent,
  onLaunchRemoteAgent,
  onDiscoverTmuxSessions,
  statusMessage,
}: ControlPanelProps) {
  const [formState, setFormState] = useState<LaunchLocalAgentInput>({
    workspaceId: "local-sandbox",
    displayName: "Mock Agent / local-sandbox",
    agentKind: "mock-agent",
    workingDirectory: "/Users/hx/Documents/Codes/VibeCoding/coding_kanban",
    command: "node scripts/mock-agent.mjs",
  });
  const [isLaunching, setIsLaunching] = useState(false);
  const [remoteFormState, setRemoteFormState] =
    useState<LaunchRemoteAgentInput>({
      workspaceId: "remote-sandbox",
      displayName: "SSH Agent / remote-sandbox",
      agentKind: "ssh-mock-agent",
      workingDirectory: "/Users/hx/Documents/Codes/VibeCoding/coding_kanban",
      command: "node scripts/mock-agent.mjs",
      sshTarget: {
        host: "localhost",
        username: "hx",
      },
    });
  const [isLaunchingRemote, setIsLaunchingRemote] = useState(false);
  const [isDiscovering, setIsDiscovering] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsLaunching(true);

    try {
      await onLaunchLocalAgent(formState);
    } finally {
      setIsLaunching(false);
    }
  }

  async function handleRemoteSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsLaunchingRemote(true);

    try {
      await onLaunchRemoteAgent(remoteFormState);
    } finally {
      setIsLaunchingRemote(false);
    }
  }

  async function handleDiscoverTmux() {
    setIsDiscovering(true);

    try {
      await onDiscoverTmuxSessions();
    } finally {
      setIsDiscovering(false);
    }
  }

  return (
    <section className="panel panel-controls">
      <div className="panel-header">
        <h2>Launch & Discover</h2>
      </div>
      <form className="controls-form" onSubmit={handleSubmit}>
        <input
          data-testid="launch-workspace-id"
          onChange={(event) =>
            setFormState((currentState) => ({
              ...currentState,
              workspaceId: event.target.value,
            }))
          }
          placeholder="Workspace id"
          value={formState.workspaceId}
        />
        <input
          data-testid="launch-display-name"
          onChange={(event) =>
            setFormState((currentState) => ({
              ...currentState,
              displayName: event.target.value,
            }))
          }
          placeholder="Display name"
          value={formState.displayName}
        />
        <input
          data-testid="launch-agent-kind"
          onChange={(event) =>
            setFormState((currentState) => ({
              ...currentState,
              agentKind: event.target.value,
            }))
          }
          placeholder="Agent kind"
          value={formState.agentKind}
        />
        <input
          data-testid="launch-working-directory"
          onChange={(event) =>
            setFormState((currentState) => ({
              ...currentState,
              workingDirectory: event.target.value,
            }))
          }
          placeholder="Working directory"
          value={formState.workingDirectory}
        />
        <input
          data-testid="launch-command"
          onChange={(event) =>
            setFormState((currentState) => ({
              ...currentState,
              command: event.target.value,
            }))
          }
          placeholder="Command"
          value={formState.command}
        />
        <div className="controls-actions">
          <button
            data-testid="launch-local-agent"
            disabled={isLaunching}
            type="submit"
          >
            {isLaunching ? "Launching…" : "Launch local agent"}
          </button>
          <button
            data-testid="discover-tmux"
            disabled={isDiscovering}
            onClick={handleDiscoverTmux}
            type="button"
          >
            {isDiscovering ? "Discovering…" : "Discover tmux"}
          </button>
        </div>
      </form>
      <form className="controls-form remote-form" onSubmit={handleRemoteSubmit}>
        <input
          data-testid="remote-workspace-id"
          onChange={(event) =>
            setRemoteFormState((currentState) => ({
              ...currentState,
              workspaceId: event.target.value,
            }))
          }
          placeholder="Remote workspace id"
          value={remoteFormState.workspaceId}
        />
        <input
          data-testid="remote-display-name"
          onChange={(event) =>
            setRemoteFormState((currentState) => ({
              ...currentState,
              displayName: event.target.value,
            }))
          }
          placeholder="Remote display name"
          value={remoteFormState.displayName}
        />
        <input
          data-testid="remote-host"
          onChange={(event) =>
            setRemoteFormState((currentState) => ({
              ...currentState,
              sshTarget: {
                ...currentState.sshTarget,
                host: event.target.value,
              },
            }))
          }
          placeholder="SSH host"
          value={remoteFormState.sshTarget.host}
        />
        <input
          data-testid="remote-username"
          onChange={(event) =>
            setRemoteFormState((currentState) => ({
              ...currentState,
              sshTarget: {
                ...currentState.sshTarget,
                username: event.target.value,
              },
            }))
          }
          placeholder="SSH username"
          value={remoteFormState.sshTarget.username ?? ""}
        />
        <input
          data-testid="remote-command"
          onChange={(event) =>
            setRemoteFormState((currentState) => ({
              ...currentState,
              command: event.target.value,
            }))
          }
          placeholder="Remote command"
          value={remoteFormState.command}
        />
        <div className="controls-actions">
          <button
            data-testid="launch-remote-agent"
            disabled={isLaunchingRemote}
            type="submit"
          >
            {isLaunchingRemote ? "Launching remote…" : "Launch remote agent"}
          </button>
        </div>
      </form>
      {statusMessage ? <p className="status-message">{statusMessage}</p> : null}
    </section>
  );
}
