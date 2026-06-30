import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, mkdir, readFile, writeFile, rm, access } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import {
  getToolsForMode, appendModeGuidance, executeTool, buildUserMessageContent,
  buildConversationHistory, buildConversationAttachmentMessages,
} from '../apps/backend/src/routes/ai.js';
import { buildOpenAIMessages } from '../apps/backend/src/services/llmService.js';

describe('AI PDF attachments', () => {
  it('extracts PDF text into the user message sent to the model', async () => {
    const pdf = await readFile(join(process.cwd(), 'templates/arxiv/template.pdf'));
    const content = await buildUserMessageContent('Summarize this PDF', [{
      dataUrl: 'data:application/pdf;base64,' + pdf.toString('base64'),
      name: 'template.pdf',
      type: 'application/pdf',
      isImage: false,
      size: pdf.length,
    }]);

    expect(content[0]).toEqual({ type: 'text', text: 'Summarize this PDF' });
    expect(content[1].type).toBe('text');
    expect(content[1].text).toContain('[Attached PDF: template.pdf]');
    expect(content[1].text).toContain('A TEMPLATE FOR THE arxiv STYLE');

    const openAIMessages = buildOpenAIMessages('system', [{ role: 'user', content }]);
    expect(openAIMessages[1].role).toBe('user');
    expect(openAIMessages[1].content.map(block => block.text).join('\n')).toContain('Summarize this PDF');
    expect(openAIMessages[1].content.map(block => block.text).join('\n')).toContain('A TEMPLATE FOR THE arxiv STYLE');
  });

  it('keeps PDF text and prior messages as persistent conversation context', () => {
    const conv = {
      history: [
        { role: 'user', content: 'What is the paper about?' },
        { role: 'assistant', content: 'It studies testing.' },
      ],
      attachments: [{ name: 'paper.pdf', text: 'Persistent extracted PDF text.' }],
    };
    expect(buildConversationHistory(conv)).toEqual(conv.history);
    const attachmentMessages = buildConversationAttachmentMessages(conv);
    expect(attachmentMessages[0].content).toContain('paper.pdf');
    expect(attachmentMessages[0].content).toContain('Persistent extracted PDF text.');
  });
});

describe('AI conversation modes', () => {
  it('keeps Chat read-only, Agent proposal-only, and Tools fully tooled', () => {
    expect(getToolsForMode('chat')).toEqual([]);

    const agentTools = getToolsForMode('agent').map(tool => tool.name).sort();
    expect(agentTools).toEqual(['list_chapters', 'propose_edit', 'read_chapter', 'read_references'].sort());
    expect(agentTools).not.toContain('write_code');
    expect(agentTools).not.toContain('run_code');

    const toolsModeTools = getToolsForMode('tools').map(tool => tool.name);
    expect(toolsModeTools).toContain('write_code');
    expect(toolsModeTools).toContain('run_code');
    expect(toolsModeTools).toContain('propose_edit');
  });

  it('adds explicit mode guidance to the system prompt', () => {
    expect(appendModeGuidance('base prompt', 'chat')).toContain('Mode: Chat');
    expect(appendModeGuidance('base prompt', 'agent')).toContain('Use propose_edit');
    expect(appendModeGuidance('base prompt', 'agent')).toContain('do not directly write files');
    expect(appendModeGuidance('base prompt', 'tools')).toContain('controlled code/ file work');
  });
});

describe('AI code tools', () => {
  let projectRoot;

  beforeEach(async () => {
    projectRoot = await mkdtemp(join(tmpdir(), 'ai-code-tools-'));
    await mkdir(join(projectRoot, 'code'), { recursive: true });
  });

  afterEach(async () => {
    await rm(projectRoot, { recursive: true, force: true });
  });

  it('writes only inside the project code directory', async () => {
    await executeTool('write_code', { path: 'src/example.py', content: 'print("ok")\n' }, projectRoot);
    await expect(readFile(join(projectRoot, 'code', 'src', 'example.py'), 'utf8')).resolves.toBe('print("ok")\n');
  });

  it('rejects code path traversal attempts', async () => {
    await expect(executeTool('write_code', { path: '../outside.py', content: 'bad' }, projectRoot)).rejects.toThrow(/Path traversal/);
    await expect(access(join(projectRoot, 'outside.py'))).rejects.toThrow();

    await writeFile(join(projectRoot, 'outside.py'), 'secret', 'utf8');
    await expect(executeTool('read_code', { path: '../outside.py' }, projectRoot)).rejects.toThrow(/Path traversal/);
    await expect(executeTool('run_code', { script: '../outside.py' }, projectRoot)).rejects.toThrow(/Path traversal/);
  });
});
