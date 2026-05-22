import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { LeftPanel } from './LeftPanel';
import { CenterPanel } from './CenterPanel';
import { RightPanel } from './RightPanel';

export function Layout() {
  const app = useApp();
  const navigate = useNavigate();
  const [leftWidth, setLeftWidth] = useState(250);
  const [rightWidth, setRightWidth] = useState(380);

  const currentChapterSkills = (() => {
    if (app.activeFileIndex < 0) return [];
    const file = app.openFiles[app.activeFileIndex];
    if (!file || file.type !== 'chapter' || !app.project.config) return [];
    const ch = app.project.config.chapters?.find(c => c.file === file.filename);
    return ch?.skills || [];
  })();

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
      <div style={{ width: leftWidth, minWidth: 200, borderRight: '1px solid #e0e0e0', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        <div style={{ height: '32px', display: 'flex', alignItems: 'center', padding: '0 8px', borderBottom: '1px solid #e0e0e0', background: '#fafafa' }}>
          <button
            onClick={() => navigate('/projects')}
            style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '4px', color: '#555', padding: '2px 4px', borderRadius: '3px' }}
            onMouseEnter={e => (e.currentTarget.style.background = '#e0e0e0')}
            onMouseLeave={e => (e.currentTarget.style.background = 'none')}
          >
            ← Back
          </button>
        </div>
        <div style={{ flex: 1, overflow: 'hidden' }}>
          <LeftPanel
            projectPath={app.project.path}
            config={app.project.config}
            onFileSelect={app.openFile}
            onChapterReorder={() => {}}
            globalSkills={app.project.config?.global_skills || []}
            chapterSkills={currentChapterSkills}
            onActivateSkill={app.activateSkill}
          />
        </div>
      </div>
      <ResizeHandle onResize={(delta) => setLeftWidth(w => Math.max(200, w + delta))} />
      <div style={{ flex: 1, overflow: 'hidden' }}>
        <CenterPanel
          openFiles={app.openFiles}
          activeFileIndex={app.activeFileIndex}
          onFileChange={app.updateFileContent}
          onTabSelect={app.setActiveFileIndex}
          onTabClose={app.closeFile}
          terminalVisible={app.terminalVisible}
          onToggleTerminal={app.toggleTerminal}
          projectPath={app.project.path || undefined}
        />
      </div>
      <ResizeHandle onResize={(delta) => setRightWidth(w => Math.max(300, w - delta))} />
      <div style={{ width: rightWidth, minWidth: 300, borderLeft: '1px solid #e0e0e0', overflow: 'hidden' }}>
        <RightPanel
          conversations={app.conversations}
          activeConv={app.activeConv}
          loading={app.convLoading}
          chapters={app.project.config?.chapters || []}
          skills={app.skills}
          onSelect={app.selectConversation}
          onClose={app.removeConversation}
          onCreate={app.createConversation}
          onSend={app.sendMessage}
          onRename={app.renameConversation}
        />
      </div>
    </div>
  );
}

function ResizeHandle({ onResize }: { onResize: (delta: number) => void }) {
  const handleMouseDown = (e: React.MouseEvent) => {
    const startX = e.clientX;
    const handleMouseMove = (ev: MouseEvent) => onResize(ev.clientX - startX);
    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };
  return <div onMouseDown={handleMouseDown} style={{ width: 4, cursor: 'col-resize', background: 'transparent' }} />;
}
