import type { SshTarget } from "@agent-orchestrator/shared";

export interface BuildSshArgsOptions {
  batchMode?: boolean;
  clearAllForwardings?: boolean;
  connectTimeoutSeconds?: number;
  exitOnForwardFailure?: boolean;
  localForwardings?: Array<{
    bindAddress?: string;
    localPort: number;
    remoteHost: string;
    remotePort: number;
  }>;
  noCommand?: boolean;
  remoteCommand?: string;
  requestTty?: boolean;
}

function assertSafeSshField(name: string, value: string | undefined): void {
  if (!value) {
    return;
  }

  if (/\r|\n|\0/.test(value)) {
    throw new Error(`Invalid ${name}`);
  }
}

export function formatSshDestination(sshTarget: SshTarget): string {
  assertSafeSshField("host", sshTarget.host);
  assertSafeSshField("username", sshTarget.username);

  return sshTarget.username
    ? `${sshTarget.username}@${sshTarget.host}`
    : sshTarget.host;
}

export function buildSshArgs(
  sshTarget: SshTarget,
  options: BuildSshArgsOptions = {},
): string[] {
  assertSafeSshField("identity file", sshTarget.identityFile);
  assertSafeSshField("remote command", options.remoteCommand);
  for (const forward of options.localForwardings ?? []) {
    assertSafeSshField("local forward bind address", forward.bindAddress);
    assertSafeSshField("local forward host", forward.remoteHost);
  }

  const args: string[] = [];

  if (options.requestTty) {
    args.push("-t");
  }

  if (options.batchMode) {
    args.push("-o", "BatchMode=yes");
  }

  if (options.clearAllForwardings) {
    args.push("-o", "ClearAllForwardings=yes");
  }

  if (options.connectTimeoutSeconds) {
    args.push("-o", `ConnectTimeout=${options.connectTimeoutSeconds}`);
  }

  if (options.exitOnForwardFailure) {
    args.push("-o", "ExitOnForwardFailure=yes");
  }

  for (const forward of options.localForwardings ?? []) {
    const bindPrefix = forward.bindAddress ? `${forward.bindAddress}:` : "";
    args.push(
      "-L",
      `${bindPrefix}${forward.localPort}:${forward.remoteHost}:${forward.remotePort}`,
    );
  }

  if (options.noCommand) {
    args.push("-N");
  }

  if (sshTarget.port) {
    args.push("-p", String(sshTarget.port));
  }

  if (sshTarget.identityFile) {
    args.push("-i", sshTarget.identityFile);
  }

  args.push(formatSshDestination(sshTarget));

  if (options.remoteCommand) {
    args.push(options.remoteCommand);
  }

  return args;
}
