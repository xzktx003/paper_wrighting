import { chatCompletion } from './claudeService.js';

export function resolveLLMConfig() {
  return { model: 'claude-sonnet-4-20250514' };
}

export async function callOpenAICompatible({ messages, model }) {
  const systemMsg = messages.find(m => m.role === 'system');
  const userMsgs = messages.filter(m => m.role !== 'system');
  const result = await chatCompletion(
    userMsgs.map(m => ({ role: m.role, content: m.content })),
    systemMsg?.content || ''
  );
  return { content: result };
}
