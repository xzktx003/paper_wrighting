import { describe, it, expect, vi, beforeEach } from 'vitest';
import { STAGE_TYPES, STAGE_STATUS, createStageInstance, validateStageDefinition } from '../apps/backend/src/services/pipeline/stageTypes.js';

describe('stageTypes', () => {
  describe('createStageInstance', () => {
    it('creates a stage instance with correct defaults', () => {
      const def = { name: 'test-stage', type: STAGE_TYPES.AI, description: 'Test', config: { skill: 'polish' } };
      const instance = createStageInstance(def, 2);
      expect(instance.name).toBe('test-stage');
      expect(instance.type).toBe('ai');
      expect(instance.index).toBe(2);
      expect(instance.status).toBe(STAGE_STATUS.PENDING);
      expect(instance.output).toBeNull();
      expect(instance.error).toBeNull();
      expect(instance.startedAt).toBeNull();
      expect(instance.completedAt).toBeNull();
      expect(instance.metadata).toEqual({});
    });
  });

  describe('validateStageDefinition', () => {
    it('returns null for valid AI stage', () => {
      const def = { name: 'ai-stage', type: STAGE_TYPES.AI, config: { skill: 'polish' } };
      expect(validateStageDefinition(def)).toBeNull();
    });

    it('returns null for valid compute stage', () => {
      const def = { name: 'compute', type: STAGE_TYPES.COMPUTE, config: { command: 'python' } };
      expect(validateStageDefinition(def)).toBeNull();
    });

    it('returns null for valid human stage', () => {
      const def = { name: 'human', type: STAGE_TYPES.HUMAN, config: { prompt: 'Review this' } };
      expect(validateStageDefinition(def)).toBeNull();
    });

    it('returns null for valid citation stage', () => {
      const def = { name: 'cite', type: STAGE_TYPES.CITATION, config: { action: 'verify' } };
      expect(validateStageDefinition(def)).toBeNull();
    });

    it('returns null for valid compile stage', () => {
      const def = { name: 'compile', type: STAGE_TYPES.COMPILE, config: { engine: 'xelatex' } };
      expect(validateStageDefinition(def)).toBeNull();
    });

    it('returns error for missing name', () => {
      const def = { type: STAGE_TYPES.AI, config: { skill: 'x' } };
      expect(validateStageDefinition(def)).toContain('name');
    });

    it('returns error for invalid type', () => {
      const def = { name: 'x', type: 'invalid', config: {} };
      expect(validateStageDefinition(def)).toContain('Invalid stage type');
    });

    it('returns error for missing config', () => {
      const def = { name: 'x', type: STAGE_TYPES.AI };
      expect(validateStageDefinition(def)).toContain('config');
    });

    it('returns error for AI stage without skill', () => {
      const def = { name: 'x', type: STAGE_TYPES.AI, config: {} };
      expect(validateStageDefinition(def)).toContain('skill');
    });

    it('returns error for compute stage without command', () => {
      const def = { name: 'x', type: STAGE_TYPES.COMPUTE, config: {} };
      expect(validateStageDefinition(def)).toContain('command');
    });

    it('returns error for human stage without prompt', () => {
      const def = { name: 'x', type: STAGE_TYPES.HUMAN, config: {} };
      expect(validateStageDefinition(def)).toContain('prompt');
    });

    it('returns error for citation stage without action', () => {
      const def = { name: 'x', type: STAGE_TYPES.CITATION, config: {} };
      expect(validateStageDefinition(def)).toContain('action');
    });

    it('returns error for compile stage without engine', () => {
      const def = { name: 'x', type: STAGE_TYPES.COMPILE, config: {} };
      expect(validateStageDefinition(def)).toContain('engine');
    });
  });
});
