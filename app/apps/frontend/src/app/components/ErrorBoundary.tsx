import React from 'react';

interface Props {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[ErrorBoundary]', error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;
      return (
        <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text, #333)' }}>
          <h2 style={{ fontSize: '16px', marginBottom: '8px' }}>Something went wrong</h2>
          <p style={{ fontSize: '13px', color: 'var(--muted, #888)', marginBottom: '16px' }}>
            {this.state.error?.message || 'An unexpected error occurred'}
          </p>
          <button
            onClick={() => this.setState({ hasError: false, error: null })}
            style={{
              padding: '6px 16px',
              fontSize: '13px',
              border: '1px solid var(--border, #ddd)',
              borderRadius: '6px',
              background: 'var(--panel, #fff)',
              cursor: 'pointer',
            }}
          >
            Try Again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
