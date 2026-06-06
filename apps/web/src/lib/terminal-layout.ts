export type TerminalMonitorLayoutMode = "single" | "dual" | "quad";

export interface TerminalMonitorSession {
  id: string;
}

export interface TerminalMonitorSlot {
  id: string;
  sessionId: string | null;
}

export interface NormalizeTerminalMonitorSlotsOptions {
  mode: TerminalMonitorLayoutMode;
  sessions: TerminalMonitorSession[];
  preferredSessionId?: string | null;
  preferredSlotId?: string | null;
  previousSlots?: TerminalMonitorSlot[];
}

const TERMINAL_MONITOR_SLOT_IDS = [
  "terminal-monitor-slot-1",
  "terminal-monitor-slot-2",
  "terminal-monitor-slot-3",
  "terminal-monitor-slot-4",
] as const;

export const TERMINAL_MONITOR_LAYOUT_OPTIONS: ReadonlyArray<{
  mode: TerminalMonitorLayoutMode;
  label: string;
  capacity: number;
}> = [
  { mode: "single", label: "单屏", capacity: 1 },
  { mode: "dual", label: "双屏", capacity: 2 },
  { mode: "quad", label: "四屏", capacity: 4 },
];

export function getTerminalMonitorLayoutCapacity(
  mode: TerminalMonitorLayoutMode,
): number {
  switch (mode) {
    case "dual":
      return 2;
    case "quad":
      return 4;
    case "single":
    default:
      return 1;
  }
}

export function isTerminalMonitorLayoutMode(
  value: unknown,
): value is TerminalMonitorLayoutMode {
  return value === "single" || value === "dual" || value === "quad";
}

export function getTerminalMonitorSlotIds(
  mode: TerminalMonitorLayoutMode,
): string[] {
  return TERMINAL_MONITOR_SLOT_IDS.slice(
    0,
    getTerminalMonitorLayoutCapacity(mode),
  );
}

export function normalizeTerminalMonitorSlots({
  mode,
  sessions,
  preferredSessionId,
  preferredSlotId,
  previousSlots = [],
}: NormalizeTerminalMonitorSlotsOptions): TerminalMonitorSlot[] {
  const sessionIds = sessions.map((session) => session.id);
  const availableSessionIds = new Set(sessionIds);
  const usedSessionIds = new Set<string>();
  const previousSlotById = new Map(
    previousSlots.map((slot) => [slot.id, slot]),
  );

  const slots = getTerminalMonitorSlotIds(mode).map((slotId, index) => {
    const previousSlot = previousSlotById.get(slotId) ?? previousSlots[index];
    const sessionId = previousSlot?.sessionId ?? null;
    if (
      !sessionId ||
      !availableSessionIds.has(sessionId) ||
      usedSessionIds.has(sessionId)
    ) {
      return { id: slotId, sessionId: null };
    }

    usedSessionIds.add(sessionId);
    return { id: slotId, sessionId };
  });

  const preferredIsAvailable =
    typeof preferredSessionId === "string" &&
    availableSessionIds.has(preferredSessionId);
  const preferredAlreadyVisible =
    preferredIsAvailable &&
    slots.some((slot) => slot.sessionId === preferredSessionId);

  if (preferredIsAvailable && !preferredAlreadyVisible) {
    const preferredSlotIndex = preferredSlotId
      ? slots.findIndex((slot) => slot.id === preferredSlotId)
      : -1;
    const emptySlotIndex = slots.findIndex((slot) => !slot.sessionId);
    const targetIndex =
      preferredSlotIndex >= 0
        ? preferredSlotIndex
        : emptySlotIndex >= 0
          ? emptySlotIndex
          : 0;
    const replacedSessionId = slots[targetIndex]?.sessionId;

    if (replacedSessionId) {
      usedSessionIds.delete(replacedSessionId);
    }
    slots[targetIndex] = {
      ...slots[targetIndex]!,
      sessionId: preferredSessionId,
    };
    usedSessionIds.add(preferredSessionId);
  }

  for (const slot of slots) {
    if (slot.sessionId) {
      continue;
    }

    const nextSessionId = sessionIds.find(
      (sessionId) => !usedSessionIds.has(sessionId),
    );
    if (!nextSessionId) {
      continue;
    }

    slot.sessionId = nextSessionId;
    usedSessionIds.add(nextSessionId);
  }

  return slots;
}

export function setTerminalMonitorSlotSession(
  slots: TerminalMonitorSlot[],
  slotId: string,
  sessionId: string,
): TerminalMonitorSlot[] {
  return slots.map((slot) => {
    if (slot.id === slotId) {
      return { ...slot, sessionId };
    }

    if (slot.sessionId === sessionId) {
      return { ...slot, sessionId: null };
    }

    return slot;
  });
}

export function areTerminalMonitorSlotsEqual(
  left: TerminalMonitorSlot[],
  right: TerminalMonitorSlot[],
): boolean {
  if (left.length !== right.length) {
    return false;
  }

  return left.every((slot, index) => {
    const other = right[index];
    return other?.id === slot.id && other.sessionId === slot.sessionId;
  });
}
