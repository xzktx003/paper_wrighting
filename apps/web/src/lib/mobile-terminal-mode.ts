export interface MobileTerminalTouchSignals {
  maxTouchPoints?: number;
  pointerCoarse: boolean;
}

export function shouldEnableMobileTerminalTouchMode({
  maxTouchPoints = 0,
  pointerCoarse,
}: MobileTerminalTouchSignals): boolean {
  return pointerCoarse || maxTouchPoints > 0;
}
