import { describe, it, expect, vi, beforeEach } from 'vitest';
import { STAGE_STATUS } from '../apps/backend/src/services/pipeline/stageTypes.js';

// Mock fs/promises
vi.mock('fs/promises', () => ({
  readFile: vi.fn(async (path) => {
    if (path.includes('references.bib')) {
      return `@article{smith2024,
  author = {Smith, John},
  title = {Deep Learning for NLP},
  journal = {Nature},
  year = {2024},
}

@article{doe2023,
  author = {Doe, Jane},
  title = {Transformer Architectures},
  journal = {ICML},
  year = {2023},
}`;
    }
    throw new Error('File not found');
  }),
  writeFile: vi.fn().mockResolvedValue(undefined),
  mkdir: vi.fn().mockResolvedValue(undefined),
}));

// Mock LLM
vi.mock('../apps/backend/src/services/llmService.js', () => ({
  chatCompletion: vi.fn(async ({ systemPrompt }) => {
    if (systemPrompt.includes('Verify all citations')) {
      return { content: [{ type: 'text', text: '## Citation Verification\n- ✓ smith2024: found in .bib\n- ✗ missing2024: NOT found in .bib\n\n1 missing citation found.' }], usage: {} };
    }
    if (systemPrompt.includes('Find and merge duplicate')) {
      return { content: [{ type: 'text', text: '## Deduplication Report\nNo duplicates found. All 2 entries are unique.' }], usage: {} };
    }
    if (systemPrompt.includes('suggest additional references')) {
      return { content: [{ type: 'text', text: '## Suggested References\n@article{wang2024,\n  author={Wang},\n  title={Attention Mechanisms},\n  year={2024}\n}' }], usage: {} };
    }
    return { content: [{ type: 'text', text: 'Citation output' }], usage: {} };
  }),
}));

vi.mock('../apps/backend/src/services/skillEngine.js', () => ({
  assemblePrompt: vi.fn(({ manualSkill }) => `Skill: ${manualSkill}`),
}));

const { executeCitationStage } = await import('../apps/backend/src/services/pipeline/executors/citationExecutor.js');

describe('Citation Executor', () => {
  const baseContext = {
    projectPath: '/tmp/test-project',
    input: 'This paper builds on \\cite{smith2024} and \\cite{missing2024}.',
    previousOutputs: {},
  };

  it('verify action checks citations against .bib', async () => {
    const stage = {
      name: 'verify',
      type: 'citation',
      config: { action: 'verify', bibFile: 'references.bib' },
    };

    const result = await executeCitationStage(stage, baseContext);
    expect(result.status).toBe(STAGE_STATUS.COMPLETED);
    expect(result.output).toContain('Citation Verification');
    expect(result.output).toContain('smith2024');
    expect(result.metadata.action).toBe('verify');
    expect(result.metadata.bibFile).toBe('references.bib');
  });

  it('deduplicate action finds duplicate entries', async () => {
    const stage = {
      name: 'dedup',
      type: 'citation',
      config: { action: 'deduplicate' },
    };

    const result = await executeCitationStage(stage, baseContext);
    expect(result.status).toBe(STAGE_STATUS.COMPLETED);
    expect(result.output).toContain('Deduplication');
    expect(result.metadata.action).toBe('deduplicate');
  });

  it('discover action suggests new references', async () => {
    const stage = {
      name: 'discover',
      type: 'citation',
      config: { action: 'discover' },
    };

    const result = await executeCitationStage(stage, baseContext);
    expect(result.status).toBe(STAGE_STATUS.COMPLETED);
    expect(result.output).toContain('Suggested References');
    expect(result.metadata.action).toBe('discover');
  });

  it('unknown action returns failed', async () => {
    const stage = {
      name: 'bad',
      type: 'citation',
      config: { action: 'unknown_action' },
    };

    const result = await executeCitationStage(stage, baseContext);
    expect(result.status).toBe(STAGE_STATUS.FAILED);
    expect(result.error).toContain('Unknown citation action');
  });

  it('handles missing .bib file gracefully', async () => {
    const stage = {
      name: 'verify',
      type: 'citation',
      config: { action: 'verify', bibFile: 'nonexistent.bib' },
    };

    const result = await executeCitationStage(stage, baseContext);
    expect(result.status).toBe(STAGE_STATUS.COMPLETED);
    // Should still work, just with "no .bib file found" content
  });

  it('uses default references.bib when bibFile not specified', async () => {
    const stage = {
      name: 'verify',
      type: 'citation',
      config: { action: 'verify' },
    };

    const result = await executeCitationStage(stage, baseContext);
    expect(result.status).toBe(STAGE_STATUS.COMPLETED);
    expect(result.metadata.bibFile).toBe('references.bib');
  });
});
