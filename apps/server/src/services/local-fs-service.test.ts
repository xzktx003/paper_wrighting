import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import { LocalFsService } from "./local-fs-service.js";

function createTempRoot(): string {
  return mkdtempSync(path.join(tmpdir(), "local-fs-service-"));
}

test("LocalFsService lists directories, filters hidden files, and previews text files", async () => {
  const rootDir = createTempRoot();
  const service = new LocalFsService();

  mkdirSync(path.join(rootDir, "folder"), { recursive: true });
  writeFileSync(path.join(rootDir, "visible.txt"), "hello from preview");
  writeFileSync(path.join(rootDir, ".secret"), "hidden");

  try {
    const hiddenOff = await service.list(rootDir, false);
    assert.equal(hiddenOff.path, rootDir);
    assert.equal(
      hiddenOff.entries.some((entry) => entry.name === ".secret"),
      false,
    );
    assert.equal(hiddenOff.entries[0]?.type, "directory");

    const hiddenOn = await service.list(rootDir, true);
    assert.equal(
      hiddenOn.entries.some((entry) => entry.name === ".secret"),
      true,
    );

    const preview = await service.preview(path.join(rootDir, "visible.txt"));
    assert.equal(preview.encoding, "utf8");
    assert.equal(preview.content, "hello from preview");
    assert.equal(preview.truncated, false);
  } finally {
    rmSync(rootDir, { recursive: true, force: true });
  }
});

test("LocalFsService creates, renames, chmods, and removes files", async () => {
  const rootDir = createTempRoot();
  const service = new LocalFsService();
  const originalPath = path.join(rootDir, "draft.txt");
  const renamedPath = path.join(rootDir, "final.txt");

  writeFileSync(originalPath, "draft");

  try {
    const createdDir = await service.mkdir(path.join(rootDir, "nested/child"));
    assert.equal(createdDir.endsWith(path.join("nested", "child")), true);

    const nextPath = await service.rename(originalPath, renamedPath);
    assert.equal(nextPath, renamedPath);

    await service.chmod(renamedPath, "0640");
    const afterChmod = await service.list(rootDir, true);
    const entry = afterChmod.entries.find(
      (candidate) => candidate.name === "final.txt",
    );
    assert.ok(entry);
    assert.equal(entry.permissions, "-rw-r-----");

    await service.remove(renamedPath);
    const afterDelete = await service.list(rootDir, true);
    assert.equal(
      afterDelete.entries.some((candidate) => candidate.name === "final.txt"),
      false,
    );
  } finally {
    rmSync(rootDir, { recursive: true, force: true });
  }
});

test("LocalFsService rejects chmod modes that are not complete octal permissions", async () => {
  const rootDir = createTempRoot();
  const service = new LocalFsService();
  const filePath = path.join(rootDir, "draft.txt");
  writeFileSync(filePath, "draft");

  try {
    await assert.rejects(() => service.chmod(filePath, "777abc"), {
      message: /mode must be a 3 or 4 digit octal permission/,
    });
    await assert.rejects(() => service.chmod(filePath, "888"), {
      message: /mode must be a 3 or 4 digit octal permission/,
    });
  } finally {
    rmSync(rootDir, { recursive: true, force: true });
  }
});

test("LocalFsService treats non-finite preview byte limits as an empty preview", async () => {
  const rootDir = createTempRoot();
  const service = new LocalFsService();
  const filePath = path.join(rootDir, "visible.txt");
  writeFileSync(filePath, "preview text");

  try {
    const preview = await service.preview(filePath, Number.NaN);

    assert.equal(preview.content, "");
    assert.equal(preview.truncated, true);
    assert.equal(preview.size, "preview text".length);
  } finally {
    rmSync(rootDir, { recursive: true, force: true });
  }
});
