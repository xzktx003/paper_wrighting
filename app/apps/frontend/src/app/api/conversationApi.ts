const BASE = '/api';

export interface ConversationSummary {
  id: string;
  name: string;
  context_scope: { type: string; file?: string; path?: string };
  mode: string;
  updated_at: string;
}

export interface Conversation {
  id: string;
  name: string;
  context_scope: { type: string; file?: string; path?: string };
  active_skills: string[];
  mode: string;
  model?: string;
  history: { role: string; content: string }[];
}

export async function listConversations(projectId: string): Promise<ConversationSummary[]> {
  const res = await fetch(`${BASE}/conversations/${projectId}`);
  return res.json();
}

export async function getConversation(projectId: string, convId: string): Promise<Conversation> {
  const res = await fetch(`${BASE}/conversations/${projectId}/${convId}`);
  return res.json();
}

export async function createConversation(projectId: string, data: {
  name: string;
  context_scope: { type: string; file?: string; path?: string };
  active_skills?: string[];
  mode?: string;
  model?: string;
}): Promise<Conversation> {
  const res = await fetch(`${BASE}/conversations/${projectId}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  return res.json();
}

export async function updateConversation(projectId: string, convId: string, updates: Partial<{ name: string; active_skills: string[]; mode: string }>): Promise<Conversation> {
  const res = await fetch(`${BASE}/conversations/${projectId}/${convId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updates),
  });
  return res.json();
}

export async function deleteConversation(projectId: string, convId: string) {
  await fetch(`${BASE}/conversations/${projectId}/${convId}`, { method: 'DELETE' });
}

export async function sendMessage(projectId: string, convId: string, projectPath: string, userMessage: string, projectConfig: any) {
  const res = await fetch(`${BASE}/ai/send`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ projectId, convId, projectPath, userMessage, projectConfig }),
  });
  return res.json();
}
