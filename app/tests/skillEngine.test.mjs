import { describe, it, expect } from 'vitest';
import { loadSkills, listSkills, getSkill, assemblePrompt } from '../apps/backend/src/services/skillEngine.js';

describe('Skill Engine', () => {
  it('loads built-in skills from skills directory', async () => {
    await loadSkills(null);
    const skills = listSkills();
    expect(skills.length).toBeGreaterThanOrEqual(20);
  });

  it('each skill has required fields in listing', async () => {
    const skills = listSkills();
    for (const skill of skills) {
      expect(skill.name).toBeTruthy();
      expect(skill.display_name).toBeTruthy();
      expect(skill.description).toBeTruthy();
      expect(skill.type).toBeTruthy();
      expect(skill.trigger).toBeTruthy();
    }
  });

  it('getSkill returns specific skill by name with prompt', async () => {
    const skill = getSkill('ml-paper-writing');
    expect(skill).toBeTruthy();
    expect(skill.name).toBe('ml-paper-writing');
    expect(skill.type).toBe('writing');
    expect(skill.prompt).toBeTruthy();
  });

  it('getSkill returns undefined for non-existent skill', async () => {
    const skill = getSkill('non-existent-skill-xyz');
    expect(skill).toBeUndefined();
  });

  it('skills cover all required types', async () => {
    const skills = listSkills();
    const types = new Set(skills.map(s => s.type));
    expect(types.has('writing')).toBe(true);
    expect(types.has('review')).toBe(true);
    expect(types.has('analysis')).toBe(true);
    expect(types.has('utility')).toBe(true);
    expect(types.has('research')).toBe(true);
  });

  it('skills have correct trigger modes', async () => {
    const skills = listSkills();
    const triggers = new Set(skills.map(s => s.trigger));
    expect(triggers.has('manual')).toBe(true);
  });

  it('assemblePrompt combines global and chapter skills', async () => {
    const prompt = assemblePrompt({ globalSkills: ['ml-paper-writing'], chapterSkills: ['nature-polishing'] });
    expect(prompt).toContain('ML');
    expect(prompt).toContain('Nature');
  });

  it('assemblePrompt with no skills returns base prompt', async () => {
    const prompt = assemblePrompt({ globalSkills: [], chapterSkills: [] });
    expect(prompt).toBe('You are an academic writing assistant.');
  });

  it('assemblePrompt includes manual skill when provided', async () => {
    const prompt = assemblePrompt({ globalSkills: [], chapterSkills: [], manualSkill: 'writing-anti-ai' });
    expect(prompt).toContain('AI');
  });
});
