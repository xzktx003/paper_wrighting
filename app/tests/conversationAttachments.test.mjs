import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import Fastify from 'fastify';
import { readFile } from 'fs/promises';
import { join } from 'path';
import { randomUUID } from 'crypto';
import { registerConversationRoutes } from '../apps/backend/src/routes/conversations.js';
import { getConversation } from '../apps/backend/src/services/conversationStore.js';

describe('Conversation PDF attachment routes', () => {
  const fastify = Fastify();
  const projectId = `pdf-context-${randomUUID()}`;
  let convId;

  beforeAll(async () => {
    registerConversationRoutes(fastify);
    await fastify.ready();
  });

  afterAll(async () => {
    if (convId) {
      await fastify.inject({ method: 'DELETE', url: `/api/conversations/${projectId}/${convId}` });
    }
    await fastify.close();
  });

  it('extracts an uploaded PDF and exposes only attachment metadata to the client', async () => {
    const createResponse = await fastify.inject({
      method: 'POST',
      url: `/api/conversations/${projectId}`,
      payload: { name: 'PDF context', context_scope: { type: 'free' }, mode: 'chat' },
    });
    convId = createResponse.json().id;

    const pdf = await readFile(join(process.cwd(), 'templates/arxiv/template.pdf'));
    const uploadResponse = await fastify.inject({
      method: 'POST',
      url: `/api/conversations/${projectId}/${convId}/attachments`,
      payload: {
        name: 'template.pdf', type: 'application/pdf', size: pdf.length,
        dataUrl: `data:application/pdf;base64,${pdf.toString('base64')}`,
      },
    });
    expect(uploadResponse.statusCode).toBe(200);
    expect(uploadResponse.json().attachment.textLength).toBeGreaterThan(100);

    const publicResponse = await fastify.inject({
      method: 'GET', url: `/api/conversations/${projectId}/${convId}`,
    });
    expect(publicResponse.json().attachments[0].name).toBe('template.pdf');
    expect(publicResponse.json().attachments[0]).not.toHaveProperty('text');

    const stored = await getConversation(projectId, convId);
    expect(stored.attachments[0].text).toContain('A TEMPLATE FOR THE arxiv STYLE');
  });
});
