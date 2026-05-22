import React from 'react';
import { Button, tokens } from './DesignSystem';

// ============================================
// Project Empty State
// ============================================
export function ProjectEmptyState({ onAction }: { onAction?: () => void }) {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      height: '100%',
      padding: '40px 24px',
      textAlign: 'center',
      gap: '16px',
    }}>
      {/* Icon with animation */}
      <div style={{
        position: 'relative',
        width: '80px',
        height: '80px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}>
        <div style={{
          position: 'absolute',
          inset: 0,
          borderRadius: '50%',
          background: 'linear-gradient(135deg, var(--accent-soft) 0%, transparent 100%)',
          animation: 'pulse 2s ease-in-out infinite',
        }} />
        <div style={{
          fontSize: '36px',
          filter: 'drop-shadow(0 4px 8px rgba(0,0,0,0.1))',
        }}>
          📄
        </div>
      </div>

      <div>
        <h3 style={{
          margin: 0,
          fontSize: '16px',
          fontWeight: 600,
          color: 'var(--text)',
          marginBottom: '6px',
        }}>
          暂无打开的项目
        </h3>
        <p style={{
          margin: 0,
          fontSize: '13px',
          color: 'var(--muted)',
          maxWidth: '260px',
          lineHeight: 1.5,
        }}>
          创建一个新项目或从现有文件夹导入，开始你的论文写作之旅
        </p>
      </div>

      {onAction && (
        <Button variant="primary" onClick={onAction} style={{ marginTop: '8px' }}>
          创建新项目
        </Button>
      )}

      <style>{`
        @keyframes pulse {
          0%, 100% { transform: scale(1); opacity: 0.5; }
          50% { transform: scale(1.1); opacity: 0.8; }
        }
      `}</style>
    </div>
  );
}

// ============================================
// Conversation Empty State
// ============================================
export function ConversationEmptyState({ onAction }: { onAction?: () => void }) {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      height: '100%',
      padding: '40px 24px',
      textAlign: 'center',
      gap: '16px',
    }}>
      {/* Animated icon */}
      <div style={{
        position: 'relative',
        width: '72px',
        height: '72px',
      }}>
        <div style={{
          position: 'absolute',
          inset: 0,
          borderRadius: '50%',
          background: 'linear-gradient(135deg, var(--zone-ai-accent) 0%, var(--accent) 100%)',
          opacity: 0.15,
          animation: 'float 3s ease-in-out infinite',
        }} />
        <div style={{
          position: 'absolute',
          inset: '8px',
          borderRadius: '50%',
          background: 'linear-gradient(135deg, var(--zone-ai-accent) 0%, var(--accent) 100%)',
          opacity: 0.3,
          animation: 'float 3s ease-in-out infinite 0.5s',
        }} />
        <div style={{
          position: 'absolute',
          inset: '16px',
          borderRadius: '50%',
          background: 'linear-gradient(135deg, var(--zone-ai-accent) 0%, var(--accent) 100%)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '24px',
        }}>
          💬
        </div>
      </div>

      <div>
        <h3 style={{
          margin: 0,
          fontSize: '15px',
          fontWeight: 600,
          color: 'var(--text)',
          marginBottom: '6px',
        }}>
          开始新对话
        </h3>
        <p style={{
          margin: 0,
          fontSize: '12px',
          color: 'var(--muted)',
          maxWidth: '240px',
          lineHeight: 1.5,
        }}>
          与 AI 助手讨论你的论文，获取写作建议和反馈
        </p>
      </div>

      {onAction && (
        <Button variant="primary" onClick={onAction} style={{ marginTop: '8px' }}>
          + 新建对话
        </Button>
      )}

      <style>{`
        @keyframes float {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-8px); }
        }
      `}</style>
    </div>
  );
}

// ============================================
// File Tree Empty State
// ============================================
export function FileTreeEmptyState() {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '32px 20px',
      textAlign: 'center',
      gap: '12px',
    }}>
      <div style={{ fontSize: '40px', opacity: 0.5 }}>📁</div>
      <div style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text)' }}>
        暂无文件
      </div>
      <div style={{ fontSize: '12px', color: 'var(--muted)', maxWidth: '200px' }}>
        右键空白区域创建新文件或上传文件
      </div>
    </div>
  );
}

// ============================================
// Skills Empty State
// ============================================
export function SkillsEmptyState() {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '24px 16px',
      textAlign: 'center',
      gap: '8px',
    }}>
      <div style={{ fontSize: '28px', opacity: 0.4 }}>🛠️</div>
      <div style={{ fontSize: '12px', color: 'var(--muted)' }}>
        暂无激活的技能
      </div>
    </div>
  );
}

// ============================================
// Loading State
// ============================================
export function LoadingState({ message = '加载中...' }: { message?: string }) {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '40px 24px',
      gap: '16px',
    }}>
      <div style={{
        width: '40px',
        height: '40px',
        border: '3px solid var(--border)',
        borderTopColor: 'var(--accent)',
        borderRadius: '50%',
        animation: 'spin 1s linear infinite',
      }} />
      <div style={{ fontSize: '13px', color: 'var(--muted)' }}>{message}</div>
      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}

// ============================================
// Error State
// ============================================
export function ErrorState({
  message,
  onRetry
}: {
  message: string;
  onRetry?: () => void;
}) {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '32px 24px',
      textAlign: 'center',
      gap: '12px',
    }}>
      <div style={{
        width: '48px',
        height: '48px',
        borderRadius: '50%',
        background: 'rgba(239, 68, 68, 0.1)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: '24px',
      }}>
        ⚠️
      </div>
      <div style={{ fontSize: '13px', color: 'var(--danger)', fontWeight: 500 }}>
        {message}
      </div>
      {onRetry && (
        <Button variant="secondary" size="sm" onClick={onRetry}>
          重试
        </Button>
      )}
    </div>
  );
}