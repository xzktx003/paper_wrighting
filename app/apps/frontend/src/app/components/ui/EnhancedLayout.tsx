import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../../context/AppContext';
import { EnhancedLeftPanel } from './EnhancedLeftPanel';
import { EnhancedCenterPanel } from './EnhancedCenterPanel';
import { EnhancedRightPanel } from './EnhancedRightPanel';
import { useTheme, ThemeToggle } from '../ThemeToggle';
import { tokens, Tooltip } from './DesignSystem';

export function EnhancedLayout() {
  const app = useApp();
  const navigate = useNavigate();
  const { theme, setTheme } = useTheme();
  const [leftWidth, setLeftWidth] = useState(260);
  const [rightWidth, setRightWidth] = useState(380);
  const [leftCollapsed, setLeftCollapsed] = useState(false);
  const [rightCollapsed, setRightCollapsed] = useState(false);

  const currentChapterSkills = (() => {
    if (app.activeFileIndex < 0) return [];
    const file = app.openFiles[app.activeFileIndex];
    if (!file || file.type !== 'chapter' || !app.project.config) return [];
    const ch = app.project.config.chapters?.find(c => c.file === file.filename);
    return ch?.skills || [];
  })();

  return (
    <div style={{
      display: 'flex',
      height: '100vh',
      overflow: 'hidden',
      background: 'var(--bg)',
    }}>
      {/* Left Panel - File Tree */}
      {leftCollapsed ? (
        <CollapsedPanel
          icon="📁"
          title="文件"
          onExpand={() => setLeftCollapsed(false)}
          accentColor="var(--zone-files-accent)"
        />
      ) : (
        <div style={{
          width: leftWidth,
          minWidth: 200,
          maxWidth: 400,
          borderRight: '1px solid var(--border)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          background: 'var(--panel)',
          transition: `width ${tokens.transition.normal}`,
        }}>
          {/* Header */}
          <div style={{
            height: '42px',
            display: 'flex',
            alignItems: 'center',
            padding: '0 10px',
            borderBottom: '1px solid var(--border)',
            background: 'var(--panel-muted)',
            flexShrink: 0,
            gap: '8px',
          }}>
            {/* Zone indicator */}
            <div style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              background: 'var(--zone-files-accent)',
              boxShadow: `0 0 8px var(--zone-files-accent)`,
            }} />

            {/* Back button */}
            <button
              onClick={() => navigate('/projects')}
              style={{
                border: 'none',
                background: 'none',
                cursor: 'pointer',
                fontSize: '12px',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                color: 'var(--text-secondary)',
                padding: '4px 8px',
                borderRadius: tokens.radius.md,
                transition: `all ${tokens.transition.fast}`,
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'var(--hover)';
                e.currentTarget.style.color = 'var(--accent-strong)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'none';
                e.currentTarget.style.color = 'var(--text-secondary)';
              }}
            >
              ← 返回
            </button>

            {/* Theme toggle */}
            <ThemeToggle theme={theme} onThemeChange={setTheme} />

            {/* Collapse button */}
            <Tooltip content="折叠面板" position="bottom">
              <button
                onClick={() => setLeftCollapsed(true)}
                style={{
                  marginLeft: 'auto',
                  border: 'none',
                  background: 'none',
                  cursor: 'pointer',
                  fontSize: '11px',
                  color: 'var(--muted)',
                  padding: '4px 6px',
                  borderRadius: tokens.radius.md,
                  transition: `all ${tokens.transition.fast}`,
                }}
                onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--accent)')}
                onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--muted)')}
              >
                ◀
              </button>
            </Tooltip>
          </div>

          {/* Content */}
          <div style={{ flex: 1, overflow: 'hidden' }}>
            <EnhancedLeftPanel
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
      )}

      {/* Left resize handle */}
      {!leftCollapsed && (
        <ResizeHandle
          onResize={(delta) => setLeftWidth(w => Math.max(200, Math.min(400, w + delta)))}
          accentColor="var(--zone-files-accent)"
        />
      )}

      {/* Center Panel - Editor */}
      <div style={{
        flex: 1,
        overflow: 'hidden',
        borderLeft: '1px solid var(--border)',
        borderRight: '1px solid var(--border)',
        background: 'var(--bg)',
      }}>
        <EnhancedCenterPanel
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

      {/* Right resize handle */}
      {!rightCollapsed && (
        <ResizeHandle
          onResize={(delta) => setRightWidth(w => Math.max(300, Math.min(500, w - delta)))}
          accentColor="var(--zone-ai-accent)"
        />
      )}

      {/* Right Panel - AI Assistant */}
      {rightCollapsed ? (
        <CollapsedPanel
          icon="🤖"
          title="AI"
          onExpand={() => setRightCollapsed(false)}
          accentColor="var(--zone-ai-accent)"
        />
      ) : (
        <div style={{
          width: rightWidth,
          minWidth: 300,
          maxWidth: 600,
          borderLeft: '1px solid var(--border)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          background: 'var(--panel)',
          transition: `width ${tokens.transition.normal}`,
        }}>
          {/* Header */}
          <div style={{
            height: '42px',
            display: 'flex',
            alignItems: 'center',
            padding: '0 12px',
            borderBottom: '1px solid var(--border)',
            background: 'var(--panel-muted)',
            flexShrink: 0,
            gap: '8px',
          }}>
            {/* Zone indicator */}
            <div style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              background: 'var(--zone-ai-accent)',
              boxShadow: `0 0 8px var(--zone-ai-accent)`,
            }} />

            <span style={{
              fontSize: '12px',
              fontWeight: 600,
              color: 'var(--text)',
              letterSpacing: '0.02em',
            }}>
              AI 助手
            </span>

            {/* Collapse button */}
            <Tooltip content="折叠面板" position="bottom">
              <button
                onClick={() => setRightCollapsed(true)}
                style={{
                  marginLeft: 'auto',
                  border: 'none',
                  background: 'none',
                  cursor: 'pointer',
                  fontSize: '11px',
                  color: 'var(--muted)',
                  padding: '4px 6px',
                  borderRadius: tokens.radius.md,
                  transition: `all ${tokens.transition.fast}`,
                }}
                onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--accent)')}
                onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--muted)')}
              >
                ▶
              </button>
            </Tooltip>
          </div>

          {/* Content */}
          <div style={{ flex: 1, overflow: 'hidden' }}>
            <EnhancedRightPanel
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
      )}
    </div>
  );
}

// Resize Handle Component
function ResizeHandle({
  onResize,
  accentColor,
}: {
  onResize: (delta: number) => void;
  accentColor: string;
}) {
  const [active, setActive] = useState(false);

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setActive(true);
    let lastX = e.clientX;
    const handleMouseMove = (ev: MouseEvent) => {
      const delta = ev.clientX - lastX;
      lastX = ev.clientX;
      onResize(delta);
    };
    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      setActive(false);
    };
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  return (
    <div
      onMouseDown={handleMouseDown}
      style={{
        width: '6px',
        cursor: 'col-resize',
        background: 'transparent',
        position: 'relative',
        flexShrink: 0,
        transition: `background ${tokens.transition.fast}`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = 'var(--accent-soft)';
      }}
      onMouseLeave={(e) => {
        if (!active) e.currentTarget.style.background = 'transparent';
      }}
    >
      <div style={{
        width: '3px',
        height: '40px',
        borderRadius: '2px',
        background: active ? accentColor : 'var(--border)',
        transition: `background ${tokens.transition.fast}`,
      }} />
    </div>
  );
}

// Collapsed Panel Component
function CollapsedPanel({
  icon,
  title,
  onExpand,
  accentColor,
}: {
  icon: string;
  title: string;
  onExpand: () => void;
  accentColor: string;
}) {
  return (
    <div style={{
      width: '42px',
      borderRight: '1px solid var(--border)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      paddingTop: '12px',
      background: 'var(--panel-muted)',
      gap: '12px',
    }}>
      {/* Zone indicator */}
      <div style={{
        width: '8px',
        height: '8px',
        borderRadius: '50%',
        background: accentColor,
        boxShadow: `0 0 8px ${accentColor}`,
      }} />

      {/* Icon button */}
      <Tooltip content={`展开 ${title}`} position="right">
        <button
          onClick={onExpand}
          style={{
            width: '32px',
            height: '32px',
            border: 'none',
            background: 'var(--paper)',
            borderRadius: tokens.radius.md,
            cursor: 'pointer',
            fontSize: '16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: `all ${tokens.transition.fast}`,
            boxShadow: tokens.shadow.sm,
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'scale(1.05)';
            e.currentTarget.style.boxShadow = tokens.shadow.md;
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'scale(1)';
            e.currentTarget.style.boxShadow = tokens.shadow.sm;
          }}
        >
          {icon}
        </button>
      </Tooltip>
    </div>
  );
}