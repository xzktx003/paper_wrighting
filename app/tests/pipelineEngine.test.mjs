import { describe, it, expect, vi, beforeEach } from 'vitest';
import { STAGE_TYPES, STAGE_STATUS } from '../apps/backend/src/services/pipeline/stageTypes.js';
import { resolveHumanStage } from '../apps/backend/src/services/pipeline/executors/humanExecutor.js';

// Mock fs/promises for PipelineV2.save()
vi.mock('fs/promises', () => ({
  readFile: vi.fn().mockRejectedValue(new Error('not found')),
  writeFile: vi.fn().mockResolvedValue(undefined),
  mkdir: vi.fn().mockResolvedValue(undefined),
}));

// Mock LLM and skill engine
vi.mock('../apps/backend/src/services/llmService.js', () => ({
  chatCompletion: vi.fn(async () => ({
    content: [{ type: 'text', text: 'Mocked AI output' }],
    usage: { input_tokens: 100, output_tokens: 50 },
  })),
}));

vi.mock('../apps/backend/src/services/skillEngine.js', () => ({
  assemblePrompt: vi.fn(() => 'You are an academic writing assistant.'),
}));

const { PipelineV2, createPipelineV2 } = await import('../apps/backend/src/services/pipeline/pipelineEngine.js');

describe('PipelineV2 Engine', () => {
  const simpleDef = {
    name: 'Test Pipeline',
    description: 'A test pipeline',
    stages: [
      { name: 'stage-1', type: STAGE_TYPES.AI, description: 'First', config: { skill: 'polish' } },
      { name: 'stage-2', type: STAGE_TYPES.HUMAN, description: 'Review', config: { prompt: 'Check it', actions: ['approve', 'reject'] } },
      { name: 'stage-3', type: STAGE_TYPES.AI, description: 'Final', config: { skill: 'revise' } },
    ],
  };

  describe('constructor and start', () => {
    it('creates pipeline with correct initial state', () => {
      const p = new PipelineV2({ name: 'Test', description: 'Desc', stages: simpleDef.stages, projectId: 'proj1', projectPath: '/tmp/proj' });
      expect(p.name).toBe('Test');
      expect(p.stages).toHaveLength(3);
      expect(p.status).toBe('created');
      expect(p.currentStage).toBe(0);
    });

    it('start() sets status to running and first stage to running', () => {
      const p = new PipelineV2({ name: 'Test', description: 'Desc', stages: simpleDef.stages, projectId: 'proj1', projectPath: '/tmp/proj' });
      p.start();
      expect(p.status).toBe('running');
      expect(p.stages[0].status).toBe(STAGE_STATUS.RUNNING);
      expect(p.stages[0].startedAt).not.toBeNull();
    });
  });

  describe('createPipelineV2', () => {
    it('creates and starts a pipeline from valid definition', async () => {
      const p = await createPipelineV2(simpleDef, 'proj1', '/tmp/proj');
      expect(p.id).toBeTruthy();
      expect(p.status).toBe('running');
      expect(p.stages[0].status).toBe(STAGE_STATUS.RUNNING);
    });

    it('throws on invalid stage definition', async () => {
      const badDef = { name: 'Bad', description: 'x', stages: [{ name: 'x', type: 'invalid', config: {} }] };
      await expect(createPipelineV2(badDef, 'p', '/tmp')).rejects.toThrow('Invalid pipeline');
    });
  });

  describe('runCurrentStage with AI executor', () => {
    it('completes AI stage and advances', async () => {
      const p = new PipelineV2({ name: 'Test', description: 'Desc', stages: simpleDef.stages, projectId: 'proj1', projectPath: '/tmp/proj' });
      p.start();

      const result = await p.runCurrentStage('Some input text');
      expect(result.status).toBe(STAGE_STATUS.COMPLETED);
      expect(result.output).toBe('Mocked AI output');
      expect(p.outputs['stage-1']).toBe('Mocked AI output');
      expect(p.currentStage).toBe(1);
      expect(p.stages[1].status).toBe(STAGE_STATUS.RUNNING);
    });
  });

  describe('human checkpoint flow', () => {
    it('pauses pipeline at human stage', async () => {
      const humanOnlyDef = {
        name: 'Human Test',
        description: 'x',
        stages: [
          { name: 'checkpoint', type: STAGE_TYPES.HUMAN, description: 'Review', config: { prompt: 'Check this', actions: ['approve', 'reject', 'skip'] } },
        ],
      };
      const p = new PipelineV2({ name: 'H', description: 'x', stages: humanOnlyDef.stages, projectId: 'p', projectPath: '/tmp' });
      p.start();

      const result = await p.runCurrentStage('input');
      expect(result.status).toBe(STAGE_STATUS.WAITING);
      expect(p.status).toBe('waiting');
    });

    it('resolveHumanCheckpoint with approve completes and advances', async () => {
      const stages = [
        { name: 'checkpoint', type: STAGE_TYPES.HUMAN, description: 'Review', config: { prompt: 'Check', actions: ['approve', 'reject'] } },
        { name: 'next', type: STAGE_TYPES.AI, description: 'Next', config: { skill: 'x' } },
      ];
      const p = new PipelineV2({ name: 'H', description: 'x', stages, projectId: 'p', projectPath: '/tmp' });
      p.start();
      await p.runCurrentStage('input');
      expect(p.status).toBe('waiting');

      const result = p.resolveHumanCheckpoint('approve', 'Looks good');
      expect(result.status).toBe(STAGE_STATUS.COMPLETED);
      expect(p.status).toBe('running');
      expect(p.currentStage).toBe(1);
    });

    it('resolveHumanCheckpoint with reject fails pipeline', async () => {
      const stages = [
        { name: 'checkpoint', type: STAGE_TYPES.HUMAN, description: 'Review', config: { prompt: 'Check', actions: ['approve', 'reject'] } },
      ];
      const p = new PipelineV2({ name: 'H', description: 'x', stages, projectId: 'p', projectPath: '/tmp' });
      p.start();
      await p.runCurrentStage('input');

      const result = p.resolveHumanCheckpoint('reject', 'Not good enough');
      expect(result.status).toBe(STAGE_STATUS.FAILED);
      expect(p.status).toBe('failed');
    });

    it('resolveHumanCheckpoint with skip advances', async () => {
      const stages = [
        { name: 'checkpoint', type: STAGE_TYPES.HUMAN, description: 'Review', config: { prompt: 'Check', actions: ['approve', 'skip'] } },
        { name: 'next', type: STAGE_TYPES.AI, description: 'Next', config: { skill: 'x' } },
      ];
      const p = new PipelineV2({ name: 'H', description: 'x', stages, projectId: 'p', projectPath: '/tmp' });
      p.start();
      await p.runCurrentStage('input');

      const result = p.resolveHumanCheckpoint('skip');
      expect(result.status).toBe(STAGE_STATUS.SKIPPED);
      expect(p.status).toBe('running');
      expect(p.currentStage).toBe(1);
    });

    it('resolveHumanCheckpoint with edit stores edited content', async () => {
      const stages = [
        { name: 'checkpoint', type: STAGE_TYPES.HUMAN, description: 'Review', config: { prompt: 'Check', actions: ['approve', 'edit'] } },
      ];
      const p = new PipelineV2({ name: 'H', description: 'x', stages, projectId: 'p', projectPath: '/tmp' });
      p.start();
      await p.runCurrentStage('input');

      const result = p.resolveHumanCheckpoint('edit', 'My edited content');
      expect(result.status).toBe(STAGE_STATUS.COMPLETED);
      expect(result.output).toBe('My edited content');
      expect(p.outputs['checkpoint']).toBe('My edited content');
    });
  });

  describe('pipeline control', () => {
    it('pause and resume', () => {
      const p = new PipelineV2({ name: 'T', description: 'x', stages: simpleDef.stages, projectId: 'p', projectPath: '/tmp' });
      p.start();
      p.pause();
      expect(p.status).toBe('paused');
      p.resume();
      expect(p.status).toBe('running');
    });

    it('skip advances to next stage', () => {
      const p = new PipelineV2({ name: 'T', description: 'x', stages: simpleDef.stages, projectId: 'p', projectPath: '/tmp' });
      p.start();
      p.skip();
      expect(p.currentStage).toBe(1);
      expect(p.stages[0].status).toBe(STAGE_STATUS.SKIPPED);
    });

    it('skip on last stage completes pipeline', () => {
      const p = new PipelineV2({ name: 'T', description: 'x', stages: [simpleDef.stages[0]], projectId: 'p', projectPath: '/tmp' });
      p.start();
      p.skip();
      expect(p.status).toBe('completed');
    });

    it('retryCurrentStage resets stage to pending', () => {
      const p = new PipelineV2({ name: 'T', description: 'x', stages: simpleDef.stages, projectId: 'p', projectPath: '/tmp' });
      p.start();
      p.stages[0].status = STAGE_STATUS.FAILED;
      p.stages[0].error = 'some error';
      p.status = 'failed';

      p.retryCurrentStage('Try again with more detail');
      expect(p.stages[0].status).toBe(STAGE_STATUS.PENDING);
      expect(p.stages[0].output).toBeNull();
      expect(p.stages[0].metadata.retryFeedback).toBe('Try again with more detail');
      expect(p.status).toBe('running');
    });
  });

  describe('toJSON and serialization', () => {
    it('serializes all pipeline state', () => {
      const p = new PipelineV2({ name: 'Test', description: 'Desc', stages: simpleDef.stages, projectId: 'proj1', projectPath: '/tmp/proj', options: { chapterScope: 'intro.tex' } });
      p.start();
      const json = p.toJSON();
      expect(json.id).toBeTruthy();
      expect(json.name).toBe('Test');
      expect(json.stages).toHaveLength(3);
      expect(json.chapterScope).toBe('intro.tex');
      expect(json.status).toBe('running');
      expect(json.outputs).toEqual({});
    });
  });
});

describe('resolveHumanStage (unit)', () => {
  const stage = { output: 'Some content', metadata: {} };

  it('approve returns completed', () => {
    const r = resolveHumanStage(stage, 'approve', 'LGTM');
    expect(r.status).toBe(STAGE_STATUS.COMPLETED);
    expect(r.metadata.action).toBe('approved');
    expect(r.metadata.feedback).toBe('LGTM');
  });

  it('reject returns failed', () => {
    const r = resolveHumanStage(stage, 'reject', 'Needs work');
    expect(r.status).toBe(STAGE_STATUS.FAILED);
    expect(r.error).toBe('Needs work');
  });

  it('skip returns skipped', () => {
    const r = resolveHumanStage(stage, 'skip');
    expect(r.status).toBe(STAGE_STATUS.SKIPPED);
  });

  it('edit returns completed with feedback as output', () => {
    const r = resolveHumanStage(stage, 'edit', 'Edited text');
    expect(r.status).toBe(STAGE_STATUS.COMPLETED);
    expect(r.output).toBe('Edited text');
    expect(r.metadata.action).toBe('edited');
  });

  it('unknown action returns failed', () => {
    const r = resolveHumanStage(stage, 'unknown');
    expect(r.status).toBe(STAGE_STATUS.FAILED);
    expect(r.error).toContain('Unknown human action');
  });
});
