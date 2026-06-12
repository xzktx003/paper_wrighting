export type ViewMode = "grid" | "focus";

export interface FocusViewState {
  focusedId: string | null;
  viewMode: ViewMode;
}

export function defaultFocusViewState(): FocusViewState {
  return {
    focusedId: null,
    viewMode: "grid",
  };
}

export function parseFocusViewState(raw: string | null): FocusViewState {
  if (!raw) {
    return defaultFocusViewState();
  }

  try {
    const parsed = JSON.parse(raw) as Partial<FocusViewState>;
    const focusedId =
      typeof parsed.focusedId === "string" ? parsed.focusedId.trim() : "";
    return {
      focusedId: focusedId || null,
      viewMode: parsed.viewMode === "focus" ? "focus" : "grid",
    };
  } catch {
    return defaultFocusViewState();
  }
}
