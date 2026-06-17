import { describe, it, expect, vi } from 'vitest';
import { STAGE_TYPES, STAGE_STATUS } from '../apps/backend/src/services/pipeline/stageTypes.js';
import { getPreset } from '../apps/backend/src/services/pipeline/presets.js';

// Mock fs/promises
vi.mock('fs/promises', () => ({
  readFile: vi.fn().mockRejectedValue(new Error('not found')),
  writeFile: vi.fn().mockResolvedValue(undefined),
  mkdir: vi.fn().mockResolvedValue(undefined),
}));

// Mock LLM — simulate different outputs per skill
vi.mock('../apps/backend/src/services/llmService.js', () => ({
  chatCompletion: vi.fn(async ({ systemPrompt }) => {
    if (systemPrompt.includes('outline')) {
      return { content: [{ type: 'text', text: '# Outline\n1. Introduction\n2. Methods\n3. Results\n4. Discussion' }], usage: {} };
    }
    if (systemPrompt.includes('polish')) {
      return { content: [{ type: 'text', text: 'Polished manuscript content...' }], usage: {} };
    }
    if (systemPrompt.includes('reviewer')) {
      return { content: [{ type: 'text', text: '## Review Report\n- Score: 7/10\n- Needs more detail in methods' }], usage: {} };
    }
    return { content: [{ type: 'text', text: 'AI output for stage' }], usage: {} };
  }),
}));

vi.mock('../apps/backend/src/services/skillEngine.js', () => ({
  assemblePrompt: vi.fn(({ manualSkill }) => `You are an assistant. Skill: ${manualSkill || 'none'}`),
}));

const { PipelineV2 } = await import('../apps/backend/src/services/pipeline/pipelineEngine.js');

describe('Writing Flow Pipeline', () => {
  const writingFlowDef = getPreset('writing-flow');

  it('writing-flow preset has 6 stages in correct order', () => {
    expect(writingFlowDef.stages).toHaveLength(6);
    expect(writingFlowDef.stages[0].name).toBe('outline');
    expect(writingFlowDef.stages[1].name).toBe('outline-review');
    expect(writingFlowDef.stages[2].name).toBe('draft');
    expect(writingFlowDef.stages[3].name).toBe('polish');
    expect(writingFlowDef.stages[4].name).toBe('review');
    expect(writingFlowDef.stages[5].name).toBe('review-checkpoint');
  });

  it('runs outline stage (AI) and pauses at human checkpoint', async () => {
    const p = new PipelineV2({
      name: writingFlowDef.name,
      description: writingFlowDef.description,
      stages: writingFlowDef.stages,
      projectId: 'test',
      projectPath: '/tmp/test',
    });
    p.start();

    // Run outline (AI stage)
    const r1 = await p.runCurrentStage('Write a paper about machine learning');
    expect(r1.status).toBe(STAGE_STATUS.COMPLETED);
    expect(r1.output).toContain('Outline');
    expect(p.outputs['outline']).toBeTruthy();

    // Now at outline-review (human stage)
    expect(p.currentStage).toBe(1);
    expect(p.stages[1].type).toBe(STAGE_TYPES.HUMAN);

    const r2 = await p.runCurrentStage('');
    expect(r2.status).toBe(STAGE_STATUS.WAITING);
    expect(p.status).toBe('waiting');
  });

  it('approve human checkpoint advances to draft stage', async () => {
    const p = new PipelineV2({
      name: writingFlowDef.name,
      description: writingFlowDef.description,
      stages: writingFlowDef.stages,
      projectId: 'test',
      projectPath: '/tmp/test',
    });
    p.start();

    await p.runCurrentStage('Topic: ML');
    await p.runCurrentStage('');
    expect(p.status).toBe('waiting');

    p.resolveHumanCheckpoint('approve', 'Outline looks good');
    expect(p.status).toBe('running');
    expect(p.currentStage).toBe(2);
    expect(p.stages[2].name).toBe('draft');
  });

  it('edit human checkpoint stores edited content and advances', async () => {
    const p = new PipelineV2({
      name: writingFlowDef.name,
      description: writingFlowDef.description,
      stages: writingFlowDef.stages,
      projectId: 'test',
      projectPath: '/tmp/test',
    });
    p.start();

    await p.runCurrentStage('Topic: ML');
    await p.runCurrentStage('');

    p.resolveHumanCheckpoint('edit', '# My Custom Outline\n1. Intro\n2. Experiments');
    expect(p.outputs['outline-review']).toBe('# My Custom Outline\n1. Intro\n2. Experiments');
    expect(p.currentStage).toBe(2);
  });

  it('full writing flow runs through all AI stages', async () => {
    const p = new PipelineV2({
      name: writingFlowDef.name,
      description: writingFlowDef.description,
      stages: writingFlowDef.stages,
      projectId: 'test',
      projectPath: '/tmp/test',
    });
    p.start();

    // Stage 0: outline (AI)
    await p.runCurrentStage('Topic: Deep Learning');
    expect(p.currentStage).toBe(1);

    // Stage 1: outline-review (Human) — approve
    await p.runCurrentStage('');
    p.resolveHumanCheckpoint('approve');
    expect(p.currentStage).toBe(2);

    // Stage 2: draft (AI)
    await p.runCurrentStage('');
    expect(p.currentStage).toBe(3);

    // Stage 3: polish (AI)
    await p.runCurrentStage('');
    expect(p.currentStage).toBe(4);

    // Stage 4: review (AI)
    await p.runCurrentStage('');
    expect(p.currentStage).toBe(5);

    // Stage 5: review-checkpoint (Human) — approve
    await p.runCurrentStage('');
    p.resolveHumanCheckpoint('approve');
    expect(p.status).toBe('completed');
  });

  it('skip at review-checkpoint completes pipeline', async () => {
    const p = new PipelineV2({
      name: writingFlowDef.name,
      description: writingFlowDef.description,
      stages: writingFlowDef.stages,
      projectId: 'test',
      projectPath: '/tmp/test',
    });
    p.start();

    // Fast-forward to review-checkpoint
    await p.runCurrentStage('Topic');
    await p.runCurrentStage('');
    p.resolveHumanCheckpoint('approve');
    await p.runCurrentStage('');
    await p.runCurrentStage('');
    await p.runCurrentStage('');

    // At review-checkpoint
    await p.runCurrentStage('');
    expect(p.status).toBe('waiting');

    p.resolveHumanCheckpoint('skip');
    expect(p.status).toBe('completed');
  });

  it('outputs accumulate across stages', async () => {
    const p = new PipelineV2({
      name: writingFlowDef.name,
      description: writingFlowDef.description,
      stages: writingFlowDef.stages,
      projectId: 'test',
      projectPath: '/tmp/test',
    });
    p.start();

    await p.runCurrentStage('Topic');
    expect(Object.keys(p.outputs)).toContain('outline');

    await p.runCurrentStage('');
    p.resolveHumanCheckpoint('approve');

    await p.runCurrentStage('');
    expect(Object.keys(p.outputs)).toContain('draft');

    await p.runCurrentStage('');
    expect(Object.keys(p.outputs)).toContain('polish');
  });
});

describe('Paper Pipeline (with citation + compile)', () => {
  const paperDef = getPreset('paper-pipeline');

  it('paper-pipeline has 6 stages including citation and compile', () => {
    expect(paperDef.stages).toHaveLength(6);
    const types = paperDef.stages.map(s => s.type);
    expect(types).toContain('ai');
    expect(types).toContain('human');
    expect(types).toContain('citation');
    expect(types).toContain('compile');
  });

  it('citation stage requires action config', () => {
    const citationStage = paperDef.stages.find(s => s.type === 'citation');
    expect(citationStage).toBeTruthy();
    expect(citationStage.config.action).toBe('verify');
  });

  it('compile stage requires engine config', () => {
    const compileStage = paperDef.stages.find(s => s.type === 'compile');
    expect(compileStage).toBeTruthy();
    expect(compileStage.config.engine).toBe('xelatex');
  });
});

describe('Quick Review Pipeline', () => {
  const quickDef = getPreset('quick-review');

  it('has 3 stages: review → checkpoint → revise', () => {
    expect(quickDef.stages).toHaveLength(3);
    expect(quickDef.stages[0].name).toBe('review');
    expect(quickDef.stages[1].name).toBe('review-checkpoint');
    expect(quickDef.stages[2].name).toBe('revise');
  });

  it('runs review then pauses at checkpoint', async () => {
    const p = new PipelineV2({
      name: quickDef.name,
      description: quickDef.description,
      stages: quickDef.stages,
      projectId: 'test',
      projectPath: '/tmp/test',
    });
    p.start();

    await p.runCurrentStage('My paper content');
    expect(p.currentStage).toBe(1);

    await p.runCurrentStage('');
    expect(p.status).toBe('waiting');

    p.resolveHumanCheckpoint('approve');
    expect(p.currentStage).toBe(2);

    await p.runCurrentStage('');
    expect(p.status).toBe('completed');
  });

  it('skip at checkpoint ends without revise', async () => {
    const p = new PipelineV2({
      name: quickDef.name,
      description: quickDef.description,
      stages: quickDef.stages,
      projectId: 'test',
      projectPath: '/tmp/test',
    });
    p.start();

    await p.runCurrentStage('Content');
    await p.runCurrentStage('');
    p.resolveHumanCheckpoint('skip');
    expect(p.currentStage).toBe(2);
    expect(p.stages[1].status).toBe(STAGE_STATUS.SKIPPED);
  });
});
