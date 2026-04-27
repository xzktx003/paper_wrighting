interface PassiveTerminalFocusRepairOptions {
  documentHasFocus: boolean;
  helperAvailable: boolean;
  helperFocused: boolean;
  intentionalExternalFocus: boolean;
  lastProtectedExternalFocusAt: number;
  lastTerminalIntentAt: number;
}

export function shouldRepairPassiveTerminalFocus(
  options: PassiveTerminalFocusRepairOptions,
): boolean {
  if (!options.documentHasFocus) {
    return false;
  }

  if (!options.helperAvailable || options.helperFocused) {
    return false;
  }

  if (options.intentionalExternalFocus) {
    return false;
  }

  return options.lastTerminalIntentAt > options.lastProtectedExternalFocusAt;
}
