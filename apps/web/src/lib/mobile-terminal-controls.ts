export type MobileTerminalControlId =
  | "interrupt"
  | "escape"
  | "tab"
  | "enter"
  | "eof"
  | "arrow-up"
  | "arrow-down"
  | "arrow-left"
  | "arrow-right"
  | "clear"
  | "line-start"
  | "line-end";

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
    label: "中断",
    input: "\x03",
    description: "等价 Ctrl+C，停止当前输出或命令",
    danger: true,
  },
  {
    id: "escape",
    label: "Esc",
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
    id: "enter",
    label: "Enter",
    input: "\r",
    description: "提交当前输入",
  },
  {
    id: "eof",
    label: "EOF",
    input: "\x04",
    description: "等价 Ctrl+D，结束输入流",
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
    label: "清屏",
    input: "\x0c",
    description: "等价 Ctrl+L",
  },
  {
    id: "line-start",
    label: "行首",
    input: "\x01",
    description: "等价 Ctrl+A",
  },
  {
    id: "line-end",
    label: "行尾",
    input: "\x05",
    description: "等价 Ctrl+E",
  },
];

export type MobileComposerSendMode = "send" | "paste" | "paste-run";

export function buildMobileComposerInput(
  text: string,
  mode: MobileComposerSendMode,
): string {
  const normalized = text.replace(/\r\n/g, "\n");

  if (mode === "paste") {
    return normalized;
  }

  return /[\r\n]$/.test(normalized) ? normalized : `${normalized}\r`;
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
