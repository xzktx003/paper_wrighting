import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { resolveLocalWorkingDirectory } from "./resolve-local-working-directory.js";

test("resolveLocalWorkingDirectory keeps existing absolute directories", () => {
  const directory = mkdtempSync(path.join(os.tmpdir(), "kanban-cwd-"));

  assert.equal(resolveLocalWorkingDirectory(directory), directory);
});

test("resolveLocalWorkingDirectory falls back for missing absolute directories", () => {
  assert.equal(
    resolveLocalWorkingDirectory(
      path.join(os.tmpdir(), `missing-kanban-cwd-${Date.now()}`),
    ),
    process.cwd(),
  );
});

test("resolveLocalWorkingDirectory falls back for missing relative directories", () => {
  assert.equal(
    resolveLocalWorkingDirectory(`missing-kanban-cwd-${Date.now()}`),
    process.cwd(),
  );
});

test("resolveLocalWorkingDirectory falls back for traversal segments", () => {
  assert.equal(resolveLocalWorkingDirectory("../outside"), process.cwd());
  assert.equal(resolveLocalWorkingDirectory("nested/../outside"), process.cwd());
});

test("resolveLocalWorkingDirectory falls back for invalid path characters", () => {
  assert.equal(resolveLocalWorkingDirectory("project\u0000name"), process.cwd());
  assert.equal(resolveLocalWorkingDirectory("project\nname"), process.cwd());
});

test("resolveLocalWorkingDirectory expands the home directory shortcut", () => {
  assert.equal(resolveLocalWorkingDirectory("~"), os.homedir());
  assert.equal(resolveLocalWorkingDirectory("~/"), os.homedir());
});
