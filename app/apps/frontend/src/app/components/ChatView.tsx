import React, { useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface Message {
  role: string;
  content: string;
}

interface Props {
  messages: Message[];
  loading: boolean;
}

export function ChatView({ messages, loading }: Props) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  return (
    <div style={{ flex: 1, overflow: 'auto', padding: '14px 12px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
      {messages.map((msg, i) => (
        <div key={i} style={{
          padding: '10px 14px',
          borderRadius: msg.role === 'user' ? '14px 14px 4px 14px' : '14px 14px 14px 4px',
          background: msg.role === 'user' ? 'var(--accent-soft)' : 'var(--bg-secondary)',
          border: `1px solid ${msg.role === 'user' ? 'var(--accent-soft)' : 'var(--border)'}`,
          maxWidth: '88%',
          marginLeft: msg.role === 'user' ? 'auto' : '0',
        }}>
          <div style={{ fontSize: '10px', fontWeight: 600, color: msg.role === 'user' ? 'var(--accent-strong)' : 'var(--muted)', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            {msg.role === 'user' ? 'You' : 'AI'}
          </div>
          <div className="markdown-body" style={{ fontSize: '13px', lineHeight: 1.6 }}>
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.content}</ReactMarkdown>
          </div>
        </div>
      ))}
      {loading && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--muted)', fontSize: '13px', padding: '8px 12px' }}>
          <span className="spinner" style={{ width: '12px', height: '12px' }} />
          Thinking...
        </div>
      )}
      <div ref={bottomRef} />
    </div>
  );
}
