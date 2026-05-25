import React, { useState } from 'react';

interface SearchResult {
  title: string;
  abstract: string;
  authors: string[];
  url: string;
  arxivId: string;
  sourceQuery: string;
}

interface Props {
  projectId: string;
  onInsertCitation?: (bibtex: string) => void;
}

export function WebsearchPanel({ projectId, onInsertCitation }: Props) {
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [queries, setQueries] = useState<string[]>([]);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [progress, setProgress] = useState<string[]>([]);

  const handleSearch = async () => {
    if (!query.trim()) return;
    setLoading(true);
    setError('');
    setResults([]);
    setQueries([]);
    setSelected(new Set());
    setProgress(['Splitting query...']);
    try {
      const res = await fetch('/api/websearch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: query.trim() }),
      });
      const data = await res.json();
      if (data.ok) {
        setQueries(data.queries || []);
        setResults(data.results || []);
        const logs = [`Parallel search: ${(data.queries || []).join(' | ')}`];
        for (const q of data.queries || []) {
          logs.push(`Done: ${q} (${(data.results || []).filter((r: SearchResult) => r.sourceQuery === q).length})`);
        }
        setProgress(logs);
      } else {
        setError(data.error || 'Search failed');
      }
    } catch (err: any) {
      setError(err.message || 'Search failed');
    }
    setLoading(false);
  };

  const toggleSelect = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = () => {
    if (selected.size === results.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(results.map(r => r.arxivId)));
    }
  };

  const handleInsertSelected = async () => {
    const ids = [...selected];
    if (ids.length === 0) return;
    const bibtexEntries: string[] = [];
    for (const id of ids) {
      try {
        const res = await fetch('/api/arxiv/bibtex', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ arxivId: id }),
        });
        const data = await res.json();
        if (data.ok && data.bibtex) bibtexEntries.push(data.bibtex);
      } catch {}
    }
    if (bibtexEntries.length > 0 && onInsertCitation) {
      onInsertCitation(bibtexEntries.join('\n\n'));
    }
  };

  const handleInsertSingle = async (arxivId: string) => {
    try {
      const res = await fetch('/api/arxiv/bibtex', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ arxivId }),
      });
      const data = await res.json();
      if (data.ok && data.bibtex && onInsertCitation) {
        onInsertCitation(data.bibtex);
      }
    } catch {}
  };

  return (
    <div style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
      <h4 style={{ margin: 0, fontSize: '14px', color: 'var(--text)' }}>Websearch</h4>

      <div>
        <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--muted)', display: 'block', marginBottom: '4px' }}>MULTI-QUERY SEARCH</label>
        <label style={{ fontSize: '12px', fontWeight: 500, color: 'var(--text)', display: 'block', marginBottom: '4px' }}>QUERY</label>
        <input value={query} onChange={e => setQuery(e.target.value)} placeholder="e.g. diffusion models"
          onKeyDown={e => e.key === 'Enter' && handleSearch()}
          style={{ width: '100%', padding: '6px 8px', border: '1px solid var(--border)', borderRadius: '4px', fontSize: '12px', boxSizing: 'border-box', background: 'var(--panel)', color: 'var(--text)' }} />
      </div>

      <button onClick={handleSearch} disabled={loading || !query.trim()}
        style={{ padding: '7px 14px', border: 'none', borderRadius: '6px', background: 'var(--accent)', color: '#fff', fontSize: '12px', fontWeight: 600, cursor: !loading && query.trim() ? 'pointer' : 'default', opacity: !loading && query.trim() ? 1 : 0.5, alignSelf: 'flex-start' }}>
        {loading ? 'Searching...' : 'Start search'}
      </button>

      {error && <div style={{ fontSize: '12px', color: 'var(--danger, red)' }}>{error}</div>}

      {progress.length > 0 && (
        <div style={{ fontSize: '11px', color: 'var(--muted)', fontFamily: 'monospace', lineHeight: 1.6 }}>
          {progress.map((p, i) => <div key={i}>{p}</div>)}
        </div>
      )}

      {results.length > 0 && (
        <>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', color: 'var(--text)' }}>
              <input type="checkbox" checked={selected.size === results.length} onChange={selectAll} />
              Select all
            </label>
            {selected.size > 0 && (
              <button onClick={handleInsertSelected}
                style={{ fontSize: '11px', padding: '4px 10px', border: '1px solid var(--accent)', borderRadius: '4px', background: 'var(--paper)', color: 'var(--accent)', cursor: 'pointer' }}>
                Insert selected citations
              </button>
            )}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '350px', overflow: 'auto' }}>
            {results.map(r => (
              <div key={r.arxivId} style={{ border: '1px solid var(--border)', borderRadius: '6px', padding: '8px', background: 'var(--paper)' }}>
                <div style={{ display: 'flex', gap: '6px', alignItems: 'flex-start' }}>
                  <input type="checkbox" checked={selected.has(r.arxivId)} onChange={() => toggleSelect(r.arxivId)} style={{ marginTop: '3px' }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text)', marginBottom: '2px' }}>{r.title}</div>
                    <div style={{ fontSize: '11px', color: 'var(--muted)', marginBottom: '2px' }}>
                      {r.abstract.slice(0, 150)}{r.abstract.length > 150 ? '...' : ''}
                    </div>
                    <div style={{ fontSize: '10px', color: 'var(--muted)' }}>{r.url}</div>
                  </div>
                </div>
                <button onClick={() => handleInsertSingle(r.arxivId)}
                  style={{ marginTop: '4px', fontSize: '11px', padding: '3px 8px', border: '1px solid var(--accent)', borderRadius: '4px', background: 'var(--paper)', color: 'var(--accent)', cursor: 'pointer' }}>
                  Insert citation
                </button>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
