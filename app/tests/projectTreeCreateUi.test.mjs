import { describe, it, expect } from 'vitest';
import { readFile } from 'fs/promises';
import { join } from 'path';
import { canMoveTreeItem } from '../apps/frontend/src/app/utils/projectTree.js';

describe('ProjectTree create actions', () => {
  it('exposes context-menu actions for creating files and folders via the project file API', async () => {
    const source = await readFile(join(process.cwd(), 'apps/frontend/src/app/components/ProjectTree.tsx'), 'utf8');
    expect(source).toContain('New File');
    expect(source).toContain('New Folder');
    expect(source).toContain("method: 'POST'");
    expect(source).toContain('/api/projects/${projectId}/file');
    expect(source).toContain("type === 'folder' ? 'dir' : 'file'");
  });
});

describe('ProjectTree root drop affordance', () => {
  it('shows an explicit root drop target and allows nested items to move to root', async () => {
    const source = await readFile(join(process.cwd(), 'apps/frontend/src/app/components/ProjectTree.tsx'), 'utf8');
    expect(source).toContain('Drop here to move to project root');
    expect(canMoveTreeItem({ path: 'docs/note.md', type: 'file' }, '')).toBe(true);
    expect(canMoveTreeItem({ path: 'docs/nested', type: 'dir' }, '')).toBe(true);
  });
});
