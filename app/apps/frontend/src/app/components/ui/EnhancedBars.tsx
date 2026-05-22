import React, { useState } from 'react';
import { tokens, Tooltip } from './DesignSystem';
import { KeyboardShortcut } from './EnhancedAnimations';

// ============================================
// Status Bar
// ============================================
interface StatusBarProps {
  left?: React.ReactNode;
  right?: React.ReactNode;
  items?: StatusBarItem[];
}

interface StatusBarItem {
  id: string;
  label: string;
  icon?: string;
  value?: string;
  color?: string;
  onClick?: () => void;
  tooltip?: string;
  shortcut?: string[];
}

export function StatusBar({ left, right, items = [] }: StatusBarProps) {
  return (
    <div style={{
      height: '24px',
      background: 'var(--panel-muted)',
      borderTop: '1px solid var(--border)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '0 8px',
      fontSize: '11px',
      color: 'var(--text-secondary)',
      flexShrink: 0,
    }}>
      {/* Left section */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        {left}
        {items.filter(i => i.id.startsWith('left-')).map(item => (
          <StatusBarItem key={item.id} item={item} />
        ))}
      </div>

      {/* Right section */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        {items.filter(i => i.id.startsWith('right-')).map(item => (
          <StatusBarItem key={item.id} item={item} />
        ))}
        {right}
      </div>
    </div>
  );
}

function StatusBarItem({ item }: { item: StatusBarItem }) {
  const content = (
    <div
      onClick={item.onClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '4px',
        padding: '2px 6px',
        borderRadius: tokens.radius.sm,
        cursor: item.onClick ? 'pointer' : 'default',
        transition: `background ${tokens.transition.fast}`,
        color: item.color || 'var(--text-secondary)',
      }}
      onMouseEnter={(e) => {
        if (item.onClick) e.currentTarget.style.background = 'var(--hover)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = 'transparent';
      }}
    >
      {item.icon && <span style={{ fontSize: '10px' }}>{item.icon}</span>}
      {item.label && <span>{item.label}</span>}
      {item.value && <span style={{ fontWeight: 500 }}>{item.value}</span>}
    </div>
  );

  if (item.tooltip) {
    return (
      <Tooltip content={item.tooltip} position="top">
        {content}
      </Tooltip>
    );
  }

  return content;
}

// ============================================
// Breadcrumb Navigation
// ============================================
interface BreadcrumbItem {
  label: string;
  icon?: string;
  onClick?: () => void;
}

interface BreadcrumbProps {
  items: BreadcrumbItem[];
  separator?: string;
  maxItems?: number;
}

export function Breadcrumb({ items, separator = '/', maxItems = 4 }: BreadcrumbProps) {
  let displayItems = items;
  if (items.length > maxItems) {
    displayItems = [
      items[0],
      { label: '...', onClick: undefined },
      ...items.slice(-(maxItems - 2)),
    ];
  }

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: '6px',
      fontSize: '12px',
      color: 'var(--text-secondary)',
    }}>
      {displayItems.map((item, i) => (
        <React.Fragment key={i}>
          {i > 0 && (
            <span style={{ color: 'var(--muted)', fontSize: '10px' }}>
              {separator}
            </span>
          )}
          {item.onClick ? (
            <button
              onClick={item.onClick}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                border: 'none',
                background: 'none',
                cursor: 'pointer',
                color: i === displayItems.length - 1 ? 'var(--text)' : 'var(--text-secondary)',
                fontWeight: i === displayItems.length - 1 ? 500 : 400,
                padding: '2px 4px',
                borderRadius: tokens.radius.sm,
                transition: `all ${tokens.transition.fast}`,
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'var(--hover)';
                e.currentTarget.style.color = 'var(--accent)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'transparent';
                e.currentTarget.style.color = i === displayItems.length - 1 ? 'var(--text)' : 'var(--text-secondary)';
              }}
            >
              {item.icon && <span>{item.icon}</span>}
              {item.label}
            </button>
          ) : (
            <span style={{ color: 'var(--muted)' }}>{item.label}</span>
          )}
        </React.Fragment>
      ))}
    </div>
  );
}

// ============================================
// Command Palette (Ctrl+K)
// ============================================
interface Command {
  id: string;
  label: string;
  icon?: string;
  shortcut?: string[];
  category?: string;
  action: () => void;
}

interface CommandPaletteProps {
  commands: Command[];
  isOpen: boolean;
  onClose: () => void;
  onExecute: (command: Command) => void;
}

export function CommandPalette({ commands, isOpen, onClose, onExecute }: CommandPaletteProps) {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);

  const filteredCommands = commands.filter(cmd =>
    cmd.label.toLowerCase().includes(query.toLowerCase())
  );

  const groupedCommands = filteredCommands.reduce((acc, cmd) => {
    const category = cmd.category || 'General';
    if (!acc[category]) acc[category] = [];
    acc[category].push(cmd);
    return acc;
  }, {} as Record<string, Command[]>);

  React.useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
    }
  }, [isOpen]);

  React.useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex(i => Math.min(i + 1, filteredCommands.length - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex(i => Math.max(i - 1, 0));
      } else if (e.key === 'Enter' && filteredCommands[selectedIndex]) {
        onExecute(filteredCommands[selectedIndex]);
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, filteredCommands, selectedIndex, onExecute, onClose]);

  if (!isOpen) return null;

  let flatIndex = 0;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.5)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        paddingTop: '15vh',
        zIndex: 10000,
        animation: 'fadeIn 0.15s ease',
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: '520px',
          maxWidth: '90vw',
          maxHeight: '60vh',
          background: 'var(--paper)',
          borderRadius: tokens.radius.xl,
          boxShadow: tokens.shadow.lg,
          overflow: 'hidden',
          animation: 'slideDown 0.2s ease',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search input */}
        <div style={{
          padding: '12px 16px',
          borderBottom: '1px solid var(--border)',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
        }}>
          <span style={{ fontSize: '16px', color: 'var(--muted)' }}>🔍</span>
          <input
            autoFocus
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            placeholder="输入命令搜索..."
            style={{
              flex: 1,
              border: 'none',
              background: 'transparent',
              fontSize: '14px',
              color: 'var(--text)',
              outline: 'none',
            }}
          />
          <KeyboardShortcut keys={['Esc']} />
        </div>

        {/* Commands list */}
        <div style={{
          maxHeight: 'calc(60vh - 60px)',
          overflow: 'auto',
          padding: '8px',
        }}>
          {Object.entries(groupedCommands).map(([category, cmds]) => (
            <div key={category}>
              <div style={{
                padding: '6px 10px',
                fontSize: '10px',
                fontWeight: 600,
                color: 'var(--muted)',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
              }}>
                {category}
              </div>
              {cmds.map((cmd) => {
                const isSelected = flatIndex === selectedIndex;
                flatIndex++;
                return (
                  <button
                    key={cmd.id}
                    onClick={() => {
                      onExecute(cmd);
                      onClose();
                    }}
                    onMouseEnter={() => setSelectedIndex(flatIndex - 1)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px',
                      width: '100%',
                      padding: '10px 12px',
                      border: 'none',
                      background: isSelected ? 'var(--hover)' : 'transparent',
                      borderRadius: tokens.radius.md,
                      cursor: 'pointer',
                      color: 'var(--text)',
                      fontSize: '13px',
                      textAlign: 'left',
                      transition: `background ${tokens.transition.fast}`,
                    }}
                  >
                    {cmd.icon && (
                      <span style={{
                        width: '24px',
                        height: '24px',
                        borderRadius: tokens.radius.md,
                        background: 'var(--bg-secondary)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '14px',
                      }}>
                        {cmd.icon}
                      </span>
                    )}
                    <span style={{ flex: 1 }}>{cmd.label}</span>
                    {cmd.shortcut && <KeyboardShortcut keys={cmd.shortcut} />}
                  </button>
                );
              })}
            </div>
          ))}

          {filteredCommands.length === 0 && (
            <div style={{
              padding: '32px',
              textAlign: 'center',
              color: 'var(--muted)',
              fontSize: '13px',
            }}>
              没有找到匹配的命令
            </div>
          )}
        </div>
      </div>
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes slideDown {
          from { opacity: 0; transform: translateY(-20px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}

// ============================================
// Notification Bell
// ============================================
interface Notification {
  id: string;
  type: 'info' | 'success' | 'warning' | 'error';
  title: string;
  message?: string;
  timestamp: number;
  read?: boolean;
}

interface NotificationBellProps {
  notifications: Notification[];
  onNotificationClick?: (notification: Notification) => void;
  onMarkAllRead?: () => void;
}

export function NotificationBell({ notifications, onNotificationClick, onMarkAllRead }: NotificationBellProps) {
  const [open, setOpen] = useState(false);
  const unreadCount = notifications.filter(n => !n.read).length;

  return (
    <div style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen(!open)}
        style={{
          position: 'relative',
          width: '32px',
          height: '32px',
          border: 'none',
          background: 'transparent',
          borderRadius: tokens.radius.md,
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '16px',
          color: 'var(--text-secondary)',
          transition: `all ${tokens.transition.fast}`,
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = 'var(--hover)';
          e.currentTarget.style.color = 'var(--text)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = 'transparent';
          e.currentTarget.style.color = 'var(--text-secondary)';
        }}
      >
        🔔
        {unreadCount > 0 && (
          <span style={{
            position: 'absolute',
            top: '2px',
            right: '2px',
            minWidth: '16px',
            height: '16px',
            borderRadius: tokens.radius.full,
            background: 'var(--danger)',
            color: '#fff',
            fontSize: '10px',
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '0 4px',
          }}>
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <>
          <div
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 999,
            }}
            onClick={() => setOpen(false)}
          />
          <div style={{
            position: 'absolute',
            top: '100%',
            right: 0,
            marginTop: '8px',
            width: '320px',
            background: 'var(--paper)',
            border: '1px solid var(--border)',
            borderRadius: tokens.radius.lg,
            boxShadow: tokens.shadow.lg,
            zIndex: 1000,
            animation: 'dropdownIn 0.15s ease',
            overflow: 'hidden',
          }}>
            {/* Header */}
            <div style={{
              padding: '12px 14px',
              borderBottom: '1px solid var(--border)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}>
              <span style={{ fontSize: '13px', fontWeight: 600 }}>通知</span>
              {unreadCount > 0 && onMarkAllRead && (
                <button
                  onClick={onMarkAllRead}
                  style={{
                    border: 'none',
                    background: 'none',
                    cursor: 'pointer',
                    fontSize: '11px',
                    color: 'var(--accent)',
                  }}
                >
                  全部已读
                </button>
              )}
            </div>

            {/* Notifications list */}
            <div style={{ maxHeight: '300px', overflow: 'auto' }}>
              {notifications.length === 0 ? (
                <div style={{
                  padding: '32px',
                  textAlign: 'center',
                  color: 'var(--muted)',
                  fontSize: '12px',
                }}>
                  暂无通知
                </div>
              ) : (
                notifications.map((notif) => (
                  <div
                    key={notif.id}
                    onClick={() => {
                      onNotificationClick?.(notif);
                      setOpen(false);
                    }}
                    style={{
                      padding: '12px 14px',
                      borderBottom: '1px solid var(--border)',
                      cursor: 'pointer',
                      background: notif.read ? 'transparent' : 'var(--accent-soft)',
                      transition: `background ${tokens.transition.fast}`,
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = 'var(--hover)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = notif.read ? 'transparent' : 'var(--accent-soft)';
                    }}
                  >
                    <div style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: '10px',
                    }}>
                      <span style={{ fontSize: '16px' }}>
                        {notif.type === 'success' ? '✅' : notif.type === 'error' ? '❌' : notif.type === 'warning' ? '⚠️' : 'ℹ️'}
                      </span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{
                          fontSize: '12px',
                          fontWeight: notif.read ? 400 : 600,
                          color: 'var(--text)',
                          marginBottom: '2px',
                        }}>
                          {notif.title}
                        </div>
                        {notif.message && (
                          <div style={{
                            fontSize: '11px',
                            color: 'var(--muted)',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}>
                            {notif.message}
                          </div>
                        )}
                      </div>
                      {!notif.read && (
                        <span style={{
                          width: '8px',
                          height: '8px',
                          borderRadius: '50%',
                          background: 'var(--accent)',
                          flexShrink: 0,
                          marginTop: '4px',
                        }} />
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </>
      )}
      <style>{`
        @keyframes dropdownIn {
          from { opacity: 0; transform: translateY(-8px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}

// ============================================
// Quick Actions Bar
// ============================================
interface QuickAction {
  id: string;
  icon: string;
  label: string;
  onClick: () => void;
  color?: string;
}

interface QuickActionsBarProps {
  actions: QuickAction[];
  position?: 'top' | 'bottom';
}

export function QuickActionsBar({ actions, position = 'bottom' }: QuickActionsBarProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div
      style={{
        position: 'fixed',
        [position]: '20px',
        right: '20px',
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
        zIndex: 100,
      }}
    >
      {/* Expanded actions */}
      {expanded && actions.map((action, i) => (
        <Tooltip key={action.id} content={action.label} position="left">
          <button
            onClick={() => {
              action.onClick();
              setExpanded(false);
            }}
            style={{
              width: '40px',
              height: '40px',
              border: 'none',
              borderRadius: tokens.radius.lg,
              background: action.color || 'var(--paper)',
              color: '#fff',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '18px',
              boxShadow: tokens.shadow.md,
              animation: `slideIn 0.2s ease ${i * 0.05}s both`,
              transition: `all ${tokens.transition.fast}`,
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'scale(1.1)';
              e.currentTarget.style.boxShadow = tokens.shadow.lg;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'scale(1)';
              e.currentTarget.style.boxShadow = tokens.shadow.md;
            }}
          >
            {action.icon}
          </button>
        </Tooltip>
      ))}

      {/* Main toggle button */}
      <button
        onClick={() => setExpanded(!expanded)}
        style={{
          width: '48px',
          height: '48px',
          border: 'none',
          borderRadius: '50%',
          background: 'linear-gradient(135deg, var(--accent) 0%, var(--accent-strong) 100%)',
          color: '#fff',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '20px',
          boxShadow: tokens.shadow.glow('var(--accent)'),
          transition: `all ${tokens.transition.fast}`,
          transform: expanded ? 'rotate(45deg)' : 'none',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.transform = expanded ? 'rotate(45deg) scale(1.1)' : 'scale(1.1)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = expanded ? 'rotate(45deg) scale(1)' : 'scale(1)';
        }}
      >
        +
      </button>

      <style>{`
        @keyframes slideIn {
          from { opacity: 0; transform: translateX(20px); }
          to { opacity: 1; transform: translateX(0); }
        }
      `}</style>
    </div>
  );
}

// ============================================
// Help Modal
// ============================================
interface HelpSection {
  title: string;
  shortcuts: { keys: string[]; description: string }[];
}

interface HelpModalProps {
  isOpen: boolean;
  onClose: () => void;
  sections?: HelpSection[];
}

const DEFAULT_SECTIONS: HelpSection[] = [
  {
    title: '编辑器',
    shortcuts: [
      { keys: ['Ctrl', 'S'], description: '保存文件' },
      { keys: ['Ctrl', 'Z'], description: '撤销' },
      { keys: ['Ctrl', 'Y'], description: '重做' },
      { keys: ['Ctrl', 'F'], description: '查找' },
      { keys: ['Ctrl', 'H'], description: '替换' },
    ],
  },
  {
    title: '导航',
    shortcuts: [
      { keys: ['Ctrl', 'P'], description: '快速打开文件' },
      { keys: ['Ctrl', 'B'], description: '切换侧边栏' },
      { keys: ['Ctrl', 'J'], description: '切换终端' },
      { keys: ['Ctrl', 'K'], description: '命令面板' },
    ],
  },
  {
    title: 'AI 助手',
    shortcuts: [
      { keys: ['Ctrl', 'Enter'], description: '发送消息' },
      { keys: ['Shift', 'Enter'], description: '换行' },
      { keys: ['Esc'], description: '取消生成' },
    ],
  },
];

export function HelpModal({ isOpen, onClose, sections = DEFAULT_SECTIONS }: HelpModalProps) {
  if (!isOpen) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.5)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 10000,
        animation: 'fadeIn 0.2s ease',
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: '600px',
          maxWidth: '90vw',
          maxHeight: '80vh',
          background: 'var(--paper)',
          borderRadius: tokens.radius.xl,
          boxShadow: tokens.shadow.lg,
          overflow: 'hidden',
          animation: 'scaleIn 0.2s ease',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{
          padding: '20px 24px',
          borderBottom: '1px solid var(--border)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{ fontSize: '24px' }}>⌨️</span>
            <div>
              <h2 style={{ margin: 0, fontSize: '16px', fontWeight: 600 }}>键盘快捷键</h2>
              <p style={{ margin: '4px 0 0', fontSize: '12px', color: 'var(--muted)' }}>
                提高效率的快捷方式
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              width: '32px',
              height: '32px',
              border: 'none',
              background: 'var(--bg-secondary)',
              borderRadius: tokens.radius.md,
              cursor: 'pointer',
              fontSize: '18px',
              color: 'var(--muted)',
            }}
          >
            ×
          </button>
        </div>

        {/* Content */}
        <div style={{
          padding: '20px 24px',
          overflow: 'auto',
          maxHeight: 'calc(80vh - 80px)',
        }}>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
            gap: '24px',
          }}>
            {sections.map((section) => (
              <div key={section.title}>
                <h3 style={{
                  margin: '0 0 12px',
                  fontSize: '13px',
                  fontWeight: 600,
                  color: 'var(--text)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                }}>
                  <span style={{
                    width: '4px',
                    height: '16px',
                    borderRadius: '2px',
                    background: 'var(--accent)',
                  }} />
                  {section.title}
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {section.shortcuts.map((shortcut, i) => (
                    <div
                      key={i}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '8px 10px',
                        background: 'var(--bg-secondary)',
                        borderRadius: tokens.radius.md,
                      }}
                    >
                      <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                        {shortcut.description}
                      </span>
                      <KeyboardShortcut keys={shortcut.keys} />
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes scaleIn {
          from { opacity: 0; transform: scale(0.95); }
          to { opacity: 1; transform: scale(1); }
        }
      `}</style>
    </div>
  );
}