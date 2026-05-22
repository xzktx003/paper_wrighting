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
  const res = await fetch(`${BASE}/skills`);
  return res.json();
}

export async function getSkill(name: string): Promise<SkillInfo> {
  const res = await fetch(`${BASE}/skills/${name}`);
  return res.json();
}

export async function createSkill(data: { name: string; display_name: string; description: string; type: string; trigger: string; prompt: string }): Promise<{ ok: boolean; skill?: SkillInfo; error?: string }> {
  const res = await fetch(`${BASE}/skills`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  return res.json();
}

export async function deleteSkill(name: string): Promise<{ ok: boolean }> {
  const res = await fetch(`${BASE}/skills/${name}`, { method: 'DELETE' });
  return res.json();
}

export async function reloadSkills(projectSkillsDir?: string) {
  const res = await fetch(`${BASE}/skills/reload`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ projectSkillsDir }),
  });
  return res.json();
}
