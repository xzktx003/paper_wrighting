export type MobileTerminalControlId =
  | "interrupt"
  | "escape"
  | "tab"
  | "shift-tab"
  | "enter"
  | "eof"
  | "arrow-up"
  | "arrow-down"
  | "arrow-left"
  | "arrow-right"
  | "clear"
  | "ctrl-u"
  | "ctrl-w"
  | "ctrl-k"
  | "ctrl-y"
  | "ctrl-a"
  | "ctrl-o"
  | "ctrl-e";

export interface MobileTerminalControl {
  id: MobileTerminalControlId;
  label: string;
  input: string;
  description: string;
  danger?: boolean;
}

export const MOBILE_TERMINAL_CONTROLS: MobileTerminalControl[] = [
  {
    id: "interrupt",
    label: "Ctrl+C",
    input: "\x03",
    description: "中断当前输出或命令",
    danger: true,
  },
  {
    id: "escape",
    label: "ESC",
    input: "\x1b",
    description: "退出 TUI 当前状态",
  },
  {
    id: "tab",
    label: "Tab",
    input: "\t",
    description: "补全或切换焦点",
  },
  {
    id: "shift-tab",
    label: "Shift+Tab",
    input: "\x1b[Z",
    description: "反向切换 TUI 焦点，适用于 Claude / Copilot 表单导航",
  },
  {
    id: "enter",
    label: "Enter",
    input: "\r",
    description: "提交当前输入",
  },
  {
    id: "eof",
    label: "Ctrl+D",
    input: "\x04",
    description: "结束输入流",
  },
  {
    id: "arrow-up",
    label: "↑",
    input: "\x1b[A",
    description: "方向键上",
  },
  {
    id: "arrow-down",
    label: "↓",
    input: "\x1b[B",
    description: "方向键下",
  },
  {
    id: "arrow-left",
    label: "←",
    input: "\x1b[D",
    description: "方向键左",
  },
  {
    id: "arrow-right",
    label: "→",
    input: "\x1b[C",
    description: "方向键右",
  },
  {
    id: "clear",
    label: "Ctrl+L",
    input: "\x0c",
    description: "清屏",
  },
  {
    id: "ctrl-u",
    label: "Ctrl+U",
    input: "\x15",
    description: "删除光标前内容",
  },
  {
    id: "ctrl-w",
    label: "Ctrl+W",
    input: "\x17",
    description: "删除光标前一个词",
  },
  {
    id: "ctrl-k",
    label: "Ctrl+K",
    input: "\x0b",
    description: "删除光标后内容",
  },
  {
    id: "ctrl-y",
    label: "Ctrl+Y",
    input: "\x19",
    description: "粘回刚删除的内容",
  },
  {
    id: "ctrl-a",
    label: "Ctrl+A",
    input: "\x01",
    description: "移动到行首",
  },
  {
    id: "ctrl-o",
    label: "Ctrl+O",
    input: "\x0f",
    description: "触发 Claude / Copilot 常用的面板或模式快捷键",
  },
  {
    id: "ctrl-e",
    label: "Ctrl+E",
    input: "\x05",
    description: "移动到行尾或触发 Agent CLI 快捷操作",
  },
];

export type MobileComposerSendMode = "send" | "paste" | "paste-run";

const BRACKETED_PASTE_START = "\x1b[200~";
const BRACKETED_PASTE_END = "\x1b[201~";

function normalizeComposerText(text: string): string {
  return text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
}

export function buildMobileComposerInput(
  text: string,
  mode: MobileComposerSendMode,
): string {
  return buildMobileComposerInputFrames(text, mode).join("");
}

export function buildMobileComposerInputFrames(
  text: string,
  mode: MobileComposerSendMode,
): string[] {
  const normalized = normalizeComposerText(text);

  if (mode === "paste") {
    return [normalized];
  }

  const pastedPrompt = normalized.replace(/\n+$/g, "");
  return [
    `${BRACKETED_PASTE_START}${pastedPrompt}${BRACKETED_PASTE_END}`,
    "\r",
  ];
}

export function getMobileTerminalControlInput(
  id: MobileTerminalControlId,
): string {
  const control = MOBILE_TERMINAL_CONTROLS.find((item) => item.id === id);
  if (!control) {
    throw new Error(`Unknown mobile terminal control: ${id}`);
  }
  return control.input;
}
