import { apiFetch, apiPost, apiDelete } from './fetchClient';

const BASE = '/api';

export interface SkillInfo {
  name: string;
  display_name: string;
  description: string;
  type: string;
  trigger: string;
  source: string;
  prompt?: string;
}

export async function listSkills(): Promise<SkillInfo[]> {
  return apiFetch(`${BASE}/skills`);
}

export async function getSkill(name: string): Promise<SkillInfo> {
  return apiFetch(`${BASE}/skills/${name}`);
}

export async function createSkill(data: { name: string; display_name: string; description: string; type: string; trigger: string; prompt: string }): Promise<{ ok: boolean; skill?: SkillInfo; error?: string }> {
  return apiPost(`${BASE}/skills`, data);
}

export async function deleteSkill(name: string): Promise<{ ok: boolean }> {
  return apiFetch(`${BASE}/skills/${name}`, { method: 'DELETE' });
}

export async function reloadSkills(projectSkillsDir?: string) {
  return apiPost(`${BASE}/skills/reload`, { projectSkillsDir });
}
