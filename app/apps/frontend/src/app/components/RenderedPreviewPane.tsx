import React from 'react';
import { MarkdownPreview } from './MarkdownPreview';
import { LatexPreview } from './LatexPreview';

interface Props {
  content: string;
  filename: string;
  projectId?: string | null;
  currentFile?: string;
  onScroll?: (ratio: number) => void;
  scrollRatio?: number;
}

export function RenderedPreviewPane({ content, filename, projectId, currentFile = filename, onScroll, scrollRatio }: Props) {
  if (filename.endsWith('.tex')) {
    return (
      <LatexPreview
        content={content}
        projectId={projectId}
        currentFile={currentFile}
        onScroll={onScroll}
        scrollRatio={scrollRatio}
      />
    );
  }

  return (
    <MarkdownPreview
      content={content}
      projectId={projectId}
      currentFile={currentFile}
      onScroll={onScroll}
      scrollRatio={scrollRatio}
    />
  );
}
