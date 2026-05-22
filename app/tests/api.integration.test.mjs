import { describe, it, expect, beforeAll } from 'vitest';
import { mkdtemp, rm, mkdir, writeFile } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import YAML from 'yaml';

const BASE = 'http://localhost:8787';

describe('Backend API Integration', () => {
  describe('Health', () => {
    it('GET /api/health returns ok', async () => {
      const res = await fetch(`${BASE}/api/health`);
      const data = await res.json();
      expect(res.status).toBe(200);
      expect(data.ok).toBe(true);
    });
  });

  describe('Config', () => {
    it('GET /api/config returns config object', async () => {
      const res = await fetch(`${BASE}/api/config`);
      const data = await res.json();
      expect(res.status).toBe(200);
      expect(data).toHaveProperty('claude_model');
      expect(data).toHaveProperty('claude_base_url');
    });
  });

  describe('Skills', () => {
    it('GET /api/skills returns array of skills', async () => {
      const res = await fetch(`${BASE}/api/skills`);
      const data = await res.json();
      expect(res.status).toBe(200);
      expect(Array.isArray(data)).toBe(true);
      expect(data.length).toBeGreaterThanOrEqual(20);
    });

    it('each skill has name, display_name, type', async () => {
      const res = await fetch(`${BASE}/api/skills`);
      const data = await res.json();
      for (const skill of data) {
        expect(skill.name).toBeTruthy();
        expect(skill.display_name).toBeTruthy();
        expect(skill.type).toBeTruthy();
      }
    });

    it('GET /api/skills/:name returns specific skill', async () => {
      const res = await fetch(`${BASE}/api/skills/ml-paper-writing`);
      const data = await res.json();
      expect(res.status).toBe(200);
      expect(data.name).toBe('ml-paper-writing');
    });
  });

  describe('Paper Projects', () => {
    let projectPath;

    beforeAll(async () => {
      projectPath = await mkdtemp(join(tmpdir(), 'api-paper-test-'));
    });

    it('POST /api/paper/create creates a project', async () => {
      const res = await fetch(`${BASE}/api/paper/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          path: projectPath,
          config: {
            title: 'API Test Paper',
            authors: ['Test Author'],
            template: 'plain',
            editor_mode: 'markdown',
            chapters: [{ file: 'intro.md', skills: [] }],
            global_skills: ['academic-tone'],
          },
        }),
      });
      const data = await res.json();
      expect(res.status).toBe(200);
      expect(data.path).toBe(projectPath);
    });

    it('POST /api/paper/open loads project config', async () => {
      const res = await fetch(`${BASE}/api/paper/open`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: projectPath }),
      });
      const data = await res.json();
      expect(res.status).toBe(200);
      expect(data.config.title).toBe('API Test Paper');
    });
  });

  describe('Chapters', () => {
    let projectPath;

    beforeAll(async () => {
      projectPath = await mkdtemp(join(tmpdir(), 'api-ch-test-'));
      await mkdir(join(projectPath, 'chapters'), { recursive: true });
      await writeFile(join(projectPath, 'chapters', 'ch1.md'), '# Chapter 1\n\nContent here.');
      await writeFile(join(projectPath, 'paper.yaml'), YAML.stringify({
        title: 'Chapter Test',
        chapters: [{ file: 'ch1.md', skills: [] }],
        global_skills: [],
      }));
    });

    it('POST /api/chapters/read reads chapter content', async () => {
      const res = await fetch(`${BASE}/api/chapters/read`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectPath, filename: 'ch1.md' }),
      });
      const data = await res.json();
      expect(res.status).toBe(200);
      expect(data.content).toContain('Chapter 1');
    });

    it('POST /api/chapters/write saves chapter content', async () => {
      const res = await fetch(`${BASE}/api/chapters/write`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectPath, filename: 'ch1.md', content: '# Updated\n\nNew content.' }),
      });
      expect(res.status).toBe(200);

      const readRes = await fetch(`${BASE}/api/chapters/read`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectPath, filename: 'ch1.md' }),
      });
      const data = await readRes.json();
      expect(data.content).toContain('New content.');
    });

    it('POST /api/chapters/create adds new chapter', async () => {
      const res = await fetch(`${BASE}/api/chapters/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectPath, filename: 'ch2.md' }),
      });
      expect(res.status).toBe(200);
    });
  });

  describe('Code Execution', () => {
    let projectPath;

    beforeAll(async () => {
      projectPath = await mkdtemp(join(tmpdir(), 'api-code-test-'));
      await mkdir(join(projectPath, 'code'), { recursive: true });
    });

    it('POST /api/code/exec runs a command', async () => {
      const res = await fetch(`${BASE}/api/code/exec`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectPath, command: 'echo "test output"' }),
      });
      const data = await res.json();
      expect(res.status).toBe(200);
      expect(data.stdout).toContain('test output');
    });
  });

  describe('Conversations', () => {
    const projectId = 'test-conv-api-' + Date.now();

    it('POST /api/conversations/:projectId creates conversation', async () => {
      const res = await fetch(`${BASE}/api/conversations/${projectId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'API Test Conv',
          context_scope: { type: 'free' },
          mode: 'chat',
        }),
      });
      const data = await res.json();
      expect(res.status).toBe(200);
      expect(data.id).toBeTruthy();
      expect(data.name).toBe('API Test Conv');
    });

    it('GET /api/conversations/:projectId lists conversations', async () => {
      const res = await fetch(`${BASE}/api/conversations/${projectId}`);
      const data = await res.json();
      expect(res.status).toBe(200);
      expect(Array.isArray(data)).toBe(true);
      expect(data.length).toBeGreaterThanOrEqual(1);
    });
  });
});
