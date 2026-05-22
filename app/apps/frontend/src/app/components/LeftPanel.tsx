import React from 'react';
import { ProjectTree } from './ProjectTree';
import { SkillPanel } from './SkillPanel';
import { ProjectConfig } from '../hooks/useProject';

interface Props {
  projectPath: string | null;
  config: ProjectConfig | null;
  onFileSelect: (file: { path: string; type: 'chapter' | 'code' | 'other' }) => void;
  onChapterReorder: (newOrder: string[]) => void;
  globalSkills?: string[];
  chapterSkills?: string[];
  onActivateSkill?: (skillName: string) => void;
}

export function LeftPanel({ projectPath, config, onFileSelect, onChapterReorder, globalSkills = [], chapterSkills = [], onActivateSkill = () => {} }: Props) {
  if (!projectPath || !config) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: 'var(--panel)' }}>
        <div style={{ padding: '12px 14px', fontWeight: 600, fontSize: '13px', borderBottom: '1px solid var(--border)', color: 'var(--text)' }}>
          Project
        </div>
        <div style={{ flex: 1, padding: '24px 16px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '12px' }}>
          <div style={{ fontSize: '28px', opacity: 0.3 }}>📂</div>
          <p style={{ color: 'var(--muted)', fontSize: '13px', margin: 0 }}>No project open</p>
          <button style={{ padding: '7px 16px', border: '1px solid var(--border)', borderRadius: '8px', cursor: 'pointer', background: 'var(--paper)', color: 'var(--text)', fontSize: '12px', fontWeight: 500, transition: 'all 0.15s' }}>Open Project</button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: 'var(--panel)' }}>
      <div style={{ padding: '10px 14px', fontWeight: 600, borderBottom: '1px solid var(--border)', fontSize: '13px', color: 'var(--text)', background: 'var(--panel-muted)' }}>
        {config.title || 'Untitled'}
      </div>
      <div style={{ flex: 1, overflow: 'auto', padding: '4px 0' }}>
        <ProjectTree
          projectPath={projectPath}
          config={config}
          onFileSelect={onFileSelect}
          onChapterReorder={onChapterReorder}
        />
      </div>
      <div style={{ borderTop: '1px solid var(--border)', maxHeight: '40%', overflow: 'auto', background: 'var(--panel-muted)' }}>
        <div style={{ padding: '8px 12px', fontWeight: 600, fontSize: '11px', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Skills</div>
        <SkillPanel
          globalSkills={globalSkills}
          chapterSkills={chapterSkills}
          onActivateSkill={onActivateSkill}
        />
      </div>
    </div>
  );
}
