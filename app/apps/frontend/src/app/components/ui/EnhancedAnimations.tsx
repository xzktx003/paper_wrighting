import React, { useState, useEffect, useCallback, createContext, useContext } from 'react';
import { tokens } from './DesignSystem';

// ============================================
// Toast Notification System
// ============================================
interface Toast {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  title: string;
  message?: string;
  duration?: number;
}

interface ToastContextType {
  addToast: (toast: Omit<Toast, 'id'>) => void;
  removeToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextType | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = useCallback((toast: Omit<Toast, 'id'>) => {
    const id = Math.random().toString(36).slice(2);
    setToasts(prev => [...prev, { ...toast, id }]);
    
    const duration = toast.duration ?? 4000;
    if (duration > 0) {
      setTimeout(() => {
        setToasts(prev => prev.filter(t => t.id !== id));
      }, duration);
    }
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ addToast, removeToast }}>
      {children}
      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within ToastProvider');
  }
  return context;
}

function ToastContainer({ toasts, onRemove }: { toasts: Toast[]; onRemove: (id: string) => void }) {
  return (
    <div style={{
      position: 'fixed',
      bottom: '20px',
      right: '20px',
      display: 'flex',
      flexDirection: 'column',
      gap: '10px',
      zIndex: 9999,
      maxWidth: '360px',
    }}>
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onRemove={() => onRemove(toast.id)} />
      ))}
    </div>
  );
}

function ToastItem({ toast, onRemove }: { toast: Toast; onRemove: () => void }) {
  const [exiting, setExiting] = useState(false);

  const handleClose = () => {
    setExiting(true);
    setTimeout(onRemove, 200);
  };

  const typeStyles = {
    success: { bg: 'rgba(16, 185, 129, 0.95)', icon: '✅' },
    error: { bg: 'rgba(239, 68, 68, 0.95)', icon: '❌' },
    warning: { bg: 'rgba(245, 158, 11, 0.95)', icon: '⚠️' },
    info: { bg: 'rgba(79, 110, 247, 0.95)', icon: 'ℹ️' },
  };

  const style = typeStyles[toast.type];

  return (
    <div
      style={{
        background: style.bg,
        color: '#fff',
        padding: '14px 16px',
        borderRadius: tokens.radius.lg,
        boxShadow: tokens.shadow.lg,
        display: 'flex',
        alignItems: 'flex-start',
        gap: '12px',
        animation: exiting ? 'slideOutRight 0.2s ease forwards' : 'slideInRight 0.3s ease',
        backdropFilter: 'blur(8px)',
      }}
    >
      <span style={{ fontSize: '18px', flexShrink: 0 }}>{style.icon}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 600, fontSize: '13px', marginBottom: '2px' }}>
          {toast.title}
        </div>
        {toast.message && (
          <div style={{ fontSize: '12px', opacity: 0.9, lineHeight: 1.4 }}>
            {toast.message}
          </div>
        )}
      </div>
      <button
        onClick={handleClose}
        style={{
          border: 'none',
          background: 'rgba(255,255,255,0.2)',
          color: '#fff',
          cursor: 'pointer',
          padding: '4px 8px',
          borderRadius: tokens.radius.sm,
          fontSize: '14px',
          flexShrink: 0,
        }}
      >
        ×
      </button>
      <style>{`
        @keyframes slideInRight {
          from { opacity: 0; transform: translateX(100%); }
          to { opacity: 1; transform: translateX(0); }
        }
        @keyframes slideOutRight {
          from { opacity: 1; transform: translateX(0); }
          to { opacity: 0; transform: translateX(100%); }
        }
      `}</style>
    </div>
  );
}

// ============================================
// Keyboard Shortcut Display
// ============================================
interface ShortcutProps {
  keys: string[];
  label?: string;
}

export function KeyboardShortcut({ keys, label }: ShortcutProps) {
  return (
    <div style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: '4px',
    }}>
      {label && (
        <span style={{ fontSize: '11px', color: 'var(--muted)', marginRight: '4px' }}>
          {label}
        </span>
      )}
      {keys.map((key, i) => (
        <React.Fragment key={i}>
          <kbd style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            minWidth: '20px',
            height: '20px',
            padding: '0 6px',
            background: 'var(--bg-secondary)',
            border: '1px solid var(--border)',
            borderRadius: '4px',
            fontSize: '10px',
            fontWeight: 600,
            color: 'var(--text-secondary)',
            fontFamily: 'inherit',
            boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
          }}>
            {key}
          </kbd>
          {i < keys.length - 1 && (
            <span style={{ fontSize: '10px', color: 'var(--muted)' }}>+</span>
          )}
        </React.Fragment>
      ))}
    </div>
  );
}

// ============================================
// Progress Indicator
// ============================================
interface ProgressProps {
  value: number; // 0-100
  label?: string;
  showValue?: boolean;
  size?: 'sm' | 'md' | 'lg';
  color?: string;
}

export function Progress({ value, label, showValue = true, size = 'md', color }: ProgressProps) {
  const heights = { sm: '4px', md: '8px', lg: '12px' };
  const progressColor = color || 'var(--accent)';

  return (
    <div style={{ width: '100%' }}>
      {(label || showValue) && (
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          marginBottom: '6px',
          fontSize: '11px',
          color: 'var(--text-secondary)',
        }}>
          {label && <span>{label}</span>}
          {showValue && <span>{Math.round(value)}%</span>}
        </div>
      )}
      <div style={{
        height: heights[size],
        background: 'var(--bg-secondary)',
        borderRadius: tokens.radius.full,
        overflow: 'hidden',
      }}>
        <div style={{
          height: '100%',
          width: `${Math.min(100, Math.max(0, value))}%`,
          background: `linear-gradient(90deg, ${progressColor} 0%, ${progressColor}dd 100%)`,
          borderRadius: tokens.radius.full,
          transition: `width ${tokens.transition.normal}`,
          position: 'relative',
          overflow: 'hidden',
        }}>
          {/* Shimmer effect */}
          <div style={{
            position: 'absolute',
            inset: 0,
            background: 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.3) 50%, transparent 100%)',
            animation: 'shimmer 2s infinite',
          }} />
        </div>
      </div>
      <style>{`
        @keyframes shimmer {
          from { transform: translateX(-100%); }
          to { transform: translateX(100%); }
        }
      `}</style>
    </div>
  );
}

// ============================================
// Skeleton Loader
// ============================================
interface SkeletonProps {
  width?: string | number;
  height?: string | number;
  borderRadius?: string;
  variant?: 'text' | 'circular' | 'rectangular';
}

export function Skeleton({
  width = '100%',
  height = '16px',
  borderRadius,
  variant = 'text',
}: SkeletonProps) {
  const computedRadius = borderRadius || (variant === 'circular' ? '50%' : variant === 'text' ? '4px' : '8px');

  return (
    <div
      style={{
        width,
        height,
        borderRadius: computedRadius,
        background: 'linear-gradient(90deg, var(--bg-secondary) 25%, var(--panel-muted) 50%, var(--bg-secondary) 75%)',
        backgroundSize: '200% 100%',
        animation: 'skeleton-pulse 1.5s ease-in-out infinite',
      }}
    >
      <style>{`
        @keyframes skeleton-pulse {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
      `}</style>
    </div>
  );
}

// ============================================
// Context Menu
// ============================================
interface MenuItem {
  label: string;
  icon?: string;
  shortcut?: string[];
  onClick: () => void;
  danger?: boolean;
  disabled?: boolean;
  divider?: boolean;
}

interface ContextMenuProps {
  items: MenuItem[];
  position: { x: number; y: number };
  onClose: () => void;
}

export function ContextMenu({ items, position, onClose }: ContextMenuProps) {
  useEffect(() => {
    const handleClick = () => onClose();
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('click', handleClick);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('click', handleClick);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose]);

  return (
    <div
      style={{
        position: 'fixed',
        left: position.x,
        top: position.y,
        background: 'var(--paper)',
        border: '1px solid var(--border)',
        borderRadius: tokens.radius.lg,
        padding: '6px',
        minWidth: '180px',
        boxShadow: tokens.shadow.lg,
        zIndex: 10000,
        animation: 'contextMenuIn 0.15s ease',
      }}
      onClick={(e) => e.stopPropagation()}
    >
      {items.map((item, i) => {
        if (item.divider) {
          return <div key={i} style={{ height: '1px', background: 'var(--border)', margin: '6px 0' }} />;
        }

        return (
          <button
            key={i}
            onClick={item.onClick}
            disabled={item.disabled}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              width: '100%',
              padding: '8px 10px',
              border: 'none',
              background: 'transparent',
              borderRadius: tokens.radius.md,
              cursor: item.disabled ? 'not-allowed' : 'pointer',
              color: item.danger ? 'var(--danger)' : item.disabled ? 'var(--muted)' : 'var(--text)',
              fontSize: '12px',
              textAlign: 'left',
              opacity: item.disabled ? 0.5 : 1,
              transition: `background ${tokens.transition.fast}`,
            }}
            onMouseEnter={(e) => {
              if (!item.disabled) {
                e.currentTarget.style.background = item.danger ? 'rgba(239, 68, 68, 0.1)' : 'var(--hover)';
              }
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent';
            }}
          >
            {item.icon && <span style={{ fontSize: '14px', width: '18px', textAlign: 'center' }}>{item.icon}</span>}
            <span style={{ flex: 1 }}>{item.label}</span>
            {item.shortcut && (
              <KeyboardShortcut keys={item.shortcut} />
            )}
          </button>
        );
      })}
      <style>{`
        @keyframes contextMenuIn {
          from { opacity: 0; transform: scale(0.95); }
          to { opacity: 1; transform: scale(1); }
        }
      `}</style>
    </div>
  );
}

// ============================================
// Dropdown Menu
// ============================================
interface DropdownItem {
  label: string;
  icon?: string;
  onClick: () => void;
  danger?: boolean;
  disabled?: boolean;
}

interface DropdownProps {
  trigger: React.ReactNode;
  items: DropdownItem[];
  align?: 'left' | 'right';
}

export function Dropdown({ trigger, items, align = 'left' }: DropdownProps) {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const triggerRef = useCallback((node: HTMLDivElement | null) => {
    if (node) {
      const rect = node.getBoundingClientRect();
      setPosition({
        top: rect.bottom + 4,
        left: align === 'right' ? rect.right : rect.left,
      });
    }
  }, [align]);

  return (
    <div style={{ position: 'relative', display: 'inline-block' }}>
      <div ref={triggerRef} onClick={() => setOpen(!open)}>
        {trigger}
      </div>
      {open && (
        <div
          style={{
            position: 'fixed',
            left: position.left,
            top: position.top,
            transform: align === 'right' ? 'translateX(-100%)' : 'none',
            background: 'var(--paper)',
            border: '1px solid var(--border)',
            borderRadius: tokens.radius.lg,
            padding: '6px',
            minWidth: '160px',
            boxShadow: tokens.shadow.lg,
            zIndex: 1000,
            animation: 'dropdownIn 0.15s ease',
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {items.map((item, i) => (
            <button
              key={i}
              onClick={() => {
                item.onClick();
                setOpen(false);
              }}
              disabled={item.disabled}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                width: '100%',
                padding: '8px 10px',
                border: 'none',
                background: 'transparent',
                borderRadius: tokens.radius.md,
                cursor: item.disabled ? 'not-allowed' : 'pointer',
                color: item.danger ? 'var(--danger)' : item.disabled ? 'var(--muted)' : 'var(--text)',
                fontSize: '12px',
                textAlign: 'left',
                opacity: item.disabled ? 0.5 : 1,
                transition: `background ${tokens.transition.fast}`,
              }}
              onMouseEnter={(e) => {
                if (!item.disabled) {
                  e.currentTarget.style.background = item.danger ? 'rgba(239, 68, 68, 0.1)' : 'var(--hover)';
                }
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'transparent';
              }}
            >
              {item.icon && <span style={{ fontSize: '14px', width: '18px', textAlign: 'center' }}>{item.icon}</span>}
              {item.label}
            </button>
          ))}
        </div>
      )}
      {open && (
        <div
          style={{ position: 'fixed', inset: 0, zIndex: 999 }}
          onClick={() => setOpen(false)}
        />
      )}
      <style>{`
        @keyframes dropdownIn {
          from { opacity: 0; transform: translateY(-8px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}

// ============================================
// Tabs Component
// ============================================
interface Tab {
  id: string;
  label: string;
  icon?: string;
  badge?: number;
  disabled?: boolean;
}

interface TabsProps {
  tabs: Tab[];
  activeTab: string;
  onChange: (id: string) => void;
  variant?: 'line' | 'pills' | 'enclosed';
}

export function Tabs({ tabs, activeTab, onChange, variant = 'line' }: TabsProps) {
  return (
    <div style={{
      display: 'flex',
      gap: variant === 'pills' ? '6px' : 0,
      borderBottom: variant === 'line' ? '1px solid var(--border)' : 'none',
      paddingBottom: variant === 'line' ? '0' : '0',
    }}>
      {tabs.map((tab) => {
        const isActive = tab.id === activeTab;

        const baseStyle: React.CSSProperties = {
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          padding: variant === 'pills' ? '6px 14px' : '8px 16px',
          border: 'none',
          background: 'transparent',
          cursor: tab.disabled ? 'not-allowed' : 'pointer',
          fontSize: '12px',
          fontWeight: isActive ? 600 : 400,
          color: isActive ? 'var(--accent-strong)' : 'var(--text-secondary)',
          opacity: tab.disabled ? 0.5 : 1,
          transition: `all ${tokens.transition.fast}`,
          position: 'relative',
          borderRadius: variant === 'pills' ? tokens.radius.full : variant === 'enclosed' ? tokens.radius.md : 'none',
        };

        if (variant === 'enclosed') {
          baseStyle.background = isActive ? 'var(--paper)' : 'transparent';
          baseStyle.border = isActive ? '1px solid var(--border)' : '1px solid transparent';
          baseStyle.borderBottom = 'none';
          baseStyle.marginBottom = '-1px';
        }

        if (variant === 'line' && isActive) {
          baseStyle.borderBottom = '2px solid var(--accent)';
          baseStyle.marginBottom = '-1px';
        }

        return (
          <button
            key={tab.id}
            onClick={() => !tab.disabled && onChange(tab.id)}
            style={baseStyle}
            onMouseEnter={(e) => {
              if (!isActive && !tab.disabled) {
                e.currentTarget.style.background = variant === 'pills' ? 'var(--hover)' : 'var(--bg-secondary)';
              }
            }}
            onMouseLeave={(e) => {
              if (!isActive) {
                e.currentTarget.style.background = variant === 'pills' ? 'transparent' : 'transparent';
              }
            }}
          >
            {tab.icon && <span style={{ fontSize: '14px' }}>{tab.icon}</span>}
            {tab.label}
            {tab.badge !== undefined && (
              <span style={{
                padding: '1px 6px',
                borderRadius: tokens.radius.full,
                background: isActive ? 'var(--accent-soft)' : 'var(--bg-secondary)',
                color: isActive ? 'var(--accent-strong)' : 'var(--muted)',
                fontSize: '10px',
                fontWeight: 600,
              }}>
                {tab.badge}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

// ============================================
// Stepper Component
// ============================================
interface Step {
  label: string;
  description?: string;
}

interface StepperProps {
  steps: Step[];
  currentStep: number;
  onStepClick?: (index: number) => void;
}

export function Stepper({ steps, currentStep, onStepClick }: StepperProps) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start' }}>
      {steps.map((step, i) => {
        const isCompleted = i < currentStep;
        const isCurrent = i === currentStep;
        const isLast = i === steps.length - 1;

        return (
          <React.Fragment key={i}>
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                cursor: onStepClick && (isCompleted || isCurrent) ? 'pointer' : 'default',
              }}
              onClick={() => onStepClick?.(i)}
            >
              {/* Step circle */}
              <div style={{
                width: '28px',
                height: '28px',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '12px',
                fontWeight: 600,
                background: isCompleted
                  ? 'var(--success)'
                  : isCurrent
                    ? 'var(--accent)'
                    : 'var(--bg-secondary)',
                color: isCompleted || isCurrent ? '#fff' : 'var(--muted)',
                border: `2px solid ${isCompleted ? 'var(--success)' : isCurrent ? 'var(--accent)' : 'var(--border)'}`,
                transition: `all ${tokens.transition.fast}`,
                boxShadow: isCurrent ? tokens.shadow.glow('var(--accent)') : 'none',
              }}>
                {isCompleted ? '✓' : i + 1}
              </div>

              {/* Label */}
              <div style={{
                marginTop: '8px',
                textAlign: 'center',
                maxWidth: '100px',
              }}>
                <div style={{
                  fontSize: '12px',
                  fontWeight: isCurrent ? 600 : 400,
                  color: isCurrent ? 'var(--text)' : 'var(--text-secondary)',
                }}>
                  {step.label}
                </div>
                {step.description && (
                  <div style={{
                    fontSize: '10px',
                    color: 'var(--muted)',
                    marginTop: '2px',
                  }}>
                    {step.description}
                  </div>
                )}
              </div>
            </div>

            {/* Connector line */}
            {!isLast && (
              <div style={{
                flex: 1,
                height: '2px',
                background: isCompleted ? 'var(--success)' : 'var(--border)',
                margin: '13px 8px 0',
                minWidth: '40px',
                transition: `background ${tokens.transition.fast}`,
              }} />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}

// ============================================
// Confirm Dialog
// ============================================
interface ConfirmDialogProps {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  confirmVariant?: 'primary' | 'danger';
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  title,
  message,
  confirmLabel = '确认',
  cancelLabel = '取消',
  confirmVariant = 'primary',
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.5)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 10000,
        animation: 'fadeIn 0.2s ease',
      }}
      onClick={onCancel}
    >
      <div
        style={{
          background: 'var(--paper)',
          borderRadius: tokens.radius.xl,
          padding: '24px',
          width: '360px',
          maxWidth: '90vw',
          boxShadow: tokens.shadow.lg,
          animation: 'scaleIn 0.2s ease',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h3 style={{ margin: '0 0 12px', fontSize: '16px', fontWeight: 600 }}>
          {title}
        </h3>
        <p style={{ margin: '0 0 20px', fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
          {message}
        </p>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
          <button
            onClick={onCancel}
            style={{
              padding: '8px 16px',
              border: '1px solid var(--border)',
              borderRadius: tokens.radius.md,
              background: 'var(--paper)',
              color: 'var(--text)',
              fontSize: '13px',
              cursor: 'pointer',
            }}
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            style={{
              padding: '8px 16px',
              border: 'none',
              borderRadius: tokens.radius.md,
              background: confirmVariant === 'danger' ? 'var(--danger)' : 'var(--accent)',
              color: '#fff',
              fontSize: '13px',
              fontWeight: 500,
              cursor: 'pointer',
            }}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes scaleIn {
          from { opacity: 0; transform: scale(0.95); }
          to { opacity: 1; transform: scale(1); }
        }
      `}</style>
    </div>
  );
}