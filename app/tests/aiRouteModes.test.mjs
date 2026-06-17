import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, mkdir, readFile, writeFile, rm, access } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import { getToolsForMode, appendModeGuidance, executeTool } from '../apps/backend/src/routes/ai.js';

describe('AI conversation modes', () => {
  it('keeps Chat read-only, Agent proposal-only, and Tools fully tooled', () => {
    expect(getToolsForMode('chat')).toEqual([]);

    const agentTools = getToolsForMode('agent').map(tool => tool.name).sort();
    expect(agentTools).toEqual(['list_chapters', 'propose_edit', 'read_chapter', 'read_references'].sort());
    expect(agentTools).not.toContain('write_code');
    expect(agentTools).not.toContain('run_code');

    const toolsModeTools = getToolsForMode('tools').map(tool => tool.name);
    expect(toolsModeTools).toContain('write_code');
    expect(toolsModeTools).toContain('run_code');
    expect(toolsModeTools).toContain('propose_edit');
  });

  it('adds explicit mode guidance to the system prompt', () => {
    expect(appendModeGuidance('base prompt', 'chat')).toContain('Mode: Chat');
    expect(appendModeGuidance('base prompt', 'agent')).toContain('Use propose_edit');
    expect(appendModeGuidance('base prompt', 'agent')).toContain('do not directly write files');
    expect(appendModeGuidance('base prompt', 'tools')).toContain('controlled code/ file work');
  });
});

describe('AI code tools', () => {
  let projectRoot;

  beforeEach(async () => {
    projectRoot = await mkdtemp(join(tmpdir(), 'ai-code-tools-'));
    await mkdir(join(projectRoot, 'code'), { recursive: true });
  });

  afterEach(async () => {
    await rm(projectRoot, { recursive: true, force: true });
  });

  it('writes only inside the project code directory', async () => {
    await executeTool('write_code', { path: 'src/example.py', content: 'print("ok")\n' }, projectRoot);
    await expect(readFile(join(projectRoot, 'code', 'src', 'example.py'), 'utf8')).resolves.toBe('print("ok")\n');
  });

  it('rejects code path traversal attempts', async () => {
    await expect(executeTool('write_code', { path: '../outside.py', content: 'bad' }, projectRoot)).rejects.toThrow(/Path traversal/);
    await expect(access(join(projectRoot, 'outside.py'))).rejects.toThrow();

    await writeFile(join(projectRoot, 'outside.py'), 'secret', 'utf8');
    await expect(executeTool('read_code', { path: '../outside.py' }, projectRoot)).rejects.toThrow(/Path traversal/);
    await expect(executeTool('run_code', { script: '../outside.py' }, projectRoot)).rejects.toThrow(/Path traversal/);
  });
});
