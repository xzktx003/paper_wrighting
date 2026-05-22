import React, { useRef, useState } from 'react';
import { ProjectTree } from '../ProjectTree';
import { SkillPanel } from '../SkillPanel';
import { ProjectConfig } from '../../hooks/useProject';
import { ProjectEmptyState, SkillsEmptyState } from './EnhancedEmptyStates';
import { tokens } from './DesignSystem';

interface Props {
  projectPath: string | null;
  config: ProjectConfig | null;
  onFileSelect: (file: { path: string; type: 'chapter' | 'code' | 'other' }) => void;
  onChapterReorder: (newOrder: string[]) => void;
  globalSkills?: string[];
  chapterSkills?: string[];
  onActivateSkill?: (skillName: string) => void;
  onOpenProject?: () => void;
}

export function EnhancedLeftPanel({
  projectPath,
  config,
  onFileSelect,
  onChapterReorder,
  globalSkills = [],
  chapterSkills = [],
  onActivateSkill = () => {},
  onOpenProject,
}: Props) {
  const contentRef = useRef<HTMLDivElement | null>(null);
  const [skillsHeight, setSkillsHeight] = useState(220);

  if (!projectPath || !config) {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        background: 'var(--panel)',
      }}>
        <ProjectEmptyState onAction={onOpenProject} />
      </div>
    );
  }

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      background: 'var(--panel)',
    }}>
      {/* Project title */}
      <div style={{
        padding: '12px 14px',
        fontWeight: 600,
        borderBottom: '1px solid var(--border)',
        fontSize: '13px',
        color: 'var(--text)',
        background: 'var(--panel-muted)',
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
      }}>
        <span style={{
          width: '8px',
          height: '8px',
          borderRadius: '50%',
          background: 'var(--zone-files-accent)',
          boxShadow: `0 0 8px var(--zone-files-accent)`,
        }} />
        <span style={{
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}>
          {config.title || 'Untitled'}
        </span>
      </div>

      {/* Content area */}
      <div ref={contentRef} style={{
        flex: 1,
        minHeight: 0,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}>
        {/* File tree */}
        <div style={{
          flex: 1,
          minHeight: 120,
          overflow: 'auto',
          padding: '4px 0',
        }}>
          <ProjectTree
            projectPath={projectPath}
            config={config}
            onFileSelect={onFileSelect}
            onChapterReorder={onChapterReorder}
          />
        </div>

        {/* Resize handle */}
        <HorizontalResizeHandle
          contentRef={contentRef}
          onResize={(nextHeight) => setSkillsHeight(nextHeight)}
        />

        {/* Skills panel */}
        <div style={{
          height: skillsHeight,
          minHeight: 80,
          maxHeight: 400,
          overflow: 'auto',
          background: 'var(--panel-muted)',
          flexShrink: 0,
          display: 'flex',
          flexDirection: 'column',
        }}>
          {/* Skills header */}
          <div style={{
            padding: '10px 12px 6px',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
          }}>
            <span style={{
              fontSize: '10px',
              fontWeight: 600,
              color: 'var(--muted)',
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
            }}>
              Skills
            </span>
            {(globalSkills.length > 0 || chapterSkills.length > 0) && (
              <span style={{
                padding: '1px 6px',
                borderRadius: tokens.radius.full,
                background: 'var(--accent-soft)',
                color: 'var(--accent-strong)',
                fontSize: '9px',
                fontWeight: 600,
              }}>
                {globalSkills.length + chapterSkills.length}
              </span>
            )}
          </div>

          {/* Skills content */}
          <div style={{ flex: 1, overflow: 'auto', padding: '0 8px 8px' }}>
            {globalSkills.length > 0 || chapterSkills.length > 0 ? (
              <SkillPanel
                globalSkills={globalSkills}
                chapterSkills={chapterSkills}
                onActivateSkill={onActivateSkill}
              />
            ) : (
              <SkillsEmptyState />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function HorizontalResizeHandle({
  contentRef,
  onResize,
}: {
  contentRef: React.RefObject<HTMLDivElement>;
  onResize: (nextHeight: number) => void;
}) {
  const [active, setActive] = useState(false);

  const handleMouseDown = (event: React.MouseEvent) => {
    event.preventDefault();
    const content = contentRef.current;
    if (!content) return;
    setActive(true);

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const rect = content.getBoundingClientRect();
      const nextHeight = clamp(rect.bottom - moveEvent.clientY, 80, Math.max(80, rect.height - 100));
      onResize(nextHeight);
    };

    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      setActive(false);
    };

    document.body.style.cursor = 'row-resize';
    document.body.style.userSelect = 'none';
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  return (
    <div
      role="separator"
      aria-orientation="horizontal"
      title="拖动调整文件树和技能面板高度"
      onMouseDown={handleMouseDown}
      style={{
        height: 8,
        cursor: 'row-resize',
        flexShrink: 0,
        borderTop: '1px solid var(--border)',
        background: active ? 'var(--accent-soft)' : 'var(--panel)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        transition: `background ${tokens.transition.fast}`,
      }}
      onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--accent-soft)'; }}
      onMouseLeave={(e) => { if (!active) e.currentTarget.style.background = 'var(--panel)'; }}
    >
      <div style={{
        width: '32px',
        height: '3px',
        borderRadius: '2px',
        background: active ? 'var(--accent)' : 'var(--border)',
        transition: `background ${tokens.transition.fast}`,
      }} />
    </div>
  );
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}