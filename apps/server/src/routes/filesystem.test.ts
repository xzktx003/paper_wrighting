import assert from "node:assert/strict";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import { buildServer } from "../app.js";

function createTempRoot(): string {
  return mkdtempSync(path.join(tmpdir(), "filesystem-routes-"));
}

function buildMultipartPayload(
  fields: Record<string, string>,
  files: Array<{ fieldName: string; filename: string; content: string }> = [],
  boundary = "----filesystem-routes-test",
): { body: string; contentType: string } {
  const parts = Object.entries(fields).map(
    ([name, value]) =>
      `--${boundary}\r\nContent-Disposition: form-data; name="${name}"\r\n\r\n${value}\r\n`,
  );
  parts.push(
    ...files.map(
      ({ fieldName, filename, content }) =>
        `--${boundary}\r\nContent-Disposition: form-data; name="${fieldName}"; filename="${filename}"\r\nContent-Type: text/plain\r\n\r\n${content}\r\n`,
    ),
  );
  return {
    body: `${parts.join("")}--${boundary}--\r\n`,
    contentType: `multipart/form-data; boundary=${boundary}`,
  };
}

test("filesystem routes list, preview, rename, and delete local files", async () => {
  const rootDir = createTempRoot();
  const sourcePath = path.join(rootDir, "example.txt");
  const renamedPath = path.join(rootDir, "renamed.txt");
  writeFileSync(sourcePath, "route preview");

  const { app } = buildServer();
  await app.ready();

  try {
    const listRes = await app.inject({
      method: "POST",
      url: "/api/fs/list",
      payload: {
        path: rootDir,
        showHidden: true,
      },
    });
    assert.equal(listRes.statusCode, 200);
    assert.equal(
      JSON.parse(listRes.payload).entries.some(
        (entry: { name: string }) => entry.name === "example.txt",
      ),
      true,
    );

    const previewRes = await app.inject({
      method: "POST",
      url: "/api/fs/preview",
      payload: {
        path: sourcePath,
      },
    });
    assert.equal(previewRes.statusCode, 200);
    assert.equal(JSON.parse(previewRes.payload).content, "route preview");

    const renameRes = await app.inject({
      method: "POST",
      url: "/api/fs/operation",
      payload: {
        operation: "rename",
        path: sourcePath,
        newPath: renamedPath,
      },
    });
    assert.equal(renameRes.statusCode, 200);

    const downloadRes = await app.inject({
      method: "POST",
      url: "/api/fs/download",
      payload: {
        path: renamedPath,
      },
    });
    assert.equal(downloadRes.statusCode, 200);
    assert.equal(downloadRes.body, "route preview");

    const deleteRes = await app.inject({
      method: "POST",
      url: "/api/fs/operation",
      payload: {
        operation: "delete",
        path: renamedPath,
      },
    });
    assert.equal(deleteRes.statusCode, 200);

    const listAfterDeleteRes = await app.inject({
      method: "POST",
      url: "/api/fs/list",
      payload: {
        path: rootDir,
        showHidden: true,
      },
    });
    assert.equal(listAfterDeleteRes.statusCode, 200);
    assert.equal(
      JSON.parse(listAfterDeleteRes.payload).entries.some(
        (entry: { name: string }) => entry.name === "renamed.txt",
      ),
      false,
    );
  } finally {
    rmSync(rootDir, { recursive: true, force: true });
    await app.close();
  }
});

test("filesystem download sanitizes quoted filenames in response headers", async () => {
  const rootDir = createTempRoot();
  const quotedPath = path.join(rootDir, 'bad"name.txt');
  writeFileSync(quotedPath, "quoted download");

  const { app } = buildServer();
  await app.ready();

  try {
    const response = await app.inject({
      method: "POST",
      url: "/api/fs/download",
      payload: {
        path: quotedPath,
      },
    });

    assert.equal(response.statusCode, 200);
    assert.equal(
      response.headers["content-disposition"],
      'attachment; filename="bad_name.txt"',
    );
    assert.equal(response.body, "quoted download");
  } finally {
    rmSync(rootDir, { recursive: true, force: true });
    await app.close();
  }
});

test("filesystem routes delegate remote list requests to the SFTP service", async () => {
  const calls: Array<{ path: string; showHidden?: boolean }> = [];
  const fakeSftpService = {
    list: async (_target: unknown, pathValue: string, showHidden?: boolean) => {
      calls.push({ path: pathValue, showHidden });
      return {
        path: "/remote/home",
        entries: [],
      };
    },
    mkdir: async () => "/remote/home/new-dir",
    rename: async () => "/remote/home/renamed",
    remove: async () => {},
    preview: async () => ({
      path: "/remote/home/file.txt",
      content: "remote",
      encoding: "utf8" as const,
      truncated: false,
      size: 6,
      mimeType: "text/plain",
    }),
    chmod: async () => {},
    createReadStream: async () => {
      throw new Error("not used");
    },
    createWriteStream: async () => {
      throw new Error("not used");
    },
  };

  const { app } = buildServer({
    sftpService: fakeSftpService as never,
  });
  await app.ready();

  try {
    const res = await app.inject({
      method: "POST",
      url: "/api/fs/list",
      payload: {
        path: "~",
        showHidden: true,
        sshTarget: {
          host: "example.com",
          port: 22,
          username: "demo",
        },
      },
    });

    assert.equal(res.statusCode, 200);
    assert.deepEqual(calls, [{ path: "~", showHidden: true }]);
  } finally {
    await app.close();
  }
});

test("filesystem routes keep distinct SSH identities separate in the SFTP service contract", async () => {
  const calls: string[] = [];
  const fakeSftpService = {
    list: async (target: { identityFile?: string }, pathValue: string) => {
      calls.push(`${target.identityFile ?? ""}:${pathValue}`);
      return {
        path: "/remote/home",
        entries: [],
      };
    },
    mkdir: async () => "/remote/home/new-dir",
    rename: async () => "/remote/home/renamed",
    remove: async () => {},
    preview: async () => ({
      path: "/remote/home/file.txt",
      content: "remote",
      encoding: "utf8" as const,
      truncated: false,
      size: 6,
      mimeType: "text/plain",
    }),
    chmod: async () => {},
    createReadStream: async () => {
      throw new Error("not used");
    },
    createWriteStream: async () => {
      throw new Error("not used");
    },
  };

  const { app } = buildServer({
    sftpService: fakeSftpService as never,
  });
  await app.ready();

  try {
    await app.inject({
      method: "POST",
      url: "/api/fs/list",
      payload: {
        path: "~",
        sshTarget: {
          host: "example.com",
          port: 22,
          username: "demo",
          identityFile: "/tmp/key-a",
        },
      },
    });

    await app.inject({
      method: "POST",
      url: "/api/fs/list",
      payload: {
        path: "~",
        sshTarget: {
          host: "example.com",
          port: 22,
          username: "demo",
          identityFile: "/tmp/key-b",
        },
      },
    });

    assert.deepEqual(calls, ["/tmp/key-a:~", "/tmp/key-b:~"]);
  } finally {
    await app.close();
  }
});

test("filesystem chmod rejects malformed modes as a client error", async () => {
  const rootDir = createTempRoot();
  const sourcePath = path.join(rootDir, "example.txt");
  writeFileSync(sourcePath, "route preview");

  const { app } = buildServer();
  await app.ready();

  try {
    const chmodRes = await app.inject({
      method: "POST",
      url: "/api/fs/chmod",
      payload: {
        path: sourcePath,
        mode: "777abc",
      },
    });

    assert.equal(chmodRes.statusCode, 400);
    assert.match(
      JSON.parse(chmodRes.payload).error,
      /mode must be a 3 or 4 digit octal permission/,
    );
  } finally {
    rmSync(rootDir, { recursive: true, force: true });
    await app.close();
  }
});

test("filesystem routes map invalid local paths to client errors", async () => {
  const { app } = buildServer();
  await app.ready();

  try {
    const previewRes = await app.inject({
      method: "POST",
      url: "/api/fs/preview",
      payload: {
        path: "bad\npath.txt",
      },
    });

    assert.equal(previewRes.statusCode, 400);
    assert.match(JSON.parse(previewRes.payload).error, /invalid characters/);
  } finally {
    await app.close();
  }
});

test("filesystem JSON routes reject malformed request bodies as client errors", async () => {
  const { app } = buildServer();
  await app.ready();

  try {
    const invalidRequests = [
      {
        url: "/api/fs/list",
        payload: {
          path: 42,
        },
      },
      {
        url: "/api/fs/list",
        payload: {
          path: process.cwd(),
          showHidden: "true",
        },
      },
      {
        url: "/api/fs/list",
        payload: {
          path: "~",
          sshTarget: {
            host: "example.test",
            port: 70_000,
          },
        },
      },
      {
        url: "/api/fs/list",
        payload: {
          path: "~",
          sshTarget: {
            host: "example.test\n-oProxyCommand=sh",
          },
        },
      },
      {
        url: "/api/fs/list",
        payload: {
          path: "~",
          sshTarget: {
            host: "example.test",
            username: "demo\ruser",
          },
        },
      },
      {
        url: "/api/fs/operation",
        payload: {
          operation: "copy",
          path: process.cwd(),
        },
      },
      {
        url: "/api/fs/operation",
        payload: {
          operation: "rename",
          path: process.cwd(),
          newPath: 42,
        },
      },
      {
        url: "/api/fs/preview",
        payload: {
          path: process.cwd(),
          maxBytes: -1,
        },
      },
      {
        url: "/api/fs/chmod",
        payload: {
          path: process.cwd(),
          mode: 755,
        },
      },
      {
        url: "/api/fs/download",
        payload: {
          path: {},
        },
      },
    ];

    for (const { url, payload } of invalidRequests) {
      const response = await app.inject({
        method: "POST",
        url,
        payload,
      });

      assert.equal(response.statusCode, 400, `${url} should reject payload`);
      assert.match(
        JSON.parse(response.payload).error,
        /must|required|contains invalid characters/,
      );
    }
  } finally {
    await app.close();
  }
});

test("filesystem upload rejects malformed relativePaths JSON as a client error", async () => {
  const { app } = buildServer();
  await app.ready();
  const multipart = buildMultipartPayload({
    path: "/tmp",
    relativePaths: "{not-json",
  });

  try {
    const uploadRes = await app.inject({
      method: "POST",
      url: "/api/fs/upload",
      headers: {
        "content-type": multipart.contentType,
      },
      payload: multipart.body,
    });

    assert.equal(uploadRes.statusCode, 400);
    assert.match(JSON.parse(uploadRes.payload).error, /valid JSON/);
  } finally {
    await app.close();
  }
});

test("filesystem upload rejects malformed sshTarget metadata as a client error", async () => {
  const { app } = buildServer();
  await app.ready();
  const multipart = buildMultipartPayload({
    path: "/tmp",
    sshTarget: JSON.stringify({ host: "example.test", port: "22" }),
  });

  try {
    const uploadRes = await app.inject({
      method: "POST",
      url: "/api/fs/upload",
      headers: {
        "content-type": multipart.contentType,
      },
      payload: multipart.body,
    });

    assert.equal(uploadRes.statusCode, 400);
    assert.match(JSON.parse(uploadRes.payload).error, /port must be an integer/);
  } finally {
    await app.close();
  }
});

test("filesystem upload rejects sshTarget metadata with control characters", async () => {
  const { app } = buildServer();
  await app.ready();
  const multipart = buildMultipartPayload({
    path: "/tmp",
    sshTarget: JSON.stringify({
      host: "example.test\n-oProxyCommand=sh",
    }),
  });

  try {
    const uploadRes = await app.inject({
      method: "POST",
      url: "/api/fs/upload",
      headers: {
        "content-type": multipart.contentType,
      },
      payload: multipart.body,
    });

    assert.equal(uploadRes.statusCode, 400);
    assert.match(JSON.parse(uploadRes.payload).error, /sshTarget\.host/);
  } finally {
    await app.close();
  }
});

test("filesystem upload rejects non-string relativePaths entries as a client error", async () => {
  const { app } = buildServer();
  await app.ready();
  const multipart = buildMultipartPayload({
    path: "/tmp",
    relativePaths: JSON.stringify(["ok.txt", 42]),
  });

  try {
    const uploadRes = await app.inject({
      method: "POST",
      url: "/api/fs/upload",
      headers: {
        "content-type": multipart.contentType,
      },
      payload: multipart.body,
    });

    assert.equal(uploadRes.statusCode, 400);
    assert.match(JSON.parse(uploadRes.payload).error, /array of strings/);
  } finally {
    await app.close();
  }
});

test("filesystem upload rejects escaping relativePaths before creating parent directories", async () => {
  const rootDir = createTempRoot();
  const targetDir = path.join(rootDir, "target");
  const escapedDir = path.join(rootDir, "escape");
  mkdirSync(targetDir, { recursive: true });

  const { app } = buildServer();
  await app.ready();
  const multipart = buildMultipartPayload(
    {
      path: targetDir,
      relativePaths: JSON.stringify(["../escape/file.txt"]),
    },
    [{ fieldName: "files", filename: "file.txt", content: "escape" }],
  );

  try {
    const uploadRes = await app.inject({
      method: "POST",
      url: "/api/fs/upload",
      headers: {
        "content-type": multipart.contentType,
      },
      payload: multipart.body,
    });

    assert.equal(uploadRes.statusCode, 400);
    assert.match(JSON.parse(uploadRes.payload).error, /relativePaths/);
    assert.equal(existsSync(escapedDir), false);
  } finally {
    rmSync(rootDir, { recursive: true, force: true });
    await app.close();
  }
});

test("filesystem upload rejects malformed filenames before opening write streams", async () => {
  const rootDir = createTempRoot();
  const targetDir = path.join(rootDir, "target");
  mkdirSync(targetDir, { recursive: true });

  const { app } = buildServer();
  await app.ready();
  const multipart = buildMultipartPayload(
    {
      path: targetDir,
    },
    [{ fieldName: "files", filename: "", content: "escape" }],
  );

  try {
    const uploadRes = await app.inject({
      method: "POST",
      url: "/api/fs/upload",
      headers: {
        "content-type": multipart.contentType,
      },
      payload: multipart.body,
    });

    assert.equal(uploadRes.statusCode, 400);
    assert.match(JSON.parse(uploadRes.payload).error, /filename/);
  } finally {
    rmSync(rootDir, { recursive: true, force: true });
    await app.close();
  }
});
