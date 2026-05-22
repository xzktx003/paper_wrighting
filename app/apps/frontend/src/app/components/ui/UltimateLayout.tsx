import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../../context/AppContext';
import { EnhancedLeftPanel } from './EnhancedLeftPanel';
import { EnhancedCenterPanel } from './EnhancedCenterPanel';
import { EnhancedRightPanel } from './EnhancedRightPanel';
import { useTheme, ThemeToggle, THEMES } from '../ThemeToggle';
import { tokens, Tooltip, Badge } from './DesignSystem';
import {
  StatusBar,
  Breadcrumb,
  CommandPalette,
  HelpModal,
  KeyboardShortcut,
  ToastProvider,
  useToast,
  type Command,
} from './EnhancedAnimations';
import { NotificationBell } from './EnhancedBars';

// ============================================
// Ultimate Layout (整合所有优化)
// ============================================
export function UltimateLayout() {
  const app = useApp();
  const navigate = useNavigate();
  const { theme, setTheme } = useTheme();
  const { addToast } = useToast();

  // Panel states
  const [leftWidth, setLeftWidth] = useState(260);
  const [rightWidth, setRightWidth] = useState(380);
  const [leftCollapsed, setLeftCollapsed] = useState(false);
  const [rightCollapsed, setRightCollapsed] = useState(false);

  // Command palette
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);

  // Help modal
  const [helpOpen, setHelpOpen] = useState(false);

  // Notifications
  const [notifications, setNotifications] = useState<any[]>([]);

  // Current chapter skills
  const currentChapterSkills = (() => {
    if (app.activeFileIndex < 0) return [];
    const file = app.openFiles[app.activeFileIndex];
    if (!file || file.type !== 'chapter' || !app.project.config) return [];
    const ch = app.project.config.chapters?.find(c => c.file === file.filename);
    return ch?.skills || [];
  })();

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl/Cmd + K: Command palette
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setCommandPaletteOpen(true);
      }
      // Ctrl/Cmd + /: Help
      if ((e.ctrlKey || e.metaKey) && e.key === '/') {
        e.preventDefault();
        setHelpOpen(true);
      }
      // Ctrl/Cmd + B: Toggle left panel
      if ((e.ctrlKey || e.metaKey) && e.key === 'b') {
        e.preventDefault();
        setLeftCollapsed(v => !v);
      }
      // Ctrl/Cmd + J: Toggle right panel
      if ((e.ctrlKey || e.metaKey) && e.key === 'j') {
        e.preventDefault();
        setRightCollapsed(v => !v);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Commands for command palette
  const commands: Command[] = [
    { id: 'new-project', label: '新建项目', icon: '📄', category: '项目', shortcut: ['Ctrl', 'N'], action: () => navigate('/projects') },
    { id: 'open-project', label: '打开项目', icon: '📂', category: '项目', action: () => navigate('/projects') },
    { id: 'save-file', label: '保存文件', icon: '💾', category: '编辑', shortcut: ['Ctrl', 'S'], action: () => addToast({ type: 'success', title: '文件已保存' }) },
    { id: 'compile', label: '编译 PDF', icon: '📄', category: '编辑', shortcut: ['Ctrl', 'Shift', 'P'], action: () => addToast({ type: 'info', title: '开始编译...' }) },
    { id: 'toggle-left', label: '切换文件面板', icon: '📁', category: '视图', shortcut: ['Ctrl', 'B'], action: () => setLeftCollapsed(v => !v) },
    { id: 'toggle-right', label: '切换 AI 面板', icon: '🤖', category: '视图', shortcut: ['Ctrl', 'J'], action: () => setRightCollapsed(v => !v) },
    { id: 'toggle-terminal', label: '切换终端', icon: '⌨️', category: '视图', action: () => app.toggleTerminal() },
    { id: 'new-conversation', label: '新建对话', icon: '💬', category: 'AI', shortcut: ['Ctrl', 'Shift', 'N'], action: () => app.createConversation({ name: '新对话', mode: 'chat', context_scope: { type: 'free' }, active_skills: [] }) },
    { id: 'theme-light', label: '浅色主题', icon: '☀️', category: '主题', action: () => setTheme('light') },
    { id: 'theme-dark', label: '深色主题', icon: '🌙', category: '主题', action: () => setTheme('primer-dark') },
    { id: 'theme-cyber', label: '赛博科技', icon: '⚡', category: '主题', action: () => setTheme('cyber-tech') },
    { id: 'theme-dracula', label: 'Dracula', icon: '🧛', category: '主题', action: () => setTheme('dracula') },
    { id: 'help', label: '键盘快捷键', icon: '⌨️', category: '帮助', shortcut: ['Ctrl', '/'], action: () => setHelpOpen(true) },
  ];

  // Breadcrumb items
  const breadcrumbItems = [
    { label: '项目', icon: '📁', onClick: () => navigate('/projects') },
    ...(app.project.config?.title ? [{ label: app.project.config.title }] : []),
    ...(app.openFiles[app.activeFileIndex] ? [{ label: app.openFiles[app.activeFileIndex].filename }] : []),
  ];

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100vh',
      overflow: 'hidden',
      background: 'var(--bg)',
    }}>
      {/* Top Bar */}
      <div style={{
        height: '48px',
        borderBottom: '1px solid var(--border)',
        display: 'flex',
        alignItems: 'center',
        padding: '0 12px',
        gap: '12px',
        background: 'var(--panel)',
        flexShrink: 0,
      }}>
        {/* Logo & Back */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{
            width: '28px',
            height: '28px',
            borderRadius: tokens.radius.md,
            background: 'linear-gradient(135deg, var(--accent) 0%, var(--accent-strong) 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '14px',
            boxShadow: tokens.shadow.glow('var(--accent)'),
          }}>
            📝
          </div>
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
              e.currentTarget.style.color = 'var(--accent)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'none';
              e.currentTarget.style.color = 'var(--text-secondary)';
            }}
          >
            ← 返回
          </button>
        </div>

        {/* Breadcrumb */}
        <Breadcrumb items={breadcrumbItems} />

        {/* Spacer */}
        <div style={{ flex: 1 }} />

        {/* Quick actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {/* Command palette trigger */}
          <Tooltip content="命令面板" position="bottom">
            <button
              onClick={() => setCommandPaletteOpen(true)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '4px 10px',
                border: '1px solid var(--border)',
                borderRadius: tokens.radius.md,
                background: 'var(--paper)',
                cursor: 'pointer',
                fontSize: '11px',
                color: 'var(--text-secondary)',
                transition: `all ${tokens.transition.fast}`,
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = 'var(--accent)';
                e.currentTarget.style.background = 'var(--accent-soft)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = 'var(--border)';
                e.currentTarget.style.background = 'var(--paper)';
              }}
            >
              <span>🔍</span>
              <span>命令</span>
              <KeyboardShortcut keys={['Ctrl', 'K']} />
            </button>
          </Tooltip>

          {/* Theme toggle */}
          <ThemeToggle theme={theme} onThemeChange={setTheme} />

          {/* Notifications */}
          <NotificationBell
            notifications={notifications}
            onNotificationClick={(n) => addToast({ type: n.type, title: n.title, message: n.message })}
            onMarkAllRead={() => setNotifications([])}
          />

          {/* Help */}
          <Tooltip content="帮助" position="bottom">
            <button
              onClick={() => setHelpOpen(true)}
              style={{
                width: '32px',
                height: '32px',
                border: '1px solid var(--border)',
                borderRadius: tokens.radius.md,
                background: 'var(--paper)',
                cursor: 'pointer',
                fontSize: '14px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: `all ${tokens.transition.fast}`,
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'var(--hover)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'var(--paper)';
              }}
            >
              ❓
            </button>
          </Tooltip>
        </div>
      </div>

      {/* Main content */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {/* Left Panel */}
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
        )}

        {/* Left resize handle */}
        {!leftCollapsed && (
          <ResizeHandle
            onResize={(delta) => setLeftWidth(w => Math.max(200, Math.min(400, w + delta)))}
            accentColor="var(--zone-files-accent)"
          />
        )}

        {/* Center Panel */}
        <div style={{
          flex: 1,
          overflow: 'hidden',
          borderLeft: '1px solid var(--border)',
          borderRight: '1px solid var(--border)',
          background: 'var(--bg)',
          display: 'flex',
          flexDirection: 'column',
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
            onResize={(delta) => setRightWidth(w => Math.max(300, Math.min(600, w - delta)))}
            accentColor="var(--zone-ai-accent)"
          />
        )}

        {/* Right Panel */}
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
        )}
      </div>

      {/* Status Bar */}
      <StatusBar
        items={[
          { id: 'left-mode', label: app.activeFileIndex >= 0 ? app.openFiles[app.activeFileIndex]?.type : '', icon: '📝' },
          { id: 'left-encoding', label: 'UTF-8', icon: '' },
          { id: 'right-theme', label: THEMES.find(t => t.value === theme)?.label || theme, icon: '🎨' },
        ]}
      />

      {/* Command Palette */}
      <CommandPalette
        commands={commands}
        isOpen={commandPaletteOpen}
        onClose={() => setCommandPaletteOpen(false)}
        onExecute={(cmd) => cmd.action()}
      />

      {/* Help Modal */}
      <HelpModal
        isOpen={helpOpen}
        onClose={() => setHelpOpen(false)}
      />
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
      <div style={{
        width: '8px',
        height: '8px',
        borderRadius: '50%',
        background: accentColor,
        boxShadow: `0 0 8px ${accentColor}`,
      }} />
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

// ============================================
// Layout with Toast Provider
// ============================================
export function UltimateLayoutWithToast() {
  return (
    <ToastProvider>
      <UltimateLayout />
    </ToastProvider>
  );
}