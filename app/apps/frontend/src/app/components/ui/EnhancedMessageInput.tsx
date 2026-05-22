import React, { useState, useRef, useEffect } from 'react';
import { Button, Spinner, tokens } from './DesignSystem';

interface Props {
  onSend: (message: string) => void;
  disabled?: boolean;
  placeholder?: string;
  contextInfo?: {
    type: string;
    mode: string;
  };
}

export function EnhancedMessageInput({ onSend, disabled = false, placeholder = '输入消息... (Enter 发送, Shift+Enter 换行)', contextInfo }: Props) {
  const [value, setValue] = useState('');
  const [focused, setFocused] = useState(false);
  const [sending, setSending] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize textarea
  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = Math.min(textarea.scrollHeight, 200) + 'px';
    }
  }, [value]);

  const handleSend = () => {
    if (!value.trim() || disabled || sending) return;
    setSending(true);
    onSend(value.trim());
    setValue('');
    setSending(false);
    textareaRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const canSend = value.trim() && !disabled && !sending;

  return (
    <div style={{
      borderTop: '1px solid var(--border)',
      padding: '12px',
      background: 'var(--panel-muted)',
    }}>
      {/* Context info badges */}
      {contextInfo && (
        <div style={{
          display: 'flex',
          gap: '8px',
          marginBottom: '10px',
          flexWrap: 'wrap',
        }}>
          <span style={{
            padding: '3px 10px',
            borderRadius: tokens.radius.full,
            background: 'var(--accent-soft)',
            color: 'var(--accent-strong)',
            fontSize: '10px',
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
          }}>
            <span style={{
              width: '6px',
              height: '6px',
              borderRadius: '50%',
              background: 'var(--accent)',
            }} />
            {contextInfo.type === 'chapter' ? `章节: ${contextInfo.type}` : contextInfo.type}
          </span>
          <span style={{
            padding: '3px 10px',
            borderRadius: tokens.radius.full,
            background: 'var(--bg-secondary)',
            color: 'var(--text-secondary)',
            fontSize: '10px',
            fontWeight: 500,
            textTransform: 'capitalize',
          }}>
            {contextInfo.mode}
          </span>
        </div>
      )}

      {/* Input container */}
      <div style={{
        position: 'relative',
        borderRadius: tokens.radius.lg,
        border: `1px solid ${focused ? 'var(--accent)' : 'var(--border)'}`,
        background: 'var(--paper)',
        boxShadow: focused ? `0 0 0 3px var(--accent-soft), ${tokens.shadow.sm}` : tokens.shadow.sm,
        transition: `all ${tokens.transition.fast}`,
        overflow: 'hidden',
      }}>
        <textarea
          ref={textareaRef}
          value={value}
          onChange={e => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholder={placeholder}
          disabled={disabled}
          rows={1}
          style={{
            width: '100%',
            minHeight: '48px',
            maxHeight: '200px',
            padding: '12px 80px 12px 14px',
            border: 'none',
            background: 'transparent',
            color: 'var(--text)',
            fontSize: '13px',
            lineHeight: 1.5,
            resize: 'none',
            outline: 'none',
            fontFamily: 'inherit',
            boxSizing: 'border-box',
          }}
        />

        {/* Actions */}
        <div style={{
          position: 'absolute',
          right: '8px',
          bottom: '8px',
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
        }}>
          {/* Character count */}
          {value.length > 0 && (
            <span style={{
              fontSize: '10px',
              color: value.length > 4000 ? 'var(--danger)' : 'var(--muted)',
              marginRight: '4px',
            }}>
              {value.length}
            </span>
          )}

          {/* Send button */}
          <button
            onClick={handleSend}
            disabled={!canSend}
            style={{
              width: '36px',
              height: '32px',
              border: 'none',
              borderRadius: tokens.radius.md,
              background: canSend
                ? 'linear-gradient(135deg, var(--accent) 0%, var(--accent-strong) 100%)'
                : 'var(--bg-secondary)',
              color: canSend ? '#fff' : 'var(--muted)',
              cursor: canSend ? 'pointer' : 'not-allowed',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: `all ${tokens.transition.fast}`,
              boxShadow: canSend ? tokens.shadow.md : 'none',
              transform: canSend ? 'translateY(0)' : 'none',
            }}
            onMouseEnter={(e) => {
              if (canSend) {
                e.currentTarget.style.transform = 'translateY(-1px)';
                e.currentTarget.style.boxShadow = tokens.shadow.lg;
              }
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = canSend ? tokens.shadow.md : 'none';
            }}
          >
            {sending ? (
              <Spinner size={16} color="#fff" />
            ) : (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="22" y1="2" x2="11" y2="13" />
                <polygon points="22 2 15 22 11 13 2 9 22 2" />
              </svg>
            )}
          </button>
        </div>
      </div>

      {/* Hints */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        marginTop: '8px',
        fontSize: '10px',
        color: 'var(--muted)',
      }}>
        <span>Enter 发送 · Shift+Enter 换行</span>
        <span>{value.trim() ? `${value.trim().split(/\s+/).length} 词` : ''}</span>
      </div>
    </div>
  );
}