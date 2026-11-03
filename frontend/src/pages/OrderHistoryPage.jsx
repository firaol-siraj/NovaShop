import { useEffect, useState, useCallback, useRef } from 'react';
import AccountLayout from '../components/account/AccountLayout';
import { useAuth } from '../context/AuthContext';
import { orderApi } from '../lib/api/orderApi';

const FILTER_TABS = [
  { key: 'all', label: 'All Orders' },
  { key: 'processing', label: 'Processing' },
  { key: 'shipped', label: 'Shipped' },
  { key: 'delivered', label: 'Delivered' },
  { key: 'cancelled', label: 'Cancelled' },
];

function formatMoney(value) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(Number(value || 0));
}

function formatDate(value) {
  if (!value) return '—';
  const date = new Date(value);
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(date);
}

function normalizeStatus(status) {
  const value = String(status || '').toLowerCase();
  if (['placed', 'processing', 'confirmed', 'pending', 'pending_payment'].includes(value)) return 'processing';
  if (['shipped', 'in-transit', 'in_transit'].includes(value)) return 'shipped';
  if (value === 'delivered') return 'delivered';
  if (value === 'cancelled' || value === 'canceled') return 'cancelled';
  return 'processing';
}

function getStatusBadge(status) {
  const norm = normalizeStatus(status);
  const map = {
    processing: {
      label: 'Processing',
      chip: 'rgba(212, 166, 98, 0.15)',
      color: 'var(--color-warning)',
      border: 'rgba(212, 166, 98, 0.35)',
    },
    shipped: {
      label: 'Shipped',
      chip: 'rgba(128, 128, 128, 0.12)',
      color: 'var(--text-secondary)',
      border: 'var(--border-subtle)',
    },
    delivered: {
      label: 'Delivered',
      chip: 'rgba(46, 125, 50, 0.15)',
      color: 'var(--color-success)',
      border: 'rgba(46, 125, 50, 0.35)',
    },
    cancelled: {
      label: 'Cancelled',
      chip: 'rgba(217, 83, 79, 0.15)',
      color: 'var(--color-danger)',
      border: 'rgba(217, 83, 79, 0.35)',
    },
  };

  return map[norm] || map.processing;
}

export default function OrderHistoryPage({ go, currentPath }) {
  const { user, isLoading: authLoading } = useAuth();
  const listRef = useRef(null);

  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [page, setPage] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    const p = parseInt(params.get('page'), 10);
    return Number.isFinite(p) && p > 0 ? p : 1;
  });

  const [statusFilter, setStatusFilter] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    const s = params.get('status');
    return FILTER_TABS.some((t) => t.key === s) ? s : 'all';
  });

  const [pagination, setPagination] = useState({
    total: 0,
    totalPages: 1,
    currentPage: 1,
  });

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await orderApi.getMyOrders({
        page,
        limit: 10,
        status: statusFilter,
      });

      if (res.success && Array.isArray(res.data)) {
        setOrders(res.data);
        setPagination({
          total: res.total || res.data.length,
          totalPages: res.totalPages || 1,
          currentPage: res.currentPage || page,
        });
      } else {
        throw new Error(res.message || 'Unable to load orders');
      }
    } catch (err) {
      if (err.status === 401 || err.response?.status === 401) {
        sessionStorage.setItem('novashop_redirect_after_login', '/account/orders');
        go('/login');
        return;
      }
      setError(err.response?.data?.message || err.message || 'Failed to fetch orders.');
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter, go]);

  useEffect(() => {
    if (!authLoading && !user) {
      sessionStorage.setItem('novashop_redirect_after_login', '/account/orders');
      go('/login');
      return;
    }

    if (user) {
      fetchOrders();
    }
  }, [authLoading, user, fetchOrders, go]);

  const handleTabChange = (key) => {
    setStatusFilter(key);
    setPage(1);
    const params = new URLSearchParams();
    if (key !== 'all') params.set('status', key);
    params.set('page', '1');
    const query = params.toString() ? `?${params.toString()}` : '';
    window.history.replaceState({}, '', `/account/orders${query}`);
  };

  const handlePageChange = (newPage) => {
    if (newPage < 1 || newPage > pagination.totalPages) return;
    setPage(newPage);
    const params = new URLSearchParams(window.location.search);
    params.set('page', String(newPage));
    if (statusFilter !== 'all') params.set('status', statusFilter);
    window.history.replaceState({}, '', `/account/orders?${params.toString()}`);
    if (listRef.current) {
      listRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  if (authLoading || !user) return null;

  return (
    <AccountLayout go={go} currentPath={currentPath || '/account/orders'}>
      <div style={{ display: 'grid', gap: '20px' }}>
        <div style={{ fontFamily: 'var(--font-sans)', fontSize: '10px', letterSpacing: '0.16em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>
          <button type="button" onClick={() => go('/')} style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: 'var(--text-muted)', fontFamily: 'inherit', letterSpacing: 'inherit', textTransform: 'inherit' }}>Home</button>
          <span style={{ margin: '0 8px', color: 'var(--border-default)' }}>/</span>
          <button type="button" onClick={() => go('/account')} style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: 'var(--text-muted)', fontFamily: 'inherit', letterSpacing: 'inherit', textTransform: 'inherit' }}>Account</button>
          <span style={{ margin: '0 8px', color: 'var(--border-default)' }}>/</span>
          <span style={{ color: 'var(--text-primary)', fontWeight: 700 }}>Orders</span>
        </div>

        <div>
          <h1 style={{ margin: 0, fontFamily: 'var(--font-serif)', fontSize: 'clamp(32px, 3vw, 52px)', letterSpacing: '-0.04em', fontWeight: 500, color: 'var(--text-primary)', lineHeight: 1.08 }}>Order History</h1>
          <p style={{ margin: '8px 0 0', fontFamily: 'var(--font-sans)', fontSize: '14px', color: 'var(--text-secondary)', lineHeight: 1.65 }}>View, track, and download official receipts for your NovaShop purchases.</p>
        </div>

        <div style={{ height: '1px', width: '100%', background: 'var(--border-default)' }} />

        {/* Filter Tabs */}
        <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '4px' }}>
          {FILTER_TABS.map((tab) => {
            const active = statusFilter === tab.key;
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => handleTabChange(tab.key)}
                style={{
                  border: '1px solid var(--border-default)',
                  background: active ? 'var(--color-primary)' : 'transparent',
                  color: active ? 'var(--color-primary-contrast)' : 'var(--text-secondary)',
                  borderRadius: '999px',
                  padding: '9px 18px',
                  fontFamily: 'var(--font-sans)',
                  fontSize: '11px',
                  letterSpacing: '0.12em',
                  textTransform: 'uppercase',
                  cursor: 'pointer',
                  transition: 'all 180ms ease',
                  whiteSpace: 'nowrap',
                }}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        {error && (
          <div style={{ background: 'rgba(217, 83, 79, 0.1)', border: '1px solid var(--color-danger)', borderRadius: '12px', padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '14px' }}>
            <span style={{ fontFamily: 'var(--font-sans)', fontSize: '13px', color: 'var(--color-danger)' }}>{error}</span>
            <button
              type="button"
              onClick={fetchOrders}
              style={{ border: '1px solid var(--color-danger)', background: 'transparent', color: 'var(--color-danger)', borderRadius: '999px', padding: '6px 14px', fontFamily: 'var(--font-sans)', fontSize: '10px', letterSpacing: '0.12em', textTransform: 'uppercase', cursor: 'pointer' }}
            >
              Retry
            </button>
          </div>
        )}

        <div ref={listRef} style={{ display: 'grid', gap: '16px' }}>
          {loading ? (
            <div style={{ display: 'grid', gap: '14px' }}>
              <div style={{ height: '140px', background: 'var(--skeleton-base)', borderRadius: '14px', animation: 'pulse 1.5s infinite' }} />
              <div style={{ height: '140px', background: 'var(--skeleton-base)', borderRadius: '14px', animation: 'pulse 1.5s infinite' }} />
            </div>
          ) : orders.length === 0 ? (
            <div style={{ minHeight: '220px', display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center', background: 'var(--bg-surface)', border: '1px solid var(--border-default)', borderRadius: '16px', padding: '36px 20px' }}>
              <div>
                <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: 'var(--bg-surface-sunken)', margin: '0 auto 12px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px' }}>
                  📦
                </div>
                <h3 style={{ margin: '0 0 6px', fontFamily: 'var(--font-serif)', fontSize: '24px', color: 'var(--text-primary)', fontWeight: 500 }}>
                  {statusFilter === 'all' ? 'No orders placed yet' : `No ${statusFilter} orders`}
                </h3>
                <p style={{ margin: '0 0 18px', fontFamily: 'var(--font-sans)', fontSize: '14px', color: 'var(--text-secondary)' }}>
                  Explore the curated collections and complete your first order.
                </p>
                <button
                  type="button"
                  onClick={() => go('/shop')}
                  style={{ border: 'none', background: 'var(--color-primary)', color: 'var(--color-primary-contrast)', borderRadius: '999px', padding: '12px 24px', fontFamily: 'var(--font-sans)', fontSize: '10px', letterSpacing: '0.14em', textTransform: 'uppercase', cursor: 'pointer' }}
                >
                  Start Shopping
                </button>
              </div>
            </div>
          ) : (
            orders.map((order) => {
              const statusMeta = getStatusBadge(order.status);
              const itemsList = order.orderItems || [];
              const totalItems = itemsList.reduce((sum, it) => sum + (Number(it.qty) || 1), 0);
              const orderId = order.orderNumber || order._id;
              const isPaid = Boolean(order.isPaid || order.paymentStatus === 'paid');

              return (
                <article
                  key={order._id}
                  onClick={() => go(`/account/orders/${order._id}`)}
                  style={{
                    background: 'var(--bg-surface)',
                    border: '1px solid var(--border-default)',
                    borderRadius: '16px',
                    padding: '20px 24px',
                    cursor: 'pointer',
                    display: 'grid',
                    gap: '16px',
                    transition: 'border-color 180ms ease, box-shadow 180ms ease',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = 'var(--border-strong)';
                    e.currentTarget.style.boxShadow = '0 6px 20px rgba(0,0,0,0.12)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = 'var(--border-default)';
                    e.currentTarget.style.boxShadow = 'none';
                  }}
                >
                  {/* Header Row */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                      <span style={{ fontFamily: 'var(--font-sans)', fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)' }}>
                        #{orderId}
                      </span>
                      <span style={{ color: 'var(--text-muted)' }}>·</span>
                      <span style={{ fontFamily: 'var(--font-sans)', fontSize: '12px', color: 'var(--text-secondary)' }}>
                        Placed on {formatDate(order.createdAt)}
                      </span>
                      <span style={{ color: 'var(--text-muted)' }}>·</span>
                      <span style={{ fontFamily: 'var(--font-sans)', fontSize: '12px', color: 'var(--text-secondary)' }}>
                        {totalItems} piece{totalItems === 1 ? '' : 's'}
                      </span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span
                        style={{
                          background: statusMeta.chip,
                          border: `1px solid ${statusMeta.border}`,
                          color: statusMeta.color,
                          borderRadius: '999px',
                          padding: '4px 10px',
                          fontFamily: 'var(--font-sans)',
                          fontSize: '9px',
                          letterSpacing: '0.12em',
                          textTransform: 'uppercase',
                          fontWeight: 700,
                        }}
                      >
                        {statusMeta.label}
                      </span>
                      <span
                        style={{
                          background: isPaid ? 'rgba(46, 125, 50, 0.15)' : 'rgba(212, 166, 98, 0.15)',
                          border: `1px solid ${isPaid ? 'rgba(46, 125, 50, 0.35)' : 'rgba(212, 166, 98, 0.35)'}`,
                          color: isPaid ? 'var(--color-success)' : 'var(--color-warning)',
                          borderRadius: '999px',
                          padding: '4px 10px',
                          fontFamily: 'var(--font-sans)',
                          fontSize: '9px',
                          letterSpacing: '0.12em',
                          textTransform: 'uppercase',
                          fontWeight: 700,
                        }}
                      >
                        {isPaid ? 'Paid' : 'Pending Payment'}
                      </span>
                    </div>
                  </div>

                  <div style={{ height: '1px', width: '100%', background: 'var(--border-subtle)' }} />

                  {/* Items Preview */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                      {itemsList.slice(0, 4).map((item, idx) => (
                        <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <img
                            src={item.image || 'https://images.unsplash.com/photo-1529139574466-a303027c1d8b?auto=format&fit=crop&w=500&q=80'}
                            alt={item.name}
                            style={{ width: '48px', height: '48px', objectFit: 'cover', borderRadius: '8px', background: 'var(--bg-surface-sunken)' }}
                          />
                        </div>
                      ))}
                      {itemsList.length > 4 && (
                        <div style={{ fontFamily: 'var(--font-sans)', fontSize: '11px', color: 'var(--text-muted)', background: 'var(--bg-surface-sunken)', borderRadius: '8px', padding: '14px 10px', fontWeight: 600 }}>
                          +{itemsList.length - 4} more
                        </div>
                      )}
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontFamily: 'var(--font-serif)', fontSize: '20px', fontWeight: 600, color: 'var(--text-primary)' }}>
                          {formatMoney(order.totalPrice)}
                        </div>
                        {order.totalPriceETB && (
                          <div style={{ fontFamily: 'var(--font-sans)', fontSize: '11px', color: 'var(--text-muted)' }}>
                            ~{Number(order.totalPriceETB).toLocaleString()} ETB
                          </div>
                        )}
                      </div>

                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          go(`/account/orders/${order._id}`);
                        }}
                        style={{
                          border: '1px solid var(--border-default)',
                          background: 'var(--bg-surface-raised)',
                          color: 'var(--text-primary)',
                          borderRadius: '999px',
                          padding: '10px 18px',
                          fontFamily: 'var(--font-sans)',
                          fontSize: '10px',
                          letterSpacing: '0.14em',
                          textTransform: 'uppercase',
                          cursor: 'pointer',
                        }}
                      >
                        View Details →
                      </button>
                    </div>
                  </div>
                </article>
              );
            })
          )}
        </div>

        {/* Pagination Controls */}
        {pagination.totalPages > 1 && (
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '10px', marginTop: '16px' }}>
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => handlePageChange(page - 1)}
              style={{
                border: '1px solid var(--border-default)',
                background: page <= 1 ? 'var(--bg-surface-sunken)' : 'var(--bg-surface)',
                color: page <= 1 ? 'var(--text-muted)' : 'var(--text-primary)',
                borderRadius: '999px',
                padding: '8px 16px',
                fontFamily: 'var(--font-sans)',
                fontSize: '10px',
                letterSpacing: '0.12em',
                textTransform: 'uppercase',
                cursor: page <= 1 ? 'not-allowed' : 'pointer',
              }}
            >
              ← Previous
            </button>

            <span style={{ fontFamily: 'var(--font-sans)', fontSize: '12px', color: 'var(--text-secondary)', margin: '0 8px' }}>
              Page {pagination.currentPage} of {pagination.totalPages}
            </span>

            <button
              type="button"
              disabled={page >= pagination.totalPages}
              onClick={() => handlePageChange(page + 1)}
              style={{
                border: '1px solid var(--border-default)',
                background: page >= pagination.totalPages ? 'var(--bg-surface-sunken)' : 'var(--bg-surface)',
                color: page >= pagination.totalPages ? 'var(--text-muted)' : 'var(--text-primary)',
                borderRadius: '999px',
                padding: '8px 16px',
                fontFamily: 'var(--font-sans)',
                fontSize: '10px',
                letterSpacing: '0.12em',
                textTransform: 'uppercase',
                cursor: page >= pagination.totalPages ? 'not-allowed' : 'pointer',
              }}
            >
              Next →
            </button>
          </div>
        )}
      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
      `}</style>
    </AccountLayout>
  );
}
