import React, { useState, useRef, useEffect } from 'react';
import { ConversationSummary } from '../api/conversationApi';

interface Props {
  conversations: ConversationSummary[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onClose: (id: string) => void;
  onNew: () => void;
  onRename?: (id: string, newName: string) => void;
}

interface ContextMenuState {
  visible: boolean;
  x: number;
  y: number;
  convId: string;
  convName: string;
}

export function ConversationTabs({ conversations, activeId, onSelect, onClose, onNew, onRename }: Props) {
  const [contextMenu, setContextMenu] = useState<ContextMenuState>({ visible: false, x: 0, y: 0, convId: '', convName: '' });
  const [renaming, setRenaming] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const renameInputRef = useRef<HTMLInputElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (renaming && renameInputRef.current) {
      renameInputRef.current.focus();
      renameInputRef.current.select();
    }
  }, [renaming]);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setContextMenu(prev => ({ ...prev, visible: false }));
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const handleContextMenu = (e: React.MouseEvent, conv: ConversationSummary) => {
    e.preventDefault();
    setContextMenu({ visible: true, x: e.clientX, y: e.clientY, convId: conv.id, convName: conv.name });
  };

  const handleRenameStart = () => {
    setRenameValue(contextMenu.convName);
    setRenaming(contextMenu.convId);
    setContextMenu(prev => ({ ...prev, visible: false }));
  };

  const handleRenameSubmit = () => {
    if (renaming && renameValue.trim() && onRename) {
      onRename(renaming, renameValue.trim());
    }
    setRenaming(null);
  };

  const handleRenameKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleRenameSubmit();
    if (e.key === 'Escape') setRenaming(null);
  };

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: '2px', overflow: 'auto', padding: '0 4px', width: '100%' }}>
        {conversations.map(conv => (
          <div
            key={conv.id}
            onClick={() => onSelect(conv.id)}
            onContextMenu={(e) => handleContextMenu(e, conv)}
            style={{
              padding: '4px 10px',
              fontSize: '12px',
              cursor: 'pointer',
              borderRadius: '4px 4px 0 0',
              background: conv.id === activeId ? '#fff' : '#f5f5f5',
              borderBottom: conv.id === activeId ? '2px solid #1976d2' : 'none',
              whiteSpace: 'nowrap',
            }}
          >
            {renaming === conv.id ? (
              <input
                ref={renameInputRef}
                value={renameValue}
                onChange={e => setRenameValue(e.target.value)}
                onBlur={handleRenameSubmit}
                onKeyDown={handleRenameKeyDown}
                onClick={e => e.stopPropagation()}
                style={{ width: '80px', fontSize: '12px', border: '1px solid #1976d2', borderRadius: '2px', padding: '1px 4px', outline: 'none' }}
              />
            ) : (
              <>
                {conv.name}
                <span onClick={(e) => { e.stopPropagation(); onClose(conv.id); }} style={{ marginLeft: '6px', color: '#999' }}>×</span>
              </>
            )}
          </div>
        ))}
        <button onClick={onNew} style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: '16px', padding: '2px 8px' }}>+</button>
      </div>

      {contextMenu.visible && (
        <div
          ref={menuRef}
          style={{
            position: 'fixed',
            top: contextMenu.y,
            left: contextMenu.x,
            background: '#fff',
            border: '1px solid #ddd',
            borderRadius: '4px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
            zIndex: 9999,
            minWidth: '120px',
            fontSize: '13px',
          }}
        >
          <div onClick={handleRenameStart} style={{ padding: '6px 12px', cursor: 'pointer' }} onMouseEnter={e => (e.currentTarget.style.background = '#f0f0f0')} onMouseLeave={e => (e.currentTarget.style.background = '#fff')}>
            Rename
          </div>
          <div onClick={() => { onClose(contextMenu.convId); setContextMenu(prev => ({ ...prev, visible: false })); }} style={{ padding: '6px 12px', cursor: 'pointer', color: '#d32f2f' }} onMouseEnter={e => (e.currentTarget.style.background = '#f0f0f0')} onMouseLeave={e => (e.currentTarget.style.background = '#fff')}>
            Delete
          </div>
        </div>
      )}
    </>
  );
}
