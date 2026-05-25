import { describe, it, expect } from 'vitest';

const BASE = 'http://localhost:8787';
const PROJECT_ID = 'c2b87dfc-af29-42ef-b088-0f28aa9d65c3';

describe('Paper Agent Project Loading (Editor Page Flow)', () => {
  it('GET /api/projects/:id/tree returns file tree', async () => {
    const res = await fetch(`${BASE}/api/projects/${PROJECT_ID}/tree`);
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.items).toBeDefined();
    expect(Array.isArray(data.items)).toBe(true);
    expect(data.items.length).toBeGreaterThan(0);
  });

  it('tree contains sec/*.tex chapter files', async () => {
    const res = await fetch(`${BASE}/api/projects/${PROJECT_ID}/tree`);
    const data = await res.json();
    const secFiles = data.items.filter(
      f => f.type === 'file' && /^sec\/[^/]+\.tex$/.test(f.path)
    );
    expect(secFiles.length).toBeGreaterThanOrEqual(5);
    expect(secFiles.some(f => f.path === 'sec/1.abstract.tex')).toBe(true);
    expect(secFiles.some(f => f.path === 'sec/2.introduction.tex')).toBe(true);
  });

  it('tree does not include nested sec/ from subdirectories', async () => {
    const res = await fetch(`${BASE}/api/projects/${PROJECT_ID}/tree`);
    const data = await res.json();
    const secFiles = data.items.filter(
      f => f.type === 'file' && /^sec\/[^/]+\.tex$/.test(f.path)
    );
    for (const f of secFiles) {
      expect(f.path).not.toContain('MSAVQ');
    }
  });

  it('GET /api/projects/:id/file reads project.json', async () => {
    const res = await fetch(`${BASE}/api/projects/${PROJECT_ID}/file?path=project.json`);
    const data = await res.json();
    expect(res.status).toBe(200);
    const meta = JSON.parse(data.content);
    expect(meta.id).toBe(PROJECT_ID);
    expect(meta.name).toBeTruthy();
  });

  it('GET /api/projects/:id/file reads a tex chapter', async () => {
    const res = await fetch(`${BASE}/api/projects/${PROJECT_ID}/file?path=${encodeURIComponent('sec/1.abstract.tex')}`);
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.content).toContain('abstract');
  });

  it('PUT /api/projects/:id/file writes and reads back', async () => {
    const testContent = '% test write ' + Date.now();
    const writeRes = await fetch(`${BASE}/api/projects/${PROJECT_ID}/file`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: 'sec/__test_tmp.tex', content: testContent }),
    });
    expect(writeRes.status).toBe(200);

    const readRes = await fetch(`${BASE}/api/projects/${PROJECT_ID}/file?path=${encodeURIComponent('sec/__test_tmp.tex')}`);
    const readData = await readRes.json();
    expect(readData.content).toBe(testContent);

    // Cleanup
    await fetch(`${BASE}/api/projects/${PROJECT_ID}/file?path=${encodeURIComponent('sec/__test_tmp.tex')}`, {
      method: 'DELETE',
    });
  });

  it('SPA fallback serves index.html for /editor/:id', async () => {
    const res = await fetch(`${BASE}/editor/${PROJECT_ID}`);
    const html = await res.text();
    expect(res.status).toBe(200);
    expect(html).toContain('<div id="root">');
    expect(html).toContain('script');
  });
});
