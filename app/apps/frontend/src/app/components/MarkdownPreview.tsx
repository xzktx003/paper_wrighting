import React, { useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';
import { resolveProjectAssetUrl } from '../utils/previewAssets';

interface Props {
  content: string;
  projectId?: string | null;
  currentFile?: string;
  onScroll?: (ratio: number) => void;
  scrollRatio?: number;
}

export function MarkdownPreview({ content, projectId, currentFile = '', onScroll, scrollRatio }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const scrollingRef = useRef(false);

  useEffect(() => {
    const el = containerRef.current;
    if (!el || scrollRatio === undefined) return;
    scrollingRef.current = true;
    const maxScroll = el.scrollHeight - el.clientHeight;
    el.scrollTop = scrollRatio * maxScroll;
    requestAnimationFrame(() => { scrollingRef.current = false; });
  }, [scrollRatio]);

  const handleScroll = () => {
    if (scrollingRef.current || !onScroll) return;
    const el = containerRef.current;
    if (!el) return;
    const maxScroll = el.scrollHeight - el.clientHeight;
    if (maxScroll <= 0) return;
    onScroll(el.scrollTop / maxScroll);
  };

  return (
    <div
      ref={containerRef}
      onScroll={handleScroll}
      style={{ 
        padding: '16px 24px', 
        overflow: 'auto', 
        height: '100%', 
        fontFamily: 'serif', 
        lineHeight: 1.8,
        background: '#ffffff',  // 保持白色背景（模拟纸张）
        color: '#1a1a1a',  // 深色文字确保可读性
      }}
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[rehypeKatex]}
        components={{
          img: ({ src, alt, ...props }) => (
            <img
              {...props}
              src={resolveProjectAssetUrl(projectId, currentFile, src)}
              alt={alt || ''}
              loading="lazy"
            />
          ),
          // 白色背景下的深色文字样式
          h1: ({ children, ...props }) => (
            <h1 style={{ color: '#1a1a1a', borderBottom: '1px solid #e0e0e0', paddingBottom: '8px' }} {...props}>{children}</h1>
          ),
          h2: ({ children, ...props }) => (
            <h2 style={{ color: '#1a1a1a' }} {...props}>{children}</h2>
          ),
          h3: ({ children, ...props }) => (
            <h3 style={{ color: '#1a1a1a' }} {...props}>{children}</h3>
          ),
          p: ({ children, ...props }) => (
            <p style={{ color: '#1a1a1a' }} {...props}>{children}</p>
          ),
          a: ({ children, href, ...props }) => (
            <a href={href} style={{ color: '#0066cc' }} {...props}>{children}</a>
          ),
          code: ({ children, className, ...props }) => {
            const isInline = !className;
            if (isInline) {
              return (
                <code style={{ 
                  background: '#f5f5f5', 
                  padding: '2px 6px', 
                  borderRadius: '4px',
                  color: '#c7254e',
                }} {...props}>
                  {children}
                </code>
              );
            }
            return <code className={className} style={{ background: '#f5f5f5', color: '#333' }} {...props}>{children}</code>;
          },
          pre: ({ children, ...props }) => (
            <pre style={{ 
              background: '#f5f5f5', 
              border: '1px solid #e0e0e0', 
              borderRadius: '8px', 
              padding: '12px',
              color: '#333',
              overflow: 'auto',
            }} {...props}>{children}</pre>
          ),
          blockquote: ({ children, ...props }) => (
            <blockquote style={{ 
              borderLeft: '3px solid #888', 
              paddingLeft: '12px', 
              color: '#555',
              margin: '12px 0',
            }} {...props}>{children}</blockquote>
          ),
          table: ({ children, ...props }) => (
            <table style={{ 
              borderCollapse: 'collapse', 
              width: '100%', 
              color: '#1a1a1a',
            }} {...props}>{children}</table>
          ),
          th: ({ children, ...props }) => (
            <th style={{ 
              border: '1px solid #ccc', 
              padding: '8px', 
              background: '#f5f5f5',
              color: '#1a1a1a',
            }} {...props}>{children}</th>
          ),
          td: ({ children, ...props }) => (
            <td style={{ 
              border: '1px solid #ccc', 
              padding: '8px',
              color: '#1a1a1a',
            }} {...props}>{children}</td>
          ),
          hr: ({ ...props }) => (
            <hr style={{ borderColor: '#e0e0e0' }} {...props} />
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
