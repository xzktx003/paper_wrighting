import React, { useEffect, useState } from 'react';

export type ThemeName = 'light' | 'primer-dark' | 'dracula' | 'cyber-tech';

export const THEMES: { value: ThemeName; label: string; swatch: string }[] = [
  { value: 'cyber-tech', label: '⚡ 赛博科技', swatch: '#00e5ff' },
  { value: 'light', label: 'Basic Light', swatch: '#4f6ef7' },
  { value: 'primer-dark', label: 'GitHub Dark', swatch: '#2f81f7' },
  { value: 'dracula', label: 'Dracula', swatch: '#bd93f9' },
];

function isThemeName(value: string | null): value is ThemeName {
  return THEMES.some((theme) => theme.value === value);
}

function getInitialTheme(): ThemeName {
  const saved = localStorage.getItem('paper-writer-theme');
  if (isThemeName(saved)) return saved;
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'primer-dark' : 'light';
}

export function useTheme() {
  const [theme, setTheme] = useState<ThemeName>(getInitialTheme);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('paper-writer-theme', theme);
  }, [theme]);

  const setNamedTheme = (nextTheme: ThemeName) => setTheme(nextTheme);
  const toggle = () => setTheme(t => t === 'light' ? 'primer-dark' : 'light');

  return { theme, toggle, setTheme: setNamedTheme };
}

export function ThemeToggle({
  theme,
  onThemeChange,
}: {
  theme: ThemeName;
  onThemeChange: (theme: ThemeName) => void;
}) {
  const current = THEMES.find((item) => item.value === theme) || THEMES[0];
  const [open, setOpen] = useState(false);

  return (
    <div style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen(!open)}
        title={`主题: ${current.label}`}
        style={{
          border: '1px solid var(--border)',
          background: 'var(--panel)',
          borderRadius: '6px',
          padding: '4px 8px',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: 4,
          color: 'var(--text)',
          fontSize: 11,
        }}
      >
        <span
          aria-hidden="true"
          style={{
            width: 10,
            height: 10,
            borderRadius: 999,
            background: current.swatch,
            boxShadow: `0 0 8px ${current.swatch}`,
            flexShrink: 0,
          }}
        />
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none" style={{ opacity: 0.6 }}>
          <path d="M2 3.5L5 6.5L8 3.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </button>
      {open && (
        <>
          <div style={{ position: 'fixed', inset: 0, zIndex: 9998 }} onClick={() => setOpen(false)} />
          <div style={{
            position: 'absolute',
            top: 'calc(100% + 4px)',
            right: 0,
            background: 'var(--panel)',
            border: '1px solid var(--border)',
            borderRadius: '8px',
            boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
            zIndex: 9999,
            minWidth: 120,
            padding: '4px',
          }}>
            {THEMES.map((item) => (
              <div
                key={item.value}
                onClick={() => { onThemeChange(item.value); setOpen(false); }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '6px 10px',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: 12,
                  color: item.value === theme ? 'var(--accent)' : 'var(--text)',
                  fontWeight: item.value === theme ? 600 : 400,
                  background: item.value === theme ? 'var(--accent-soft)' : 'transparent',
                }}
                onMouseEnter={e => { if (item.value !== theme) e.currentTarget.style.background = 'var(--hover)'; }}
                onMouseLeave={e => { if (item.value !== theme) e.currentTarget.style.background = 'transparent'; }}
              >
                <span style={{ width: 8, height: 8, borderRadius: 999, background: item.swatch, flexShrink: 0 }} />
                {item.label}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
