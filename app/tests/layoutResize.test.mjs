import { describe, it, expect } from 'vitest';
import { readFile } from 'fs/promises';
import { join } from 'path';

describe('layout panel resize ranges', () => {
  it('allows narrower file and assistant panels while preserving an editor minimum width', async () => {
    const source = await readFile(join(process.cwd(), 'apps/frontend/src/app/components/Layout.tsx'), 'utf8');

    expect(source).toContain('const LEFT_PANEL_MIN_WIDTH = 120');
    expect(source).toContain('const RIGHT_PANEL_MIN_WIDTH = 180');
    expect(source).toContain('const CENTER_PANEL_MIN_WIDTH = 360');
    expect(source).toContain('clampPanelWidth(width, LEFT_PANEL_MIN_WIDTH, maxWidth)');
    expect(source).toContain('clampPanelWidth(width, RIGHT_PANEL_MIN_WIDTH, maxWidth)');
    expect(source).toContain('viewportWidth - otherSideWidth - CENTER_PANEL_MIN_WIDTH');
    expect(source).not.toContain('Math.max(200, w + delta)');
    expect(source).not.toContain('Math.max(300, w - delta)');
  });

  it('expands the resize handle hit target beyond the visible 5px divider', async () => {
    const css = await readFile(join(process.cwd(), 'apps/frontend/src/app/components/Layout.module.css'), 'utf8');

    expect(css).toContain('.resizeHandle::before');
    expect(css).toContain('left: -8px');
    expect(css).toContain('right: -8px');
  });
});
