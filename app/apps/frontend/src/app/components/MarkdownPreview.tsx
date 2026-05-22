import React from 'react';
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
}

export function MarkdownPreview({ content, projectId, currentFile = '' }: Props) {
  return (
    <div style={{ padding: '16px 24px', overflow: 'auto', height: '100%', fontFamily: 'serif', lineHeight: 1.8 }}>
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
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
