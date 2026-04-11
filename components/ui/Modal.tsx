'use client';

import { useEffect } from 'react';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  maxWidth?: number;
  footer?: React.ReactNode;
}

export default function Modal({ open, onClose, title, children, maxWidth = 500, footer }: ModalProps) {
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handler);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 980,
        background: 'rgba(0,0,0,.55)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 16, overflowY: 'auto',
      }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{
        background: '#fff', borderRadius: 16,
        width: '100%', maxWidth,
        overflow: 'hidden',
        boxShadow: '0 24px 64px rgba(0,0,0,.25)',
        maxHeight: '90vh',
        display: 'flex', flexDirection: 'column',
      }}>
        {/* Header */}
        <div style={{
          background: 'var(--ink)', padding: '14px 18px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          flexShrink: 0,
        }}>
          <div style={{ fontFamily: 'Bebas Neue, sans-serif', fontSize: 18, letterSpacing: 2, color: '#fff' }}>
            {title}
          </div>
          <button
            onClick={onClose}
            style={{ cursor: 'pointer', color: '#888', fontSize: 24, background: 'none', border: 'none', lineHeight: 1 }}
          >
            &times;
          </button>
        </div>

        {/* Content */}
        <div style={{ overflow: 'auto', flex: 1, padding: 18 }}>
          {children}
        </div>

        {/* Footer */}
        {footer && (
          <div style={{ padding: '14px 18px', display: 'flex', gap: 8, borderTop: '1px solid var(--bd)', flexShrink: 0 }}>
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
