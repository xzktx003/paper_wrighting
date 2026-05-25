import { STAGE_TYPES } from './stageTypes.js';

/**
 * Pipeline 2.0 Preset Templates
 * Composable pipeline definitions using typed stages.
 */

export const PIPELINE_PRESETS = {
  'writing-flow': {
    name: 'Writing Flow',
    description: 'Outline → Draft → Polish → Review — full paper writing pipeline',
    stages: [
      {
        name: 'outline',
        type: STAGE_TYPES.AI,
        description: 'Generate structured outline from topic/abstract',
        config: { skill: 'ars-outline', maxInputChars: 8000 },
      },
      {
        name: 'outline-review',
        type: STAGE_TYPES.HUMAN,
        description: 'Review and approve the outline before drafting',
        config: { prompt: 'Review the generated outline. Approve to proceed with drafting, or edit to refine.', actions: ['approve', 'edit', 'reject'], showOutput: 'outline' },
      },
      {
        name: 'draft',
        type: STAGE_TYPES.AI,
        description: 'Write first draft based on approved outline',
        config: { skill: 'ars-full', includeOutputs: ['outline', 'outline-review'], maxInputChars: 24000 },
      },
      {
        name: 'polish',
        type: STAGE_TYPES.AI,
        description: 'Polish manuscript for publication-quality English',
        config: { skill: 'nature-polishing', includeOutputs: ['draft'], maxInputChars: 24000 },
      },
      {
        name: 'review',
        type: STAGE_TYPES.AI,
        description: 'Peer review the polished manuscript',
        config: { skill: 'academic-paper-reviewer', includeOutputs: ['polish'], maxInputChars: 24000 },
      },
      {
        name: 'review-checkpoint',
        type: STAGE_TYPES.HUMAN,
        description: 'Review the peer review report and decide next steps',
        config: { prompt: 'Review the peer review report. Approve to finalize, or reject to revise.', actions: ['approve', 'reject', 'skip'], showOutput: 'review' },
      },
    ],
  },

  'paper-pipeline': {
    name: 'Paper Pipeline',
    description: 'Polish → Review → Revise → Compile — end-to-end paper processing',
    stages: [
      {
        name: 'polish',
        type: STAGE_TYPES.AI,
        description: 'Polish manuscript for publication-quality English',
        config: { skill: 'nature-polishing', maxInputChars: 24000 },
      },
      {
        name: 'review',
        type: STAGE_TYPES.AI,
        description: 'Peer review the polished manuscript',
        config: { skill: 'academic-paper-reviewer', includeOutputs: ['polish'], maxInputChars: 24000 },
      },
      {
        name: 'review-checkpoint',
        type: STAGE_TYPES.HUMAN,
        description: 'Approve review or request revision',
        config: { prompt: 'Review the peer review report. Approve to proceed with revision, or skip to go directly to compile.', actions: ['approve', 'skip', 'reject'], showOutput: 'review' },
      },
      {
        name: 'revise',
        type: STAGE_TYPES.AI,
        description: 'Revise based on review feedback',
        config: { skill: 'ars-revision', includeOutputs: ['polish', 'review'], maxInputChars: 24000 },
      },
      {
        name: 'citation-check',
        type: STAGE_TYPES.CITATION,
        description: 'Verify citations are complete and consistent',
        config: { action: 'verify' },
      },
      {
        name: 'compile',
        type: STAGE_TYPES.COMPILE,
        description: 'Compile final PDF',
        config: { engine: 'xelatex', mainFile: 'main.tex' },
      },
    ],
  },

  'quick-review': {
    name: 'Quick Review',
    description: 'Review → Revise — fast feedback loop',
    stages: [
      {
        name: 'review',
        type: STAGE_TYPES.AI,
        description: 'Quick peer review',
        config: { skill: 'academic-paper-reviewer', maxInputChars: 24000 },
      },
      {
        name: 'review-checkpoint',
        type: STAGE_TYPES.HUMAN,
        description: 'Review feedback and decide whether to revise',
        config: { prompt: 'Review the feedback. Approve to auto-revise, or skip to end.', actions: ['approve', 'skip'], showOutput: 'review' },
      },
      {
        name: 'revise',
        type: STAGE_TYPES.AI,
        description: 'Revise based on review',
        config: { skill: 'ars-revision', includeOutputs: ['review'], maxInputChars: 24000 },
      },
    ],
  },

  'citation-pipeline': {
    name: 'Citation Pipeline',
    description: 'Verify → Deduplicate → Discover — citation management',
    stages: [
      {
        name: 'verify',
        type: STAGE_TYPES.CITATION,
        description: 'Verify all citations match .bib entries',
        config: { action: 'verify' },
      },
      {
        name: 'deduplicate',
        type: STAGE_TYPES.CITATION,
        description: 'Find and merge duplicate entries',
        config: { action: 'deduplicate' },
      },
      {
        name: 'discover',
        type: STAGE_TYPES.CITATION,
        description: 'Suggest additional references',
        config: { action: 'discover' },
      },
      {
        name: 'review-suggestions',
        type: STAGE_TYPES.HUMAN,
        description: 'Review suggested citations before adding',
        config: { prompt: 'Review the suggested citations. Approve to add them to your .bib file.', actions: ['approve', 'edit', 'skip'], showOutput: 'discover' },
      },
    ],
  },

  'executable-paper': {
    name: 'Executable Paper',
    description: 'Run Code → Generate Figures → Compile — reproducible paper',
    stages: [
      {
        name: 'run-experiments',
        type: STAGE_TYPES.COMPUTE,
        description: 'Execute experiment scripts',
        config: { command: 'python', args: ['src/main.py'], timeoutMs: 600_000 },
      },
      {
        name: 'generate-figures',
        type: STAGE_TYPES.COMPUTE,
        description: 'Generate figures from results',
        config: { command: 'python', args: ['src/plot.py'], timeoutMs: 120_000 },
      },
      {
        name: 'verify-outputs',
        type: STAGE_TYPES.HUMAN,
        description: 'Verify generated figures and results',
        config: { prompt: 'Check that all figures and results were generated correctly.', actions: ['approve', 'reject'] },
      },
      {
        name: 'compile',
        type: STAGE_TYPES.COMPILE,
        description: 'Compile paper with generated figures',
        config: { engine: 'xelatex', mainFile: 'main.tex' },
      },
    ],
  },
};

export function getPreset(name) {
  return PIPELINE_PRESETS[name] || null;
}

export function listPresets() {
  return Object.entries(PIPELINE_PRESETS).map(([id, def]) => ({
    id,
    name: def.name,
    description: def.description,
    stageCount: def.stages.length,
    stages: def.stages.map(s => ({ name: s.name, type: s.type, description: s.description })),
  }));
}
