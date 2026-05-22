import React, { useState } from 'react';
import { ProjectConfig } from '../hooks/useProject';

interface Props {
  projectPath: string;
  config: ProjectConfig;
  onFileSelect: (file: { path: string; type: 'chapter' | 'code' | 'other' }) => void;
  onChapterReorder: (newOrder: string[]) => void;
}

export function ProjectTree({ projectPath, config, onFileSelect, onChapterReorder }: Props) {
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['chapters', 'code']));

  const toggleSection = (section: string) => {
    setExpandedSections(prev => {
      const next = new Set(prev);
      if (next.has(section)) next.delete(section);
      else next.add(section);
      return next;
    });
  };

  return (
    <div style={{ fontSize: '13px' }}>
      <div>
        <div
          onClick={() => toggleSection('chapters')}
          style={{ padding: '4px 8px', cursor: 'pointer', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}
        >
          <span>{expandedSections.has('chapters') ? '▼' : '▶'}</span>
          <span>Chapters</span>
        </div>
        {expandedSections.has('chapters') && (
          <div style={{ paddingLeft: '16px' }}>
            {(config.chapters || []).map((ch, i) => (
              <div
                key={ch.file}
                onClick={() => onFileSelect({ path: ch.file, type: 'chapter' })}
                style={{ padding: '3px 8px', cursor: 'pointer', borderRadius: '3px' }}
                onMouseEnter={e => (e.currentTarget.style.background = '#f0f0f0')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
              >
                <span style={{ color: '#666', marginRight: '6px' }}>{i + 1}.</span>
                {ch.file}
                {ch.skills.length > 0 && (
                  <span style={{ marginLeft: '8px', fontSize: '10px', color: '#999' }}>
                    [{ch.skills.length} skills]
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <div style={{ marginTop: '8px' }}>
        <div
          onClick={() => toggleSection('code')}
          style={{ padding: '4px 8px', cursor: 'pointer', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}
        >
          <span>{expandedSections.has('code') ? '▼' : '▶'}</span>
          <span>Code</span>
        </div>
        {expandedSections.has('code') && (
          <div style={{ paddingLeft: '16px' }}>
            <div
              onClick={() => onFileSelect({ path: 'src/', type: 'code' })}
              style={{ padding: '3px 8px', cursor: 'pointer', borderRadius: '3px' }}
              onMouseEnter={e => (e.currentTarget.style.background = '#f0f0f0')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
            >
              src/
            </div>
            <div
              onClick={() => onFileSelect({ path: 'notebooks/', type: 'code' })}
              style={{ padding: '3px 8px', cursor: 'pointer', borderRadius: '3px' }}
              onMouseEnter={e => (e.currentTarget.style.background = '#f0f0f0')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
            >
              notebooks/
            </div>
          </div>
        )}
      </div>

      <div style={{ marginTop: '8px' }}>
        <div
          onClick={() => toggleSection('figures')}
          style={{ padding: '4px 8px', cursor: 'pointer', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}
        >
          <span>{expandedSections.has('figures') ? '▼' : '▶'}</span>
          <span>Figures</span>
        </div>
      </div>
    </div>
  );
}
