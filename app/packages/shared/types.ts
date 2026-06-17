export interface AgentResponse {
  ok: boolean;
  reply: string;
  suggestion: string;
}

export interface OpenFile {
  filename: string;
  content: string;
  type: 'chapter' | 'code' | 'other';
  dirty: boolean;
}

export interface PendingEdit {
  id: string;
  filename: string;
  original: string;
  proposed: string;
  description: string;
}

export interface ConversationMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}
