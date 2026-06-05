import { lazy } from "react";

export const LazyTerminalView = lazy(() =>
  import("./TerminalView").then(({ TerminalView }) => ({
    default: TerminalView,
  })),
);
