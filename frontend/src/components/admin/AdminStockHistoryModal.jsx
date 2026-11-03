import { createPortal } from 'react-dom';
import { AdminIcon } from './AdminLayout';

const formatDate = (value) => {
  if (!value) return '';
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? ''
    : date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
};

export default function AdminStockHistoryModal({
  item,
  movements = [],
  loading = false,
  isOpen,
  onClose,
}) {
  if (!isOpen) return null;

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
      aria-labelledby="history-modal-title"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '720px',
          maxHeight: '85vh',
          background: 'var(--bg-surface)',
          border: '1px solid var(--border-default)',
          borderRadius: '12px',
          boxShadow: 'var(--shadow-xl)',
          color: 'var(--text-primary)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          animation: 'modalSlideUp 150ms cubic-bezier(0.16, 1, 0.3, 1)',
        }}
      >
        {/* Header */}
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
              Audit Trail
            </span>
            <h2
              id="history-modal-title"
              style={{
                margin: '2px 0 0',
                fontSize: '18px',
                fontFamily: 'var(--font-serif)',
                fontWeight: 600,
                color: 'var(--text-primary)',
              }}
            >
              {item ? `Stock History: ${item.name}` : 'Catalog Stock Movements'}
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

        {/* Content Table */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px' }}>
          {item?.sku && (
            <div style={{ marginBottom: '14px', fontSize: '13px', color: 'var(--text-secondary)' }}>
              SKU: <span style={{ fontFamily: 'monospace', color: 'var(--text-primary)' }}>{item.sku}</span> · Current on hand:{' '}
              <strong style={{ color: 'var(--text-primary)' }}>{item.stock}</strong>
            </div>
          )}

          {loading ? (
            <div style={{ textAlign: 'center', padding: '36px 0', color: 'var(--text-muted)' }}>
              Loading stock movements…
            </div>
          ) : movements.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '36px 0', color: 'var(--text-muted)' }}>
              No stock movements recorded yet.
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', fontSize: '12px', borderCollapse: 'collapse', textAlign: 'left' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border-default)', color: 'var(--text-muted)' }}>
                    <th style={{ padding: '8px 6px', fontWeight: 600 }}>Date</th>
                    <th style={{ padding: '8px 6px', fontWeight: 600 }}>Type</th>
                    <th style={{ padding: '8px 6px', fontWeight: 600 }}>Change</th>
                    <th style={{ padding: '8px 6px', fontWeight: 600 }}>Stock</th>
                    <th style={{ padding: '8px 6px', fontWeight: 600 }}>Reason</th>
                    <th style={{ padding: '8px 6px', fontWeight: 600 }}>By</th>
                  </tr>
                </thead>
                <tbody>
                  {movements.map((m) => {
                    const isPositive = m.quantityChange > 0;
                    return (
                      <tr
                        key={m._id}
                        style={{
                          borderBottom: '1px solid var(--border-subtle)',
                        }}
                      >
                        <td style={{ padding: '10px 6px', whiteSpace: 'nowrap', color: 'var(--text-secondary)' }}>
                          {formatDate(m.createdAt)}
                        </td>
                        <td style={{ padding: '10px 6px' }}>
                          <span
                            style={{
                              display: 'inline-block',
                              padding: '2px 6px',
                              borderRadius: '4px',
                              fontSize: '11px',
                              fontWeight: 600,
                              textTransform: 'capitalize',
                              background: 'var(--bg-surface-raised)',
                              color: 'var(--text-primary)',
                              border: '1px solid var(--border-subtle)',
                            }}
                          >
                            {(m.type || 'adjustment').replace('_', ' ')}
                          </span>
                        </td>
                        <td
                          style={{
                            padding: '10px 6px',
                            fontWeight: 700,
                            fontFamily: 'monospace',
                            color: isPositive ? 'var(--color-success)' : 'var(--color-danger)',
                          }}
                        >
                          {isPositive ? `+${m.quantityChange}` : m.quantityChange}
                        </td>
                        <td style={{ padding: '10px 6px', whiteSpace: 'nowrap', color: 'var(--text-secondary)' }}>
                          {m.stockBefore} → <strong style={{ color: 'var(--text-primary)' }}>{m.stockAfter}</strong>
                        </td>
                        <td style={{ padding: '10px 6px', color: 'var(--text-secondary)', maxWidth: '200px' }}>
                          {m.reason || '—'}
                        </td>
                        <td style={{ padding: '10px 6px', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                          {m.admin?.name || (m.order?.orderNumber ? `Order #${m.order.orderNumber}` : 'System')}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'flex-end',
            padding: '12px 20px',
            borderTop: '1px solid var(--border-subtle)',
            background: 'var(--bg-surface-raised)',
          }}
        >
          <button
            type="button"
            onClick={onClose}
            style={{
              height: '34px',
              padding: '0 16px',
              borderRadius: '6px',
              border: '1px solid var(--border-default)',
              background: 'var(--bg-surface)',
              color: 'var(--text-primary)',
              fontSize: '13px',
              fontWeight: 500,
              cursor: 'pointer',
            }}
          >
            Close
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
