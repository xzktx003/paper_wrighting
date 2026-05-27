import { describe, it, expect, vi, beforeEach } from 'vitest';
import { STAGE_STATUS } from '../apps/backend/src/services/pipeline/stageTypes.js';

// Mock child_process.spawn
const mockSpawn = vi.fn();
vi.mock('child_process', () => ({
  spawn: (...args) => mockSpawn(...args),
}));

vi.mock('fs/promises', () => ({
  mkdir: vi.fn().mockResolvedValue(undefined),
}));

const { executeComputeStage } = await import('../apps/backend/src/services/pipeline/executors/computeExecutor.js');

function createMockProcess({ exitCode = 0, stdout = '', stderr = '', error = null, delay = 0 } = {}) {
  const proc = {
    stdout: { on: vi.fn() },
    stderr: { on: vi.fn() },
    on: vi.fn(),
    kill: vi.fn(),
  };

  mockSpawn.mockReturnValue(proc);

  // Simulate async events
  setTimeout(() => {
    if (error) {
      const errorHandler = proc.on.mock.calls.find(c => c[0] === 'error')?.[1];
      if (errorHandler) errorHandler(new Error(error));
    } else {
      if (stdout) {
        const stdoutHandler = proc.stdout.on.mock.calls.find(c => c[0] === 'data')?.[1];
        if (stdoutHandler) stdoutHandler(Buffer.from(stdout));
      }
      if (stderr) {
        const stderrHandler = proc.stderr.on.mock.calls.find(c => c[0] === 'data')?.[1];
        if (stderrHandler) stderrHandler(Buffer.from(stderr));
      }
      const closeHandler = proc.on.mock.calls.find(c => c[0] === 'close')?.[1];
      if (closeHandler) closeHandler(exitCode);
    }
  }, delay || 5);

  return proc;
}

describe('Compute Executor', () => {
  const baseContext = { projectPath: '/tmp/project', previousOutputs: {} };

  beforeEach(() => { mockSpawn.mockClear(); });

  it('runs command successfully and returns stdout', async () => {
    createMockProcess({ exitCode: 0, stdout: 'Result: 42\nDone.' });

    const stage = {
      name: 'run-script',
      type: 'compute',
      config: { command: 'python', args: ['main.py'] },
    };

    const result = await executeComputeStage(stage, baseContext);
    expect(result.status).toBe(STAGE_STATUS.COMPLETED);
    expect(result.output).toContain('Result: 42');
    expect(result.metadata.exitCode).toBe(0);
    expect(mockSpawn).toHaveBeenCalledWith('python', ['main.py'], expect.objectContaining({ cwd: '/tmp/project' }));
  });

  it('returns failed on non-zero exit code', async () => {
    createMockProcess({ exitCode: 1, stderr: 'Error: file not found' });

    const stage = {
      name: 'run-script',
      type: 'compute',
      config: { command: 'python', args: ['missing.py'] },
    };

    const result = await executeComputeStage(stage, baseContext);
    expect(result.status).toBe(STAGE_STATUS.FAILED);
    expect(result.error).toContain('file not found');
    expect(result.metadata.exitCode).toBe(1);
  });

  it('returns failed on spawn error', async () => {
    createMockProcess({ error: 'ENOENT: command not found' });

    const stage = {
      name: 'run-script',
      type: 'compute',
      config: { command: 'nonexistent-cmd' },
    };

    const result = await executeComputeStage(stage, baseContext);
    expect(result.status).toBe(STAGE_STATUS.FAILED);
    // Sandbox validation rejects unknown executables before spawn
    expect(result.error).toContain('not in the allowed list');
    expect(result.metadata.sandboxRejected).toBe(true);
  });

  it('uses custom cwd from config', async () => {
    createMockProcess({ exitCode: 0, stdout: 'ok' });

    const stage = {
      name: 'run-in-subdir',
      type: 'compute',
      config: { command: 'make', cwd: '/tmp/project/code' },
    };

    await executeComputeStage(stage, baseContext);
    expect(mockSpawn).toHaveBeenCalledWith('make', [], expect.objectContaining({ cwd: '/tmp/project/code' }));
  });

  it('passes environment variables from config', async () => {
    createMockProcess({ exitCode: 0, stdout: 'ok' });

    const stage = {
      name: 'run-with-env',
      type: 'compute',
      config: { command: 'python', args: ['train.py'], env: { CUDA_VISIBLE_DEVICES: '0' } },
    };

    await executeComputeStage(stage, baseContext);
    const envArg = mockSpawn.mock.calls[0][2].env;
    expect(envArg.CUDA_VISIBLE_DEVICES).toBe('0');
  });

  it('respects abort signal', async () => {
    const proc = createMockProcess({ exitCode: 0, stdout: 'ok', delay: 50 });
    const controller = new AbortController();

    const stage = {
      name: 'long-run',
      type: 'compute',
      config: { command: 'python', args: ['long.py'] },
    };

    const promise = executeComputeStage(stage, baseContext, controller.signal);

    // Abort after spawn is set up
    await new Promise(r => setTimeout(r, 5));
    controller.abort();

    expect(proc.kill).toHaveBeenCalledWith('SIGKILL');
  });
});
