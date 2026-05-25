import React, { useState } from 'react';
import { plotFromTable } from '../../api/client';

interface Props {
  projectId: string;
  onInsert?: (assetPath: string) => void;
}

export function PlotPanel({ projectId, onInsert }: Props) {
  const [tableLatex, setTableLatex] = useState('');
  const [chartType, setChartType] = useState('bar');
  const [title, setTitle] = useState('');
  const [prompt, setPrompt] = useState('');
  const [filename, setFilename] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<string>('');

  const handleGenerate = async () => {
    if (!tableLatex.trim() || !projectId) return;
    setLoading(true);
    setError('');
    setResult('');
    try {
      const res = await plotFromTable({
        projectId,
        tableLatex: tableLatex.trim(),
        chartType,
        title: title || undefined,
        prompt: prompt || undefined,
        filename: filename || undefined,
      });
      if (res.ok && res.assetPath) {
        setResult(res.assetPath);
      } else {
        setError(res.error || 'Plot generation failed');
      }
    } catch (err: any) {
      setError(err.message || 'Plot generation failed');
    }
    setLoading(false);
  };

  return (
    <div style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
      <h4 style={{ margin: 0, fontSize: '14px', color: 'var(--text)' }}>Plot</h4>

      <div>
        <label style={{ fontSize: '12px', fontWeight: 500, color: 'var(--text)', display: 'block', marginBottom: '4px' }}>TABLE LATEX</label>
        <textarea value={tableLatex} onChange={e => setTableLatex(e.target.value)}
          placeholder="Paste your LaTeX table here..."
          style={{ width: '100%', minHeight: '100px', padding: '8px', border: '1px solid var(--border)', borderRadius: '4px', fontSize: '12px', boxSizing: 'border-box', background: 'var(--panel)', color: 'var(--text)', fontFamily: 'monospace', resize: 'vertical' }} />
      </div>

      <div>
        <label style={{ fontSize: '12px', fontWeight: 500, color: 'var(--text)', display: 'block', marginBottom: '4px' }}>CHART TYPE</label>
        <select value={chartType} onChange={e => setChartType(e.target.value)}
          style={{ width: '100%', padding: '6px 8px', border: '1px solid var(--border)', borderRadius: '4px', fontSize: '12px', background: 'var(--panel)', color: 'var(--text)' }}>
          <option value="bar">Bar Chart</option>
          <option value="line">Line Chart</option>
          <option value="scatter">Scatter Plot</option>
          <option value="pie">Pie Chart</option>
          <option value="heatmap">Heatmap</option>
          <option value="box">Box Plot</option>
        </select>
      </div>

      <div>
        <label style={{ fontSize: '12px', fontWeight: 500, color: 'var(--text)', display: 'block', marginBottom: '4px' }}>TITLE (OPTIONAL)</label>
        <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Chart title"
          style={{ width: '100%', padding: '6px 8px', border: '1px solid var(--border)', borderRadius: '4px', fontSize: '12px', boxSizing: 'border-box', background: 'var(--panel)', color: 'var(--text)' }} />
      </div>

      <div>
        <label style={{ fontSize: '12px', fontWeight: 500, color: 'var(--text)', display: 'block', marginBottom: '4px' }}>EXTRA PROMPT (OPTIONAL)</label>
        <input value={prompt} onChange={e => setPrompt(e.target.value)} placeholder="e.g. use seaborn style, blue palette"
          style={{ width: '100%', padding: '6px 8px', border: '1px solid var(--border)', borderRadius: '4px', fontSize: '12px', boxSizing: 'border-box', background: 'var(--panel)', color: 'var(--text)' }} />
      </div>

      <div>
        <label style={{ fontSize: '12px', fontWeight: 500, color: 'var(--text)', display: 'block', marginBottom: '4px' }}>FILENAME (OPTIONAL)</label>
        <input value={filename} onChange={e => setFilename(e.target.value)} placeholder="e.g. comparison_chart.png"
          style={{ width: '100%', padding: '6px 8px', border: '1px solid var(--border)', borderRadius: '4px', fontSize: '12px', boxSizing: 'border-box', background: 'var(--panel)', color: 'var(--text)' }} />
      </div>

      <button onClick={handleGenerate} disabled={loading || !tableLatex.trim()}
        style={{ padding: '8px 14px', border: 'none', borderRadius: '6px', background: 'var(--accent)', color: '#fff', fontSize: '12px', fontWeight: 600, cursor: !loading && tableLatex.trim() ? 'pointer' : 'default', opacity: !loading && tableLatex.trim() ? 1 : 0.5 }}>
        {loading ? 'Generating...' : 'Generate chart'}
      </button>

      {error && <div style={{ fontSize: '12px', color: 'var(--danger, red)' }}>{error}</div>}

      {result && (
        <div style={{ border: '1px solid var(--border)', borderRadius: '6px', padding: '10px', background: 'var(--paper)' }}>
          <div style={{ fontSize: '12px', color: 'var(--text)', marginBottom: '6px' }}>Generated: <code>{result}</code></div>
          {onInsert && (
            <button onClick={() => onInsert(result)}
              style={{ fontSize: '11px', padding: '4px 10px', border: '1px solid var(--accent)', borderRadius: '4px', background: 'var(--paper)', color: 'var(--accent)', cursor: 'pointer' }}>
              Insert \\includegraphics
            </button>
          )}
        </div>
      )}
    </div>
  );
}
