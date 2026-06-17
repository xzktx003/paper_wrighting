import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtemp, rm, writeFile } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import { executeScript, executeCommand } from '../apps/backend/src/services/codeExecutor.js';

describe('Code Executor', () => {
  let testDir;

  beforeAll(async () => {
    testDir = await mkdtemp(join(tmpdir(), 'code-test-'));
  });

  afterAll(async () => {
    await rm(testDir, { recursive: true, force: true });
  });

  it('executeCommand runs shell command and returns stdout', async () => {
    const result = await executeCommand('echo "hello world"', { cwd: testDir });
    expect(result.stdout.trim()).toBe('hello world');
    expect(result.code).toBe(0);
  });

  it('executeCommand captures stderr', async () => {
    const result = await executeCommand('echo "error" >&2', { cwd: testDir });
    expect(result.stderr.trim()).toBe('error');
  });

  it('executeCommand returns non-zero exit code on failure', async () => {
    const result = await executeCommand('exit 1', { cwd: testDir });
    expect(result.code).toBe(1);
  });

  it('executeScript runs Python script', async () => {
    const scriptPath = join(testDir, 'test.py');
    await writeFile(scriptPath, 'print("hello from python")');
    const result = await executeScript(scriptPath, { cwd: testDir });
    expect(result.stdout.trim()).toBe('hello from python');
    expect(result.code).toBe(0);
  });

  it('executeScript runs shell script', async () => {
    const scriptPath = join(testDir, 'test.sh');
    await writeFile(scriptPath, 'echo "hello from shell"');
    const result = await executeScript(scriptPath, { cwd: testDir });
    expect(result.stdout.trim()).toBe('hello from shell');
    expect(result.code).toBe(0);
  });

  it('executeScript handles script errors', async () => {
    const scriptPath = join(testDir, 'error.py');
    await writeFile(scriptPath, 'raise ValueError("test error")');
    const result = await executeScript(scriptPath, { cwd: testDir });
    expect(result.code).not.toBe(0);
    expect(result.stderr).toContain('ValueError');
  });

  it('executeCommand respects cwd', async () => {
    const result = await executeCommand('pwd', { cwd: testDir });
    expect(result.stdout.trim()).toBe(testDir);
  });
});
