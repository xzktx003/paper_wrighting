import React, { useState } from 'react';
import { arxivSearch, arxivBibtex, ArxivPaper } from '../../api/client';

interface Props {
  projectId: string;
  onInsertCitation?: (bibtex: string) => void;
}

export function PaperSearchPanel({ projectId, onInsertCitation }: Props) {
  const [query, setQuery] = useState('');
  const [maxResults, setMaxResults] = useState(5);
  const [useWebModel, setUseWebModel] = useState(false);
  const [papers, setPapers] = useState<ArxivPaper[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [bibFile, setBibFile] = useState('references.bib');
  const [autoInsert, setAutoInsert] = useState(true);
  const [aiInsert, setAiInsert] = useState(false);
  const [writingBib, setWritingBib] = useState(false);

  const handleSearch = async () => {
    if (!query.trim()) return;
    setLoading(true);
    setError('');
    setPapers([]);
    setSelected(new Set());
    try {
      const res = await arxivSearch({ query: query.trim(), maxResults });
      if (res.ok && res.papers) {
        setPapers(res.papers);
      } else {
        setError(res.error || 'Search failed');
      }
    } catch (err: any) {
      setError(err.message || 'Search failed');
    }
    setLoading(false);
  };

  const toggleSelect = (arxivId: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(arxivId)) next.delete(arxivId);
      else next.add(arxivId);
      return next;
    });
  };

  const handleWriteBib = async () => {
    const ids = selected.size > 0 ? [...selected] : papers.map(p => p.arxivId);
    if (ids.length === 0) return;
    setWritingBib(true);
    const bibtexEntries: string[] = [];
    for (const id of ids) {
      try {
        const res = await arxivBibtex({ arxivId: id });
        if (res.ok && res.bibtex) bibtexEntries.push(res.bibtex);
      } catch {}
    }
    if (bibtexEntries.length > 0 && onInsertCitation) {
      onInsertCitation(bibtexEntries.join('\n\n'));
    }
    setWritingBib(false);
  };

  const handleInsertSingle = async (arxivId: string) => {
    try {
      const res = await arxivBibtex({ arxivId });
      if (res.ok && res.bibtex && onInsertCitation) {
        onInsertCitation(res.bibtex);
      }
    } catch {}
  };

  return (
    <div style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
      <h4 style={{ margin: 0, fontSize: '14px', color: 'var(--text)' }}>Paper search</h4>

      <div>
        <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--muted)', display: 'block', marginBottom: '4px' }}>ARXIV SEARCH</label>
        <label style={{ fontSize: '12px', fontWeight: 500, color: 'var(--text)', display: 'block', marginBottom: '4px' }}>KEYWORDS</label>
        <input value={query} onChange={e => setQuery(e.target.value)} placeholder="e.g. LLM"
          onKeyDown={e => e.key === 'Enter' && handleSearch()}
          style={{ width: '100%', padding: '6px 8px', border: '1px solid var(--border)', borderRadius: '4px', fontSize: '12px', boxSizing: 'border-box', background: 'var(--panel)', color: 'var(--text)' }} />
      </div>

      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
        <input type="number" value={maxResults} onChange={e => setMaxResults(Number(e.target.value) || 5)} min={1} max={10}
          style={{ width: '50px', padding: '6px 8px', border: '1px solid var(--border)', borderRadius: '4px', fontSize: '12px', background: 'var(--panel)', color: 'var(--text)' }} />
        <button onClick={handleSearch} disabled={loading || !query.trim()}
          style={{ padding: '6px 14px', border: 'none', borderRadius: '6px', background: 'var(--accent)', color: '#fff', fontSize: '12px', fontWeight: 600, cursor: !loading && query.trim() ? 'pointer' : 'default', opacity: !loading && query.trim() ? 1 : 0.5 }}>
          {loading ? 'Searching...' : 'Search'}
        </button>
      </div>

      <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: 'var(--text)' }}>
        <input type="checkbox" checked={useWebModel} onChange={e => setUseWebModel(e.target.checked)} />
        Use Websearch model
      </label>

      {error && <div style={{ fontSize: '12px', color: 'var(--danger, red)' }}>{error}</div>}

      {papers.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '300px', overflow: 'auto' }}>
          {papers.map(p => (
            <div key={p.arxivId} style={{ border: '1px solid var(--border)', borderRadius: '6px', padding: '8px', background: 'var(--paper)' }}>
              <div style={{ display: 'flex', gap: '6px', alignItems: 'flex-start' }}>
                <input type="checkbox" checked={selected.has(p.arxivId)} onChange={() => toggleSelect(p.arxivId)} style={{ marginTop: '3px' }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text)', marginBottom: '2px' }}>{p.title}</div>
                  <div style={{ fontSize: '11px', color: 'var(--muted)' }}>{p.authors.slice(0, 3).join(', ')}{p.authors.length > 3 ? ' ...' : ''}</div>
                  <div style={{ fontSize: '11px', color: 'var(--muted)' }}>{p.arxivId}</div>
                </div>
              </div>
              <button onClick={() => handleInsertSingle(p.arxivId)}
                style={{ marginTop: '4px', fontSize: '11px', padding: '3px 8px', border: '1px solid var(--accent)', borderRadius: '4px', background: 'var(--paper)', color: 'var(--accent)', cursor: 'pointer' }}>
                Insert citation
              </button>
            </div>
          ))}
        </div>
      )}

      {papers.length > 0 && (
        <>
          <div>
            <label style={{ fontSize: '12px', fontWeight: 500, color: 'var(--text)', display: 'block', marginBottom: '4px' }}>BIB FILE</label>
            <input value={bibFile} onChange={e => setBibFile(e.target.value)}
              style={{ width: '100%', padding: '6px 8px', border: '1px solid var(--border)', borderRadius: '4px', fontSize: '12px', boxSizing: 'border-box', background: 'var(--panel)', color: 'var(--text)' }} />
          </div>

          <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: 'var(--text)' }}>
            <input type="checkbox" checked={autoInsert} onChange={e => setAutoInsert(e.target.checked)} />
            Auto-insert citations into current TeX
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: 'var(--text)' }}>
            <input type="checkbox" checked={aiInsert} onChange={e => setAiInsert(e.target.checked)} />
            AI insert citations in selected TeX
          </label>

          <button onClick={handleWriteBib} disabled={writingBib}
            style={{ padding: '8px 14px', border: 'none', borderRadius: '6px', background: 'var(--accent)', color: '#fff', fontSize: '12px', fontWeight: 600, cursor: writingBib ? 'default' : 'pointer', opacity: writingBib ? 0.5 : 1 }}>
            {writingBib ? 'Writing...' : 'Write Bib / insert citations'}
          </button>
        </>
      )}
    </div>
  );
}
