import type { SshHostPreset } from "@agent-orchestrator/shared";

export type SidePanelSelectedHost =
  | { type: "local" }
  | { type: "ssh"; preset: SshHostPreset };

export interface FileBrowserSessionState {
  selectedHost: SidePanelSelectedHost;
}

export type SidePanelTool = "files" | "vscode";

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function hasUnsafeSshControlCharacters(value: string): boolean {
  return /[\0\r\n]/.test(value);
}

function isSafeNonEmptySshString(value: unknown): value is string {
  return isNonEmptyString(value) && !hasUnsafeSshControlCharacters(value);
}

function isOptionalString(value: unknown): value is string | undefined {
  return value === undefined || typeof value === "string";
}

function isOptionalSafeSshString(
  value: unknown,
): value is string | undefined {
  return isOptionalString(value) && !hasUnsafeSshControlCharacters(value ?? "");
}

function isSshHostPreset(value: unknown): value is SshHostPreset {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }

  const candidate = value as Partial<SshHostPreset>;
  const port = candidate.port;
  return (
    isSafeNonEmptySshString(candidate.name) &&
    isSafeNonEmptySshString(candidate.host) &&
    typeof port === "number" &&
    Number.isInteger(port) &&
    port >= 1 &&
    port <= 65535 &&
    isOptionalSafeSshString(candidate.username) &&
    isOptionalSafeSshString(candidate.identityFile) &&
    isSafeNonEmptySshString(candidate.defaultPath)
  );
}

function parseSelectedHost(value: unknown): SidePanelSelectedHost {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { type: "local" };
  }

  const candidate = value as Partial<SidePanelSelectedHost>;
  if (
    candidate.type === "ssh" &&
    "preset" in candidate &&
    isSshHostPreset(candidate.preset)
  ) {
    return {
      type: "ssh",
      preset: candidate.preset,
    };
  }

  return { type: "local" };
}

export function parseSidePanelSessionStates(
  raw: string | null,
): Record<string, FileBrowserSessionState> {
  if (!raw) {
    return {};
  }

  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return {};
    }

    return Object.fromEntries(
      Object.entries(parsed).map(([sessionId, value]) => {
        const selectedHost =
          value && typeof value === "object" && !Array.isArray(value)
            ? parseSelectedHost(
                (value as Partial<FileBrowserSessionState>).selectedHost,
              )
            : { type: "local" as const };
        return [
          sessionId,
          {
            selectedHost,
          },
        ];
      }),
    );
  } catch {
    return {};
  }
}

export function parseInitialSidePanelTool(
  _raw: string | null,
  _focusedId: string | null,
): SidePanelTool | null {
  return null;
}
