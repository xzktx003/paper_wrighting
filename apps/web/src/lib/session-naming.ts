export interface BuildDefaultSessionNameInput {
  hostLabel: string;
  agentKind: string;
  launchMode: "direct" | "tmux";
  existingNames?: string[];
}

function normalizeSessionNameSegment(
  value: string,
  options: { allowDots?: boolean } = {},
): string {
  const allowedPunctuation = options.allowDots ? "._-" : "_-";

  return value
    .trim()
    .toLowerCase()
    .replace(/[\s/:@\\]+/g, "_")
    .replace(new RegExp(`[^a-z0-9${allowedPunctuation}]`, "g"), "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function buildUniqueSessionName(
  baseName: string,
  existingNames: string[],
): string {
  if (!existingNames.includes(baseName)) {
    return baseName;
  }

  let suffix = 2;
  let candidate = `${baseName}_${suffix}`;
  while (existingNames.includes(candidate)) {
    suffix += 1;
    candidate = `${baseName}_${suffix}`;
  }

  return candidate;
}

export function buildDefaultSessionName({
  hostLabel,
  agentKind,
  launchMode,
  existingNames = [],
}: BuildDefaultSessionNameInput): string {
  const normalizedHost =
    normalizeSessionNameSegment(hostLabel, {
      allowDots: launchMode !== "tmux",
    }) || "host";
  const normalizedKind = normalizeSessionNameSegment(agentKind) || "shell";
  const transportLabel = launchMode === "tmux" ? "tmux" : "shell";

  return buildUniqueSessionName(
    `${normalizedHost}_${normalizedKind}_${transportLabel}`,
    existingNames,
  );
}
