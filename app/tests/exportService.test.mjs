import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtemp, rm, writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import YAML from 'yaml';
import { mergeChapters, exportToLatex } from '../apps/backend/src/services/exportService.js';

describe('Export Service', () => {
  let testDir;

  beforeAll(async () => {
    testDir = await mkdtemp(join(tmpdir(), 'export-test-'));
    await mkdir(join(testDir, 'chapters'), { recursive: true });
    await mkdir(join(testDir, 'output'), { recursive: true });
    await writeFile(join(testDir, 'chapters', 'intro.md'), '# Introduction\n\nThis is the intro.');
    await writeFile(join(testDir, 'chapters', 'methods.md'), '# Methods\n\nThis is the methods section.');
    await writeFile(join(testDir, 'paper.yaml'), YAML.stringify({
      title: 'Test Paper',
      chapters: [{ file: 'intro.md', skills: [] }, { file: 'methods.md', skills: [] }],
    }));
  });

  afterAll(async () => {
    await rm(testDir, { recursive: true, force: true });
  });

  it('mergeChapters combines multiple chapter files', async () => {
    const merged = await mergeChapters(testDir);
    expect(merged).toContain('# Introduction');
    expect(merged).toContain('# Methods');
    expect(merged).toContain('This is the intro.');
    expect(merged).toContain('This is the methods section.');
  });

  it('mergeChapters preserves chapter order from config', async () => {
    const merged = await mergeChapters(testDir);
    const introIdx = merged.indexOf('# Introduction');
    const methodsIdx = merged.indexOf('# Methods');
    expect(introIdx).toBeLessThan(methodsIdx);
  });

  it('mergeChapters adds separator between chapters', async () => {
    const merged = await mergeChapters(testDir);
    expect(merged).toContain('\n\n---\n\n');
    const parts = merged.split('\n\n---\n\n');
    expect(parts.length).toBe(2);
  });

  it('exportToLatex calls pandoc (if available)', async () => {
    try {
      const result = await exportToLatex(testDir);
      expect(result.texPath).toContain('paper.tex');
    } catch (e) {
      // If pandoc is not installed, skip gracefully
      expect(e.message).toMatch(/pandoc|ENOENT|not found/i);
    }
  });
});
