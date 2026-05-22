import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Fastify from 'fastify';
import { mkdir, readFile, rm, writeFile } from 'fs/promises';
import { join } from 'path';
import crypto from 'crypto';
import { DATA_DIR } from '../apps/backend/src/config/constants.js';
import { registerProjectRoutes } from '../apps/backend/src/routes/projects.js';

describe('Project routes', () => {
  let fastify;
  const projectIds = [];

  beforeEach(async () => {
    fastify = Fastify();
    registerProjectRoutes(fastify);
    await fastify.ready();
  });

  afterEach(async () => {
    await fastify.close();
    for (const projectId of projectIds.splice(0)) {
      await rm(join(DATA_DIR, projectId), { recursive: true, force: true });
    }
  });

  it('soft deletes a project even when project.json is missing', async () => {
    const projectId = `missing-meta-${crypto.randomUUID()}`;
    projectIds.push(projectId);
    await mkdir(join(DATA_DIR, projectId), { recursive: true });
    await writeFile(join(DATA_DIR, projectId, 'paper.tex'), 'content');

    const res = await fastify.inject({
      method: 'DELETE',
      url: `/api/projects/${projectId}`,
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ ok: true });

    const meta = JSON.parse(await readFile(join(DATA_DIR, projectId, 'project.json'), 'utf8'));
    expect(meta.id).toBe(projectId);
    expect(meta.name).toBe(projectId);
    expect(meta.trashed).toBe(true);
    expect(meta.trashedAt).toBeTruthy();
  });

  it('treats deleting an already removed project as a successful no-op', async () => {
    const res = await fastify.inject({
      method: 'DELETE',
      url: '/api/projects/already-gone',
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ ok: true });
  });

  it('soft deletes a project when project.json is invalid', async () => {
    const projectId = `invalid-meta-${crypto.randomUUID()}`;
    projectIds.push(projectId);
    await mkdir(join(DATA_DIR, projectId), { recursive: true });
    await writeFile(join(DATA_DIR, projectId, 'project.json'), '{invalid json');

    const res = await fastify.inject({
      method: 'DELETE',
      url: `/api/projects/${projectId}`,
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ ok: true });

    const meta = JSON.parse(await readFile(join(DATA_DIR, projectId, 'project.json'), 'utf8'));
    expect(meta.id).toBe(projectId);
    expect(meta.trashed).toBe(true);
  });
});
