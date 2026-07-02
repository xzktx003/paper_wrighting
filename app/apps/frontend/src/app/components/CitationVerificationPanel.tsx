import React, { useEffect, useState } from 'react';

interface CitationResult {
  key: string;
  type: string;
  doi: string | null;
  title: string | null;
  status: 'verified' | 'title_match' | 'doi_not_found' | 'unverifiable';
  confidence: 'high' | 'medium' | 'low' | 'none';
  matchedTitle?: string;
  matchedYear?: number;
  matchedJournal?: string;
  sources: Array<{ source: string; verified: boolean; error?: string }>;
}

interface VerificationReport {
  totalEntries: number;
  verified: number;
  titleMatch: number;
  doiNotFound: number;
  unverifiable: number;
  results: CitationResult[];
  summary: string;
}

interface CrossCheckResult {
  citedKeys: string[];
  bibKeys: string[];
  missingInBib: string[];
  uncitedInBib: string[];
}

interface FullReport extends VerificationReport, CrossCheckResult {
  missingInBib: string[];
  uncitedInBib: string[];
  mainFile?: string;
  bibFiles?: string[];
}

interface Props {
  report: FullReport | null;
  loading: boolean;
  loadingAction?: 'verify' | 'cross-check' | null;
  verificationTotal?: number;
  error?: string | null;
  onRunVerification?: () => void;
  onRunCrossCheck?: () => void;
  onCancel?: () => void;
  projectPath?: string;
}

const STATUS_CONFIG: Record<string, { icon: string; color: string; bg: string; label: string }> = {
  verified: { icon: '✅', color: '#22c55e', bg: '#22c55e15', label: 'Verified' },
  title_match: { icon: '🔍', color: '#eab308', bg: '#eab30815', label: 'Title Match' },
  doi_not_found: { icon: '❌', color: '#ef4444', bg: '#ef444415', label: 'DOI Not Found' },
  unverifiable: { icon: '⚠️', color: '#f97316', bg: '#f9731615', label: 'Unverifiable' },
};

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.unverifiable;
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '1px 6px', borderRadius: 4, background: cfg.bg, color: cfg.color, fontSize: 10, fontWeight: 600, whiteSpace: 'nowrap' }}>
      {cfg.icon} {cfg.label}
    </span>
  );
}

function ConfidenceBar({ confidence }: { confidence: string }) {
  const widths: Record<string, number> = { high: 100, medium: 66, low: 33, none: 0 };
  const colors: Record<string, string> = { high: '#22c55e', medium: '#eab308', low: '#f97316', none: '#ef4444' };
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
      <div style={{ height: 3, width: 40, background: 'var(--border)', borderRadius: 2, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${widths[confidence] || 0}%`, background: colors[confidence] || '#666', borderRadius: 2 }} />
      </div>
      <span style={{ fontSize: 9, color: 'var(--muted)', textTransform: 'capitalize' }}>{confidence}</span>
    </div>
  );
}

function SummaryCards({ report }: { report: FullReport }) {
  const cards = [
    { label: 'Total', value: report.totalEntries, color: 'var(--fg)' },
    { label: '✅ Verified', value: report.verified, color: '#22c55e' },
    { label: '🔍 Title Match', value: report.titleMatch, color: '#eab308' },
    { label: '❌ DOI Missing', value: report.doiNotFound, color: '#ef4444' },
    { label: '⚠️ Unknown', value: report.unverifiable, color: '#f97316' },
  ];
  if (report.missingInBib) {
    cards.push({ label: '📑 Missing in .bib', value: report.missingInBib.length, color: '#ef4444' });
  }
  if (report.uncitedInBib) {
    cards.push({ label: '📄 Uncited', value: report.uncitedInBib.length, color: '#f97316' });
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(90px, 1fr))', gap: 4 }}>
      {cards.map(c => (
        <div key={c.label} style={{ padding: '6px 4px', background: 'var(--bg-secondary)', borderRadius: 6, textAlign: 'center' }}>
          <div style={{ fontWeight: 700, fontSize: 16, color: c.color }}>{c.value}</div>
          <div style={{ color: 'var(--muted)', fontSize: 9, lineHeight: 1.3 }}>{c.label}</div>
        </div>
      ))}
    </div>
  );
}

function CitationItem({ result }: { result: CitationResult }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div style={{ borderBottom: '1px solid var(--border)' }}>
      <div
        style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 8px', cursor: 'pointer', fontSize: 11 }}
        onClick={() => setExpanded(!expanded)}
      >
        <span style={{ color: 'var(--muted)', minWidth: 16, fontSize: 10 }}>{expanded ? '▾' : '▸'}</span>
        <code style={{ fontWeight: 600, fontFamily: 'monospace', fontSize: 11, flexShrink: 0 }}>{result.key}</code>
        <StatusBadge status={result.status} />
        <div style={{ flex: 1 }} />
        <ConfidenceBar confidence={result.confidence} />
      </div>
      {expanded && (
        <div style={{ padding: '4px 8px 8px 30px', fontSize: 10, lineHeight: 1.5, color: 'var(--muted)' }}>
          {result.doi && <div><strong>DOI:</strong> {result.doi}</div>}
          {result.title && <div><strong>Title:</strong> {result.title}</div>}
          {result.matchedTitle && <div><strong>Matched:</strong> {result.matchedTitle}</div>}
          {result.matchedYear && <div><strong>Year:</strong> {result.matchedYear}</div>}
          {result.matchedJournal && <div><strong>Journal:</strong> {result.matchedJournal}</div>}
          {result.sources.length > 0 && (
            <div style={{ marginTop: 4 }}>
              <strong>Sources:</strong>{' '}
              {result.sources.map(s => (
                <span key={s.source} style={{ color: s.verified ? '#22c55e' : '#ef4444', marginRight: 6 }}>
                  {s.source} {s.verified ? '✓' : '✗'}{s.error ? ` (${s.error})` : ''}
                </span>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function CitationVerificationPanel({ report, loading, loadingAction, verificationTotal, error, onRunVerification, onRunCrossCheck, onCancel, projectPath }: Props) {
  const [view, setView] = useState<'summary' | 'verified' | 'missing' | 'uncited'>('summary');
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  useEffect(() => {
    if (!loading) {
      setElapsedSeconds(0);
      return;
    }
    const startedAt = Date.now();
    const timer = window.setInterval(() => setElapsedSeconds(Math.floor((Date.now() - startedAt) / 1000)), 1000);
    return () => window.clearInterval(timer);
  }, [loading]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', padding: 12, gap: 10, overflow: 'auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ fontWeight: 700, fontSize: 14 }}>📚 Citation Verification</div>
      </div>

      {/* Action Buttons */}
      <div style={{ display: 'flex', gap: 6 }}>
        <button
          type="button"
          onClick={onRunVerification}
          disabled={loading || !projectPath}
          style={{ flex: 1, padding: '8px 12px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg-secondary)', color: 'var(--fg)', cursor: loading ? 'wait' : 'pointer', fontSize: 12, fontWeight: 600, opacity: !projectPath ? 0.5 : 1 }}
        >
          {loading && loadingAction === 'verify' ? '⏳ Verifying...' : '🔍 Verify All Citations'}
        </button>
        {loading && onCancel && (
          <button
            type="button"
            onClick={onCancel}
            style={{ padding: '8px 10px', borderRadius: 6, border: '1px solid #ef444480', background: '#ef444415', color: '#ef4444', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}
          >
            Stop
          </button>
        )}
        <button
          type="button"
          onClick={onRunCrossCheck}
          disabled={loading || !projectPath}
          style={{ flex: 1, padding: '8px 12px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg-secondary)', color: 'var(--fg)', cursor: loading ? 'wait' : 'pointer', fontSize: 12, fontWeight: 600, opacity: !projectPath ? 0.5 : 1 }}
        >
          {loading && loadingAction === 'cross-check' ? '⏳ Checking...' : '📑 Cross-Check Only'}
        </button>
      </div>

      {error && (
        <div role="alert" style={{ padding: '9px 10px', background: '#ef444415', border: '1px solid #ef444450', borderRadius: 6, color: '#ef4444', fontSize: 11, lineHeight: 1.5 }}>
          <strong>Citation verification failed:</strong> {error}
        </div>
      )}

      {!projectPath && (
        <div style={{ padding: 10, background: '#eab30815', border: '1px solid #eab30840', borderRadius: 6, fontSize: 11, color: '#eab308', textAlign: 'center' }}>
          Open a project to enable citation verification
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div style={{ padding: 20, textAlign: 'center', color: 'var(--muted)', fontSize: 12 }}>
          <div style={{ marginBottom: 8 }}>
            ⏳ {loadingAction === 'cross-check'
              ? 'Cross-checking project citations...'
              : `Verifying ${verificationTotal || 'project'} bibliography entries...`}
          </div>
          <div style={{ fontSize: 10, marginBottom: 4 }}>Elapsed: {elapsedSeconds}s · timeout: 120s</div>
          <div style={{ fontSize: 10 }}>CrossRef · Semantic Scholar · OpenAlex</div>
        </div>
      )}

      {/* Report */}
      {report && !loading && (
        <>
          {(report.mainFile || report.bibFiles?.length) && (
            <div style={{ padding: '7px 9px', background: 'var(--bg-secondary)', borderRadius: 6, color: 'var(--muted)', fontSize: 10, lineHeight: 1.5 }}>
              {report.mainFile && <div><strong>Main TeX:</strong> <code>{report.mainFile}</code></div>}
              {report.bibFiles?.length ? <div><strong>Bibliography:</strong> <code>{report.bibFiles.join(', ')}</code></div> : null}
            </div>
          )}
          <SummaryCards report={report} />

          {/* Tab Bar */}
          <div style={{ display: 'flex', gap: 2, background: 'var(--bg-secondary)', borderRadius: 6, padding: 2 }}>
            {([
              { id: 'summary', label: 'Summary' },
              { id: 'verified', label: `Verified (${report.results?.length || 0})` },
              { id: 'missing', label: `Missing (${report.missingInBib?.length || 0})` },
              { id: 'uncited', label: `Uncited (${report.uncitedInBib?.length || 0})` },
            ] as const).map(tab => (
              <button
                key={tab.id}
                onClick={() => setView(tab.id)}
                style={{ flex: 1, padding: '4px 0', borderRadius: 4, border: 'none', background: view === tab.id ? 'var(--bg)' : 'transparent', color: view === tab.id ? 'var(--fg)' : 'var(--muted)', fontSize: 10, fontWeight: 600, cursor: 'pointer', transition: 'all 0.15s' }}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Summary View */}
          {view === 'summary' && (
            <div style={{ padding: '8px 10px', background: 'var(--bg-secondary)', borderRadius: 6, fontSize: 12, lineHeight: 1.6, color: 'var(--muted)' }}>
              {report.summary}
            </div>
          )}

          {/* Verified Results */}
          {view === 'verified' && report.results && (
            <div style={{ background: 'var(--bg-secondary)', borderRadius: 6, overflow: 'hidden' }}>
              {report.results.length === 0 ? (
                <div style={{ padding: 12, textAlign: 'center', color: 'var(--muted)', fontSize: 11 }}>No citations to verify</div>
              ) : (
                report.results.map(r => <CitationItem key={r.key} result={r} />)
              )}
            </div>
          )}

          {/* Missing in .bib */}
          {view === 'missing' && (
            <div style={{ padding: '8px 10px', background: 'var(--bg-secondary)', borderRadius: 6 }}>
              {(!report.missingInBib || report.missingInBib.length === 0) ? (
                <div style={{ textAlign: 'center', color: '#22c55e', fontSize: 12, padding: 8 }}>✅ All cited keys found in .bib file</div>
              ) : (
                <>
                  <div style={{ fontWeight: 600, marginBottom: 6, fontSize: 12, color: '#ef4444' }}>
                    ⚠️ {report.missingInBib.length} citation(s) in .tex but missing from .bib:
                  </div>
                  {report.missingInBib.map(key => (
                    <div key={key} style={{ padding: '3px 0', fontSize: 11 }}>
                      <code style={{ background: '#ef444420', padding: '1px 4px', borderRadius: 3, color: '#ef4444' }}>{key}</code>
                    </div>
                  ))}
                </>
              )}
            </div>
          )}

          {/* Uncited in .bib */}
          {view === 'uncited' && (
            <div style={{ padding: '8px 10px', background: 'var(--bg-secondary)', borderRadius: 6 }}>
              {(!report.uncitedInBib || report.uncitedInBib.length === 0) ? (
                <div style={{ textAlign: 'center', color: '#22c55e', fontSize: 12, padding: 8 }}>✅ All .bib entries are cited</div>
              ) : (
                <>
                  <div style={{ fontWeight: 600, marginBottom: 6, fontSize: 12, color: '#f97316' }}>
                    📄 {report.uncitedInBib.length} entry(ies) in .bib but never cited:
                  </div>
                  {report.uncitedInBib.map(key => (
                    <div key={key} style={{ padding: '3px 0', fontSize: 11 }}>
                      <code style={{ background: '#f9731620', padding: '1px 4px', borderRadius: 3, color: '#f97316' }}>{key}</code>
                    </div>
                  ))}
                </>
              )}
            </div>
          )}
        </>
      )}

      {/* Empty State */}
      {!report && !loading && (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--muted)', gap: 8, padding: 20 }}>
          <div style={{ fontSize: 28 }}>📚</div>
          <div style={{ fontSize: 13, fontWeight: 600 }}>Citation Verification</div>
          <div style={{ fontSize: 11, textAlign: 'center', lineHeight: 1.5 }}>
            Verify your BibTeX entries against<br />
            CrossRef, Semantic Scholar & OpenAlex
          </div>
          <div style={{ fontSize: 10, textAlign: 'center', lineHeight: 1.5, maxWidth: 220 }}>
            • Detect hallucinated citations<br />
            • Find missing .bib entries<br />
            • Identify uncited references
          </div>
        </div>
      )}
    </div>
  );
}
