import { apiFetch, apiPost } from './fetchClient';

const BASE = '/api';

export async function openProject(path: string) {
  return apiPost(`${BASE}/projects/open`, { path });
}

export async function createProject(path: string, config: any) {
  return apiPost(`${BASE}/projects/create`, { path, config });
}

export async function readChapter(projectPath: string, filename: string) {
  return apiPost(`${BASE}/chapters/read`, { projectPath, filename });
}

export async function writeChapter(projectPath: string, filename: string, content: string) {
  return apiPost(`${BASE}/chapters/write`, { projectPath, filename, content });
}

export async function createChapter(projectPath: string, filename: string) {
  return apiPost(`${BASE}/chapters/create`, { projectPath, filename });
}

export async function reorderChapters(projectPath: string, order: string[]) {
  return apiPost(`${BASE}/chapters/reorder`, { projectPath, order });
}

export async function getProjectTree(path: string) {
  return apiPost(`${BASE}/projects/tree`, { path });
}

export async function readCodeFile(projectPath: string, filePath: string) {
  return apiPost(`${BASE}/code/read`, { projectPath, filePath });
}

export async function getCodeTree(projectPath: string) {
  return apiPost(`${BASE}/code/tree`, { projectPath });
}
