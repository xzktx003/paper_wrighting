import { chatCompletion } from '../services/llmService.js';
import { assemblePrompt } from '../services/skillEngine.js';
import { readTextFile, listDir } from '../services/fileManager.js';
import { join } from 'path';
import { existsSync } from 'fs';
import { resolveProjectPath } from './ai.js';

const REVIEW_JSON_SCHEMA = `{
  "overallScore": number (0-100),
  "decision": "accept" | "minor_revision" | "major_revision" | "reject",
  "dimensions": [
    {
      "name": "methodology" | "novelty" | "clarity" | "reproducibility" | "writing_quality",
      "score": number (0-100),
      "issues": [
        {
          "severity": "critical" | "major" | "minor",
          "location": "section:line description",
          "description": "What is wrong",
          "suggestion": "How to fix it"
        }
      ]
    }
  ],
  "summary": "Markdown overall review summary",
  "revisionChecklist": [
    {
      "priority": number,
      "action": "Specific action to take",
      "section": "Which section",
      "done": false
    }
  ]
}`;

async function readPaperContent(resolvedPath, chapterScope) {
  const secDir = join(resolvedPath, 'sec');
  const chapDir = join(resolvedPath, 'chapters');
  const dir = existsSync(secDir) ? secDir : chapDir;

  if (chapterScope) {
    try { return await readTextFile(join(dir, chapterScope)); } catch {}
  }

  const entries = await listDir(dir);
  const texFiles = entries.filter(e => e.type === 'file' && e.name.endsWith('.tex')).sort((a, b) => a.name.localeCompare(b.name));
  const parts = [];
  for (const f of texFiles) {
    try {
      const content = await readTextFile(join(dir, f.name));
      parts.push(`% === ${f.name} ===\n${content}`);
    } catch {}
  }
  return parts.join('\n\n');
}

export function registerReviewRoutes(fastify) {
  fastify.post('/api/review/structured', async (request, reply) => {
    const { projectPath, chapterScope } = request.body;
    let resolvedPath;
    try {
      resolvedPath = await resolveProjectPath(projectPath);
    } catch (err) {
      reply.code(500);
      return { error: `Failed to resolve project path: ${err.message}` };
    }

    let content;
    try {
      content = await readPaperContent(resolvedPath, chapterScope);
    } catch (err) {
      reply.code(500);
      return { error: `Failed to read paper content: ${err.message}` };
    }

    if (!content || !content.trim()) {
      return { error: 'No paper content found to review.' };
    }

    const skillPrompt = assemblePrompt({ manualSkill: 'academic-paper-reviewer' });
    const systemPrompt = `${skillPrompt}\n\nIMPORTANT: You MUST output your review as a single valid JSON object matching this exact schema (no markdown fencing, no extra text):\n${REVIEW_JSON_SCHEMA}`;

    let response;
    try {
      response = await chatCompletion({
        systemPrompt,
        messages: [{ role: 'user', content: `Please provide a structured peer review of the following academic paper:\n\n${content.slice(0, 15000)}` }],
      });
    } catch (err) {
      reply.code(500);
      return { error: `LLM call failed: ${err.message}` };
    }

    const textBlock = response.content.find(b => b.type === 'text');
    const rawText = textBlock?.text || '';

    let reviewData;
    try {
      reviewData = JSON.parse(rawText);
    } catch {
      const jsonMatch = rawText.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (jsonMatch) {
        try {
          reviewData = JSON.parse(jsonMatch[1]);
        } catch {
          const braceMatch = rawText.match(/\{[\s\S]*\}/);
          if (braceMatch) {
            try { reviewData = JSON.parse(braceMatch[0]); }
            catch { return { error: 'Failed to parse review as JSON', rawText: rawText.slice(0, 1000) }; }
          } else {
            return { error: 'Failed to parse review as JSON', rawText: rawText.slice(0, 1000) };
          }
        }
      } else {
        const braceMatch = rawText.match(/\{[\s\S]*\}/);
        if (braceMatch) {
          try { reviewData = JSON.parse(braceMatch[0]); }
          catch { return { error: 'Failed to parse review as JSON', rawText: rawText.slice(0, 1000) }; }
        } else {
          return { error: 'Failed to parse review as JSON', rawText: rawText.slice(0, 1000) };
        }
      }
    }

    return reviewData;
  });
}
