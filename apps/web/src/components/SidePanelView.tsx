import type { ReactNode } from "react";

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
  const className = [
    "side-panel-view",
    preserveMountedWhenInactive ? "side-panel-view--preserved" : "",
    active ? "side-panel-view--active" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div aria-hidden={!active} className={className}>
      {children}
    </div>
  );
}
