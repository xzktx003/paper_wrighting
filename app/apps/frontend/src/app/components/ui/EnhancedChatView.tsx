import React, { useRef, useEffect, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Avatar, Spinner, tokens } from './DesignSystem';

interface Message {
  role: string;
  content: string;
  timestamp?: number;
}

interface Props {
  messages: Message[];
  loading: boolean;
  userName?: string;
  aiName?: string;
}

export function EnhancedChatView({ messages, loading, userName = 'You', aiName = 'AI Assistant' }: Props) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [autoScroll, setAutoScroll] = useState(true);

  useEffect(() => {
    if (autoScroll) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, autoScroll]);

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const target = e.currentTarget;
    const isAtBottom = target.scrollHeight - target.scrollTop - target.clientHeight < 50;
    setAutoScroll(isAtBottom);
  };

  const formatTime = (timestamp?: number) => {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div
      ref={containerRef}
      onScroll={handleScroll}
      style={{
        flex: 1,
        overflow: 'auto',
        padding: '16px 12px',
        display: 'flex',
        flexDirection: 'column',
        gap: '16px',
        background: 'var(--bg)',
      }}
    >
      {/* Welcome message for empty state */}
      {messages.length === 0 && !loading && (
        <div style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '16px',
          padding: '40px 20px',
          textAlign: 'center',
        }}>
          <div style={{
            width: '72px',
            height: '72px',
            borderRadius: '50%',
            background: 'linear-gradient(135deg, var(--accent) 0%, var(--accent-strong) 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '32px',
            boxShadow: tokens.shadow.glow('var(--accent)'),
          }}>
            ✨
          </div>
          <div>
            <div style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text)', marginBottom: '6px' }}>
              {aiName}
            </div>
            <div style={{ fontSize: '13px', color: 'var(--muted)', maxWidth: '280px', lineHeight: 1.5 }}>
              我可以帮助你润色论文、解答问题、或者进行多步骤的写作任务。
            </div>
          </div>
          <div style={{
            display: 'flex',
            gap: '8px',
            flexWrap: 'wrap',
            justifyContent: 'center',
            marginTop: '8px',
          }}>
            {['润色这段文字', '帮我分析结构', '检查语法错误', '解释这个概念'].map((suggestion) => (
              <button
                key={suggestion}
                style={{
                  padding: '6px 14px',
                  border: '1px solid var(--border)',
                  borderRadius: tokens.radius.full,
                  background: 'var(--paper)',
                  color: 'var(--text-secondary)',
                  fontSize: '12px',
                  cursor: 'pointer',
                  transition: `all ${tokens.transition.fast}`,
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = 'var(--accent)';
                  e.currentTarget.style.color = 'var(--accent-strong)';
                  e.currentTarget.style.background = 'var(--accent-soft)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = 'var(--border)';
                  e.currentTarget.style.color = 'var(--text-secondary)';
                  e.currentTarget.style.background = 'var(--paper)';
                }}
              >
                {suggestion}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Messages */}
      {messages.map((msg, i) => {
        const isUser = msg.role === 'user';
        const showAvatar = i === 0 || messages[i - 1]?.role !== msg.role;

        return (
          <div
            key={i}
            style={{
              display: 'flex',
              flexDirection: isUser ? 'row-reverse' : 'row',
              alignItems: 'flex-start',
              gap: '10px',
              animation: 'fadeInUp 0.3s ease',
            }}
          >
            {/* Avatar */}
            {showAvatar ? (
              isUser ? (
                <Avatar name={userName} size={32} color="var(--accent)" />
              ) : (
                <Avatar name={aiName} size={32} color="var(--zone-ai-accent)" />
              )
            ) : (
              <div style={{ width: 32 }} />
            )}

            {/* Message content */}
            <div style={{
              maxWidth: '75%',
              display: 'flex',
              flexDirection: 'column',
              alignItems: isUser ? 'flex-end' : 'flex-start',
              gap: '4px',
            }}>
              {/* Name and time */}
              {showAvatar && (
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  paddingLeft: isUser ? 0 : '4px',
                  paddingRight: isUser ? '4px' : 0,
                }}>
                  <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text)' }}>
                    {isUser ? userName : aiName}
                  </span>
                  {msg.timestamp && (
                    <span style={{ fontSize: '10px', color: 'var(--muted)' }}>
                      {formatTime(msg.timestamp)}
                    </span>
                  )}
                </div>
              )}

              {/* Message bubble */}
              <div
                style={{
                  padding: '12px 16px',
                  borderRadius: isUser
                    ? '18px 18px 4px 18px'
                    : '18px 18px 18px 4px',
                  background: isUser
                    ? 'linear-gradient(135deg, var(--accent) 0%, var(--accent-strong) 100%)'
                    : 'var(--paper)',
                  border: isUser ? 'none' : '1px solid var(--border)',
                  boxShadow: isUser ? tokens.shadow.md : tokens.shadow.sm,
                  color: isUser ? '#fff' : 'var(--text)',
                  fontSize: '13px',
                  lineHeight: 1.6,
                  wordBreak: 'break-word',
                }}
              >
                <div
                  className="markdown-body"
                  style={{
                    fontSize: '13px',
                    lineHeight: 1.6,
                    color: isUser ? '#fff' : 'var(--text)',
                  }}
                >
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm]}
                    components={{
                      // Style code blocks
                      code: ({ node, className, children, ...props }) => {
                        const isInline = !className;
                        if (isInline) {
                          return (
                            <code
                              style={{
                                background: isUser ? 'rgba(255,255,255,0.2)' : 'var(--bg-secondary)',
                                padding: '2px 6px',
                                borderRadius: '4px',
                                fontFamily: '"JetBrains Mono", monospace',
                                fontSize: '0.9em',
                              }}
                              {...props}
                            >
                              {children}
                            </code>
                          );
                        }
                        return (
                          <code
                            className={className}
                            style={{
                              display: 'block',
                              background: isUser ? 'rgba(255,255,255,0.15)' : 'var(--bg-secondary)',
                              padding: '12px',
                              borderRadius: '8px',
                              fontFamily: '"JetBrains Mono", monospace',
                              fontSize: '12px',
                              overflow: 'auto',
                              marginTop: '8px',
                            }}
                            {...props}
                          >
                            {children}
                          </code>
                        );
                      },
                      // Style links
                      a: ({ node, children, ...props }) => (
                        <a
                          {...props}
                          style={{
                            color: isUser ? '#fff' : 'var(--accent)',
                            textDecoration: 'underline',
                            textDecorationColor: isUser ? 'rgba(255,255,255,0.5)' : 'var(--accent-soft)',
                          }}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          {children}
                        </a>
                      ),
                      // Style lists
                      ul: ({ node, children, ...props }) => (
                        <ul style={{ margin: '8px 0', paddingLeft: '20px' }} {...props}>
                          {children}
                        </ul>
                      ),
                      ol: ({ node, children, ...props }) => (
                        <ol style={{ margin: '8px 0', paddingLeft: '20px' }} {...props}>
                          {children}
                        </ol>
                      ),
                      // Style headings
                      h1: ({ node, children, ...props }) => (
                        <h1 style={{ fontSize: '16px', fontWeight: 700, margin: '12px 0 8px' }} {...props}>
                          {children}
                        </h1>
                      ),
                      h2: ({ node, children, ...props }) => (
                        <h2 style={{ fontSize: '14px', fontWeight: 600, margin: '10px 0 6px' }} {...props}>
                          {children}
                        </h2>
                      ),
                      // Style blockquote
                      blockquote: ({ node, children, ...props }) => (
                        <blockquote
                          style={{
                            borderLeft: `3px solid ${isUser ? 'rgba(255,255,255,0.5)' : 'var(--accent)'}`,
                            paddingLeft: '12px',
                            margin: '8px 0',
                            color: isUser ? 'rgba(255,255,255,0.85)' : 'var(--text-secondary)',
                            fontStyle: 'italic',
                          }}
                          {...props}
                        >
                          {children}
                        </blockquote>
                      ),
                    }}
                  >
                    {msg.content}
                  </ReactMarkdown>
                </div>
              </div>
            </div>
          </div>
        );
      })}

      {/* Loading indicator */}
      {loading && (
        <div style={{
          display: 'flex',
          flexDirection: 'row',
          alignItems: 'flex-start',
          gap: '10px',
          animation: 'fadeInUp 0.3s ease',
        }}>
          <Avatar name={aiName} size={32} color="var(--zone-ai-accent)" />
          <div style={{
            padding: '14px 18px',
            borderRadius: '18px 18px 18px 4px',
            background: 'var(--paper)',
            border: '1px solid var(--border)',
            boxShadow: tokens.shadow.sm,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Spinner size={16} color="var(--accent)" />
              <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                正在思考中...
              </span>
            </div>
            {/* Typing dots animation */}
            <div style={{
              display: 'flex',
              gap: '4px',
              marginTop: '8px',
              paddingLeft: '4px',
            }}>
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  style={{
                    width: '6px',
                    height: '6px',
                    borderRadius: '50%',
                    background: 'var(--accent)',
                    animation: `bounce 1.4s ease-in-out ${i * 0.16}s infinite`,
                  }}
                />
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Auto-scroll indicator */}
      {!autoScroll && (
        <button
          onClick={() => {
            setAutoScroll(true);
            bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
          }}
          style={{
            position: 'absolute',
            bottom: '80px',
            left: '50%',
            transform: 'translateX(-50%)',
            padding: '6px 14px',
            borderRadius: tokens.radius.full,
            border: '1px solid var(--border)',
            background: 'var(--paper)',
            color: 'var(--text-secondary)',
            fontSize: '12px',
            cursor: 'pointer',
            boxShadow: tokens.shadow.md,
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            transition: `all ${tokens.transition.fast}`,
          }}
        >
          ↓ 滚动到最新
        </button>
      )}

      <div ref={bottomRef} />

      {/* Animations */}
      <style>{`
        @keyframes fadeInUp {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        @keyframes bounce {
          0%, 60%, 100% {
            transform: translateY(0);
          }
          30% {
            transform: translateY(-6px);
          }
        }
      `}</style>
    </div>
  );
}