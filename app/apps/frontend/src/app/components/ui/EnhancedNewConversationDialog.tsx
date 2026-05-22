import React, { useState, useEffect } from 'react';
import { Button, Input, Select, Card, Badge, tokens } from './DesignSystem';

interface Props {
  chapters: { file: string }[];
  skills: { name: string; display_name: string }[];
  onSubmit: (data: { name: string; context_scope: any; active_skills: string[]; mode: string; model?: string }) => void;
  onCancel: () => void;
}

const AVAILABLE_MODELS = [
  { value: '', label: 'Default (from settings)' },
  { value: 'claude-sonnet-4-20250514', label: 'Claude Sonnet 4' },
  { value: 'claude-opus-4-20250514', label: 'Claude Opus 4' },
  { value: 'claude-haiku-4-20250506', label: 'Claude Haiku 4' },
  { value: 'claude-sonnet-4.6', label: 'Claude Sonnet 4.6' },
];

const MODES = [
  {
    value: 'chat',
    label: '💬 Chat',
    description: '只读讨论模式',
    color: '#4f6ef7',
  },
  {
    value: 'agent',
    label: '🤖 Agent',
    description: '可审查的编辑建议',
    color: '#a855f7',
  },
  {
    value: 'tools',
    label: '🔧 Tools',
    description: '多步骤任务执行',
    color: '#00e676',
  },
];

export function EnhancedNewConversationDialog({ chapters, skills, onSubmit, onCancel }: Props) {
  const [name, setName] = useState('');
  const [scopeType, setScopeType] = useState('free');
  const [scopeFile, setScopeFile] = useState('');
  const [mode, setMode] = useState('chat');
  const [model, setModel] = useState('');
  const [selectedSkills, setSelectedSkills] = useState<string[]>([]);
  const [configModel, setConfigModel] = useState('');

  useEffect(() => {
    fetch('/api/config').then(r => r.json()).then(cfg => {
      if (cfg.claude_model) setConfigModel(cfg.claude_model);
    }).catch(() => {});
  }, []);

  const handleSubmit = () => {
    let context_scope: any = { type: scopeType };
    if (scopeType === 'chapter') context_scope.file = scopeFile;
    onSubmit({ name: name || `New ${scopeType}`, context_scope, active_skills: selectedSkills, mode, model: model || undefined });
  };

  const toggleSkill = (skillName: string) => {
    setSelectedSkills(prev =>
      prev.includes(skillName)
        ? prev.filter(s => s !== skillName)
        : [...prev, skillName]
    );
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.5)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        animation: 'fadeIn 0.2s ease',
      }}
      onClick={(e) => e.target === e.currentTarget && onCancel()}
    >
      <div
        style={{
          background: 'var(--paper)',
          borderRadius: tokens.radius.xl,
          width: '480px',
          maxHeight: '85vh',
          overflow: 'auto',
          boxShadow: tokens.shadow.lg,
          animation: 'slideUp 0.3s ease',
        }}
      >
        {/* Header */}
        <div style={{
          padding: '20px 24px 16px',
          borderBottom: '1px solid var(--border)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 600, color: 'var(--text)' }}>
              新建对话
            </h3>
            <p style={{ margin: '4px 0 0', fontSize: '12px', color: 'var(--muted)' }}>
              创建一个新的 AI 助手会话
            </p>
          </div>
          <button
            onClick={onCancel}
            style={{
              width: '28px',
              height: '28px',
              border: 'none',
              background: 'var(--bg-secondary)',
              borderRadius: tokens.radius.md,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--muted)',
              fontSize: '16px',
              transition: `all ${tokens.transition.fast}`,
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'var(--danger)';
              e.currentTarget.style.color = '#fff';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'var(--bg-secondary)';
              e.currentTarget.style.color = 'var(--muted)';
            }}
          >
            ×
          </button>
        </div>

        {/* Content */}
        <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Name */}
          <Input
            label="对话名称"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="例如：润色引言部分"
          />

          {/* Model */}
          <Select
            label="模型"
            value={model}
            onChange={e => setModel(e.target.value)}
            options={AVAILABLE_MODELS.map(m => ({
              value: m.value,
              label: m.value === '' ? `默认 (${configModel || 'from settings'})` : m.label,
            }))}
          />

          {/* Mode Selection */}
          <div>
            <label style={{ fontSize: '12px', fontWeight: 500, color: 'var(--text)', display: 'block', marginBottom: '8px' }}>
              对话模式
            </label>
            <div style={{ display: 'flex', gap: '10px' }}>
              {MODES.map(m => (
                <Card
                  key={m.value}
                  padding="md"
                  hover
                  onClick={() => setMode(m.value)}
                  style={{
                    flex: 1,
                    border: mode === m.value ? `2px solid ${m.color}` : '1px solid var(--border)',
                    background: mode === m.value ? `${m.color}08` : 'var(--paper)',
                    cursor: 'pointer',
                  }}
                >
                  <div style={{
                    fontSize: '14px',
                    fontWeight: 600,
                    color: mode === m.value ? m.color : 'var(--text)',
                    marginBottom: '4px',
                  }}>
                    {m.label}
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--muted)' }}>
                    {m.description}
                  </div>
                </Card>
              ))}
            </div>
          </div>

          {/* Context Scope */}
          <Select
            label="上下文范围"
            value={scopeType}
            onChange={e => setScopeType(e.target.value)}
            options={[
              { value: 'free', label: 'Free (无文件绑定)' },
              { value: 'global', label: 'Global (所有章节)' },
              { value: 'chapter', label: 'Chapter (指定章节)' },
            ]}
          />

          {scopeType === 'chapter' && (
            <Select
              label="选择章节"
              value={scopeFile}
              onChange={e => setScopeFile(e.target.value)}
              options={[
                { value: '', label: '选择章节...' },
                ...chapters.map(ch => ({ value: ch.file, label: ch.file })),
              ]}
            />
          )}

          {/* Skills */}
          {skills.length > 0 && (
            <div>
              <label style={{ fontSize: '12px', fontWeight: 500, color: 'var(--text)', display: 'block', marginBottom: '8px' }}>
                激活的技能
              </label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                {skills.map(skill => {
                  const isSelected = selectedSkills.includes(skill.name);
                  return (
                    <button
                      key={skill.name}
                      onClick={() => toggleSkill(skill.name)}
                      style={{
                        padding: '6px 12px',
                        border: `1px solid ${isSelected ? 'var(--accent)' : 'var(--border)'}`,
                        borderRadius: tokens.radius.full,
                        background: isSelected ? 'var(--accent-soft)' : 'var(--paper)',
                        color: isSelected ? 'var(--accent-strong)' : 'var(--text-secondary)',
                        fontSize: '12px',
                        fontWeight: isSelected ? 600 : 400,
                        cursor: 'pointer',
                        transition: `all ${tokens.transition.fast}`,
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                      }}
                    >
                      {isSelected && '✓ '}
                      {skill.display_name || skill.name}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{
          padding: '16px 24px',
          borderTop: '1px solid var(--border)',
          display: 'flex',
          justifyContent: 'flex-end',
          gap: '10px',
          background: 'var(--panel-muted)',
          borderRadius: `0 0 ${tokens.radius.xl} ${tokens.radius.xl}`,
        }}>
          <Button variant="ghost" onClick={onCancel}>
            取消
          </Button>
          <Button variant="primary" onClick={handleSubmit}>
            创建对话
          </Button>
        </div>
      </div>

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes slideUp {
          from {
            opacity: 0;
            transform: translateY(20px) scale(0.98);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }
      `}</style>
    </div>
  );
}