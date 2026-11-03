import { createPortal } from 'react-dom';
import { AdminIcon } from './AdminLayout';

const formatCurrency = (val) =>
  `$${Number(val || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const formatDate = (val) => {
  if (!val) return '—';
  const d = new Date(val);
  return Number.isNaN(d.getTime())
    ? '—'
    : d.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
};

export default function AdminDiscountUsageDrawer({
  discount,
  redemptions = [],
  loading = false,
  isOpen,
  onClose,
  go,
}) {
  if (!isOpen || !discount) return null;

  const totalSaved = redemptions.reduce((acc, r) => acc + (Number(r.amountSaved) || 0), 0);

  return createPortal(
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 99999,
        display: 'flex',
        justifyContent: 'flex-end',
        background: 'var(--bg-overlay, rgba(20, 18, 16, 0.65))',
        backdropFilter: 'blur(3px)',
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="usage-drawer-title"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '560px',
          height: '100%',
          background: 'var(--bg-surface)',
          borderLeft: '1px solid var(--border-default)',
          boxShadow: 'var(--shadow-xl)',
          color: 'var(--text-primary)',
          display: 'flex',
          flexDirection: 'column',
          animation: 'drawerSlideLeft 180ms cubic-bezier(0.16, 1, 0.3, 1)',
        }}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '18px 24px',
            borderBottom: '1px solid var(--border-subtle)',
            background: 'var(--bg-surface-raised)',
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
              Promotion Usage & Redemptions
            </span>
            <h2
              id="usage-drawer-title"
              style={{
                margin: '2px 0 0',
                fontSize: '18px',
                fontFamily: 'var(--font-serif)',
                fontWeight: 600,
                color: 'var(--text-primary)',
              }}
            >
              {discount.name} ({discount.code})
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

        {/* Summary Metric Strip */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            padding: '14px 24px',
            background: 'var(--bg-surface-sunken)',
            borderBottom: '1px solid var(--border-subtle)',
            gap: '12px',
          }}
        >
          <div>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Total Redemptions
            </span>
            <div style={{ fontSize: '20px', fontWeight: 700, color: 'var(--text-primary)', marginTop: '2px' }}>
              {redemptions.length}
            </div>
          </div>
          <div>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Customer Savings
            </span>
            <div style={{ fontSize: '20px', fontWeight: 700, color: 'var(--color-success)', marginTop: '2px' }}>
              {formatCurrency(totalSaved)}
            </div>
          </div>
        </div>

        {/* Redemptions List */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 24px' }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-muted)' }}>
              Loading redemptions…
            </div>
          ) : redemptions.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '48px 0', color: 'var(--text-muted)' }}>
              <div style={{ marginBottom: '8px' }}>
                <AdminIcon name="receipt" size={28} />
              </div>
              <p style={{ margin: 0, fontSize: '14px', color: 'var(--text-secondary)' }}>
                No customers have redeemed this discount code yet.
              </p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {redemptions.map((r) => (
                <div
                  key={r._id}
                  style={{
                    padding: '12px 14px',
                    borderRadius: '8px',
                    background: 'var(--bg-surface-raised)',
                    border: '1px solid var(--border-subtle)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '6px',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span
                        style={{
                          fontSize: '13px',
                          fontWeight: 600,
                          color: 'var(--text-primary)',
                        }}
                      >
                        Order #{r.orderNumber}
                      </span>
                      {r.orderId && go && (
                        <button
                          type="button"
                          onClick={() => {
                            onClose();
                            go(`/admin/orders/${r.orderId}`);
                          }}
                          style={{
                            border: 0,
                            background: 'transparent',
                            color: 'var(--color-accent, #D4A662)',
                            fontSize: '11px',
                            fontWeight: 600,
                            cursor: 'pointer',
                            textDecoration: 'underline',
                          }}
                        >
                          View Order
                        </button>
                      )}
                    </div>
                    <span
                      style={{
                        fontSize: '13px',
                        fontWeight: 700,
                        color: 'var(--color-success)',
                      }}
                    >
                      Saved {formatCurrency(r.amountSaved)}
                    </span>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '12px' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>
                      {r.customerName} ({r.customerEmail})
                    </span>
                    <span style={{ color: 'var(--text-muted)', fontSize: '11px' }}>
                      {formatDate(r.date)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          style={{
            padding: '14px 24px',
            borderTop: '1px solid var(--border-subtle)',
            background: 'var(--bg-surface-raised)',
            display: 'flex',
            justifyContent: 'flex-end',
          }}
        >
          <button
            type="button"
            onClick={onClose}
            style={{
              height: '36px',
              padding: '0 18px',
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

      <style>{`
        @keyframes drawerSlideLeft {
          from { transform: translateX(100%); }
          to { transform: translateX(0); }
        }
      `}</style>
    </div>,
    document.body
  );
}
