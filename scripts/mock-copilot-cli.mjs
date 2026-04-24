#!/usr/bin/env node
/**
 * Mock Copilot CLI TUI used by tests/e2e/copilot-focus.spec.ts.
 *
 * It mirrors the subset of the real Copilot CLI behaviour that matters for
 * keyboard focus regressions:
 *
 * 1. On startup the TUI blocks on a capability handshake. It sends a primary
 *    device attributes query (CSI c) and a DSR query (CSI 6n) and does not
 *    accept user input until xterm.js auto-answers both of them through the
 *    PTY. If those replies are filtered on the way to the PTY the TUI will
 *    sit there forever and the user cannot type — exactly the "starts up but
 *    never lets me type" failure mode reported on real Copilot CLI.
 * 2. Once the handshake succeeds the TUI enables focus tracking (DECSET
 *    1004) and then pauses keyboard intake whenever the terminal reports
 *    focus-out (CSI O). This is how real TUI chat boxes behave: if the
 *    terminal advertises "I am not focused" they silently drop keystrokes
 *    even though the PTY is still forwarding them. The mock exposes every
 *    received byte through "copilot-mock-focus-bytes:..." lines so tests
 *    can reason about whether stdin actually reached the PTY.
 * 3. Every completed line (terminated by CR or LF) is emitted as
 *    "copilot-mock-line:<content>" so tests can assert that user keystrokes
 *    made it into the TUI input box.
 *
 * The script always stays on the primary screen and never clears the
 * terminal so the Kanban replay surface remains inspectable during tests.
 */

const STATE = {
  handshakeDa: false,
  handshakeDsr: false,
  ready: false,
  focused: true,
  buffer: "",
};

function emit(line) {
  process.stdout.write(`${line}\r\n`);
}

function writeControl(payload) {
  process.stdout.write(payload);
}

if (process.stdin.isTTY) {
  process.stdin.setRawMode(true);
}

process.stdin.resume();

emit("copilot-mock-booting");

// Start handshake. xterm.js auto-answers these.
writeControl("\u001b[c"); // Primary DA
writeControl("\u001b[6n"); // DSR — cursor position report

// Enable focus tracking like the real Copilot TUI does after its prompt is
// mounted.
writeControl("\u001b[?1004h");

const HANDSHAKE_TIMEOUT_MS = 4000;
const handshakeTimeout = setTimeout(() => {
  if (!STATE.ready) {
    emit("copilot-mock-handshake-timeout");
  }
}, HANDSHAKE_TIMEOUT_MS);

function markHandshakeProgress() {
  if (STATE.handshakeDa && STATE.handshakeDsr && !STATE.ready) {
    STATE.ready = true;
    clearTimeout(handshakeTimeout);
    emit("copilot-mock-ready");
  }
}

function consumeControlSequences(text) {
  let remaining = text;

  while (remaining.length > 0) {
    // Primary DA reply: ESC [ ? 1 ; 2 c (xterm default) or ESC [ ? 6 c etc.
    const daMatch = remaining.match(/^\u001b\[\?[\d;]*c/);
    if (daMatch) {
      STATE.handshakeDa = true;
      emit(`copilot-mock-da-reply:${Buffer.from(daMatch[0]).toString("hex")}`);
      remaining = remaining.slice(daMatch[0].length);
      markHandshakeProgress();
      continue;
    }

    // Secondary DA reply should NOT reach us — the server filters it because
    // it pollutes shell prompts. Log it so regressions surface loudly.
    const secondaryDaMatch = remaining.match(/^\u001b\[>[\d;]*c/);
    if (secondaryDaMatch) {
      emit(
        `copilot-mock-unexpected-secondary-da:${Buffer.from(
          secondaryDaMatch[0],
        ).toString("hex")}`,
      );
      remaining = remaining.slice(secondaryDaMatch[0].length);
      continue;
    }

    // DSR cursor position reply: ESC [ <row> ; <col> R
    const dsrMatch = remaining.match(/^\u001b\[\d+;\d+R/);
    if (dsrMatch) {
      STATE.handshakeDsr = true;
      emit(`copilot-mock-dsr-reply:${Buffer.from(dsrMatch[0]).toString("hex")}`);
      remaining = remaining.slice(dsrMatch[0].length);
      markHandshakeProgress();
      continue;
    }

    // Focus in / focus out (xterm focus tracking mode).
    if (remaining.startsWith("\u001b[I")) {
      STATE.focused = true;
      emit("copilot-mock-focus-in");
      remaining = remaining.slice(3);
      continue;
    }

    if (remaining.startsWith("\u001b[O")) {
      STATE.focused = false;
      emit("copilot-mock-focus-out");
      remaining = remaining.slice(3);
      continue;
    }

    return remaining;
  }

  return remaining;
}

process.stdin.on("data", (chunk) => {
  const text = chunk.toString("latin1");
  emit(`copilot-mock-bytes:${Buffer.from(text, "latin1").toString("hex")}`);

  let residual = consumeControlSequences(text);

  if (!STATE.ready) {
    emit("copilot-mock-blocked-preready");
    return;
  }

  if (!STATE.focused) {
    emit("copilot-mock-blocked-unfocused");
    return;
  }

  for (const char of residual) {
    if (char === "\r" || char === "\n") {
      emit(`copilot-mock-line:${STATE.buffer}`);
      STATE.buffer = "";
      continue;
    }

    if (char === "\u0003") {
      emit("copilot-mock-sigint");
      process.exit(0);
    }

    if (char === "\u007f") {
      STATE.buffer = STATE.buffer.slice(0, -1);
      continue;
    }

    // Ignore remaining control characters — real Copilot just redraws.
    if (char < " ") {
      continue;
    }

    STATE.buffer += char;
  }
});

process.on("SIGTERM", () => process.exit(0));
process.on("SIGHUP", () => process.exit(0));
