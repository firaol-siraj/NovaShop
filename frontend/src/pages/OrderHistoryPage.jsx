import { useEffect, useMemo, useRef, useState } from 'react';
import AccountLayout from '../components/account/AccountLayout';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';

const PAGE_SIZE = 10;
const FILTER_TABS = ['all', 'processing', 'shipped', 'delivered', 'cancelled'];

function formatMoney(value) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(Number(value || 0));
}

function formatDate(value) {
  const date = value ? new Date(value) : new Date();
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(date);
}

function formatPlacedLabel(value) {
  const date = value ? new Date(value) : new Date();
  const now = new Date();
  const sameDay = date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth() && date.getDate() === now.getDate();

  if (sameDay) {
    return `Placed Today, ${new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit' }).format(date)}`;
  }

  return `Placed ${new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(date)}`;
}

function formatTime(value) {
  const date = value ? new Date(value) : new Date();
  return new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);
}

function normalizeStatus(status) {
  const value = String(status || '').toLowerCase();
  if (['placed', 'processing', 'confirmed', 'pending'].includes(value)) return 'processing';
  if (['shipped', 'in-transit', 'in_transit'].includes(value)) return 'shipped';
  if (value === 'delivered') return 'delivered';
  if (value === 'cancelled' || value === 'canceled') return 'cancelled';
  return 'processing';
}

function getStatusMeta(status) {
  const normalized = normalizeStatus(status);
  const map = {
    processing: {
      label: 'Processing',
      chip: 'rgba(196, 142, 74, 0.12)',
      color: '#8D5C33',
      border: 'rgba(196, 142, 74, 0.26)',
      dot: '#B77A48',
    },
    shipped: {
      label: 'Shipped',
      chip: 'rgba(120, 126, 137, 0.12)',
      color: '#44505A',
      border: 'rgba(120, 126, 137, 0.30)',
      dot: '#5F6A7A',
    },
    delivered: {
      label: 'Delivered',
      chip: 'rgba(90, 110, 100, 0.12)',
      color: '#2E5E47',
      border: 'rgba(90, 110, 100, 0.22)',
      dot: '#2E5E47',
    },
    cancelled: {
      label: 'Cancelled',
      chip: 'rgba(121, 84, 83, 0.10)',
      color: '#7A4C4A',
      border: 'rgba(121, 84, 83, 0.20)',
      dot: '#7A4C4A',
    },
  };

  return map[normalized] || map.processing;
}

function formatStatusBadge(order) {
  const status = normalizeStatus(order.status);
  const meta = getStatusMeta(status);
  const deliveredDate = order.deliveredAt ? formatDate(order.deliveredAt) : order.deliveryDate ? formatDate(order.deliveryDate) : null;

  if (status === 'shipped') {
    return {
      label: 'Shipped',
      chip: meta.chip,
      color: meta.color,
      border: meta.border,
      dot: meta.dot,
      icon: 'truck',
    };
  }

  if (status === 'delivered') {
    return {
      label: `Delivered · ${deliveredDate || formatDate(order.placedAt || order.createdAt)}`,
      chip: meta.chip,
      color: meta.color,
      border: meta.border,
      dot: meta.dot,
      icon: 'check',
    };
  }

  if (status === 'cancelled') {
    return {
      label: 'Cancelled',
      chip: meta.chip,
      color: meta.color,
      border: meta.border,
      dot: meta.dot,
      icon: 'x',
    };
  }

  return {
    label: 'Processing',
    chip: meta.chip,
    color: meta.color,
    border: meta.border,
    dot: meta.dot,
    icon: 'clock',
  };
}

function getOrderStatusLabel(status) {
  const normalized = normalizeStatus(status);
  if (normalized === 'shipped') return 'Shipped';
  if (normalized === 'delivered') return 'Delivered';
  if (normalized === 'cancelled') return 'Cancelled';
  return 'Processing';
}

function getOrderId(order) {
  return order.orderId || order.id || 'NS-0000';
}

export default function OrderHistoryPage({ go, currentPath }) {
  const { orders } = useCart();
  const { user, isLoading } = useAuth();
  const listRef = useRef(null);
  const [page, setPage] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    const pageParam = Number(params.get('page') || 1);
    return Number.isFinite(pageParam) && pageParam > 0 ? pageParam : 1;
  });
  const [statusFilter, setStatusFilter] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    const rawStatus = params.get('status');
    return FILTER_TABS.includes(rawStatus || 'all') ? rawStatus || 'all' : 'all';
  });

  useEffect(() => {
    if (!isLoading && !user) {
      sessionStorage.setItem('novashop_redirect_after_login', '/account/orders');
      go('/login');
    }
  }, [isLoading, user, go]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const requestedStatus = params.get('status');
    if (requestedStatus && FILTER_TABS.includes(requestedStatus)) {
      setStatusFilter(requestedStatus);
    } else {
      setStatusFilter('all');
    }
  }, [currentPath]);

  const filteredOrders = useMemo(() => {
    const normalizedOrders = [...(orders || [])].sort((a, b) => {
      const dateA = new Date(a.placedAt || a.createdAt || 0).getTime();
      const dateB = new Date(b.placedAt || b.createdAt || 0).getTime();
      return dateB - dateA;
    });

    if (statusFilter === 'all') return normalizedOrders;
    return normalizedOrders.filter((order) => normalizeStatus(order.status) === statusFilter);
  }, [orders, statusFilter]);

  useEffect(() => {
    setPage(1);
  }, [statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredOrders.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const currentPageOrders = filteredOrders.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (statusFilter !== 'all') params.set('status', statusFilter);
    else params.delete('status');
    params.set('page', String(safePage));
    const target = `${window.location.pathname}?${params.toString()}`;
    if (window.location.search !== params.toString() ? `?${params.toString()}` : '' ) {
      window.history.replaceState({}, '', target);
    }
  }, [statusFilter, safePage]);

  const handleStatusChange = (nextStatus) => {
    const nextUrl = new URL(window.location.href);
    if (nextStatus === 'all') nextUrl.searchParams.delete('status');
    else nextUrl.searchParams.set('status', nextStatus);
    nextUrl.searchParams.set('page', '1');
    setStatusFilter(nextStatus);
    setPage(1);
    go(`${nextUrl.pathname}${nextUrl.search}`);
  };

  const handlePageChange = (nextPage) => {
    setPage(nextPage);
    if (listRef.current) {
      listRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const startIndex = filteredOrders.length === 0 ? 0 : (safePage - 1) * PAGE_SIZE + 1;
  const endIndex = Math.min(safePage * PAGE_SIZE, filteredOrders.length);

  const emptyMessage = statusFilter === 'all' ? 'No orders yet.' : `No ${getOrderStatusLabel(statusFilter).toLowerCase()} orders.`;

  if (!user) return null;

  return (
    <AccountLayout go={go} currentPath={currentPath}>
      <div style={{ marginBottom: '8px', fontFamily: 'var(--font-sans)', fontSize: '11px', letterSpacing: '0.16em', textTransform: 'uppercase', color: '#7A726C' }}>
        <button type="button" onClick={() => go('/')} style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: '#7A726C', fontFamily: 'inherit', letterSpacing: 'inherit', textTransform: 'inherit' }}>Home</button>
        <span style={{ margin: '0 10px', color: '#B9B1AB' }}>/</span>
        <button type="button" onClick={() => go('/account')} style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: '#7A726C', fontFamily: 'inherit', letterSpacing: 'inherit', textTransform: 'inherit' }}>Account</button>
        <span style={{ margin: '0 10px', color: '#B9B1AB' }}>/</span>
        <span style={{ color: '#1B1816' }}>Orders</span>
      </div>

      <section style={{ display: 'grid', gap: '10px' }}>
        <h1 style={{ margin: 0, fontFamily: 'var(--font-serif)', fontSize: 'clamp(34px, 3vw, 52px)', letterSpacing: '-0.04em', color: '#1B1816', fontWeight: 500 }}>Orders</h1>
        <p style={{ margin: 0, fontFamily: 'var(--font-sans)', fontSize: '14px', color: '#6E6962' }}>View and manage your recent orders.</p>
      </section>

      <div style={{ height: '1px', width: '100%', background: 'rgba(27,24,22,0.12)' }} />

      <section style={{ display: 'grid', gap: '14px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'nowrap', overflowX: 'auto', paddingBottom: '4px' }}>
          {['all', 'processing', 'shipped', 'delivered', 'cancelled'].map((tab) => {
            const active = statusFilter === tab;
            const label = tab === 'all' ? 'All' : getOrderStatusLabel(tab);
            return (
              <button
                key={tab}
                type="button"
                onClick={() => handleStatusChange(tab)}
                style={{
                  border: '1px solid rgba(27,24,22,0.12)',
                  background: active ? '#1B1816' : 'transparent',
                  color: active ? '#FDFBF7' : '#6E6962',
                  borderRadius: '999px',
                  padding: '10px 16px',
                  fontFamily: 'var(--font-sans)',
                  fontSize: '10px',
                  letterSpacing: '0.14em',
                  textTransform: 'uppercase',
                  cursor: 'pointer',
                  transition: 'all 180ms ease',
                  whiteSpace: 'nowrap',
                }}
              >
                {label}
              </button>
            );
          })}
        </div>

        <div style={{ height: '1px', width: '100%', background: 'rgba(27,24,22,0.12)' }} />

        <div ref={listRef} style={{ display: 'grid', gap: '16px' }}>
          {filteredOrders.length === 0 ? (
            <div style={{ minHeight: '240px', display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center', background: '#F7F2EA', border: '1px solid rgba(27,24,22,0.10)', borderRadius: '16px', padding: '30px 20px' }}>
              <div>
                <div style={{ fontFamily: 'var(--font-sans)', fontSize: '12px', letterSpacing: '0.14em', textTransform: 'uppercase', color: '#7A726C', marginBottom: '8px' }}>Status</div>
                <div style={{ fontFamily: 'var(--font-serif)', fontSize: '26px', color: '#1B1816', marginBottom: '8px' }}>{emptyMessage}</div>
                <div style={{ fontFamily: 'var(--font-sans)', fontSize: '14px', color: '#6E6962' }}>Try another filter to browse your purchases.</div>
              </div>
            </div>
          ) : (
            currentPageOrders.map((order, index) => {
              const status = normalizeStatus(order.status);
              const badge = formatStatusBadge(order);
              const totalItems = Array.isArray(order.items) ? order.items.reduce((sum, item) => sum + Number(item.qty || 1), 0) : 0;
              const orderTotal = Number(order.total || order.summary?.total || order.subtotal || 0);
              const totalLabel = totalItems === 1 ? '1 item' : `${totalItems} items`;
              const productItems = Array.isArray(order.items) ? order.items : [];
              const previewItems = productItems.slice(0, 3);
              const extraItems = Math.max(0, productItems.length - 3);
              const orderId = getOrderId(order);

              return (
                <article
                  key={orderId}
                  onClick={() => go(`/account/orders/${orderId}`)}
                  style={{
                    background: '#F7F2EA',
                    border: '1px solid rgba(27,24,22,0.12)',
                    borderRadius: '14px',
                    boxShadow: '0 8px 22px rgba(27,24,22,0.04)',
                    overflow: 'hidden',
                    cursor: 'pointer',
                    opacity: 0,
                    transform: 'translateY(8px)',
                    animation: 'nsOrderFade 200ms ease forwards',
                    animationDelay: `${index * 50}ms`,
                    transition: 'border-color 180ms ease, box-shadow 180ms ease',
                  }}
                  onMouseEnter={(event) => {
                    event.currentTarget.style.borderColor = 'rgba(27,24,22,0.18)';
                    event.currentTarget.style.boxShadow = '0 10px 26px rgba(27,24,22,0.07)';
                  }}
                  onMouseLeave={(event) => {
                    event.currentTarget.style.borderColor = 'rgba(27,24,22,0.12)';
                    event.currentTarget.style.boxShadow = '0 8px 22px rgba(27,24,22,0.04)';
                  }}
                >
                  <div style={{ background: '#F0E7DF', borderBottom: '1px solid rgba(27,24,22,0.10)', padding: '18px 18px 12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                        <span style={{ fontFamily: 'var(--font-sans)', fontSize: '14px', fontWeight: 700, color: '#1B1816' }}>Order #{orderId}</span>
                        <span style={{ width: '4px', height: '4px', borderRadius: '50%', background: '#9C948F', display: 'inline-block' }} />
                        <span style={{ fontFamily: 'var(--font-sans)', fontSize: '12px', color: '#6E6962' }}>{formatPlacedLabel(order.placedAt || order.createdAt)}</span>
                      </div>

                      <span style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '8px',
                        padding: '7px 10px',
                        borderRadius: '999px',
                        background: badge.chip,
                        color: badge.color,
                        border: `1px solid ${badge.border}`,
                        fontFamily: 'var(--font-sans)',
                        fontSize: '9px',
                        letterSpacing: '0.12em',
                        textTransform: 'uppercase',
                        fontWeight: 600,
                      }}>
                        <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: badge.dot, display: 'inline-block' }} />
                        {badge.label}
                      </span>
                    </div>
                  </div>

                  <div style={{ background: '#FDFBF7', padding: '16px 18px 0' }}>
                    <div style={{ display: 'flex', gap: '8px', paddingBottom: '16px' }}>
                      {previewItems.map((item, itemIndex) => (
                        <div key={`${item.name || 'item'}-${itemIndex}`} style={{ position: 'relative', width: '54px', height: '64px', borderRadius: '10px', overflow: 'hidden', border: '1px solid rgba(27,24,22,0.10)', background: '#F2EDE8' }}>
                          <img src={item.image || item.primaryImage || ''} alt={item.name || 'Product'} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                        </div>
                      ))}
                      {extraItems > 0 ? (
                        <div style={{ width: '54px', height: '64px', borderRadius: '10px', border: '1px solid rgba(27,24,22,0.10)', background: '#F1EAE3', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-sans)', fontSize: '11px', color: '#6E6962', fontWeight: 600 }}>
                          +{extraItems} more
                        </div>
                      ) : null}
                    </div>
                    <div style={{ height: '1px', width: '100%', background: 'rgba(27,24,22,0.10)' }} />
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap', background: '#FDFBF7', padding: '16px 18px 18px' }}>
                    <div style={{ fontFamily: 'var(--font-sans)', fontSize: '13px', color: '#1B1816', fontWeight: 500 }}>{totalLabel} · {formatMoney(orderTotal)}</div>
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        go(`/account/orders/${orderId}`);
                      }}
                      style={{
                        border: '1px solid rgba(27,24,22,0.18)',
                        background: 'transparent',
                        color: '#1B1816',
                        borderRadius: '999px',
                        padding: '10px 14px',
                        fontFamily: 'var(--font-sans)',
                        fontSize: '10px',
                        letterSpacing: '0.14em',
                        textTransform: 'uppercase',
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '8px',
                        transition: 'transform 180ms ease, border-color 180ms ease',
                      }}
                      onMouseEnter={(event) => {
                        event.currentTarget.style.transform = 'translateX(3px)';
                        event.currentTarget.style.borderColor = 'rgba(27,24,22,0.45)';
                      }}
                      onMouseLeave={(event) => {
                        event.currentTarget.style.transform = 'translateX(0)';
                        event.currentTarget.style.borderColor = 'rgba(27,24,22,0.18)';
                      }}
                    >
                      View Order <span aria-hidden="true">→</span>
                    </button>
                  </div>
                </article>
              );
            })
          )}
        </div>

        {filteredOrders.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '14px', flexWrap: 'wrap', paddingTop: '8px' }}>
            <div style={{ fontFamily: 'var(--font-sans)', fontSize: '10px', letterSpacing: '0.16em', textTransform: 'uppercase', color: '#7A726C' }}>
              Showing {filteredOrders.length === 0 ? 0 : startIndex}–{endIndex} of {filteredOrders.length} Orders
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={() => handlePageChange(safePage - 1)}
                disabled={safePage <= 1}
                style={{
                  border: '1px solid rgba(27,24,22,0.18)',
                  background: 'transparent',
                  color: safePage <= 1 ? '#B6B0A9' : '#1B1816',
                  borderRadius: '999px',
                  padding: '10px 14px',
                  fontFamily: 'var(--font-sans)',
                  fontSize: '10px',
                  letterSpacing: '0.14em',
                  textTransform: 'uppercase',
                  cursor: safePage <= 1 ? 'not-allowed' : 'pointer',
                  opacity: safePage <= 1 ? 0.5 : 1,
                }}
              >
                Previous
              </button>
              <button
                type="button"
                onClick={() => handlePageChange(safePage + 1)}
                disabled={safePage >= totalPages}
                style={{
                  border: '1px solid rgba(27,24,22,0.18)',
                  background: 'transparent',
                  color: safePage >= totalPages ? '#B6B0A9' : '#1B1816',
                  borderRadius: '999px',
                  padding: '10px 14px',
                  fontFamily: 'var(--font-sans)',
                  fontSize: '10px',
                  letterSpacing: '0.14em',
                  textTransform: 'uppercase',
                  cursor: safePage >= totalPages ? 'not-allowed' : 'pointer',
                  opacity: safePage >= totalPages ? 0.5 : 1,
                }}
              >
                Next
              </button>
            </div>
          </div>
        )}
      </section>

      <style>{`
        @keyframes nsOrderFade {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }

        @media (max-width: 1023px) {
          .ns-account-shell > div > div { grid-template-columns: 1fr !important; }
          .ns-account-shell nav { display: flex !important; gap: 8px !important; overflow-x: auto; white-space: nowrap; }
          .ns-account-shell nav button { min-width: max-content; }
        }

        @media (max-width: 767px) {
          .ns-account-shell > div { padding-left: 18px !important; padding-right: 18px !important; }
          .ns-account-shell main > section { gap: 12px !important; }
          article > div:first-child > div { align-items: flex-start !important; }
          article > div:first-child span:last-child { width: 100%; justify-content: flex-start; }
        }
      `}</style>
    </AccountLayout>
  );
}
