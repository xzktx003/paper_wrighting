export interface FileBrowserUiState {
  width: number;
  mainCollapsed: boolean;
  sideCollapsed: boolean;
}

const DEFAULT_FILE_BROWSER_UI_STATE: FileBrowserUiState = {
  mainCollapsed: false,
  sideCollapsed: false,
  width: 540,
};

export const FILE_BROWSER_MIN_WIDTH = 360;

export function parseFileBrowserUiState(raw: string | null): FileBrowserUiState {
  if (!raw) {
    return DEFAULT_FILE_BROWSER_UI_STATE;
  }

  try {
    const parsed = JSON.parse(raw) as Partial<FileBrowserUiState>;
    return {
      mainCollapsed:
        typeof parsed.mainCollapsed === "boolean"
          ? parsed.mainCollapsed
          : DEFAULT_FILE_BROWSER_UI_STATE.mainCollapsed,
      sideCollapsed:
        typeof parsed.sideCollapsed === "boolean"
          ? parsed.sideCollapsed
          : DEFAULT_FILE_BROWSER_UI_STATE.sideCollapsed,
      width:
        typeof parsed.width === "number" &&
        Number.isFinite(parsed.width) &&
        parsed.width >= FILE_BROWSER_MIN_WIDTH
          ? parsed.width
          : DEFAULT_FILE_BROWSER_UI_STATE.width,
    };
  } catch {
    return DEFAULT_FILE_BROWSER_UI_STATE;
  }
}
