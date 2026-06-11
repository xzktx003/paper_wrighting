import { useState } from "react";

import {
  buildMobileComposerInputFrames,
  type MobileComposerSendMode,
} from "../lib/mobile-terminal-controls";

interface MobileAgentComposerProps {
  disabled?: boolean;
  onSendInput: (input: string) => Promise<void> | void;
}

export function MobileAgentComposer({
  disabled = false,
  onSendInput,
}: MobileAgentComposerProps) {
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);

  const send = async (mode: MobileComposerSendMode) => {
    if (!text || disabled || sending) {
      return;
    }

    setSending(true);
    try {
      for (const input of buildMobileComposerInputFrames(text, mode)) {
        await onSendInput(input);
      }
      setText("");
    } finally {
      setSending(false);
    }
  };

  return (
    <form
      className="mobile-agent-composer"
      onSubmit={(event) => {
        event.preventDefault();
        void send("send");
      }}
    >
      <textarea
        className="mobile-agent-composer-input"
        disabled={disabled || sending}
        onChange={(event) => setText(event.target.value)}
        placeholder="输入给 Codex / Agent 的内容"
        rows={3}
        value={text}
      />
      <div className="mobile-agent-composer-actions">
        <button
          className="mobile-agent-composer-btn mobile-agent-composer-btn--primary"
          disabled={!text || disabled || sending}
          type="submit"
        >
          发送
        </button>
        <button
          className="mobile-agent-composer-btn"
          disabled={!text || disabled || sending}
          onClick={() => void send("paste")}
          type="button"
        >
          粘贴
        </button>
        <button
          className="mobile-agent-composer-btn"
          disabled={!text || disabled || sending}
          onClick={() => void send("paste-run")}
          type="button"
        >
          粘贴执行
        </button>
      </div>
    </form>
  );
}
