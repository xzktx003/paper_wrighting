import React, { useState } from 'react';
import { ConversationTabs } from './ConversationTabs';
import { ChatView } from './ChatView';
import { NewConversationDialog } from './NewConversationDialog';
import { ConversationSummary, Conversation } from '../api/conversationApi';

interface Props {
  conversations: ConversationSummary[];
  activeConv: Conversation | null;
  loading: boolean;
  chapters: { file: string }[];
  skills: { name: string; display_name: string }[];
  onSelect: (id: string) => void;
  onClose: (id: string) => void;
  onCreate: (data: any) => void;
  onSend: (message: string) => void;
  onRename?: (id: string, newName: string) => void;
}

export function RightPanel({ conversations, activeConv, loading, chapters, skills, onSelect, onClose, onCreate, onSend, onRename }: Props) {
  const [showNewDialog, setShowNewDialog] = useState(false);
  const [inputValue, setInputValue] = useState('');

  const handleSend = () => {
    if (!inputValue.trim()) return;
    onSend(inputValue.trim());
    setInputValue('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ height: '36px', borderBottom: '1px solid #e0e0e0', display: 'flex', alignItems: 'center' }}>
        <ConversationTabs
          conversations={conversations}
          activeId={activeConv?.id || null}
          onSelect={onSelect}
          onClose={onClose}
          onNew={() => setShowNewDialog(true)}
          onRename={onRename}
        />
      </div>

      {activeConv ? (
        <>
          <ChatView messages={activeConv.history} loading={loading} />
          <div style={{ borderTop: '1px solid #e0e0e0', padding: '8px' }}>
            <div style={{ fontSize: '11px', color: '#888', marginBottom: '4px' }}>
              {activeConv.context_scope.type === 'chapter' ? `Chapter: ${activeConv.context_scope.file}` :
               activeConv.context_scope.type === 'code' ? 'Code' :
               activeConv.context_scope.type === 'global' ? 'Global' : 'Free'} | Mode: {activeConv.mode}
            </div>
            <textarea
              value={inputValue}
              onChange={e => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type a message... (Enter to send, Shift+Enter for newline)"
              style={{ width: '100%', minHeight: '60px', resize: 'vertical', border: '1px solid #ddd', borderRadius: '4px', padding: '8px', fontSize: '13px', boxSizing: 'border-box' }}
            />
          </div>
        </>
      ) : (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#888' }}>
          <button onClick={() => setShowNewDialog(true)} style={{ padding: '8px 16px', border: '1px solid #ddd', borderRadius: '4px', cursor: 'pointer', background: '#fff' }}>
            + New Conversation
          </button>
        </div>
      )}

      {showNewDialog && (
        <NewConversationDialog
          chapters={chapters}
          skills={skills}
          onSubmit={(data) => { onCreate(data); setShowNewDialog(false); }}
          onCancel={() => setShowNewDialog(false)}
        />
      )}
    </div>
  );
}
