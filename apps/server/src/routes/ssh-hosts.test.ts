import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import { buildServer } from "../app.js";

function makeTempDir(prefix: string): string {
  return mkdtempSync(path.join(tmpdir(), prefix));
}

async function buildApp() {
  const { app } = buildServer();
  await app.ready();
  return app;
}

test("POST /api/directory-suggestions returns local directory candidates for the typed prefix", async () => {
  const app = await buildApp();
  const rootDir = makeTempDir("directory-suggestions-");
  const projectsDir = path.join(rootDir, "projects");

  mkdirSync(path.join(projectsDir, "app-one"), { recursive: true });
  mkdirSync(path.join(projectsDir, "app-two"), { recursive: true });
  mkdirSync(path.join(projectsDir, "docs"), { recursive: true });

  try {
    const res = await app.inject({
      method: "POST",
      url: "/api/directory-suggestions",
      payload: {
        prefix: path.join(projectsDir, "app"),
      },
    });

    assert.equal(res.statusCode, 200);

    const body = JSON.parse(res.payload);
    assert.equal(body.enabled, true);
    assert.deepEqual(body.suggestions, [
      path.join(projectsDir, "app-one"),
      path.join(projectsDir, "app-two"),
    ]);
  } finally {
    rmSync(rootDir, { recursive: true, force: true });
    await app.close();
  }
});

test("POST /api/directory-suggestions disables remote suggestions when passwordless SSH is unavailable", async () => {
  const app = await buildApp();

  try {
    const res = await app.inject({
      method: "POST",
      url: "/api/directory-suggestions",
      payload: {
        prefix: "/data01/home/hou",
        sshTarget: {
          host: "127.0.0.1",
          port: 1,
          username: "nobody",
        },
      },
    });

    assert.equal(res.statusCode, 200);

    const body = JSON.parse(res.payload);
    assert.equal(body.enabled, false);
    assert.deepEqual(body.suggestions, []);
  } finally {
    await app.close();
  }
});

test("POST /api/directory-suggestions rejects missing or non-string prefixes as client errors", async () => {
  const app = await buildApp();

  try {
    for (const payload of [{}, { prefix: 42 }]) {
      const res = await app.inject({
        method: "POST",
        url: "/api/directory-suggestions",
        payload,
      });

      assert.equal(res.statusCode, 400);
      assert.match(JSON.parse(res.payload).error, /prefix must be a string/);
    }
  } finally {
    await app.close();
  }
});

test("POST /api/directory-suggestions rejects malformed ssh targets as client errors", async () => {
  const app = await buildApp();

  try {
    const invalidRequests = [
      {
        prefix: "/tmp",
        sshTarget: "example.test",
      },
      {
        prefix: "/tmp",
        sshTarget: {
          host: "",
        },
      },
      {
        prefix: "/tmp",
        sshTarget: {
          host: "example.test",
          port: "22",
        },
      },
      {
        prefix: "/tmp",
        sshTarget: {
          host: "example.test\n-oProxyCommand=sh",
        },
      },
      {
        prefix: "/tmp",
        sshTarget: {
          host: "example.test",
          username: "demo\ruser",
        },
      },
    ];

    for (const payload of invalidRequests) {
      const res = await app.inject({
        method: "POST",
        url: "/api/directory-suggestions",
        payload,
      });

      assert.equal(res.statusCode, 400);
      assert.match(JSON.parse(res.payload).error, /sshTarget/);
    }
  } finally {
    await app.close();
  }
});
