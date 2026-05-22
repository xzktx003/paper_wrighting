import React, { useState } from 'react';
import { EnhancedConversationTabs } from './EnhancedConversationTabs';
import { EnhancedChatView } from './EnhancedChatView';
import { EnhancedNewConversationDialog } from './EnhancedNewConversationDialog';
import { EnhancedMessageInput } from './EnhancedMessageInput';
import { ConversationEmptyState } from './EnhancedEmptyStates';
import { tokens } from './DesignSystem';
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

export function EnhancedRightPanel({
  conversations,
  activeConv,
  loading,
  chapters,
  skills,
  onSelect,
  onClose,
  onCreate,
  onSend,
  onRename,
}: Props) {
  const [showNewDialog, setShowNewDialog] = useState(false);

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      background: 'var(--panel)',
    }}>
      {/* Header with tabs */}
      <div style={{
        height: '42px',
        borderBottom: '1px solid var(--border)',
        display: 'flex',
        alignItems: 'center',
        background: 'var(--panel-muted)',
        flexShrink: 0,
      }}>
        <EnhancedConversationTabs
          conversations={conversations}
          activeId={activeConv?.id || null}
          onSelect={onSelect}
          onClose={onClose}
          onNew={() => setShowNewDialog(true)}
          onRename={onRename}
        />
      </div>

      {/* Content */}
      {activeConv ? (
        <>
          {/* Chat view */}
          <EnhancedChatView
            messages={activeConv.history}
            loading={loading}
            userName="You"
            aiName="AI Assistant"
          />

          {/* Message input */}
          <EnhancedMessageInput
            onSend={onSend}
            disabled={loading}
            contextInfo={{
              type: activeConv.context_scope.type === 'chapter'
                ? `章节: ${activeConv.context_scope.file}`
                : activeConv.context_scope.type === 'global'
                  ? '全局'
                  : '自由',
              mode: activeConv.mode,
            }}
          />
        </>
      ) : (
        <ConversationEmptyState onAction={() => setShowNewDialog(true)} />
      )}

      {/* New conversation dialog */}
      {showNewDialog && (
        <EnhancedNewConversationDialog
          chapters={chapters}
          skills={skills}
          onSubmit={(data) => {
            onCreate(data);
            setShowNewDialog(false);
          }}
          onCancel={() => setShowNewDialog(false)}
        />
      )}
    </div>
  );
}