import { useState } from 'react';
import { createPortal } from 'react-dom';
import { AdminIcon } from './AdminLayout';

export default function AdminReorderLevelModal({
  item,
  currentLevel = 5,
  isOpen,
  onClose,
  onSave,
}) {
  const [level, setLevel] = useState(
    item?.reorder !== undefined ? item.reorder : currentLevel
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    const num = Number(level);
    if (isNaN(num) || num < 0) {
      setError('Threshold must be a non-negative number.');
      return;
    }

    setSubmitting(true);
    setError('');
    try {
      await onSave(num, item);
      onClose();
    } catch (err) {
      setError(err?.response?.data?.message || err?.message || 'Failed to update reorder level.');
    } finally {
      setSubmitting(false);
    }
  };

  return createPortal(
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 99999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--bg-overlay, rgba(20, 18, 16, 0.75))',
        backdropFilter: 'blur(3px)',
        padding: '16px',
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="reorder-modal-title"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '440px',
          background: 'var(--bg-surface)',
          border: '1px solid var(--border-default)',
          borderRadius: '12px',
          boxShadow: 'var(--shadow-xl)',
          color: 'var(--text-primary)',
          overflow: 'hidden',
          animation: 'modalSlideUp 150ms cubic-bezier(0.16, 1, 0.3, 1)',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '16px 20px',
            borderBottom: '1px solid var(--border-subtle)',
          }}
        >
          <div>
            <span
              style={{
                fontSize: '11px',
                fontWeight: 600,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                color: 'var(--color-accent, #D4A662)',
              }}
            >
              Reorder Settings
            </span>
            <h2
              id="reorder-modal-title"
              style={{
                margin: '2px 0 0',
                fontSize: '18px',
                fontFamily: 'var(--font-serif)',
                fontWeight: 600,
                color: 'var(--text-primary)',
              }}
            >
              Set Low-Stock Reorder Level
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '32px',
              height: '32px',
              border: 0,
              background: 'transparent',
              color: 'var(--text-muted)',
              borderRadius: '6px',
              cursor: 'pointer',
            }}
          >
            <AdminIcon name="close" size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {item && (
            <div
              style={{
                padding: '10px 12px',
                borderRadius: '8px',
                background: 'var(--bg-surface-raised)',
                border: '1px solid var(--border-subtle)',
              }}
            >
              <strong style={{ display: 'block', fontSize: '13px', color: 'var(--text-primary)' }}>
                {item.name}
              </strong>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                SKU: {item.sku} · Current threshold: {item.reorder ?? currentLevel} units
              </span>
            </div>
          )}

          <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
            {item
              ? 'Configure the low-stock alert threshold specifically for this item. When available inventory reaches or drops below this number, the item triggers a Low Stock alert.'
              : 'Configure the default catalog-wide threshold at which inventory alerts trigger for low stock.'}
          </p>

          <label style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)' }}>
            Threshold (Units)
            <input
              type="number"
              min="0"
              max="10000"
              required
              autoFocus
              value={level}
              onChange={(e) => setLevel(e.target.value)}
              style={{
                height: '40px',
                padding: '0 12px',
                borderRadius: '8px',
                border: '1px solid var(--border-default)',
                background: 'var(--bg-input)',
                color: 'var(--text-primary)',
                fontFamily: 'ui-monospace, SFMono-Regular, monospace',
                fontSize: '15px',
                fontWeight: 600,
              }}
            />
          </label>

          {error && (
            <div
              style={{
                padding: '8px 12px',
                borderRadius: '6px',
                background: 'var(--color-danger-soft)',
                border: '1px solid var(--color-danger)',
                color: 'var(--color-danger)',
                fontSize: '12px',
              }}
            >
              {error}
            </div>
          )}

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'flex-end',
              gap: '10px',
              paddingTop: '8px',
              borderTop: '1px solid var(--border-subtle)',
            }}
          >
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              style={{
                height: '38px',
                padding: '0 16px',
                borderRadius: '8px',
                border: '1px solid var(--border-default)',
                background: 'transparent',
                color: 'var(--text-primary)',
                fontFamily: 'var(--font-sans)',
                fontSize: '13px',
                fontWeight: 500,
                cursor: 'pointer',
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              style={{
                height: '38px',
                padding: '0 20px',
                borderRadius: '8px',
                border: 'none',
                background: 'var(--color-primary, #1B1816)',
                color: 'var(--color-sand, #F9F6F0)',
                fontFamily: 'var(--font-sans)',
                fontSize: '13px',
                fontWeight: 600,
                cursor: submitting ? 'not-allowed' : 'pointer',
                opacity: submitting ? 0.7 : 1,
              }}
            >
              {submitting ? 'Saving…' : 'Save Reorder Level'}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}
