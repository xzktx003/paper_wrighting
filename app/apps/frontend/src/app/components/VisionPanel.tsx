import React, { useState, useRef } from 'react';
import { visionToLatex } from '../../api/client';

interface Props {
  projectId: string;
  onInsert?: (latex: string) => void;
}

export function VisionPanel({ projectId, onInsert }: Props) {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string>('');
  const [result, setResult] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [prompt, setPrompt] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) {
      setFile(f);
      setResult('');
      setError('');
      const reader = new FileReader();
      reader.onload = () => setPreview(reader.result as string);
      reader.readAsDataURL(f);
    }
  };

  const handleRecognize = async () => {
    if (!file || !projectId) return;
    setLoading(true);
    setError('');
    try {
      const res = await visionToLatex({ projectId, file, mode: 'formula', prompt: prompt || undefined });
      if (res.ok && res.latex) {
        setResult(res.latex);
      } else {
        setError(res.error || 'Recognition failed');
      }
    } catch (err: any) {
      setError(err.message || 'Recognition failed');
    }
    setLoading(false);
  };

  const handleClear = () => {
    setFile(null);
    setPreview('');
    setResult('');
    setError('');
    setPrompt('');
    if (fileRef.current) fileRef.current.value = '';
  };

  return (
    <div style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h4 style={{ margin: 0, fontSize: '14px', color: 'var(--text)' }}>Vision</h4>
        {result && (
          <button onClick={handleClear} style={{ fontSize: '11px', border: 'none', background: 'none', color: 'var(--accent)', cursor: 'pointer' }}>
            Clear result
          </button>
        )}
      </div>

      <div>
        <label style={{ fontSize: '12px', fontWeight: 500, color: 'var(--text)', display: 'block', marginBottom: '4px' }}>UPLOAD IMAGE</label>
        <input ref={fileRef} type="file" accept="image/*" onChange={handleFileChange}
          style={{ fontSize: '12px', color: 'var(--text)' }} />
      </div>

      {preview && (
        <div style={{ border: '1px solid var(--border)', borderRadius: '6px', padding: '8px', background: 'var(--paper)', textAlign: 'center' }}>
          <img src={preview} alt="uploaded" style={{ maxWidth: '100%', maxHeight: '150px' }} />
        </div>
      )}

      <div>
        <label style={{ fontSize: '12px', fontWeight: 500, color: 'var(--text)', display: 'block', marginBottom: '4px' }}>EXTRA CONSTRAINTS (OPTIONAL)</label>
        <input value={prompt} onChange={e => setPrompt(e.target.value)} placeholder="e.g. output tabular only, no table caption"
          style={{ width: '100%', padding: '6px 8px', border: '1px solid var(--border)', borderRadius: '4px', fontSize: '12px', boxSizing: 'border-box', background: 'var(--panel)', color: 'var(--text)' }} />
      </div>

      <div style={{ display: 'flex', gap: '8px' }}>
        <button onClick={handleRecognize} disabled={!file || loading}
          style={{ padding: '7px 14px', border: 'none', borderRadius: '6px', background: 'var(--accent)', color: '#fff', fontSize: '12px', fontWeight: 600, cursor: file && !loading ? 'pointer' : 'default', opacity: file && !loading ? 1 : 0.5 }}>
          {loading ? 'Recognizing...' : 'Start recognition'}
        </button>
        {result && onInsert && (
          <button onClick={() => onInsert(result)}
            style={{ padding: '7px 14px', border: '1px solid var(--accent)', borderRadius: '6px', background: 'var(--paper)', color: 'var(--accent)', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}>
            Insert at cursor
          </button>
        )}
      </div>

      {error && <div style={{ fontSize: '12px', color: 'var(--danger, red)' }}>{error}</div>}

      {result && (
        <div style={{ border: '1px solid var(--border)', borderRadius: '6px', padding: '10px', background: 'var(--paper)', fontSize: '12px', fontFamily: 'monospace', whiteSpace: 'pre-wrap', wordBreak: 'break-all', color: 'var(--text)' }}>
          {result}
        </div>
      )}
    </div>
  );
}
