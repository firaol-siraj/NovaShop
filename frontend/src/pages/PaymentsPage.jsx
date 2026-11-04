import { useState, useEffect, useCallback } from 'react';
import AccountLayout from '../components/account/AccountLayout';
import { useAuth } from '../context/AuthContext';
import { paymentApi } from '../lib/api/paymentApi';

function formatMoney(value) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(Number(value || 0));
}

function formatDate(dateValue) {
  if (!dateValue) return '—';
  const d = new Date(dateValue);
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(d);
}

function getStatusBadge(status) {
  const norm = String(status || '').toLowerCase();
  if (norm === 'paid' || norm === 'success' || norm === 'completed') {
    return {
      label: 'Paid',
      bg: 'rgba(46, 125, 50, 0.15)',
      color: 'var(--color-success)',
      border: 'rgba(46, 125, 50, 0.35)',
    };
  }
  if (norm === 'pending' || norm === 'pending_payment') {
    return {
      label: 'Pending',
      bg: 'rgba(212, 166, 98, 0.15)',
      color: 'var(--color-warning)',
      border: 'rgba(212, 166, 98, 0.35)',
    };
  }
  if (norm === 'failed') {
    return {
      label: 'Failed',
      bg: 'rgba(217, 83, 79, 0.15)',
      color: 'var(--color-danger)',
      border: 'rgba(217, 83, 79, 0.35)',
    };
  }
  return {
    label: status ? String(status).toUpperCase() : 'Cancelled',
    bg: 'rgba(128, 128, 128, 0.12)',
    color: 'var(--text-secondary)',
    border: 'var(--border-subtle)',
  };
}

export default function PaymentsPage({ go, currentPath }) {
  const { user, isLoading: authLoading } = useAuth();
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchPayments = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await paymentApi.getMyPayments();
      if (res.success && Array.isArray(res.data)) {
        setPayments(res.data);
      } else {
        throw new Error(res.message || 'Unable to retrieve payments');
      }
    } catch (err) {
      if (err.status === 401 || err.response?.status === 401) {
        sessionStorage.setItem('novashop_redirect_after_login', '/account/payments');
        go('/login');
        return;
      }
      setError(err.response?.data?.message || err.message || 'Failed to fetch payment records.');
    } finally {
      setLoading(false);
    }
  }, [go]);

  useEffect(() => {
    if (!authLoading && !user) {
      sessionStorage.setItem('novashop_redirect_after_login', '/account/payments');
      go('/login');
      return;
    }

    if (user) {
      fetchPayments();
    }
  }, [authLoading, user, go, fetchPayments]);

  const stats = {
    totalTransactions: payments.length,
    paidCount: payments.filter((p) => p.status === 'Paid').length,
    totalSpentUSD: payments.filter((p) => p.status === 'Paid').reduce((sum, p) => sum + (Number(p.amount) || 0), 0),
  };

  if (authLoading || !user) return null;

  return (
    <AccountLayout go={go} currentPath={currentPath || '/account/payments'}>
      <div style={{ display: 'grid', gap: '26px' }}>
        <div>
          <div style={{ fontFamily: 'var(--font-sans)', fontSize: '10px', letterSpacing: '0.16em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>Payment Records &amp; Security</div>
          <h1 style={{ margin: '6px 0 0', fontFamily: 'var(--font-serif)', fontSize: 'clamp(32px, 3.5vw, 48px)', fontWeight: 500, color: 'var(--text-primary)', letterSpacing: '-0.04em' }}>Payments &amp; Transactions</h1>
          <p style={{ margin: '8px 0 0', fontFamily: 'var(--font-sans)', fontSize: '14px', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
            Authoritative history of all payment transactions, Chapa payment references, and order settlements.
          </p>
        </div>

        <div style={{ height: '1px', width: '100%', background: 'var(--border-subtle)' }} />

        {/* Chapa Hosted Gateway Security Notice */}
        <div
          style={{
            background: 'var(--bg-surface)',
            border: '1px solid var(--border-default)',
            borderRadius: '16px',
            padding: '20px 24px',
            display: 'flex',
            alignItems: 'flex-start',
            gap: '16px',
          }}
        >
          <div
            style={{
              width: '42px',
              height: '42px',
              borderRadius: '50%',
              background: 'var(--color-success)',
              color: 'var(--color-primary-contrast)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              fontSize: '18px',
            }}
          >
            🔒
          </div>
          <div>
            <div style={{ fontFamily: 'var(--font-sans)', fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '0.02em', textTransform: 'uppercase' }}>
              Secure Hosted Payments via Chapa
            </div>
            <div style={{ fontFamily: 'var(--font-sans)', fontSize: '13px', color: 'var(--text-secondary)', marginTop: '6px', lineHeight: 1.6 }}>
              Payments on NovaShop are securely hosted and verified by Chapa. Sensitive payment information—such as debit/credit card numbers or mobile banking credentials—is processed directly on Chapa's PCI-DSS compliant checkout and is never stored on our servers.
            </div>
          </div>
        </div>

        {error && (
          <div style={{ background: 'rgba(217, 83, 79, 0.1)', border: '1px solid var(--color-danger)', borderRadius: '12px', padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '14px' }}>
            <span style={{ fontFamily: 'var(--font-sans)', fontSize: '13px', color: 'var(--color-danger)' }}>{error}</span>
            <button
              type="button"
              onClick={fetchPayments}
              style={{ border: '1px solid var(--color-danger)', background: 'transparent', color: 'var(--color-danger)', borderRadius: '999px', padding: '6px 14px', fontFamily: 'var(--font-sans)', fontSize: '10px', letterSpacing: '0.12em', textTransform: 'uppercase', cursor: 'pointer' }}
            >
              Retry
            </button>
          </div>
        )}

        {/* Stats Row */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '16px' }} className="ns-payment-stats">
          <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-default)', borderRadius: '14px', padding: '18px 20px' }}>
            <div style={{ fontFamily: 'var(--font-sans)', fontSize: '10px', letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>Total Transactions</div>
            <div style={{ fontFamily: 'var(--font-serif)', fontSize: '28px', color: 'var(--text-primary)', marginTop: '6px' }}>{stats.totalTransactions}</div>
          </div>
          <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-default)', borderRadius: '14px', padding: '18px 20px' }}>
            <div style={{ fontFamily: 'var(--font-sans)', fontSize: '10px', letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>Completed Payments</div>
            <div style={{ fontFamily: 'var(--font-serif)', fontSize: '28px', color: 'var(--color-success)', marginTop: '6px' }}>{stats.paidCount}</div>
          </div>
          <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-default)', borderRadius: '14px', padding: '18px 20px' }}>
            <div style={{ fontFamily: 'var(--font-sans)', fontSize: '10px', letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>Settled Total</div>
            <div style={{ fontFamily: 'var(--font-serif)', fontSize: '28px', color: 'var(--text-primary)', marginTop: '6px' }}>{formatMoney(stats.totalSpentUSD)}</div>
          </div>
        </div>

        {/* Real Payment Records Table / Cards */}
        <section>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
            <h2 style={{ margin: 0, fontFamily: 'var(--font-serif)', fontSize: '24px', color: 'var(--text-primary)', fontWeight: 500 }}>Transaction History</h2>
            <span style={{ fontFamily: 'var(--font-sans)', fontSize: '12px', color: 'var(--text-muted)' }}>{payments.length} record{payments.length === 1 ? '' : 's'}</span>
          </div>

          {loading ? (
            <div style={{ display: 'grid', gap: '14px' }}>
              <div style={{ height: '70px', background: 'var(--skeleton-base)', borderRadius: '14px', animation: 'pulse 1.5s infinite' }} />
              <div style={{ height: '70px', background: 'var(--skeleton-base)', borderRadius: '14px', animation: 'pulse 1.5s infinite' }} />
              <div style={{ height: '70px', background: 'var(--skeleton-base)', borderRadius: '14px', animation: 'pulse 1.5s infinite' }} />
            </div>
          ) : payments.length === 0 ? (
            <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-default)', borderRadius: '14px', padding: '36px 20px', textAlign: 'center' }}>
              <div style={{ fontFamily: 'var(--font-sans)', fontSize: '11px', letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '8px' }}>No Payment Records Yet</div>
              <p style={{ margin: '0 0 18px', fontFamily: 'var(--font-sans)', fontSize: '14px', color: 'var(--text-secondary)', maxWidth: '400px', marginInline: 'auto' }}>
                When you complete an order via Chapa or Cash on Delivery, your official payment receipts and references will be listed here.
              </p>
              <button
                type="button"
                onClick={() => go('/shop')}
                style={{ border: 'none', background: 'var(--color-primary)', color: 'var(--color-primary-contrast)', borderRadius: '999px', padding: '12px 22px', fontFamily: 'var(--font-sans)', fontSize: '10px', letterSpacing: '0.14em', textTransform: 'uppercase', cursor: 'pointer' }}
              >
                Browse Catalog
              </button>
            </div>
          ) : (
            <div style={{ display: 'grid', gap: '12px' }}>
              {payments.map((p) => {
                const badge = getStatusBadge(p.status);
                return (
                  <div
                    key={p.id}
                    className="ns-payment-card"
                    style={{
                      background: 'var(--bg-surface)',
                      border: '1px solid var(--border-default)',
                      borderRadius: '14px',
                      padding: '18px 20px',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      gap: '16px',
                      flexWrap: 'wrap',
                    }}
                  >
                    <div style={{ display: 'grid', gap: '4px', minWidth: '220px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <span style={{ fontFamily: 'var(--font-sans)', fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)' }}>
                          Ref: {p.txRef || 'NS-TX'}
                        </span>
                        <span
                          style={{
                            background: badge.bg,
                            border: `1px solid ${badge.border}`,
                            color: badge.color,
                            borderRadius: '999px',
                            padding: '3px 9px',
                            fontFamily: 'var(--font-sans)',
                            fontSize: '9px',
                            letterSpacing: '0.12em',
                            textTransform: 'uppercase',
                            fontWeight: 700,
                          }}
                        >
                          {badge.label}
                        </span>
                      </div>
                      <div style={{ fontFamily: 'var(--font-sans)', fontSize: '12px', color: 'var(--text-secondary)' }}>
                        Order #{p.orderNumber} · Method: {p.paymentMethod || 'Chapa'}
                      </div>
                      <div style={{ fontFamily: 'var(--font-sans)', fontSize: '11px', color: 'var(--text-muted)' }}>
                        {formatDate(p.date || p.createdAt)}
                      </div>
                    </div>

                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontFamily: 'var(--font-serif)', fontSize: '20px', fontWeight: 600, color: 'var(--text-primary)' }}>
                        {formatMoney(p.amount)}
                      </div>
                      {p.amountETB && (
                        <div style={{ fontFamily: 'var(--font-sans)', fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                          ~{Number(p.amountETB).toLocaleString()} ETB
                        </div>
                      )}
                    </div>

                    <div>
                      <button
                        type="button"
                        onClick={() => go(p.orderLink || `/account/orders/${p.orderId}`)}
                        style={{
                          border: '1px solid var(--border-default)',
                          background: 'var(--bg-surface-raised)',
                          color: 'var(--text-primary)',
                          borderRadius: '999px',
                          minHeight: '44px',
                          padding: '11px 18px',
                          fontFamily: 'var(--font-sans)',
                          fontSize: '10px',
                          letterSpacing: '0.14em',
                          textTransform: 'uppercase',
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        View Receipt →
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
        @media (max-width: 767px) {
          .ns-payment-stats {
            grid-template-columns: 1fr !important;
          }
        }
        @media (max-width: 639px) {
          .ns-payment-card {
            flex-direction: column !important;
            align-items: flex-start !important;
            gap: 14px !important;
          }
          .ns-payment-card > div:nth-child(2) {
            text-align: left !important;
          }
        }
      `}</style>
    </AccountLayout>
  );
}
