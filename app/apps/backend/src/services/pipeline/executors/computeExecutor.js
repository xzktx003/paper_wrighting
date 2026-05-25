import { spawn } from 'child_process';
import { STAGE_STATUS } from '../stageTypes.js';

const DEFAULT_TIMEOUT = 300_000; // 5 minutes

export async function executeComputeStage(stage, context, signal) {
  const { config } = stage;
  const { projectPath } = context;
  const timeoutMs = config.timeoutMs || DEFAULT_TIMEOUT;
  const cwd = config.cwd ? config.cwd : projectPath;

  return new Promise((resolve, reject) => {
    const args = config.args || [];
    const child = spawn(config.command, args, {
      cwd,
      env: { ...process.env, ...(config.env || {}) },
      shell: true,
    });

    let stdout = '';
    let stderr = '';
    let killed = false;

    const timer = setTimeout(() => {
      killed = true;
      child.kill('SIGKILL');
    }, timeoutMs);

    if (signal) {
      signal.addEventListener('abort', () => {
        killed = true;
        child.kill('SIGKILL');
        clearTimeout(timer);
      }, { once: true });
    }

    child.stdout.on('data', d => { stdout += d.toString(); });
    child.stderr.on('data', d => { stderr += d.toString(); });

    child.on('error', err => {
      clearTimeout(timer);
      resolve({
        status: STAGE_STATUS.FAILED,
        output: stderr || stdout,
        error: err.message,
        metadata: { exitCode: null },
      });
    });

    child.on('close', code => {
      clearTimeout(timer);
      if (killed) {
        resolve({
          status: STAGE_STATUS.FAILED,
          output: stdout,
          error: `Process timed out after ${timeoutMs / 1000}s`,
          metadata: { exitCode: null, timedOut: true },
        });
      } else if (code !== 0) {
        resolve({
          status: STAGE_STATUS.FAILED,
          output: stdout,
          error: stderr || `Process exited with code ${code}`,
          metadata: { exitCode: code },
        });
      } else {
        resolve({
          status: STAGE_STATUS.COMPLETED,
          output: stdout,
          metadata: { exitCode: 0 },
        });
      }
    });
  });
}
