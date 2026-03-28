import { useEffect, useState } from "react";

import type {
  AgentSessionRecord,
  LaunchLocalAgentInput,
  ScanDirectoryInput,
  ScanResult,
  SshHostPreset,
  SshTarget,
} from "@agent-orchestrator/shared";

import {
  discoverTmuxSessions,
  getSshHosts,
  launchPtyAgent,
  launchSshPtyAgent,
  scanDirectory,
} from "../lib/api";

interface SideDrawerProps {
  open: boolean;
  sessions: AgentSessionRecord[];
  onLaunched: () => void;
  onFocusSession: (id: string) => void;
}

type SelectedHost = { type: "local" } | { type: "ssh"; preset: SshHostPreset };

const kindPriority: Record<string, number> = {
  copilot: 0,
  codex: 1,
  claude: 2,
  shell: 3,
};

function sortScanResults(results: ScanResult[]): ScanResult[] {
  return [...results].sort((a, b) => {
    // running first
    if (a.status !== b.status) {
      return a.status === "running" ? -1 : 1;
    }
    // then by kind priority
    const ap = kindPriority[a.agentKind] ?? 99;
    const bp = kindPriority[b.agentKind] ?? 99;
    if (ap !== bp) return ap - bp;
    // then alphabetically
    return a.displayName.localeCompare(b.displayName);
  });
}

function findExistingSession(
  result: ScanResult,
  sessions: AgentSessionRecord[],
): AgentSessionRecord | undefined {
  // Match by sessionId → agentSessionId
  if (result.sessionId) {
    const match = sessions.find((s) => s.agentSessionId === result.sessionId);
    if (match) return match;
  }
  // Match by tmuxSession
  if (result.tmuxSession) {
    const match = sessions.find(
      (s) => s.transportRef?.tmuxSession === result.tmuxSession,
    );
    if (match) return match;
  }
  // Match by host+cwd+kind combo
  const hostId = result.sshTarget?.host ?? "local";
  return sessions.find(
    (s) =>
      (s.hostId ?? "local") === hostId &&
      s.workingDirectory === result.workingDirectory &&
      s.agentKind === result.agentKind,
  );
}

export function SideDrawer({
  open,
  sessions,
  onLaunched,
  onFocusSession,
}: SideDrawerProps) {
  // Panel open state
  const [hostsOpen, setHostsOpen] = useState(true);
  const [resultsOpen, setResultsOpen] = useState(true);
  const [newSessionOpen, setNewSessionOpen] = useState(false);

  // Host selection
  const [sshHosts, setSshHosts] = useState<SshHostPreset[]>([]);
  const [selectedHost, setSelectedHost] = useState<SelectedHost>({
    type: "local",
  });
  const [scanPath, setScanPath] = useState("~/");

  // Scan
  const [scanResults, setScanResults] = useState<ScanResult[]>([]);
  const [scanning, setScanning] = useState(false);
  const [scanMessage, setScanMessage] = useState<string | null>(null);

  // New session form
  const [newName, setNewName] = useState("");
  const [newKind, setNewKind] = useState("copilot");
  const [newDir, setNewDir] = useState("");

  // Status
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  useEffect(() => {
    getSshHosts()
      .then((res) => setSshHosts(res.hosts))
      .catch(() => {});
  }, []);

  if (!open) return null;

  function currentSshTarget(): SshTarget | undefined {
    if (selectedHost.type === "ssh") {
      return {
        host: selectedHost.preset.host,
        port: selectedHost.preset.port,
        username: selectedHost.preset.username,
        identityFile: selectedHost.preset.identityFile,
      };
    }
    return undefined;
  }

  async function handleScan() {
    setScanning(true);
    setScanMessage(null);

    try {
      const sshTarget = currentSshTarget();
      const input: ScanDirectoryInput = {
        path: scanPath || "~/",
        hostId:
          selectedHost.type === "ssh" ? selectedHost.preset.name : undefined,
        sshTarget,
      };
      const response = await scanDirectory(input);
      setScanResults(sortScanResults(response.results));
      setScanMessage(`扫描完成: 发现 ${response.results.length} 个 Agent`);
      setResultsOpen(true);
    } catch (error) {
      setScanMessage(
        `扫描失败: ${error instanceof Error ? error.message : "未知错误"}`,
      );
    } finally {
      setScanning(false);
    }
  }

  async function handleDiscoverTmux() {
    try {
      const result = await discoverTmuxSessions();
      if (result.unavailable) {
        setStatusMessage("本机 tmux 不可用");
      } else {
        setStatusMessage(`发现 ${result.items.length} 个 tmux 会话`);
        onLaunched();
      }
    } catch {
      setStatusMessage("tmux 扫描失败");
    }
  }

  async function handleAddScanResult(result: ScanResult) {
    try {
      if (result.sshTarget) {
        let remoteCommand: string;
        if (result.tmuxSession) {
          remoteCommand = `tmux attach -t '${result.tmuxSession}'`;
        } else {
          let inner: string;
          if (result.sessionId) {
            inner = `cd '${result.workingDirectory}' && ${result.agentKind} --resume=${result.sessionId}`;
          } else {
            inner = `cd '${result.workingDirectory}' && ${result.agentKind}`;
          }
          remoteCommand = `zsh -i -c ${JSON.stringify(inner)}`;
        }

        await launchSshPtyAgent({
          workspaceId: "default",
          displayName: result.displayName,
          agentKind: result.agentKind,
          sshTarget: result.sshTarget,
          remoteCommand,
          workingDirectory: result.workingDirectory,
          agentSessionId: result.sessionId,
        });
      } else if (result.tmuxSession) {
        await launchPtyAgent({
          workspaceId: "default",
          displayName: result.displayName,
          agentKind: result.agentKind,
          command: `tmux attach -t '${result.tmuxSession}'`,
        });
      } else if (result.sessionId) {
        const cmd = result.workingDirectory
          ? `cd '${result.workingDirectory}' && ${result.agentKind} --resume=${result.sessionId}`
          : `${result.agentKind} --resume=${result.sessionId}`;
        await launchPtyAgent({
          workspaceId: "default",
          displayName: result.displayName,
          agentKind: result.agentKind,
          command: cmd,
          workingDirectory: result.workingDirectory,
        });
      } else {
        await launchPtyAgent({
          workspaceId: "default",
          displayName: result.displayName,
          agentKind: result.agentKind,
          command: `cd '${result.workingDirectory}' && ${result.agentKind}`,
          workingDirectory: result.workingDirectory,
        });
      }

      setStatusMessage(`已接入: ${result.displayName}`);
      onLaunched();
    } catch {
      setStatusMessage(`接入失败: ${result.displayName}`);
    }
  }

  async function handleNewSession() {
    if (!newName && !newKind) return;

    const name = newName || `${newKind} 新会话`;
    const dir = newDir || "~/";

    try {
      if (selectedHost.type === "ssh") {
        const target = currentSshTarget()!;
        const inner = `cd '${dir}' && ${newKind}`;
        const remoteCommand = `zsh -i -c ${JSON.stringify(inner)}`;

        await launchSshPtyAgent({
          workspaceId: "default",
          displayName: name,
          agentKind: newKind,
          sshTarget: target,
          remoteCommand,
          workingDirectory: dir,
        });
      } else {
        const input: LaunchLocalAgentInput = {
          workspaceId: "default",
          displayName: name,
          agentKind: newKind,
          command: `cd '${dir}' && ${newKind}`,
          workingDirectory: dir,
        };
        await launchPtyAgent(input);
      }
      setStatusMessage(`已创建: ${name}`);
      setNewName("");
      setNewDir("");
      onLaunched();
    } catch {
      setStatusMessage(`创建失败: ${name}`);
    }
  }

  return (
    <aside className="side-drawer">
      {/* ── Section 1: Hosts ── */}
      <div className="drawer-collapsible">
        <button
          className="drawer-collapsible-header"
          onClick={() => setHostsOpen(!hostsOpen)}
        >
          <span>{hostsOpen ? "▼" : "▶"} 主机</span>
          <span className="drawer-collapsible-count">
            {sshHosts.length + 1}
          </span>
        </button>
        {hostsOpen && (
          <div className="drawer-collapsible-body">
            <label
              className={`host-item ${selectedHost.type === "local" ? "selected" : ""}`}
            >
              <input
                type="radio"
                name="host"
                checked={selectedHost.type === "local"}
                onChange={() => setSelectedHost({ type: "local" })}
              />
              <span className="host-name">🖥 本地</span>
            </label>
            {sshHosts.map((h) => (
              <label
                key={h.name}
                className={`host-item ${selectedHost.type === "ssh" && selectedHost.preset.name === h.name ? "selected" : ""}`}
              >
                <input
                  type="radio"
                  name="host"
                  checked={
                    selectedHost.type === "ssh" &&
                    selectedHost.preset.name === h.name
                  }
                  onChange={() => setSelectedHost({ type: "ssh", preset: h })}
                />
                <span className="host-name">🌐 {h.name}</span>
                <span className="host-detail">
                  {h.username ? `${h.username}@` : ""}
                  {h.host}
                  {h.port !== 22 ? `:${h.port}` : ""}
                </span>
              </label>
            ))}

            <div className="host-scan-row">
              <input
                className="drawer-input"
                placeholder="扫描路径 (默认 ~/)"
                value={scanPath}
                onChange={(e) => setScanPath(e.target.value)}
              />
              <button
                className="drawer-btn primary"
                onClick={handleScan}
                disabled={scanning}
              >
                {scanning ? "…" : "扫描"}
              </button>
            </div>
            {selectedHost.type === "local" && (
              <button className="drawer-btn small" onClick={handleDiscoverTmux}>
                扫描本地 tmux
              </button>
            )}
          </div>
        )}
      </div>

      {/* ── Section 2: Scan Results ── */}
      <div className="drawer-collapsible">
        <button
          className="drawer-collapsible-header"
          onClick={() => setResultsOpen(!resultsOpen)}
        >
          <span>{resultsOpen ? "▼" : "▶"} 扫描结果</span>
          <span className="drawer-collapsible-count">{scanResults.length}</span>
        </button>
        {resultsOpen && (
          <div className="drawer-collapsible-body">
            {scanMessage && <p className="drawer-message">{scanMessage}</p>}
            {scanResults.length === 0 && !scanMessage && (
              <p className="drawer-message">选择主机后点击「扫描」</p>
            )}
            {scanResults.map((result, index) => {
              const existing = findExistingSession(result, sessions);
              return (
                <div key={index} className="scan-result-item">
                  <div className="scan-result-info">
                    <span className="scan-result-name">
                      {result.displayName}
                    </span>
                    <span
                      className={`scan-result-status status-${result.status}`}
                    >
                      {result.status === "running" ? "运行中" : "已停止"}
                    </span>
                  </div>
                  <span className="scan-result-kind">
                    {result.agentKind}
                    {result.workingDirectory
                      ? ` · ${result.workingDirectory}`
                      : ""}
                  </span>
                  {existing ? (
                    <button
                      className="drawer-btn small btn-focus"
                      onClick={() => onFocusSession(existing.id)}
                    >
                      已在宫格 → 聚焦
                    </button>
                  ) : (
                    <button
                      className="drawer-btn small"
                      onClick={() => handleAddScanResult(result)}
                    >
                      {result.status === "running" ? "接入" : "恢复"}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Section 3: New Session ── */}
      <div className="drawer-collapsible">
        <button
          className="drawer-collapsible-header"
          onClick={() => setNewSessionOpen(!newSessionOpen)}
        >
          <span>{newSessionOpen ? "▼" : "▶"} 新建会话</span>
        </button>
        {newSessionOpen && (
          <div className="drawer-collapsible-body">
            <input
              className="drawer-input"
              placeholder="显示名称 (可选)"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
            />
            <select
              className="drawer-input"
              value={newKind}
              onChange={(e) => setNewKind(e.target.value)}
            >
              <option value="copilot">copilot</option>
              <option value="codex">codex</option>
              <option value="claude">claude</option>
              <option value="shell">shell</option>
            </select>
            <input
              className="drawer-input"
              placeholder="工作目录 (默认 ~/)"
              value={newDir}
              onChange={(e) => setNewDir(e.target.value)}
            />
            <p className="drawer-message">
              目标主机:{" "}
              {selectedHost.type === "local"
                ? "本地"
                : selectedHost.preset.name}
            </p>
            <button className="drawer-btn primary" onClick={handleNewSession}>
              创建会话
            </button>
          </div>
        )}
      </div>

      {statusMessage && <p className="drawer-status">{statusMessage}</p>}
    </aside>
  );
}
