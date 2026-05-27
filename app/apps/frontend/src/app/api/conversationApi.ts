import { apiFetch, apiPost, apiPut, apiDelete } from './fetchClient';

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
  return apiFetch(`${BASE}/conversations/${projectId}`);
}

export async function getConversation(projectId: string, convId: string): Promise<Conversation> {
  return apiFetch(`${BASE}/conversations/${projectId}/${convId}`);
}

export async function createConversation(projectId: string, data: {
  name: string;
  context_scope: { type: string; file?: string; path?: string };
  active_skills?: string[];
  mode?: string;
  model?: string;
}): Promise<Conversation> {
  return apiPost(`${BASE}/conversations/${projectId}`, data);
}

export async function updateConversation(projectId: string, convId: string, updates: Partial<{ name: string; active_skills: string[]; mode: string }>): Promise<Conversation> {
  return apiPut(`${BASE}/conversations/${projectId}/${convId}`, updates);
}

export async function deleteConversation(projectId: string, convId: string) {
  await apiDelete(`${BASE}/conversations/${projectId}/${convId}`);
}

export async function sendMessage(projectId: string, convId: string, projectPath: string, userMessage: string, projectConfig: any, images?: { dataUrl: string; name: string }[]) {
  return apiPost(`${BASE}/ai/send`, {
    projectId, convId, projectPath, userMessage, projectConfig,
    images: images?.map(img => ({ dataUrl: img.dataUrl, name: img.name })),
  });
}

/** SSE streaming version of sendMessage */
export async function sendMessageStream(
  projectId: string, convId: string, projectPath: string, userMessage: string, projectConfig: any,
  images: { dataUrl: string; name: string }[] | undefined,
  callbacks: {
    onToken: (text: string) => void;
    onToolUse?: (name: string, input: any) => void;
    onToolResult?: (name: string, result: string) => void;
    onDone: (fullText: string) => void;
    onError: (message: string) => void;
  }
) {
  const token = localStorage.getItem('api_token');
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${BASE}/ai/stream`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      projectId, convId, projectPath, userMessage, projectConfig,
      images: images?.map(img => ({ dataUrl: img.dataUrl, name: img.name })),
    }),
  });

  if (!res.ok) {
    callbacks.onError(`HTTP ${res.status}`);
    return;
  }

  if (!res.body) {
    callbacks.onError('Response body is null');
    return;
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    let eventType = '';
    for (const line of lines) {
      if (line.startsWith('event: ')) {
        eventType = line.slice(7).trim();
      } else if (line.startsWith('data: ')) {
        const dataStr = line.slice(6);
        try {
          const data = JSON.parse(dataStr);
          switch (eventType) {
            case 'token': callbacks.onToken(data.text || ''); break;
            case 'tool_use': callbacks.onToolUse?.(data.name, data.input); break;
            case 'tool_result': callbacks.onToolResult?.(data.name, data.result || ''); break;
            case 'done': callbacks.onDone(data.fullText || ''); break;
            case 'error': callbacks.onError(data.message || 'Unknown error'); break;
          }
        } catch {}
        eventType = '';
      }
    }
  }
}

// ── Review API ──
export async function structuredReview(projectPath: string, chapterScope?: string) {
  return apiPost(`${BASE}/review/structured`, { projectPath, chapterScope });
}

// ── Anti-AI API ──
export async function detectAntiAi(projectPath: string, content?: string, chapterScope?: string) {
  return apiPost(`${BASE}/anti-ai/detect`, { projectPath, content, chapterScope });
}

export async function detectAntiAiDeep(projectPath: string, content?: string, chapterScope?: string) {
  return apiPost(`${BASE}/anti-ai/deep-detect`, { projectPath, content, chapterScope });
}

export async function detectAntiAiGPTZero(projectPath: string, content?: string, chapterScope?: string) {
  return apiPost(`${BASE}/anti-ai/gptzero-detect`, { projectPath, content, chapterScope });
}

// ── Pipeline V2 API ──

export interface PipelinePreset {
  id: string;
  name: string;
  description: string;
  stageCount: number;
  stages: { name: string; type: string; description: string }[];
}

export interface PipelineStageV2 {
  name: string;
  type: 'ai' | 'compute' | 'human' | 'citation' | 'compile';
  description: string;
  config: Record<string, any>;
  index: number;
  status: 'pending' | 'running' | 'waiting' | 'completed' | 'failed' | 'skipped';
  output: string | null;
  error: string | null;
  startedAt: string | null;
  completedAt: string | null;
  metadata: Record<string, any>;
}

export interface PipelineV2 {
  id: string;
  name: string;
  description: string;
  projectId: string;
  projectPath: string;
  stages: PipelineStageV2[];
  currentStage: number;
  status: 'created' | 'running' | 'waiting' | 'paused' | 'completed' | 'failed';
  chapterScope: string | null;
  createdAt: string;
  updatedAt: string;
  outputs: Record<string, string>;
  errors: { stage: string; error: string }[];
}

export async function listPipelinePresets(): Promise<{ presets: PipelinePreset[] }> {
  return apiFetch(`${BASE}/v2/pipeline/presets`);
}

export async function startPipelineV2(preset: string, projectPath: string, chapterScope?: string): Promise<PipelineV2> {
  return apiPost(`${BASE}/v2/pipeline/start`, { preset, projectPath, chapterScope });
}

export async function getPipelineV2Status(pipelineId: string): Promise<PipelineV2> {
  return apiFetch(`${BASE}/v2/pipeline/${pipelineId}`);
}

export async function runPipelineV2Stage(pipelineId: string) {
  return apiPost(`${BASE}/v2/pipeline/${pipelineId}/run`, {});
}

export async function resolvePipelineV2(pipelineId: string, action: string, feedback?: string) {
  return apiPost(`${BASE}/v2/pipeline/${pipelineId}/resolve`, { action, feedback });
}

export async function retryPipelineV2(pipelineId: string, feedback?: string) {
  return apiPost(`${BASE}/v2/pipeline/${pipelineId}/retry`, { feedback });
}

export async function skipPipelineV2Stage(pipelineId: string) {
  return apiPost(`${BASE}/v2/pipeline/${pipelineId}/skip`, {});
}

export async function pausePipelineV2(pipelineId: string) {
  return apiPost(`${BASE}/v2/pipeline/${pipelineId}/pause`, {});
}

export async function resumePipelineV2(pipelineId: string) {
  return apiPost(`${BASE}/v2/pipeline/${pipelineId}/resume`, {});
}

// ── Citation Verification API ──

export interface CitationResult {
  key: string;
  type: string;
  doi: string | null;
  title: string | null;
  status: 'verified' | 'title_match' | 'doi_not_found' | 'unverifiable';
  confidence: 'high' | 'medium' | 'low' | 'none';
  matchedTitle?: string;
  matchedYear?: number;
  matchedJournal?: string;
  sources: Array<{ source: string; verified: boolean; error?: string }>;
}

export interface VerificationReport {
  totalEntries: number;
  verified: number;
  titleMatch: number;
  doiNotFound: number;
  unverifiable: number;
  results: CitationResult[];
  summary: string;
}

export interface CrossCheckResult {
  citedKeys: string[];
  bibKeys: string[];
  missingInBib: string[];
  uncitedInBib: string[];
}

export interface FullCitationReport extends VerificationReport, CrossCheckResult {}

/** Verify all BibTeX entries against academic databases */
export async function verifyCitations(projectPath: string, bibFile?: string): Promise<FullCitationReport> {
  return apiPost(`${BASE}/citations/verify`, { projectPath, bibFile });
}

/** Verify .tex citations and cross-check with .bib */
export async function verifyTexCitations(projectPath: string, texFile?: string, bibFile?: string): Promise<FullCitationReport> {
  return apiPost(`${BASE}/citations/verify-tex`, { projectPath, texFile, bibFile });
}

/** Quick cross-check without external API calls */
export async function crossCheckCitations(projectPath: string, texFile?: string, bibFile?: string): Promise<CrossCheckResult> {
  return apiPost(`${BASE}/citations/cross-check`, { projectPath, texFile, bibFile });
}
