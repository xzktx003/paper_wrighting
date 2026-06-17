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

vi.mock('fs', () => ({
  existsSync: vi.fn((path) => path.endsWith('.pdf')),
}));

const { executeCompileStage } = await import('../apps/backend/src/services/pipeline/executors/compileExecutor.js');

function createMockProcess({ exitCode = 0, stdout = '', stderr = '', error = null } = {}) {
  const proc = {
    stdout: { on: vi.fn() },
    stderr: { on: vi.fn() },
    on: vi.fn(),
    kill: vi.fn(),
  };

  mockSpawn.mockReturnValue(proc);

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
  }, 5);

  return proc;
}

describe('Compile Executor', () => {
  const baseContext = { projectPath: '/tmp/paper', previousOutputs: {} };

  beforeEach(() => { mockSpawn.mockClear(); });

  it('compiles with xelatex successfully', async () => {
    createMockProcess({ exitCode: 0, stdout: 'Output written on main.pdf' });

    const stage = {
      name: 'compile',
      type: 'compile',
      config: { engine: 'xelatex', mainFile: 'main.tex' },
    };

    const result = await executeCompileStage(stage, baseContext);
    expect(result.status).toBe(STAGE_STATUS.COMPLETED);
    expect(result.output).toContain('.pdf');
    expect(result.metadata.engine).toBe('xelatex');
    expect(result.metadata.exitCode).toBe(0);
  });

  it('compiles with pdflatex', async () => {
    createMockProcess({ exitCode: 0, stdout: 'Done' });

    const stage = {
      name: 'compile',
      type: 'compile',
      config: { engine: 'pdflatex', mainFile: 'paper.tex' },
    };

    const result = await executeCompileStage(stage, baseContext);
    expect(result.status).toBe(STAGE_STATUS.COMPLETED);
    expect(mockSpawn).toHaveBeenCalledWith(
      'pdflatex',
      expect.arrayContaining(['-interaction=nonstopmode']),
      expect.objectContaining({ cwd: '/tmp/paper' })
    );
  });

  it('compiles with latexmk', async () => {
    createMockProcess({ exitCode: 0, stdout: 'Latexmk: All targets are up-to-date' });

    const stage = {
      name: 'compile',
      type: 'compile',
      config: { engine: 'latexmk', mainFile: 'main.tex' },
    };

    const result = await executeCompileStage(stage, baseContext);
    expect(result.status).toBe(STAGE_STATUS.COMPLETED);
    expect(mockSpawn).toHaveBeenCalledWith(
      'latexmk',
      expect.arrayContaining(['-pdf']),
      expect.objectContaining({ cwd: '/tmp/paper' })
    );
  });

  it('returns failed for unsupported engine', async () => {
    const stage = {
      name: 'compile',
      type: 'compile',
      config: { engine: 'unsupported-engine', mainFile: 'main.tex' },
    };

    const result = await executeCompileStage(stage, baseContext);
    expect(result.status).toBe(STAGE_STATUS.FAILED);
    expect(result.error).toContain('Unsupported engine');
  });

  it('returns failed on non-zero exit code', async () => {
    createMockProcess({ exitCode: 1, stdout: '! LaTeX Error: File not found.\nl.42 \\input{missing}\n' });

    const stage = {
      name: 'compile',
      type: 'compile',
      config: { engine: 'xelatex', mainFile: 'main.tex' },
    };

    const result = await executeCompileStage(stage, baseContext);
    expect(result.status).toBe(STAGE_STATUS.FAILED);
    expect(result.error).toContain('exit code 1');
    expect(result.metadata.exitCode).toBe(1);
  });

  it('returns failed on spawn error', async () => {
    createMockProcess({ error: 'xelatex not found' });

    const stage = {
      name: 'compile',
      type: 'compile',
      config: { engine: 'xelatex', mainFile: 'main.tex' },
    };

    const result = await executeCompileStage(stage, baseContext);
    expect(result.status).toBe(STAGE_STATUS.FAILED);
    expect(result.error).toContain('xelatex not found');
  });

  it('uses custom output directory', async () => {
    createMockProcess({ exitCode: 0, stdout: 'Done' });

    const stage = {
      name: 'compile',
      type: 'compile',
      config: { engine: 'pdflatex', mainFile: 'main.tex', outputDir: 'build' },
    };

    await executeCompileStage(stage, baseContext);
    const args = mockSpawn.mock.calls[0][1];
    expect(args.some(a => a.includes('build'))).toBe(true);
  });

  it('defaults to main.tex and output directory', async () => {
    createMockProcess({ exitCode: 0, stdout: 'Done' });

    const stage = {
      name: 'compile',
      type: 'compile',
      config: { engine: 'pdflatex' },
    };

    const result = await executeCompileStage(stage, baseContext);
    expect(result.status).toBe(STAGE_STATUS.COMPLETED);
    expect(result.metadata.outputDir).toContain('output');
  });

  it('respects abort signal', async () => {
    const proc = createMockProcess({ exitCode: 0, stdout: 'ok' });
    const controller = new AbortController();

    const stage = {
      name: 'compile',
      type: 'compile',
      config: { engine: 'xelatex', mainFile: 'main.tex' },
    };

    // Start and abort after a tick to ensure listener is registered
    const promise = executeCompileStage(stage, baseContext, controller.signal);
    await new Promise(r => setTimeout(r, 2));
    controller.abort();
    expect(proc.kill).toHaveBeenCalledWith('SIGKILL');
  });
});
