import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtemp, rm, readFile, writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import { loadProject, saveProject, createProject, addChapter, reorderChapters, getProjectRoot } from '../apps/backend/src/services/projectService.js';

describe('Project Service', () => {
  let testDir;

  beforeAll(async () => {
    testDir = await mkdtemp(join(tmpdir(), 'paper-test-'));
  });

  afterAll(async () => {
    await rm(testDir, { recursive: true, force: true });
  });

  it('createProject scaffolds directory structure', async () => {
    const config = {
      title: 'Test Paper',
      authors: ['Author One'],
      template: 'plain',
      editor_mode: 'markdown',
      chapters: [{ file: 'introduction.md', skills: [] }],
      global_skills: ['academic-tone'],
    };
    await createProject(testDir, config);

    const loaded = await loadProject(testDir);
    expect(loaded.title).toBe('Test Paper');
    expect(loaded.authors).toContain('Author One');
    expect(loaded.chapters).toHaveLength(1);
    expect(loaded.chapters[0].file).toBe('introduction.md');
  });

  it('saveProject updates paper.yaml', async () => {
    const config = await loadProject(testDir);
    config.title = 'Updated Title';
    await saveProject(testDir, config);

    const reloaded = await loadProject(testDir);
    expect(reloaded.title).toBe('Updated Title');
  });

  it('addChapter appends to chapters list', async () => {
    await addChapter(testDir, 'methods.md');
    const config = await loadProject(testDir);
    const files = config.chapters.map(c => c.file);
    expect(files).toContain('methods.md');
  });

  it('reorderChapters changes chapter order', async () => {
    await reorderChapters(testDir, ['methods.md', 'introduction.md']);
    const config = await loadProject(testDir);
    expect(config.chapters[0].file).toBe('methods.md');
    expect(config.chapters[1].file).toBe('introduction.md');
  });

  it('loadProject throws for non-existent path', async () => {
    await expect(loadProject('/tmp/non-existent-project-xyz')).rejects.toThrow();
  });

  it('getProjectRoot resolves Paper Agent metadata id when directory name differs', async () => {
    const root = await getProjectRoot('c2b87dfc-af29-42ef-b088-0f28aa9d65c3');
    expect(root.endsWith('/papers/torq')).toBe(true);
  });
});
