import React, { useState, useEffect } from 'react';

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

export function NewConversationDialog({ chapters, skills, onSubmit, onCancel }: Props) {
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
    if (scopeType === 'code') context_scope.path = 'code/';
    onSubmit({ name: name || `New ${scopeType}`, context_scope, active_skills: selectedSkills, mode, model: model || undefined });
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
      <div style={{ background: '#fff', borderRadius: '8px', padding: '24px', width: '400px' }}>
        <h3 style={{ margin: '0 0 16px' }}>New Conversation</h3>

        <label style={{ display: 'block', marginBottom: '12px' }}>
          <span style={{ fontSize: '13px', fontWeight: 500 }}>Name</span>
          <input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Write Introduction"
            style={{ display: 'block', width: '100%', marginTop: '4px', padding: '6px 8px', border: '1px solid #ddd', borderRadius: '4px', boxSizing: 'border-box' }} />
        </label>

        <label style={{ display: 'block', marginBottom: '12px' }}>
          <span style={{ fontSize: '13px', fontWeight: 500 }}>Model</span>
          <select value={model} onChange={e => setModel(e.target.value)}
            style={{ display: 'block', width: '100%', marginTop: '4px', padding: '6px 8px', border: '1px solid #ddd', borderRadius: '4px' }}>
            {AVAILABLE_MODELS.map(m => (
              <option key={m.value} value={m.value}>
                {m.value === '' ? `Default (${configModel || 'from settings'})` : m.label}
              </option>
            ))}
          </select>
        </label>

        <label style={{ display: 'block', marginBottom: '12px' }}>
          <span style={{ fontSize: '13px', fontWeight: 500 }}>Context Scope</span>
          <select value={scopeType} onChange={e => setScopeType(e.target.value)}
            style={{ display: 'block', width: '100%', marginTop: '4px', padding: '6px 8px', border: '1px solid #ddd', borderRadius: '4px' }}>
            <option value="free">Free (no file binding)</option>
            <option value="global">Global (all chapters)</option>
            <option value="chapter">Chapter (specific)</option>
            <option value="code">Code</option>
          </select>
        </label>

        {scopeType === 'chapter' && (
          <label style={{ display: 'block', marginBottom: '12px' }}>
            <span style={{ fontSize: '13px', fontWeight: 500 }}>Chapter</span>
            <select value={scopeFile} onChange={e => setScopeFile(e.target.value)}
              style={{ display: 'block', width: '100%', marginTop: '4px', padding: '6px 8px', border: '1px solid #ddd', borderRadius: '4px' }}>
              <option value="">Select...</option>
              {chapters.map(ch => <option key={ch.file} value={ch.file}>{ch.file}</option>)}
            </select>
          </label>
        )}

        <label style={{ display: 'block', marginBottom: '12px' }}>
          <span style={{ fontSize: '13px', fontWeight: 500 }}>Mode</span>
          <select value={mode} onChange={e => setMode(e.target.value)}
            style={{ display: 'block', width: '100%', marginTop: '4px', padding: '6px 8px', border: '1px solid #ddd', borderRadius: '4px' }}>
            <option value="chat">Chat (read-only discussion)</option>
            <option value="agent">Agent (propose edits)</option>
            <option value="tools">Tools (multi-step tasks)</option>
          </select>
        </label>

        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '16px' }}>
          <button onClick={onCancel} style={{ padding: '6px 16px', border: '1px solid #ddd', borderRadius: '4px', background: '#fff', cursor: 'pointer' }}>Cancel</button>
          <button onClick={handleSubmit} style={{ padding: '6px 16px', border: 'none', borderRadius: '4px', background: '#1976d2', color: '#fff', cursor: 'pointer' }}>Create</button>
        </div>
      </div>
    </div>
  );
}
