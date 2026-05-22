import React, { useState, useCallback, useRef } from 'react';
import { MarkdownEditor } from '../MarkdownEditor';
import { RenderedDocumentEditor } from '../RenderedDocumentEditor';
import { MarkdownPreview } from '../MarkdownPreview';
import { LatexPreview } from '../LatexPreview';
import { TerminalPanel } from '../TerminalPanel';
import { getOpenPrismProjectId, isImagePath, isPdfPath, isPreviewableTextPath } from '../../utils/previewAssets';
import { compileProject } from '../../../api/client';
import { tokens, Button, Spinner, Tooltip } from './DesignSystem';

interface OpenFile {
  filename: string;
  content: string;
  type: 'chapter' | 'code' | 'other';
  dirty: boolean;
}

interface Props {
  openFiles: OpenFile[];
  activeFileIndex: number;
  onFileChange: (index: number, content: string) => void;
  onTabSelect: (index: number) => void;
  onTabClose: (index: number) => void;
  terminalVisible: boolean;
  onToggleTerminal: () => void;
  projectPath?: string;
}

export function EnhancedCenterPanel({
  openFiles,
  activeFileIndex,
  onFileChange,
  onTabSelect,
  onTabClose,
  terminalVisible,
  onToggleTerminal,
  projectPath,
}: Props) {
  const [editorViewMode, setEditorViewMode] = useState<'source' | 'split' | 'live'>('split');
  const [terminalHeight, setTerminalHeight] = useState(250);
  const [terminalMaximized, setTerminalMaximized] = useState(false);
  const [editorRatio, setEditorRatio] = useState(0.5);
  const [previewScrollRatio, setPreviewScrollRatio] = useState<number | undefined>(undefined);
  const [editorScrollRatio, setEditorScrollRatio] = useState<number | undefined>(undefined);
  const [syncScrollEnabled, setSyncScrollEnabled] = useState(true);
  const [compiling, setCompiling] = useState(false);
  const [compileResult, setCompileResult] = useState<{ ok: boolean; log?: string; error?: string } | null>(null);
  const editorAreaRef = useRef<HTMLDivElement>(null);
  const scrollSourceRef = useRef<'editor' | 'preview' | null>(null);
  const activeFile = openFiles?.[activeFileIndex];
  const projectId = getOpenPrismProjectId(projectPath);
  const activeIsImage = !!activeFile && isImagePath(activeFile.filename);
  const activeIsPdf = !!activeFile && isPdfPath(activeFile.filename);
  const activeIsText = !!activeFile && isPreviewableTextPath(activeFile.filename);

  const handleTerminalResize = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    const startY = e.clientX !== undefined ? e.clientY : 0;
    const startH = terminalHeight;
    const onMove = (ev: MouseEvent) => {
      const newH = Math.max(100, Math.min(800, startH + (startY - ev.clientY)));
      setTerminalHeight(newH);
    };
    const onUp = () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
    document.body.style.cursor = 'row-resize';
    document.body.style.userSelect = 'none';
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }, [terminalHeight]);

  const handleEditorPreviewResize = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    const container = editorAreaRef.current;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    const onMove = (ev: MouseEvent) => {
      const ratio = (ev.clientY - rect.top) / rect.height;
      setEditorRatio(Math.max(0.2, Math.min(0.8, ratio)));
    };
    const onUp = () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
    document.body.style.cursor = 'row-resize';
    document.body.style.userSelect = 'none';
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }, []);

  const handleEditorScroll = useCallback((ratio: number) => {
    if (!syncScrollEnabled || scrollSourceRef.current === 'preview') return;
    scrollSourceRef.current = 'editor';
    setPreviewScrollRatio(ratio);
    requestAnimationFrame(() => { scrollSourceRef.current = null; });
  }, [syncScrollEnabled]);

  const handlePreviewScroll = useCallback((ratio: number) => {
    if (!syncScrollEnabled || scrollSourceRef.current === 'editor') return;
    scrollSourceRef.current = 'preview';
    setEditorScrollRatio(ratio);
    requestAnimationFrame(() => { scrollSourceRef.current = null; });
  }, [syncScrollEnabled]);

  const handleCompile = useCallback(async () => {
    if (!projectId || compiling) return;
    setCompiling(true);
    setCompileResult(null);
    try {
      const result = await compileProject(projectId, activeFile?.filename);
      setCompileResult(result);
    } catch (e: any) {
      setCompileResult({ ok: false, error: e.message });
    } finally {
      setCompiling(false);
    }
  }, [projectId, compiling, activeFile?.filename]);

  const termH = terminalMaximized ? '100%' : terminalHeight;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: 'var(--bg)' }}>
      {/* Enhanced Tab bar */}
      <div style={{
        height: '40px',
        borderBottom: '1px solid var(--border)',
        display: 'flex',
        alignItems: 'center',
        padding: '0 8px',
        gap: '4px',
        overflow: 'auto',
        flexShrink: 0,
        background: 'var(--panel-muted)',
      }}>
        {/* File tabs */}
        <div style={{ display: 'flex', gap: '2px', flex: 1, overflow: 'auto' }}>
          {(openFiles || []).map((file, i) => {
            const isActive = i === activeFileIndex;
            return (
              <div
                key={file.filename}
                onClick={() => onTabSelect(i)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '6px 12px',
                  fontSize: '12px',
                  cursor: 'pointer',
                  borderRadius: `${tokens.radius.md} ${tokens.radius.md} 0 0`,
                  background: isActive ? 'var(--paper)' : 'transparent',
                  borderBottom: isActive ? '2px solid var(--accent)' : '2px solid transparent',
                  color: isActive ? 'var(--accent-strong)' : 'var(--text-secondary)',
                  fontWeight: isActive ? 500 : 400,
                  transition: `all ${tokens.transition.fast}`,
                  whiteSpace: 'nowrap',
                }}
                onMouseEnter={(e) => {
                  if (!isActive) {
                    e.currentTarget.style.background = 'var(--hover)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isActive) {
                    e.currentTarget.style.background = 'transparent';
                  }
                }}
              >
                {/* File type icon */}
                <span style={{ fontSize: '11px' }}>
                  {file.type === 'chapter' ? '📝' : file.type === 'code' ? '💻' : '📄'}
                </span>
                <span>{file.filename}</span>
                {file.dirty && (
                  <span style={{
                    width: '6px',
                    height: '6px',
                    borderRadius: '50%',
                    background: 'var(--accent)',
                  }} />
                )}
                <button
                  onClick={(e) => { e.stopPropagation(); onTabClose(i); }}
                  style={{
                    border: 'none',
                    background: 'transparent',
                    cursor: 'pointer',
                    color: 'var(--muted)',
                    fontSize: '14px',
                    padding: '0 2px',
                    borderRadius: '4px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    transition: `all ${tokens.transition.fast}`,
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'var(--danger)';
                    e.currentTarget.style.color = '#fff';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'transparent';
                    e.currentTarget.style.color = 'var(--muted)';
                  }}
                >
                  ×
                </button>
              </div>
            );
          })}
        </div>

        {/* Editor controls */}
        {activeFile && activeFile.type === 'chapter' && (
          <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
            {/* View mode toggle */}
            <div style={{
              display: 'flex',
              border: '1px solid var(--border)',
              borderRadius: tokens.radius.md,
              overflow: 'hidden',
              background: 'var(--paper)',
            }}>
              {([
                { key: 'source', label: 'Source', icon: '📄' },
                { key: 'split', label: 'Split', icon: '⬜' },
                { key: 'live', label: 'Rendered', icon: '👁️' },
              ] as const).map(({ key, label, icon }) => (
                <Tooltip key={key} content={`${label} 视图`} position="bottom">
                  <button
                    onClick={() => setEditorViewMode(key)}
                    style={{
                      fontSize: '11px',
                      border: 'none',
                      borderRight: key === 'live' ? 'none' : '1px solid var(--border)',
                      padding: '5px 10px',
                      cursor: 'pointer',
                      background: editorViewMode === key ? 'var(--accent-soft)' : 'transparent',
                      color: editorViewMode === key ? 'var(--accent-strong)' : 'var(--text-secondary)',
                      fontWeight: editorViewMode === key ? 600 : 500,
                      transition: `all ${tokens.transition.fast}`,
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                    }}
                  >
                    <span>{icon}</span>
                    <span>{label}</span>
                  </button>
                </Tooltip>
              ))}
            </div>

            {/* Sync scroll toggle */}
            {editorViewMode === 'split' && (
              <Tooltip content={syncScrollEnabled ? '关闭同步滚动' : '开启同步滚动'} position="bottom">
                <button
                  onClick={() => setSyncScrollEnabled(v => !v)}
                  style={{
                    fontSize: '11px',
                    border: '1px solid var(--border)',
                    borderRadius: tokens.radius.md,
                    padding: '5px 10px',
                    cursor: 'pointer',
                    background: syncScrollEnabled ? 'var(--accent-soft)' : 'transparent',
                    color: syncScrollEnabled ? 'var(--accent-strong)' : 'var(--muted)',
                    fontWeight: 500,
                    transition: `all ${tokens.transition.fast}`,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                  }}
                >
                  <span>{syncScrollEnabled ? '🔗' : '⛓️'}</span>
                  <span>{syncScrollEnabled ? '同步' : '自由'}</span>
                </button>
              </Tooltip>
            )}

            {/* Compile button */}
            <Tooltip content="编译为 PDF" position="bottom">
              <button
                onClick={handleCompile}
                disabled={compiling || !projectId}
                style={{
                  fontSize: '11px',
                  border: '1px solid var(--border)',
                  borderRadius: tokens.radius.md,
                  padding: '5px 12px',
                  cursor: compiling || !projectId ? 'wait' : 'pointer',
                  background: compiling ? 'var(--accent-soft)' : 'var(--paper)',
                  color: compiling ? 'var(--accent-strong)' : 'var(--text-secondary)',
                  fontWeight: 500,
                  transition: `all ${tokens.transition.fast}`,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                {compiling ? (
                  <Spinner size={12} color="var(--accent)" />
                ) : (
                  <span>📄</span>
                )}
                <span>编译</span>
              </button>
            </Tooltip>
          </div>
        )}

        {/* Terminal toggle */}
        <Tooltip content={terminalVisible ? '隐藏终端' : '显示终端'} position="bottom">
          <button
            onClick={onToggleTerminal}
            style={{
              fontSize: '11px',
              border: '1px solid var(--border)',
              borderRadius: tokens.radius.md,
              padding: '5px 10px',
              cursor: 'pointer',
              background: terminalVisible ? 'var(--zone-terminal-accent-dim)' : 'var(--paper)',
              color: terminalVisible ? 'var(--zone-terminal-accent)' : 'var(--text-secondary)',
              fontWeight: 500,
              transition: `all ${tokens.transition.fast}`,
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
            }}
          >
            <span>⌨️</span>
            <span>终端</span>
          </button>
        </Tooltip>
      </div>

      {/* Compile result toast */}
      {compileResult && (
        <div style={{
          padding: '8px 12px',
          background: compileResult.ok ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
          borderBottom: `1px solid ${compileResult.ok ? 'var(--success)' : 'var(--danger)'}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          fontSize: '12px',
          color: compileResult.ok ? 'var(--success)' : 'var(--danger)',
        }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            {compileResult.ok ? '✅' : '❌'} {compileResult.ok ? '编译成功' : compileResult.error || '编译失败'}
          </span>
          <button
            onClick={() => setCompileResult(null)}
            style={{
              border: 'none',
              background: 'transparent',
              cursor: 'pointer',
              color: 'inherit',
              fontSize: '14px',
            }}
          >
            ×
          </button>
        </div>
      )}

      {/* Editor area */}
      {activeFile ? (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {activeIsImage ? (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
              <img
                src={`/api/projects/${projectId}/blob?path=${encodeURIComponent(activeFile.filename)}`}
                alt={activeFile.filename}
                style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', borderRadius: tokens.radius.md }}
              />
            </div>
          ) : activeIsPdf ? (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <iframe
                src={`/api/projects/${projectId}/blob?path=${encodeURIComponent(activeFile.filename)}`}
                style={{ width: '100%', height: '100%', border: 'none' }}
              />
            </div>
          ) : activeIsText ? (
            <MarkdownPreview
              content={activeFile.content}
              projectId={projectId}
              currentFile={activeFile.filename}
              onScroll={handlePreviewScroll}
              scrollRatio={previewScrollRatio}
            />
          ) : activeFile.type === 'chapter' ? (
            <div ref={editorAreaRef} style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
              {editorViewMode === 'source' ? (
                <div style={{ flex: 1, overflow: 'hidden' }}>
                  <MarkdownEditor
                    content={activeFile.content}
                    onChange={(v) => onFileChange(activeFileIndex, v)}
                    onScroll={handleEditorScroll}
                    scrollRatio={editorScrollRatio}
                  />
                </div>
              ) : editorViewMode === 'split' ? (
                <>
                  <div style={{ flex: editorRatio, overflow: 'hidden', borderBottom: '1px solid var(--border)' }}>
                    <MarkdownEditor
                      content={activeFile.content}
                      onChange={(v) => onFileChange(activeFileIndex, v)}
                      onScroll={handleEditorScroll}
                      scrollRatio={editorScrollRatio}
                    />
                  </div>
                  <div
                    onMouseDown={handleEditorPreviewResize}
                    style={{
                      height: '5px',
                      cursor: 'row-resize',
                      background: 'var(--border)',
                      flexShrink: 0,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <div style={{ width: '40px', height: '2px', borderRadius: '1px', background: 'var(--muted)' }} />
                  </div>
                  <div style={{ flex: 1 - editorRatio, overflow: 'hidden', background: '#f5f5f0' }}>
                    <LatexPreview
                      content={activeFile.content}
                      projectId={projectId}
                      currentFile={activeFile.filename}
                      onScroll={handlePreviewScroll}
                      scrollRatio={previewScrollRatio}
                    />
                  </div>
                </>
              ) : (
                <div style={{ flex: 1, overflow: 'hidden' }}>
                  <RenderedDocumentEditor
                    content={activeFile.content}
                    onChange={(v) => onFileChange(activeFileIndex, v)}
                    projectId={projectId}
                    currentFile={activeFile.filename}
                  />
                </div>
              )}
            </div>
          ) : (
            <div style={{ flex: 1, overflow: 'hidden' }}>
              <MarkdownEditor
                content={activeFile.content}
                onChange={(v) => onFileChange(activeFileIndex, v)}
                onScroll={handleEditorScroll}
                scrollRatio={editorScrollRatio}
              />
            </div>
          )}
        </div>
      ) : (
        <div style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '12px',
          color: 'var(--muted)',
        }}>
          <div style={{ fontSize: '48px', opacity: 0.3 }}>📝</div>
          <p style={{ fontSize: '14px', margin: 0 }}>选择一个文件开始编辑</p>
        </div>
      )}

      {/* Terminal */}
      {terminalVisible && (
        <>
          <div
            onMouseDown={handleTerminalResize}
            style={{
              height: '5px',
              cursor: 'row-resize',
              background: 'var(--border)',
              flexShrink: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <div style={{ width: '40px', height: '2px', borderRadius: '1px', background: 'var(--muted)' }} />
          </div>
          <div style={{ height: termH, flexShrink: 0, borderTop: '1px solid var(--border)' }}>
            <TerminalPanel cwd={projectPath || ''} />
          </div>
        </>
      )}
    </div>
  );
}