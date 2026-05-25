import React, { useState, useEffect } from 'react';

interface Props {
  chapters: { file: string }[];
  skills: { name: string; display_name: string }[];
  onSubmit: (data: { name: string; context_scope: any; active_skills: string[]; mode: string; model?: string }) => void;
  onCancel: () => void;
}

export function NewConversationDialog({ chapters, skills, onSubmit, onCancel }: Props) {
  const [name, setName] = useState('');
  const [scopeType, setScopeType] = useState('free');
  const [scopeFile, setScopeFile] = useState('');
  const [mode, setMode] = useState('chat');
  const [model, setModel] = useState('');
  const [selectedSkills, setSelectedSkills] = useState<string[]>([]);
  const [configModel, setConfigModel] = useState('');
  const [availableModels, setAvailableModels] = useState<string[]>([]);
  const [modelsError, setModelsError] = useState('');

  useEffect(() => {
    fetch('/api/config').then(r => r.json()).then(cfg => {
      if (cfg.claude_model || cfg.llm_model) setConfigModel(cfg.llm_model || cfg.claude_model);
    }).catch((err) => { console.error('Failed to load config:', err); });

    fetch('/api/models').then(r => r.json()).then(data => {
      if (data.error) {
        setModelsError(data.error);
      } else if (data.models && data.models.length > 0) {
        setAvailableModels(data.models);
      }
    }).catch((err) => { setModelsError(`Failed to fetch models: ${err.message}`); });
  }, []);

  const handleSubmit = () => {
    let context_scope: any = { type: scopeType };
    if (scopeType === 'chapter') context_scope.file = scopeFile;
    onSubmit({ name: name || `New ${scopeType}`, context_scope, active_skills: selectedSkills, mode, model: model || undefined });
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
      <div style={{ background: 'var(--paper)', borderRadius: '8px', padding: '24px', width: '400px', color: 'var(--text)' }}>
        <h3 style={{ margin: '0 0 16px' }}>New Conversation</h3>

        <label style={{ display: 'block', marginBottom: '12px' }}>
          <span style={{ fontSize: '13px', fontWeight: 500 }}>Name</span>
          <input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Write Introduction"
            style={{ display: 'block', width: '100%', marginTop: '4px', padding: '6px 8px', border: '1px solid var(--border)', borderRadius: '4px', boxSizing: 'border-box', background: 'var(--panel)', color: 'var(--text)' }} />
        </label>

        <label style={{ display: 'block', marginBottom: '12px' }}>
          <span style={{ fontSize: '13px', fontWeight: 500 }}>Model</span>
          {modelsError && <span style={{ fontSize: '11px', color: 'var(--danger)', marginLeft: '8px' }}>{modelsError}</span>}
          <select value={model} onChange={e => setModel(e.target.value)}
            style={{ display: 'block', width: '100%', marginTop: '4px', padding: '6px 8px', border: '1px solid var(--border)', borderRadius: '4px', background: 'var(--panel)', color: 'var(--text)' }}>
            <option value="">{`Default (${configModel || 'from settings'})`}</option>
            {availableModels.map(m => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
        </label>

        <label style={{ display: 'block', marginBottom: '12px' }}>
          <span style={{ fontSize: '13px', fontWeight: 500 }}>Context Scope</span>
          <select value={scopeType} onChange={e => setScopeType(e.target.value)}
            style={{ display: 'block', width: '100%', marginTop: '4px', padding: '6px 8px', border: '1px solid var(--border)', borderRadius: '4px', background: 'var(--panel)', color: 'var(--text)' }}>
            <option value="free">Free (no file binding)</option>
            <option value="global">Global (all chapters)</option>
            <option value="chapter">Chapter (specific)</option>
          </select>
        </label>

        {scopeType === 'chapter' && (
          <label style={{ display: 'block', marginBottom: '12px' }}>
            <span style={{ fontSize: '13px', fontWeight: 500 }}>Chapter</span>
            <select value={scopeFile} onChange={e => setScopeFile(e.target.value)}
              style={{ display: 'block', width: '100%', marginTop: '4px', padding: '6px 8px', border: '1px solid var(--border)', borderRadius: '4px', background: 'var(--panel)', color: 'var(--text)' }}>
              <option value="">Select...</option>
              {chapters.map(ch => <option key={ch.file} value={ch.file}>{ch.file}</option>)}
            </select>
          </label>
        )}

        <label style={{ display: 'block', marginBottom: '12px' }}>
          <span style={{ fontSize: '13px', fontWeight: 500 }}>Mode</span>
          <select value={mode} onChange={e => setMode(e.target.value)}
            style={{ display: 'block', width: '100%', marginTop: '4px', padding: '6px 8px', border: '1px solid var(--border)', borderRadius: '4px', background: 'var(--panel)', color: 'var(--text)' }}>
            <option value="chat">Chat (read-only discussion)</option>
            <option value="agent">Agent (propose edits)</option>
            <option value="tools">Tools (multi-step tasks)</option>
          </select>
        </label>

        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '16px' }}>
          <button onClick={onCancel} style={{ padding: '6px 16px', border: '1px solid var(--border)', borderRadius: '4px', background: 'var(--panel)', color: 'var(--text)', cursor: 'pointer' }}>Cancel</button>
          <button onClick={handleSubmit} style={{ padding: '6px 16px', border: 'none', borderRadius: '4px', background: 'var(--accent)', color: '#fff', cursor: 'pointer' }}>Create</button>
        </div>
      </div>
    </div>
  );
}
