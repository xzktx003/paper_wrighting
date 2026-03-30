import { getQuickTmuxShortcutLabel } from "../lib/platform-compat";

export function BottomBar() {
  const quickTmuxShortcutLabel = getQuickTmuxShortcutLabel();

  return (
    <footer className="bottom-bar">
      <span>双击卡片放大</span>
      <span>Esc 返回宫格</span>
      <span>{quickTmuxShortcutLabel} 快连 tmux</span>
      <span>Tab 切换焦点</span>
    </footer>
  );
}
