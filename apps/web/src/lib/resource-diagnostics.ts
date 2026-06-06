const RATE_WINDOW_MS = 5_000;

interface RateSample {
  timestamp: number;
  bytes: number;
}

interface TerminalSocketState {
  agentSessionId: string;
  state: "connecting" | "open";
}

interface PerformanceMemory {
  usedJSHeapSize?: number;
  totalJSHeapSize?: number;
  jsHeapSizeLimit?: number;
}

interface PerformanceLike {
  memory?: PerformanceMemory;
}

interface DocumentLike {
  querySelectorAll: (selector: string) => { length: number };
}

export interface ResourceDiagnosticsSnapshot {
  timestamp: number;
  dom: {
    xtermCount: number;
    terminalViewCount: number;
    liveTerminalViewCount: number;
    previewTerminalViewCount: number;
    lightweightPreviewCount: number;
    monitorTerminalPaneCount: number;
    activeInputTerminalPaneCount: number;
    vscodeIframeCount: number;
  };
  agentSessionSocket: {
    messagesPerSecond: number;
    kilobytesPerSecond: number;
    totalMessages: number;
    totalKilobytes: number;
    lastPayloadKilobytes: number;
  };
  terminalSockets: {
    connecting: number;
    open: number;
    total: number;
  };
  terminalFrames: {
    messagesPerSecond: number;
    kilobytesPerSecond: number;
  };
  memory: {
    usedJSHeapMegabytes?: number;
    totalJSHeapMegabytes?: number;
    jsHeapLimitMegabytes?: number;
  };
}

export interface ResourceDiagnosticsOptions {
  documentRef?: DocumentLike;
  now?: number;
  performanceRef?: PerformanceLike;
}

const agentSnapshotSamples: RateSample[] = [];
const terminalFrameSamples: RateSample[] = [];
const terminalSockets = new Map<number, TerminalSocketState>();

let nextTerminalSocketId = 1;
let totalAgentSnapshotMessages = 0;
let totalAgentSnapshotBytes = 0;
let lastAgentSnapshotBytes = 0;

function measureTextBytes(payload: string): number {
  return new TextEncoder().encode(payload).byteLength;
}

function trimSamples(samples: RateSample[], now: number): void {
  while (samples.length > 0 && now - samples[0]!.timestamp > RATE_WINDOW_MS) {
    samples.shift();
  }
}

function recordSample(samples: RateSample[], bytes: number, now: number): void {
  samples.push({ timestamp: now, bytes });
  trimSamples(samples, now);
}

function calculateRate(samples: RateSample[], now: number) {
  trimSamples(samples, now);
  const totalBytes = samples.reduce((sum, sample) => sum + sample.bytes, 0);

  return {
    kilobytesPerSecond: totalBytes / 1024 / (RATE_WINDOW_MS / 1000),
    messagesPerSecond: samples.length / (RATE_WINDOW_MS / 1000),
  };
}

function countSelector(
  documentRef: DocumentLike | undefined,
  selector: string,
) {
  if (!documentRef) {
    return 0;
  }

  try {
    return documentRef.querySelectorAll(selector).length;
  } catch {
    return 0;
  }
}

function toMegabytes(value: number | undefined): number | undefined {
  return typeof value === "number" && Number.isFinite(value)
    ? value / 1024 / 1024
    : undefined;
}

export function recordAgentSnapshotFrame(
  payload: string,
  now = Date.now(),
): void {
  const bytes = measureTextBytes(payload);
  totalAgentSnapshotMessages += 1;
  totalAgentSnapshotBytes += bytes;
  lastAgentSnapshotBytes = bytes;
  recordSample(agentSnapshotSamples, bytes, now);
}

export function recordTerminalFrame(payload: string, now = Date.now()): void {
  recordSample(terminalFrameSamples, measureTextBytes(payload), now);
}

export function registerTerminalWebSocket(agentSessionId: string): {
  markOpen: () => void;
  markClosed: () => void;
} {
  const socketId = nextTerminalSocketId;
  nextTerminalSocketId += 1;
  let closed = false;

  terminalSockets.set(socketId, {
    agentSessionId,
    state: "connecting",
  });

  return {
    markOpen() {
      if (closed) {
        return;
      }

      terminalSockets.set(socketId, {
        agentSessionId,
        state: "open",
      });
    },
    markClosed() {
      if (closed) {
        return;
      }

      closed = true;
      terminalSockets.delete(socketId);
    },
  };
}

export function getResourceDiagnosticsSnapshot(
  options: ResourceDiagnosticsOptions = {},
): ResourceDiagnosticsSnapshot {
  const now = options.now ?? Date.now();
  const documentRef =
    options.documentRef ??
    (typeof document === "undefined" ? undefined : document);
  const performanceRef: PerformanceLike | undefined =
    options.performanceRef ??
    (typeof performance === "undefined"
      ? undefined
      : (performance as PerformanceLike));
  const agentSnapshotRate = calculateRate(agentSnapshotSamples, now);
  const terminalFrameRate = calculateRate(terminalFrameSamples, now);
  let connecting = 0;
  let open = 0;

  for (const socket of terminalSockets.values()) {
    if (socket.state === "open") {
      open += 1;
    } else {
      connecting += 1;
    }
  }

  return {
    timestamp: now,
    dom: {
      xtermCount: countSelector(documentRef, ".xterm"),
      terminalViewCount: countSelector(documentRef, ".terminal-view"),
      liveTerminalViewCount: countSelector(documentRef, ".terminal-view-live"),
      previewTerminalViewCount: countSelector(
        documentRef,
        ".terminal-view-preview",
      ),
      lightweightPreviewCount: countSelector(documentRef, ".terminal-preview"),
      monitorTerminalPaneCount: countSelector(
        documentRef,
        ".focus-terminal-pane[data-terminal-pane-session]",
      ),
      activeInputTerminalPaneCount: countSelector(
        documentRef,
        '[data-active-terminal-pane="true"][data-terminal-pane-session]',
      ),
      vscodeIframeCount: countSelector(documentRef, ".vscode-drawer-frame"),
    },
    agentSessionSocket: {
      ...agentSnapshotRate,
      lastPayloadKilobytes: lastAgentSnapshotBytes / 1024,
      totalKilobytes: totalAgentSnapshotBytes / 1024,
      totalMessages: totalAgentSnapshotMessages,
    },
    terminalFrames: terminalFrameRate,
    terminalSockets: {
      connecting,
      open,
      total: connecting + open,
    },
    memory: {
      jsHeapLimitMegabytes: toMegabytes(
        performanceRef?.memory?.jsHeapSizeLimit,
      ),
      totalJSHeapMegabytes: toMegabytes(
        performanceRef?.memory?.totalJSHeapSize,
      ),
      usedJSHeapMegabytes: toMegabytes(performanceRef?.memory?.usedJSHeapSize),
    },
  };
}

export function classifyResourcePressure({
  snapshot,
  useLightweightTerminalPreview,
}: {
  snapshot: ResourceDiagnosticsSnapshot;
  useLightweightTerminalPreview: boolean;
}): string[] {
  const findings: string[] = [];
  const intentionalLiveTerminalBudget = Math.max(
    1,
    snapshot.dom.monitorTerminalPaneCount,
  );

  if (
    !useLightweightTerminalPreview &&
    snapshot.dom.xtermCount > intentionalLiveTerminalBudget
  ) {
    findings.push(
      "完整预览正在挂载多个 xterm，这是无 VS Code 场景下内存增长的首要嫌疑。",
    );
  }

  if (snapshot.agentSessionSocket.messagesPerSecond >= 5) {
    findings.push(
      "会话快照推送频率偏高，浏览器会持续 JSON 解析并触发 React 更新。",
    );
  }

  if (snapshot.terminalSockets.total > intentionalLiveTerminalBudget) {
    findings.push(
      "同时存在多个终端 WebSocket，说明页面仍挂着多个完整终端实例。",
    );
  }

  if (
    snapshot.terminalFrames.messagesPerSecond >= 20 ||
    snapshot.terminalFrames.kilobytesPerSecond >= 256
  ) {
    findings.push(
      "终端实时输出吞吐偏高，活跃终端本身会持续推高网络、xterm scrollback 和渲染压力。",
    );
  }

  if (
    useLightweightTerminalPreview &&
    snapshot.dom.xtermCount > intentionalLiveTerminalBudget
  ) {
    findings.push(
      "轻量预览下仍出现多个 xterm，需要检查是否有隐藏完整终端未释放。",
    );
  }

  if (
    snapshot.dom.xtermCount <= intentionalLiveTerminalBudget &&
    snapshot.agentSessionSocket.messagesPerSecond < 5 &&
    snapshot.terminalFrames.messagesPerSecond < 20 &&
    snapshot.terminalFrames.kilobytesPerSecond < 256 &&
    snapshot.terminalSockets.total <= intentionalLiveTerminalBudget
  ) {
    findings.push(
      "当前指标未显示明显泄漏源；若 heap 继续增长，应优先抓取 Chrome Heap Snapshot 对比 retained objects。",
    );
  }

  return findings;
}

export function resetResourceDiagnosticsForTest(): void {
  agentSnapshotSamples.length = 0;
  terminalFrameSamples.length = 0;
  terminalSockets.clear();
  nextTerminalSocketId = 1;
  totalAgentSnapshotBytes = 0;
  totalAgentSnapshotMessages = 0;
  lastAgentSnapshotBytes = 0;
}
