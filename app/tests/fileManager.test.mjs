import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtemp, rm, readFile, writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import { listDir, readTextFile, writeTextFile, deleteFile, renameFile } from '../apps/backend/src/services/fileManager.js';

describe('File Manager', () => {
  let testDir;

  beforeAll(async () => {
    testDir = await mkdtemp(join(tmpdir(), 'fm-test-'));
    await writeFile(join(testDir, 'test.md'), '# Hello\n\nWorld');
    await mkdir(join(testDir, 'subdir'));
    await writeFile(join(testDir, 'subdir', 'nested.txt'), 'nested content');
  });

  afterAll(async () => {
    await rm(testDir, { recursive: true, force: true });
  });

  it('listDir returns files and directories', async () => {
    const entries = await listDir(testDir);
    const names = entries.map(e => e.name);
    expect(names).toContain('test.md');
    expect(names).toContain('subdir');
  });

  it('listDir entries have type field', async () => {
    const entries = await listDir(testDir);
    const file = entries.find(e => e.name === 'test.md');
    const dir = entries.find(e => e.name === 'subdir');
    expect(file.type).toBe('file');
    expect(dir.type).toBe('directory');
  });

  it('readTextFile returns file content', async () => {
    const content = await readTextFile(join(testDir, 'test.md'));
    expect(content).toBe('# Hello\n\nWorld');
  });

  it('writeTextFile creates/updates file', async () => {
    await writeTextFile(join(testDir, 'new.md'), '# New File');
    const content = await readTextFile(join(testDir, 'new.md'));
    expect(content).toBe('# New File');
  });

  it('deleteFile removes file', async () => {
    await writeTextFile(join(testDir, 'to-delete.md'), 'temp');
    await deleteFile(join(testDir, 'to-delete.md'));
    await expect(readTextFile(join(testDir, 'to-delete.md'))).rejects.toThrow();
  });

  it('renameFile moves file', async () => {
    await writeTextFile(join(testDir, 'old-name.md'), 'content');
    await renameFile(join(testDir, 'old-name.md'), join(testDir, 'new-name.md'));
    const content = await readTextFile(join(testDir, 'new-name.md'));
    expect(content).toBe('content');
    await expect(readTextFile(join(testDir, 'old-name.md'))).rejects.toThrow();
  });

  it('readTextFile throws for non-existent file', async () => {
    await expect(readTextFile(join(testDir, 'no-such-file.md'))).rejects.toThrow();
  });
});
