import React, { useState, useCallback } from 'react';
import { ProjectTree } from './ProjectTree';
import { VisionPanel } from './VisionPanel';
import { PaperSearchPanel } from './PaperSearchPanel';
import { WebsearchPanel } from './WebsearchPanel';
import { PlotPanel } from './PlotPanel';
import { ProjectConfig } from '../hooks/useProject';

type LeftTab = 'files' | 'agent' | 'vision' | 'paper' | 'websearch' | 'plot';

interface Props {
  projectPath: string | null;
  config: ProjectConfig | null;
  onFileSelect: (file: { path: string; type: 'chapter' | 'code' | 'other' }) => void;
  onChapterReorder: (newOrder: string[]) => void;
}

const TABS: { key: LeftTab; label: string }[] = [
  { key: 'files', label: 'Files' },
  { key: 'agent', label: 'Agent' },
  { key: 'vision', label: 'Vision' },
  { key: 'paper', label: 'Paper search' },
  { key: 'websearch', label: 'Websearch' },
  { key: 'plot', label: 'Plot' },
];

export function LeftPanel({ projectPath, config, onFileSelect, onChapterReorder }: Props) {
  const [activeTab, setActiveTab] = useState<LeftTab>('files');

  const insertAtCursor = useCallback((text: string) => {
    window.dispatchEvent(new CustomEvent('editor-insert-text', { detail: text }));
  }, []);

  if (!projectPath || !config) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: 'var(--panel)' }}>
        <div style={{ padding: '12px 14px', fontWeight: 600, fontSize: '13px', borderBottom: '1px solid var(--border)', color: 'var(--text)' }}>
          Project
        </div>
        <div style={{ flex: 1, padding: '24px 16px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '12px' }}>
          <div style={{ fontSize: '28px', opacity: 0.3 }}>📂</div>
          <p style={{ color: 'var(--muted)', fontSize: '13px', margin: 0 }}>No project open</p>
        </div>
      </div>
    );
  }

  const projectId = projectPath;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: 'var(--panel)' }}>
      {/* Tab bar */}
      <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', background: 'var(--panel-muted)', flexShrink: 0, overflow: 'auto' }}>
        {TABS.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            style={{
              flex: '0 0 auto',
              padding: '7px 10px',
              border: 'none',
              borderBottom: activeTab === tab.key ? '2px solid var(--accent)' : '2px solid transparent',
              background: 'none',
              color: activeTab === tab.key ? 'var(--accent-strong)' : 'var(--muted)',
              fontSize: '11px',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.15s',
              whiteSpace: 'nowrap',
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div style={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
        {activeTab === 'files' && (
          <div style={{ padding: '4px 0' }}>
            <ProjectTree
              projectPath={projectPath}
              config={config}
              onFileSelect={onFileSelect}
              onChapterReorder={onChapterReorder}
            />
          </div>
        )}

        {activeTab === 'agent' && (
          <div style={{ padding: '16px 14px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '12px', color: 'var(--muted)' }}>
            <div style={{ fontSize: '24px', opacity: 0.3 }}>🤖</div>
            <p style={{ fontSize: '12px', margin: 0, textAlign: 'center' }}>Agent mode is available in the Chat panel (right side). Create a conversation with "Agent" mode to propose edits.</p>
          </div>
        )}

        {activeTab === 'vision' && (
          <VisionPanel projectId={projectId} onInsert={insertAtCursor} />
        )}

        {activeTab === 'paper' && (
          <PaperSearchPanel projectId={projectId} onInsertCitation={insertAtCursor} />
        )}

        {activeTab === 'websearch' && (
          <WebsearchPanel projectId={projectId} onInsertCitation={insertAtCursor} />
        )}

        {activeTab === 'plot' && (
          <PlotPanel
            projectId={projectId}
            onInsert={(path) => insertAtCursor(`\\includegraphics[width=\\linewidth]{${path}}`)}
          />
        )}
      </div>
    </div>
  );
}
