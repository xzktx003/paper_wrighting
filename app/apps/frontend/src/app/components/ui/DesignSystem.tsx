import React, { useState } from 'react';

// ============================================
// Design Tokens
// ============================================
export const tokens = {
  radius: {
    sm: '4px',
    md: '8px',
    lg: '12px',
    xl: '16px',
    full: '9999px',
  },
  shadow: {
    sm: '0 1px 2px rgba(0,0,0,0.05)',
    md: '0 4px 12px rgba(0,0,0,0.08)',
    lg: '0 8px 24px rgba(0,0,0,0.12)',
    glow: (color: string) => `0 0 20px ${color}40`,
  },
  transition: {
    fast: '0.15s ease',
    normal: '0.2s ease',
    slow: '0.3s ease',
  },
};

// ============================================
// Button Component
// ============================================
interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  icon?: React.ReactNode;
}

export function Button({
  children,
  variant = 'secondary',
  size = 'md',
  loading = false,
  icon,
  disabled,
  style,
  ...props
}: ButtonProps) {
  const [hovered, setHovered] = useState(false);
  const [pressed, setPressed] = useState(false);

  const baseStyle: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '6px',
    border: '1px solid',
    borderRadius: tokens.radius.md,
    fontWeight: 500,
    cursor: disabled || loading ? 'not-allowed' : 'pointer',
    transition: `all ${tokens.transition.fast}`,
    opacity: disabled ? 0.5 : 1,
    outline: 'none',
    fontFamily: 'inherit',
    ...style,
  };

  const sizeStyles: Record<string, React.CSSProperties> = {
    sm: { padding: '4px 10px', fontSize: '11px' },
    md: { padding: '6px 14px', fontSize: '12px' },
    lg: { padding: '8px 18px', fontSize: '13px' },
  };

  const variantStyles: Record<string, React.CSSProperties> = {
    primary: {
      background: hovered ? 'var(--accent-strong)' : 'var(--accent)',
      borderColor: hovered ? 'var(--accent-strong)' : 'var(--accent)',
      color: '#fff',
      boxShadow: hovered ? tokens.shadow.md : tokens.shadow.sm,
      transform: pressed ? 'scale(0.97)' : hovered ? 'translateY(-1px)' : 'none',
    },
    secondary: {
      background: hovered ? 'var(--hover)' : 'var(--paper)',
      borderColor: hovered ? 'var(--accent-soft)' : 'var(--border)',
      color: hovered ? 'var(--accent-strong)' : 'var(--text)',
      transform: pressed ? 'scale(0.98)' : 'none',
    },
    ghost: {
      background: hovered ? 'var(--hover)' : 'transparent',
      borderColor: 'transparent',
      color: hovered ? 'var(--accent-strong)' : 'var(--text-secondary)',
      transform: pressed ? 'scale(0.95)' : 'none',
    },
    danger: {
      background: hovered ? '#dc2626' : 'var(--danger)',
      borderColor: hovered ? '#dc2626' : 'var(--danger)',
      color: '#fff',
      transform: pressed ? 'scale(0.97)' : hovered ? 'translateY(-1px)' : 'none',
    },
  };

  return (
    <button
      disabled={disabled || loading}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => { setHovered(false); setPressed(false); }}
      onMouseDown={() => setPressed(true)}
      onMouseUp={() => setPressed(false)}
      style={{ ...baseStyle, ...sizeStyles[size], ...variantStyles[variant] }}
      {...props}
    >
      {loading ? <Spinner size={size === 'sm' ? 12 : 14} /> : icon}
      {children}
    </button>
  );
}

// ============================================
// Input Component
// ============================================
interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  icon?: React.ReactNode;
}

export function Input({ label, error, icon, style, ...props }: InputProps) {
  const [focused, setFocused] = useState(false);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
      {label && (
        <label style={{ fontSize: '12px', fontWeight: 500, color: 'var(--text)' }}>
          {label}
        </label>
      )}
      <div style={{ position: 'relative' }}>
        {icon && (
          <span style={{
            position: 'absolute',
            left: '10px',
            top: '50%',
            transform: 'translateY(-50%)',
            color: 'var(--muted)',
            pointerEvents: 'none',
          }}>
            {icon}
          </span>
        )}
        <input
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          style={{
            width: '100%',
            padding: icon ? '8px 12px 8px 34px' : '8px 12px',
            border: `1px solid ${error ? 'var(--danger)' : focused ? 'var(--accent)' : 'var(--border)'}`,
            borderRadius: tokens.radius.md,
            fontSize: '13px',
            background: 'var(--paper)',
            color: 'var(--text)',
            outline: 'none',
            boxShadow: focused ? `0 0 0 3px var(--accent-soft)` : 'none',
            transition: `all ${tokens.transition.fast}`,
            boxSizing: 'border-box',
            fontFamily: 'inherit',
            ...style,
          }}
          {...props}
        />
      </div>
      {error && (
        <span style={{ fontSize: '11px', color: 'var(--danger)' }}>{error}</span>
      )}
    </div>
  );
}

// ============================================
// Textarea Component
// ============================================
interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
}

export function Textarea({ label, error, style, ...props }: TextareaProps) {
  const [focused, setFocused] = useState(false);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
      {label && (
        <label style={{ fontSize: '12px', fontWeight: 500, color: 'var(--text)' }}>
          {label}
        </label>
      )}
      <textarea
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={{
          width: '100%',
          minHeight: '80px',
          padding: '10px 12px',
          border: `1px solid ${error ? 'var(--danger)' : focused ? 'var(--accent)' : 'var(--border)'}`,
          borderRadius: tokens.radius.md,
          fontSize: '13px',
          background: 'var(--paper)',
          color: 'var(--text)',
          outline: 'none',
          boxShadow: focused ? `0 0 0 3px var(--accent-soft)` : 'none',
          transition: `all ${tokens.transition.fast}`,
          boxSizing: 'border-box',
          resize: 'vertical',
          fontFamily: 'inherit',
          lineHeight: 1.5,
          ...style,
        }}
        {...props}
      />
      {error && (
        <span style={{ fontSize: '11px', color: 'var(--danger)' }}>{error}</span>
      )}
    </div>
  );
}

// ============================================
// Select Component
// ============================================
interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  options: { value: string; label: string }[];
}

export function Select({ label, options, style, ...props }: SelectProps) {
  const [focused, setFocused] = useState(false);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
      {label && (
        <label style={{ fontSize: '12px', fontWeight: 500, color: 'var(--text)' }}>
          {label}
        </label>
      )}
      <select
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={{
          width: '100%',
          padding: '8px 12px',
          border: `1px solid ${focused ? 'var(--accent)' : 'var(--border)'}`,
          borderRadius: tokens.radius.md,
          fontSize: '13px',
          background: 'var(--paper)',
          color: 'var(--text)',
          outline: 'none',
          boxShadow: focused ? `0 0 0 3px var(--accent-soft)` : 'none',
          transition: `all ${tokens.transition.fast}`,
          boxSizing: 'border-box',
          cursor: 'pointer',
          fontFamily: 'inherit',
          ...style,
        }}
        {...props}
      >
        {options.map(opt => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>
    </div>
  );
}

// ============================================
// Card Component
// ============================================
interface CardProps {
  children: React.ReactNode;
  padding?: 'none' | 'sm' | 'md' | 'lg';
  hover?: boolean;
  onClick?: () => void;
  style?: React.CSSProperties;
}

export function Card({ children, padding = 'md', hover = false, onClick, style }: CardProps) {
  const [hovered, setHovered] = useState(false);

  const paddingMap = { none: 0, sm: '8px', md: '14px', lg: '20px' };

  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: 'var(--paper)',
        border: '1px solid var(--border)',
        borderRadius: tokens.radius.lg,
        padding: paddingMap[padding],
        boxShadow: hovered && hover ? tokens.shadow.md : tokens.shadow.sm,
        transform: hovered && hover && onClick ? 'translateY(-2px)' : 'none',
        transition: `all ${tokens.transition.fast}`,
        cursor: onClick ? 'pointer' : 'default',
        ...style,
      }}
    >
      {children}
    </div>
  );
}

// ============================================
// Badge Component
// ============================================
interface BadgeProps {
  children: React.ReactNode;
  variant?: 'default' | 'primary' | 'success' | 'warning' | 'danger';
  size?: 'sm' | 'md';
}

export function Badge({ children, variant = 'default', size = 'sm' }: BadgeProps) {
  const variantStyles = {
    default: { background: 'var(--bg-secondary)', color: 'var(--text-secondary)' },
    primary: { background: 'var(--accent-soft)', color: 'var(--accent-strong)' },
    success: { background: 'rgba(16, 185, 129, 0.15)', color: 'var(--success)' },
    warning: { background: 'rgba(245, 158, 11, 0.15)', color: '#f59e0b' },
    danger: { background: 'rgba(239, 68, 68, 0.15)', color: 'var(--danger)' },
  };

  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      padding: size === 'sm' ? '2px 8px' : '4px 10px',
      borderRadius: tokens.radius.full,
      fontSize: size === 'sm' ? '10px' : '11px',
      fontWeight: 600,
      letterSpacing: '0.02em',
      ...variantStyles[variant],
    }}>
      {children}
    </span>
  );
}

// ============================================
// Spinner Component
// ============================================
interface SpinnerProps {
  size?: number;
  color?: string;
}

export function Spinner({ size = 16, color }: SpinnerProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      style={{ animation: 'spin 1s linear infinite' }}
    >
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
      <circle
        cx="12"
        cy="12"
        r="10"
        stroke={color || 'currentColor'}
        strokeWidth="3"
        strokeLinecap="round"
        strokeDasharray="31.4 31.4"
        strokeDashoffset="10"
        opacity="0.25"
      />
      <circle
        cx="12"
        cy="12"
        r="10"
        stroke={color || 'currentColor'}
        strokeWidth="3"
        strokeLinecap="round"
        strokeDasharray="31.4 31.4"
        strokeDashoffset="75"
      />
    </svg>
  );
}

// ============================================
// Empty State Component
// ============================================
interface EmptyStateProps {
  icon?: string;
  title: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
}

export function EmptyState({ icon = '📭', title, description, action }: EmptyStateProps) {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '32px 20px',
      textAlign: 'center',
      gap: '12px',
    }}>
      <div style={{
        fontSize: '48px',
        lineHeight: 1,
        opacity: 0.6,
        filter: 'grayscale(0.3)',
      }}>
        {icon}
      </div>
      <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text)' }}>
        {title}
      </div>
      {description && (
        <div style={{ fontSize: '12px', color: 'var(--muted)', maxWidth: '240px', lineHeight: 1.5 }}>
          {description}
        </div>
      )}
      {action && (
        <Button variant="primary" onClick={action.onClick} style={{ marginTop: '8px' }}>
          {action.label}
        </Button>
      )}
    </div>
  );
}

// ============================================
// Tooltip Component
// ============================================
interface TooltipProps {
  children: React.ReactNode;
  content: string;
  position?: 'top' | 'bottom' | 'left' | 'right';
}

export function Tooltip({ children, content, position = 'top' }: TooltipProps) {
  const [visible, setVisible] = useState(false);

  const positionStyles: Record<string, React.CSSProperties> = {
    top: { bottom: '100%', left: '50%', transform: 'translateX(-50%)', marginBottom: '6px' },
    bottom: { top: '100%', left: '50%', transform: 'translateX(-50%)', marginTop: '6px' },
    left: { right: '100%', top: '50%', transform: 'translateY(-50%)', marginRight: '6px' },
    right: { left: '100%', top: '50%', transform: 'translateY(-50%)', marginLeft: '6px' },
  };

  return (
    <div
      style={{ position: 'relative', display: 'inline-flex' }}
      onMouseEnter={() => setVisible(true)}
      onMouseLeave={() => setVisible(false)}
    >
      {children}
      {visible && (
        <div style={{
          position: 'absolute',
          ...positionStyles[position],
          padding: '4px 8px',
          background: 'var(--text)',
          color: 'var(--paper)',
          fontSize: '11px',
          borderRadius: tokens.radius.sm,
          whiteSpace: 'nowrap',
          zIndex: 1000,
          pointerEvents: 'none',
          boxShadow: tokens.shadow.md,
        }}>
          {content}
        </div>
      )}
    </div>
  );
}

// ============================================
// Divider Component
// ============================================
interface DividerProps {
  label?: string;
}

export function Divider({ label }: DividerProps) {
  if (!label) {
    return <div style={{ height: '1px', background: 'var(--border)', margin: '8px 0' }} />;
  }

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: '12px',
      margin: '12px 0',
    }}>
      <div style={{ flex: 1, height: '1px', background: 'var(--border)' }} />
      <span style={{ fontSize: '11px', color: 'var(--muted)', fontWeight: 500 }}>
        {label}
      </span>
      <div style={{ flex: 1, height: '1px', background: 'var(--border)' }} />
    </div>
  );
}

// ============================================
// Avatar Component
// ============================================
interface AvatarProps {
  name: string;
  size?: number;
  color?: string;
}

export function Avatar({ name, size = 28, color }: AvatarProps) {
  const initials = name
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  const bgColor = color || `hsl(${(name.charCodeAt(0) * 10) % 360}, 60%, 50%)`;

  return (
    <div style={{
      width: size,
      height: size,
      borderRadius: '50%',
      background: bgColor,
      color: '#fff',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontSize: size * 0.4,
      fontWeight: 600,
      flexShrink: 0,
    }}>
      {initials}
    </div>
  );
}