import { describe, it, expect } from 'vitest';
import { listPresets, getPreset, PIPELINE_PRESETS } from '../apps/backend/src/services/pipeline/presets.js';
import { validateStageDefinition } from '../apps/backend/src/services/pipeline/stageTypes.js';

describe('Pipeline Presets', () => {
  it('lists all presets with correct structure', () => {
    const presets = listPresets();
    expect(presets.length).toBeGreaterThanOrEqual(5);
    for (const p of presets) {
      expect(p.id).toBeTruthy();
      expect(p.name).toBeTruthy();
      expect(p.description).toBeTruthy();
      expect(p.stageCount).toBeGreaterThan(0);
      expect(p.stages.length).toBe(p.stageCount);
    }
  });

  it('getPreset returns correct preset', () => {
    const p = getPreset('writing-flow');
    expect(p).not.toBeNull();
    expect(p.name).toBe('Writing Flow');
    expect(p.stages.length).toBe(6);
  });

  it('getPreset returns null for unknown', () => {
    expect(getPreset('nonexistent')).toBeNull();
  });

  describe('all preset stages pass validation', () => {
    for (const [presetId, preset] of Object.entries(PIPELINE_PRESETS)) {
      it(`preset "${presetId}" has all valid stages`, () => {
        for (const stage of preset.stages) {
          const err = validateStageDefinition(stage);
          expect(err, `Stage "${stage.name}" in "${presetId}": ${err}`).toBeNull();
        }
      });
    }
  });

  it('writing-flow preset has correct stage types', () => {
    const p = getPreset('writing-flow');
    expect(p.stages[0].type).toBe('ai');       // outline
    expect(p.stages[1].type).toBe('human');    // outline-review
    expect(p.stages[2].type).toBe('ai');       // draft
    expect(p.stages[3].type).toBe('ai');       // polish
    expect(p.stages[4].type).toBe('ai');       // review
    expect(p.stages[5].type).toBe('human');    // review-checkpoint
  });

  it('paper-pipeline preset includes citation and compile stages', () => {
    const p = getPreset('paper-pipeline');
    const types = p.stages.map(s => s.type);
    expect(types).toContain('citation');
    expect(types).toContain('compile');
  });

  it('executable-paper preset includes compute stages', () => {
    const p = getPreset('executable-paper');
    const types = p.stages.map(s => s.type);
    expect(types.filter(t => t === 'compute').length).toBe(2);
    expect(types).toContain('human');
    expect(types).toContain('compile');
  });

  it('all presets have unique stage names within each pipeline', () => {
    for (const [presetId, preset] of Object.entries(PIPELINE_PRESETS)) {
      const names = preset.stages.map(s => s.name);
      const unique = new Set(names);
      expect(unique.size, `Duplicate stage names in "${presetId}"`).toBe(names.length);
    }
  });
});
