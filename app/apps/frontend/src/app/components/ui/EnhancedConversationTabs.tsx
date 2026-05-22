import React, { useState, useRef } from 'react';
import { tokens } from './DesignSystem';

interface ConversationSummary {
  id: string;
  name: string;
  mode: string;
  updated_at?: number;
}

interface Props {
  conversations: ConversationSummary[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onClose: (id: string) => void;
  onNew: () => void;
  onRename?: (id: string, newName: string) => void;
}

export function EnhancedConversationTabs({
  conversations,
  activeId,
  onSelect,
  onClose,
  onNew,
  onRename,
}: Props) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const startEditing = (conv: ConversationSummary) => {
    setEditingId(conv.id);
    setEditValue(conv.name);
    setTimeout(() => inputRef.current?.select(), 0);
  };

  const finishEditing = () => {
    if (editingId && editValue.trim() && onRename) {
      onRename(editingId, editValue.trim());
    }
    setEditingId(null);
    setEditValue('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      finishEditing();
    } else if (e.key === 'Escape') {
      setEditingId(null);
      setEditValue('');
    }
  };

  const getModeIcon = (mode: string) => {
    switch (mode) {
      case 'chat': return '💬';
      case 'agent': return '🤖';
      case 'tools': return '🔧';
      default: return '💬';
    }
  };

  const formatTime = (timestamp?: number) => {
    if (!timestamp) return '';
    const now = Date.now();
    const diff = now - timestamp;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return '刚刚';
    if (minutes < 60) return `${minutes}分钟前`;
    if (hours < 24) return `${hours}小时前`;
    if (days < 7) return `${days}天前`;
    return new Date(timestamp).toLocaleDateString();
  };

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      height: '100%',
      padding: '0 8px',
      gap: '4px',
      overflow: 'auto',
    }}>
      {/* Conversation tabs */}
      {conversations.map((conv) => {
        const isActive = conv.id === activeId;
        const isEditing = conv.id === editingId;

        return (
          <div
            key={conv.id}
            style={{
              position: 'relative',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '5px 10px',
              borderRadius: tokens.radius.md,
              background: isActive ? 'var(--paper)' : 'transparent',
              border: `1px solid ${isActive ? 'var(--border)' : 'transparent'}`,
              cursor: 'pointer',
              transition: `all ${tokens.transition.fast}`,
              maxWidth: '160px',
            }}
            onClick={() => !isEditing && onSelect(conv.id)}
            onMouseEnter={(e) => {
              if (!isActive) {
                e.currentTarget.style.background = 'var(--hover)';
              }
            }}
            onMouseLeave={(e) => {
              if (!isActive) {
                e.currentTarget.style.background = 'transparent';
              }
            }}
          >
            {/* Mode icon */}
            <span style={{ fontSize: '12px', flexShrink: 0 }}>
              {getModeIcon(conv.mode)}
            </span>

            {/* Name */}
            {isEditing ? (
              <input
                ref={inputRef}
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                onBlur={finishEditing}
                onKeyDown={handleKeyDown}
                onClick={(e) => e.stopPropagation()}
                style={{
                  width: '80px',
                  border: '1px solid var(--accent)',
                  borderRadius: '4px',
                  padding: '2px 6px',
                  fontSize: '11px',
                  background: 'var(--paper)',
                  color: 'var(--text)',
                  outline: 'none',
                }}
              />
            ) : (
              <span
                style={{
                  fontSize: '11px',
                  fontWeight: isActive ? 500 : 400,
                  color: isActive ? 'var(--text)' : 'var(--text-secondary)',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  flex: 1,
                }}
                title={conv.name}
              >
                {conv.name}
              </span>
            )}

            {/* Time badge (only show for non-active) */}
            {!isActive && conv.updated_at && (
              <span style={{
                fontSize: '9px',
                color: 'var(--muted)',
                flexShrink: 0,
              }}>
                {formatTime(conv.updated_at)}
              </span>
            )}

            {/* Actions */}
            <div style={{
              display: 'flex',
              gap: '2px',
              opacity: isActive ? 1 : 0,
              transition: `opacity ${tokens.transition.fast}`,
            }}>
              {/* Rename button */}
              {onRename && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    startEditing(conv);
                  }}
                  style={{
                    width: '18px',
                    height: '18px',
                    border: 'none',
                    background: 'transparent',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'var(--muted)',
                    fontSize: '10px',
                    transition: `all ${tokens.transition.fast}`,
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'var(--bg-secondary)';
                    e.currentTarget.style.color = 'var(--text)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'transparent';
                    e.currentTarget.style.color = 'var(--muted)';
                  }}
                  title="重命名"
                >
                  ✏️
                </button>
              )}

              {/* Close button */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onClose(conv.id);
                }}
                style={{
                  width: '18px',
                  height: '18px',
                  border: 'none',
                  background: 'transparent',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--muted)',
                  fontSize: '12px',
                  transition: `all ${tokens.transition.fast}`,
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'var(--danger)';
                  e.currentTarget.style.color = '#fff';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'transparent';
                  e.currentTarget.style.color = 'var(--muted)';
                }}
                title="关闭"
              >
                ×
              </button>
            </div>

            {/* Active indicator */}
            {isActive && (
              <div style={{
                position: 'absolute',
                bottom: '-1px',
                left: '50%',
                transform: 'translateX(-50%)',
                width: '20px',
                height: '2px',
                borderRadius: '1px',
                background: 'var(--accent)',
              }} />
            )}
          </div>
        );
      })}

      {/* New conversation button */}
      <button
        onClick={onNew}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: '28px',
          height: '28px',
          border: `1px dashed var(--border)`,
          borderRadius: tokens.radius.md,
          background: 'transparent',
          cursor: 'pointer',
          color: 'var(--muted)',
          fontSize: '14px',
          transition: `all ${tokens.transition.fast}`,
          flexShrink: 0,
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.borderColor = 'var(--accent)';
          e.currentTarget.style.color = 'var(--accent)';
          e.currentTarget.style.background = 'var(--accent-soft)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.borderColor = 'var(--border)';
          e.currentTarget.style.color = 'var(--muted)';
          e.currentTarget.style.background = 'transparent';
        }}
        title="新建对话"
      >
        +
      </button>
    </div>
  );
}