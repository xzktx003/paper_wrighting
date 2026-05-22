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
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        <div style={{ padding: '12px', fontWeight: 'bold', borderBottom: '1px solid #e0e0e0' }}>
          Project
        </div>
        <div style={{ flex: 1, padding: '16px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
          <p style={{ color: '#888' }}>No project open</p>
          <button style={{ padding: '6px 12px', border: '1px solid #ddd', borderRadius: '4px', cursor: 'pointer', background: '#fff' }}>Open Project</button>
          <button style={{ padding: '6px 12px', border: '1px solid #ddd', borderRadius: '4px', cursor: 'pointer', background: '#fff' }}>New Project</button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ padding: '8px 12px', fontWeight: 'bold', borderBottom: '1px solid #e0e0e0', fontSize: '14px' }}>
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
      <div style={{ borderTop: '1px solid #e0e0e0', maxHeight: '40%', overflow: 'auto' }}>
        <div style={{ padding: '6px 8px', fontWeight: 600, fontSize: '12px' }}>Skills</div>
        <SkillPanel
          globalSkills={globalSkills}
          chapterSkills={chapterSkills}
          onActivateSkill={onActivateSkill}
        />
      </div>
    </div>
  );
}
