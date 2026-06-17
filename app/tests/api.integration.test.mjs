import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtemp, rm, mkdir, writeFile } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';
import { fileURLToPath } from 'url';
import YAML from 'yaml';

const BASE = 'http://localhost:8787';

// Compute DATA_DIR to match the backend's constants.js calculation
// constants.js: REPO_ROOT = path.resolve(__dirname, '..', '..', '..', '..')
// DATA_DIR = path.resolve(REPO_ROOT, '..', 'papers')
const __filename = fileURLToPath(import.meta.url);
const __dirname = join(__filename, '..');
// The test file is in app/tests/, constants.js is in app/apps/backend/src/config/
// Going up from app/tests/ to app/ is one '..', but constants goes up 4 from config/
// Both resolve to the same repo root
const REPO_ROOT = join(__dirname, '..', 'apps', 'backend', 'src', 'config', '..', '..', '..', '..');
const DATA_DIR = process.env.OPENPRISM_DATA_DIR || join(REPO_ROOT, '..', 'papers');

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
      await mkdir(DATA_DIR, { recursive: true });
      projectPath = await mkdtemp(join(DATA_DIR, 'api-paper-test-'));
    });

    afterAll(async () => {
      if (projectPath && existsSync(projectPath)) await rm(projectPath, { recursive: true, force: true });
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
      await mkdir(DATA_DIR, { recursive: true });
      projectPath = await mkdtemp(join(DATA_DIR, 'api-ch-test-'));
      await mkdir(join(projectPath, 'chapters'), { recursive: true });
      await writeFile(join(projectPath, 'chapters', 'ch1.md'), '# Chapter 1\n\nContent here.');
      await writeFile(join(projectPath, 'paper.yaml'), YAML.stringify({
        title: 'Chapter Test',
        chapters: [{ file: 'ch1.md', skills: [] }],
        global_skills: [],
      }));
    });

    afterAll(async () => {
      if (projectPath && existsSync(projectPath)) await rm(projectPath, { recursive: true, force: true });
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
      await mkdir(DATA_DIR, { recursive: true });
      projectPath = await mkdtemp(join(DATA_DIR, 'api-code-test-'));
      await mkdir(join(projectPath, 'code'), { recursive: true });
    });

    afterAll(async () => {
      if (projectPath && existsSync(projectPath)) await rm(projectPath, { recursive: true, force: true });
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
    const projectPath = join(DATA_DIR, projectId);

    beforeAll(async () => {
      await mkdir(projectPath, { recursive: true });
    });

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
