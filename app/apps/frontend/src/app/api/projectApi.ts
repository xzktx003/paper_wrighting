const BASE = '/api';

export async function openProject(path: string) {
  const res = await fetch(`${BASE}/projects/open`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path }),
  });
  return res.json();
}

export async function createProject(path: string, config: any) {
  const res = await fetch(`${BASE}/projects/create`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path, config }),
  });
  return res.json();
}

export async function readChapter(projectPath: string, filename: string) {
  const res = await fetch(`${BASE}/chapters/read`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ projectPath, filename }),
  });
  return res.json();
}

export async function writeChapter(projectPath: string, filename: string, content: string) {
  const res = await fetch(`${BASE}/chapters/write`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ projectPath, filename, content }),
  });
  return res.json();
}

export async function createChapter(projectPath: string, filename: string) {
  const res = await fetch(`${BASE}/chapters/create`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ projectPath, filename }),
  });
  return res.json();
}

export async function reorderChapters(projectPath: string, order: string[]) {
  const res = await fetch(`${BASE}/chapters/reorder`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ projectPath, order }),
  });
  return res.json();
}

export async function getProjectTree(path: string) {
  const res = await fetch(`${BASE}/projects/tree`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path }),
  });
  return res.json();
}

export async function readCodeFile(projectPath: string, filePath: string) {
  const res = await fetch(`${BASE}/code/read`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ projectPath, filePath }),
  });
  return res.json();
}

export async function getCodeTree(projectPath: string) {
  const res = await fetch(`${BASE}/code/tree`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ projectPath }),
  });
  return res.json();
}
