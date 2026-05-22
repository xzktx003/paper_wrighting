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
    <div style={{ flex: 1, overflow: 'auto', padding: '12px' }}>
      {messages.map((msg, i) => (
        <div key={i} style={{
          marginBottom: '12px',
          padding: '8px 12px',
          borderRadius: '8px',
          background: msg.role === 'user' ? '#e3f2fd' : '#f5f5f5',
          maxWidth: '90%',
          marginLeft: msg.role === 'user' ? 'auto' : '0',
        }}>
          <div style={{ fontSize: '11px', color: '#888', marginBottom: '4px' }}>
            {msg.role === 'user' ? 'You' : 'AI'}
          </div>
          <div style={{ fontSize: '13px', lineHeight: 1.6 }}>
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.content}</ReactMarkdown>
          </div>
        </div>
      ))}
      {loading && (
        <div style={{ color: '#888', fontSize: '13px', padding: '8px' }}>Thinking...</div>
      )}
      <div ref={bottomRef} />
    </div>
  );
}
