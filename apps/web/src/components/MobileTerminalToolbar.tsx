import { MOBILE_TERMINAL_CONTROLS } from "../lib/mobile-terminal-controls";

interface MobileTerminalToolbarProps {
  disabled?: boolean;
  onSendInput: (input: string) => Promise<void> | void;
}

export function MobileTerminalToolbar({
  disabled = false,
  onSendInput,
}: MobileTerminalToolbarProps) {
  return (
    <div
      aria-label="手机终端快捷键"
      className="mobile-terminal-toolbar"
      role="toolbar"
    >
      {MOBILE_TERMINAL_CONTROLS.map((control) => (
        <button
          className={`mobile-terminal-key${control.danger ? " mobile-terminal-key--danger" : ""}`}
          disabled={disabled}
          key={control.id}
          onClick={() => void onSendInput(control.input)}
          title={control.description}
          type="button"
        >
          {control.label}
        </button>
      ))}
    </div>
  );
}
