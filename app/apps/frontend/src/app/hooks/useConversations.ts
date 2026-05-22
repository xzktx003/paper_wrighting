import { useState, useCallback } from 'react';
import {
  listConversations, getConversation, createConversation,
  deleteConversation, updateConversation, sendMessage, Conversation, ConversationSummary
} from '../api/conversationApi';

export function useConversations(projectId: string | null) {
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [activeConv, setActiveConv] = useState<Conversation | null>(null);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!projectId) return;
    const list = await listConversations(projectId);
    setConversations(list);
  }, [projectId]);

  const select = useCallback(async (convId: string) => {
    if (!projectId) return;
    setLoading(true);
    const conv = await getConversation(projectId, convId);
    setActiveConv(conv);
    setLoading(false);
  }, [projectId]);

  const create = useCallback(async (data: { name: string; context_scope: any; active_skills?: string[]; mode?: string; model?: string }) => {
    if (!projectId) return;
    const conv = await createConversation(projectId, data);
    setActiveConv(conv);
    await refresh();
    return conv;
  }, [projectId, refresh]);

  const remove = useCallback(async (convId: string) => {
    if (!projectId) return;
    await deleteConversation(projectId, convId);
    if (activeConv?.id === convId) setActiveConv(null);
    await refresh();
  }, [projectId, activeConv, refresh]);

  const rename = useCallback(async (convId: string, newName: string) => {
    if (!projectId) return;
    await updateConversation(projectId, convId, { name: newName });
    if (activeConv?.id === convId) {
      setActiveConv(prev => prev ? { ...prev, name: newName } : null);
    }
    await refresh();
  }, [projectId, activeConv, refresh]);

  const send = useCallback(async (message: string, projectPath: string, projectConfig: any) => {
    if (!projectId || !activeConv) return;
    setActiveConv(prev => prev ? {
      ...prev,
      history: [...prev.history, { role: 'user', content: message }],
    } : null);
    setLoading(true);
    const result = await sendMessage(projectId, activeConv.id, projectPath, message, projectConfig);
    setActiveConv(prev => prev ? {
      ...prev,
      history: [...prev.history, { role: 'assistant', content: result.reply }],
    } : null);
    setLoading(false);
    return result;
  }, [projectId, activeConv]);

  return { conversations, activeConv, loading, refresh, select, create, remove, rename, send };
}
