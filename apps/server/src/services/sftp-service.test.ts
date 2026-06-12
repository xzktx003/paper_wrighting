import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { Readable } from "node:stream";
import test from "node:test";

import {
  resolveSftpAuthenticationOptions,
  SftpService,
  type SftpAuthenticationDependencies,
} from "./sftp-service.js";

function createDependencies(
  existingFiles: string[],
): SftpAuthenticationDependencies {
  const files = new Set(existingFiles);
  return {
    homeDirectory: "/tmp/demo-home",
    env: {},
    fileExists: (pathValue) => files.has(pathValue),
    readFile: (pathValue) => Buffer.from(`key:${pathValue}`, "utf8"),
  };
}

class FakeSftpSession {
  directories = new Set<string>();
  directoryEntries = new Map<
    string,
    Array<{
      filename: string;
      longname: string;
      attrs: { mode: number; size: number; mtime: number };
    }>
  >();
  removedDirectories: string[] = [];
  removedFiles: string[] = [];
  readRanges: Array<{ start?: number; end?: number }> = [];

  end(): void {}

  stat(
    remotePath: string,
    callback: (
      error: Error | undefined,
      stats?: { mode: number; size: number; mtime: number },
    ) => void,
  ): void {
    if (this.directories.has(remotePath)) {
      callback(undefined, { mode: 0o040755, size: 0, mtime: 1_717_000_000 });
      return;
    }

    callback(undefined, { mode: 0o100644, size: 6, mtime: 1_717_000_000 });
  }

  realpath(
    remotePath: string,
    callback: (error: Error | undefined, resolvedPath?: string) => void,
  ): void {
    callback(undefined, remotePath === "." ? "/home/demo" : remotePath);
  }

  readdir(
    remotePath: string,
    callback: (
      error: Error | undefined,
      items?: Array<{
        filename: string;
        longname: string;
        attrs: { mode: number; size: number; mtime: number };
      }>,
    ) => void,
  ): void {
    callback(
      undefined,
      this.directoryEntries.get(remotePath) ?? [
        {
          filename: "workspace",
          longname: "drwxr-xr-x",
          attrs: { mode: 0o040755, size: 0, mtime: 1_717_000_000 },
        },
      ],
    );
  }

  chmod(
    _remotePath: string,
    _mode: number,
    callback: (error?: Error) => void,
  ): void {
    callback();
  }

  unlink(remotePath: string, callback: (error?: Error) => void): void {
    this.removedFiles.push(remotePath);
    callback();
  }

  rmdir(remotePath: string, callback: (error?: Error) => void): void {
    this.removedDirectories.push(remotePath);
    callback();
  }

  createReadStream(
    _remotePath: string,
    options?: { start?: number; end?: number },
  ): Readable {
    this.readRanges.push({
      start: options?.start,
      end: options?.end,
    });
    return Readable.from(Buffer.from("remote", "utf8").subarray(0, 1));
  }
}

class FakeSshClient extends EventEmitter {
  private ready = false;

  readonly session = new FakeSftpSession();

  connectCalls = 0;

  connect(): this {
    this.connectCalls += 1;
    setImmediate(() => {
      this.ready = true;
      this.emit("ready");
    });
    return this;
  }

  sftp(
    callback: (error: Error | undefined, sftp?: FakeSftpSession) => void,
  ): void {
    if (!this.ready) {
      callback(new Error("No response from server"));
      return;
    }

    callback(undefined, this.session);
  }

  end(): this {
    this.ready = false;
    return this;
  }
}

test("resolveSftpAuthenticationOptions prefers the explicit identity file", () => {
  const options = resolveSftpAuthenticationOptions(
    {
      host: "example.com",
      username: "demo",
      identityFile: "/tmp/explicit-key",
    },
    createDependencies(["/tmp/explicit-key", "/tmp/demo-home/.ssh/id_rsa"]),
  );

  assert.equal(options.privateKey?.toString("utf8"), "key:/tmp/explicit-key");
});

test("resolveSftpAuthenticationOptions falls back to the default ssh private key when no identity file is configured", () => {
  const options = resolveSftpAuthenticationOptions(
    {
      host: "example.com",
      username: "demo",
    },
    createDependencies(["/tmp/demo-home/.ssh/id_rsa"]),
  );

  assert.equal(
    options.privateKey?.toString("utf8"),
    "key:/tmp/demo-home/.ssh/id_rsa",
  );
});

test("resolveSftpAuthenticationOptions prefers standard default keys before unrelated custom keys", () => {
  const options = resolveSftpAuthenticationOptions(
    {
      host: "example.com",
      username: "demo",
    },
    createDependencies([
      "/tmp/demo-home/.ssh/id_ed25519_gerrit_houmo",
      "/tmp/demo-home/.ssh/id_rsa",
    ]),
  );

  assert.equal(
    options.privateKey?.toString("utf8"),
    "key:/tmp/demo-home/.ssh/id_rsa",
  );
});

test("list reuses a single pending connection safely for concurrent requests", async () => {
  const client = new FakeSshClient();
  const service = new SftpService(() => client as never);
  const target = {
    host: "example.com",
    username: "demo",
  };

  const results = await Promise.allSettled([
    service.list(target, "~"),
    service.list(target, "~"),
  ]);

  assert.deepEqual(
    results.map((result) => result.status),
    ["fulfilled", "fulfilled"],
  );
  assert.equal(client.connectCalls, 1);

  for (const result of results) {
    assert.equal(result.status, "fulfilled");
    assert.equal(result.value.path, "/home/demo");
    assert.equal(result.value.entries[0]?.name, "workspace");
  }
});

test("chmod rejects malformed octal modes before opening an SSH connection", async () => {
  const client = new FakeSshClient();
  const service = new SftpService(() => client as never);

  await assert.rejects(
    () =>
      service.chmod(
        {
          host: "example.com",
          username: "demo",
        },
        "/tmp/file.txt",
        "777abc",
      ),
    {
      message: /mode must be a 3 or 4 digit octal permission/,
    },
  );
  assert.equal(client.connectCalls, 0);
});

test("preview with zero maxBytes does not read the first remote byte", async () => {
  const client = new FakeSshClient();
  const service = new SftpService(() => client as never);

  const preview = await service.preview(
    {
      host: "example.com",
      username: "demo",
    },
    "/tmp/file.txt",
    0,
  );

  assert.equal(preview.content, "");
  assert.equal(preview.truncated, true);
  assert.deepEqual(client.session.readRanges, []);
});

test("preview with a non-finite maxBytes does not create a remote read range", async () => {
  const client = new FakeSshClient();
  const service = new SftpService(() => client as never);

  const preview = await service.preview(
    {
      host: "example.com",
      username: "demo",
    },
    "/tmp/file.txt",
    Number.NaN,
  );

  assert.equal(preview.content, "");
  assert.equal(preview.truncated, true);
  assert.deepEqual(client.session.readRanges, []);
});

test("remove skips dot directory entries during recursive SFTP deletion", async () => {
  const client = new FakeSshClient();
  const service = new SftpService(() => client as never);

  client.session.directories.add("/tmp/project");
  client.session.directoryEntries.set("/tmp/project", [
    {
      filename: ".",
      longname: "drwxr-xr-x",
      attrs: { mode: 0o040755, size: 0, mtime: 1_717_000_000 },
    },
    {
      filename: "..",
      longname: "drwxr-xr-x",
      attrs: { mode: 0o040755, size: 0, mtime: 1_717_000_000 },
    },
    {
      filename: "file.txt",
      longname: "-rw-r--r--",
      attrs: { mode: 0o100644, size: 4, mtime: 1_717_000_000 },
    },
  ]);

  await service.remove(
    {
      host: "example.com",
      username: "demo",
    },
    "/tmp/project",
  );

  assert.deepEqual(client.session.removedFiles, ["/tmp/project/file.txt"]);
  assert.deepEqual(client.session.removedDirectories, ["/tmp/project"]);
});
