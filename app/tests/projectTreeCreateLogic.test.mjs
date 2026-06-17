import { describe, it, expect } from 'vitest';
import { getCreateTargetFolderPath, canCreateChildrenFromContext } from '../apps/frontend/src/app/utils/projectTree.js';

describe('ProjectTree create action context rules', () => {
  it('allows creating children from blank/root context and folders only', () => {
    expect(canCreateChildrenFromContext(null)).toBe(true);
    expect(canCreateChildrenFromContext({ path: 'docs', type: 'dir' })).toBe(true);
    expect(canCreateChildrenFromContext({ path: 'docs/note.md', type: 'file' })).toBe(false);
  });

  it('creates new items at root or inside the selected folder, never beside a selected file', () => {
    expect(getCreateTargetFolderPath(null)).toBe('');
    expect(getCreateTargetFolderPath({ path: 'docs', type: 'dir' })).toBe('docs');
    expect(getCreateTargetFolderPath({ path: 'docs/note.md', type: 'file' })).toBe(null);
  });
});
