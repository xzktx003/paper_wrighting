import { useEffect, useRef, type ReactNode } from "react";

interface SidePanelViewProps {
  active: boolean;
  children: ReactNode;
  preserveMountedWhenInactive?: boolean;
}

export function SidePanelView({
  active,
  children,
  preserveMountedWhenInactive = false,
}: SidePanelViewProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const className = [
    "side-panel-view",
    preserveMountedWhenInactive ? "side-panel-view--preserved" : "",
    active ? "side-panel-view--active" : "",
  ]
    .filter(Boolean)
    .join(" ");

  useEffect(() => {
    const node = rootRef.current;
    if (!node) {
      return;
    }

    if (active) {
      node.removeAttribute("inert");
      return;
    }

    node.setAttribute("inert", "");
    const activeElement = document.activeElement;
    if (activeElement instanceof HTMLElement && node.contains(activeElement)) {
      activeElement.blur();
    }
  }, [active]);

  const hiddenFocusProps = active ? {} : { inert: true };

  return (
    <div
      ref={rootRef}
      aria-hidden={!active}
      className={className}
      {...hiddenFocusProps}
    >
      {children}
    </div>
  );
}
