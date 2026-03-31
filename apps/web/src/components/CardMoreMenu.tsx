import { useEffect, useRef, useState } from "react";

interface CardMoreMenuProps {
  sessionId: string;
  isTmux: boolean;
  onCopyConnectCommand: (id: string) => void;
}

export function CardMoreMenu({
  sessionId,
  isTmux,
  onCopyConnectCommand,
}: CardMoreMenuProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  return (
    <div className="card-more-menu" ref={ref}>
      <button
        className="card-more-menu-trigger"
        onClick={(e) => {
          e.stopPropagation();
          setOpen(!open);
        }}
        aria-label="更多操作"
      >
        ···
      </button>
      {open && (
        <div className="card-more-menu-dropdown">
          {isTmux && (
            <button
              className="card-more-menu-item"
              onClick={(e) => {
                e.stopPropagation();
                setOpen(false);
                onCopyConnectCommand(sessionId);
              }}
            >
              📋 复制连接命令
            </button>
          )}
        </div>
      )}
    </div>
  );
}
