import { useEffect, useMemo, useState, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { userApi } from '../lib/api/userApi';

const accountNav = [
  { key: 'overview', label: 'Overview', path: '/account' },
  { key: 'orders', label: 'Orders', path: '/account/orders' },
  { key: 'wishlist', label: 'Wishlist', path: '/account/wishlist' },
  { key: 'addresses', label: 'Addresses', path: '/account/addresses' },
  { key: 'payments', label: 'Payments', path: '/account/payments' },
  { key: 'profile', label: 'Profile', path: '/account/profile' },
  { key: 'settings', label: 'Settings', path: '/account/settings' },
];

function getStatusMeta(status) {
  const normalized = String(status || '').toLowerCase().replace(/\s+/g, '-');
  const map = {
    processing: { label: 'Processing', chip: 'rgba(212, 166, 98, 0.15)', color: 'var(--color-warning)', border: 'rgba(212, 166, 98, 0.35)' },
    confirmed: { label: 'Confirmed', chip: 'rgba(128, 128, 128, 0.12)', color: 'var(--text-secondary)', border: 'var(--border-subtle)' },
    'in-transit': { label: 'In Transit', chip: 'rgba(212, 166, 98, 0.15)', color: 'var(--color-warning)', border: 'rgba(212, 166, 98, 0.35)' },
    delivered: { label: 'Delivered', chip: 'rgba(46, 125, 50, 0.15)', color: 'var(--color-success)', border: 'rgba(46, 125, 50, 0.35)' },
    cancelled: { label: 'Cancelled', chip: 'rgba(217, 83, 79, 0.15)', color: 'var(--color-danger)', border: 'rgba(217, 83, 79, 0.35)' },
    shipped: { label: 'Shipped', chip: 'rgba(212, 166, 98, 0.15)', color: 'var(--color-warning)', border: 'rgba(212, 166, 98, 0.35)' },
    placed: { label: 'Processing', chip: 'rgba(212, 166, 98, 0.15)', color: 'var(--color-warning)', border: 'rgba(212, 166, 98, 0.35)' },
    pending: { label: 'Pending Payment', chip: 'rgba(212, 166, 98, 0.15)', color: 'var(--color-warning)', border: 'rgba(212, 166, 98, 0.35)' },
  };

  return map[normalized] || {
    label: status ? String(status).toUpperCase() : 'Confirmed',
    chip: 'rgba(128, 128, 128, 0.12)',
    color: 'var(--text-secondary)',
    border: 'var(--border-subtle)',
  };
}

function getInitials(fullName) {
  return (fullName || 'U')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('') || 'U';
}

function formatMoney(value) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(Number(value || 0));
}

function AccountOverviewPage({ go, currentPath }) {
  const { user, isLoading: authLoading, logout } = useAuth();
  const [overview, setOverview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchOverview = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await userApi.getOverview();
      if (res.success && res.data) {
        setOverview(res.data);
      } else {
        throw new Error(res.message || 'Unable to load account overview');
      }
    } catch (err) {
      if (err.status === 401 || err.response?.status === 401) {
        sessionStorage.setItem('novashop_redirect_after_login', '/account');
        go('/login');
        return;
      }
      setError(err.response?.data?.message || err.message || 'Failed to fetch account overview.');
    } finally {
      setLoading(false);
    }
  }, [go]);

  useEffect(() => {
    if (!authLoading && !user) {
      sessionStorage.setItem('novashop_redirect_after_login', '/account');
      go('/login');
      return;
    }

    if (user) {
      fetchOverview();
    }
  }, [user, authLoading, go, fetchOverview]);

  const activeKey = useMemo(() => {
    if (currentPath === '/account' || currentPath === '/account/') return 'overview';
    if (currentPath.startsWith('/account/orders')) return 'orders';
    if (currentPath.startsWith('/account/wishlist')) return 'wishlist';
    if (currentPath.startsWith('/account/addresses')) return 'addresses';
    if (currentPath.startsWith('/account/payments')) return 'payments';
    if (currentPath.startsWith('/account/profile')) return 'profile';
    if (currentPath.startsWith('/account/settings')) return 'settings';
    return 'overview';
  }, [currentPath]);

  const profileName = overview?.user?.name || user?.name || 'Customer';
  const greeting = overview?.user?.firstName || user?.name?.split(' ')[0] || 'Customer';
  const memberSince = overview?.user?.memberSince
    ? new Date(overview.user.memberSince).getFullYear()
    : user?.createdAt
    ? new Date(user.createdAt).getFullYear()
    : new Date().getFullYear();
  const defaultAddress = overview?.defaultAddress;
  const recentOrders = overview?.recentOrders || [];
  const stats = overview?.stats || { totalOrders: 0, ordersInProgress: 0, totalSpent: 0, wishlistCount: 0 };

  const handleNavAction = (item) => {
    go(item.path);
  };

  const handleSignOut = async () => {
    await logout();
    go('/');
  };

  const quickLinkCards = [
    { key: 'orders', title: 'Orders', subtext: `${stats.totalOrders} total · ${stats.ordersInProgress} in progress`, href: '/account/orders', action: () => go('/account/orders') },
    { key: 'wishlist', title: 'Wishlist', subtext: `${stats.wishlistCount} saved piece${stats.wishlistCount === 1 ? '' : 's'}`, href: '/account/wishlist', action: () => go('/account/wishlist') },
    { key: 'addresses', title: 'Addresses', subtext: defaultAddress ? `${defaultAddress.city || 'Default'}, ${defaultAddress.country || 'Ethiopia'}` : 'Manage delivery addresses', href: '/account/addresses', action: () => go('/account/addresses') },
  ];

  if (authLoading) {
    return (
      <div style={{ background: 'var(--bg-main)', minHeight: '100vh', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
        <p style={{ fontFamily: 'var(--font-sans)', fontSize: '13px', color: 'var(--text-muted)', letterSpacing: '0.12em', textTransform: 'uppercase' }}>Loading Account...</p>
      </div>
    );
  }

  if (!user) return null;

  return (
    <div style={{ background: 'var(--bg-main)', minHeight: '100vh', color: 'var(--text-primary)' }} className="ns-account-shell">
      <div style={{ maxWidth: '1280px', margin: '0 auto', padding: '32px 40px 52px' }}>
        <div style={{ marginBottom: '16px', fontFamily: 'var(--font-sans)', fontSize: '11px', letterSpacing: '0.16em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>
          <button type="button" onClick={() => go('/')} style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: 'var(--text-muted)', fontFamily: 'inherit', letterSpacing: 'inherit', textTransform: 'inherit' }}>Home</button>
          <span style={{ margin: '0 10px', color: 'var(--text-subtle)' }}>/</span>
          <span style={{ color: 'var(--text-primary)' }}>Account</span>
        </div>

        <div style={{ display: 'flex', alignItems: 'end', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px', marginBottom: '14px' }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '14px', flexWrap: 'wrap' }}>
            <h1 style={{ margin: 0, fontFamily: 'var(--font-serif)', fontSize: 'clamp(32px, 3vw, 52px)', letterSpacing: '-0.04em', fontWeight: 500, color: 'var(--text-primary)', lineHeight: 1.05 }}>My Account</h1>
            <span style={{ fontFamily: 'var(--font-serif)', fontSize: 'clamp(16px, 2vw, 24px)', fontStyle: 'italic', color: 'var(--text-muted)', fontWeight: 400 }}>Welcome back, {greeting}</span>
          </div>
        </div>

        <p style={{ margin: '0 0 18px', fontFamily: 'var(--font-sans)', fontSize: '14px', color: 'var(--text-secondary)', lineHeight: 1.7 }}>
          Authoritative dashboard for your purchases, preferences, delivery addresses, and account details.
        </p>

        <div style={{ height: '1px', width: '100%', background: 'var(--border-subtle)', marginBottom: '28px' }} />

        <div className="ns-account-grid" style={{ display: 'grid', gridTemplateColumns: '220px minmax(0, 1fr)', gap: '36px', alignItems: 'start' }}>
          <aside style={{ paddingTop: '4px' }}>
            <div style={{ fontFamily: 'var(--font-sans)', fontSize: '10px', letterSpacing: '0.16em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '14px' }}>
              Account
            </div>

            <nav style={{ display: 'grid', gap: '4px' }}>
              {accountNav.map((item) => {
                const isActive = activeKey === item.key;
                return (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => handleNavAction(item)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      width: '100%',
                      textAlign: 'left',
                      border: 'none',
                      background: isActive ? 'var(--bg-surface-raised)' : 'transparent',
                      borderLeft: isActive ? '2px solid var(--color-primary)' : '2px solid transparent',
                      padding: '12px 12px 12px 14px',
                      cursor: 'pointer',
                      color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)',
                      transition: 'background 180ms ease, color 180ms ease',
                      fontFamily: 'var(--font-sans)',
                      fontSize: '13px',
                      letterSpacing: '0.01em',
                      fontWeight: isActive ? 600 : 500,
                    }}
                  >
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </nav>

            <div style={{ marginTop: '28px', paddingTop: '18px', borderTop: '1px solid var(--border-subtle)' }}>
              <button
                type="button"
                onClick={handleSignOut}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '10px',
                  background: 'none',
                  border: 'none',
                  padding: 0,
                  cursor: 'pointer',
                  color: 'var(--text-secondary)',
                  fontFamily: 'var(--font-sans)',
                  fontSize: '12px',
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                }}
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                  <path d="M16 17l5-5-5-5" />
                  <path d="M21 12H9" />
                </svg>
                Sign out
              </button>
            </div>
          </aside>

          <main style={{ display: 'grid', gap: '26px' }}>
            {error && (
              <div style={{ background: 'rgba(217, 83, 79, 0.1)', border: '1px solid var(--color-danger)', borderRadius: '12px', padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '14px' }}>
                <span style={{ fontFamily: 'var(--font-sans)', fontSize: '13px', color: 'var(--color-danger)' }}>{error}</span>
                <button
                  type="button"
                  onClick={fetchOverview}
                  style={{ border: '1px solid var(--color-danger)', background: 'transparent', color: 'var(--color-danger)', borderRadius: '999px', padding: '6px 14px', fontFamily: 'var(--font-sans)', fontSize: '10px', letterSpacing: '0.12em', textTransform: 'uppercase', cursor: 'pointer' }}
                >
                  Retry
                </button>
              </div>
            )}

            {loading ? (
              <div style={{ display: 'grid', gap: '20px' }}>
                <div style={{ height: '100px', background: 'var(--skeleton-base)', borderRadius: '14px', animation: 'pulse 1.5s infinite' }} />
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
                  <div style={{ height: '110px', background: 'var(--skeleton-base)', borderRadius: '14px' }} />
                  <div style={{ height: '110px', background: 'var(--skeleton-base)', borderRadius: '14px' }} />
                  <div style={{ height: '110px', background: 'var(--skeleton-base)', borderRadius: '14px' }} />
                </div>
                <div style={{ height: '180px', background: 'var(--skeleton-base)', borderRadius: '14px' }} />
              </div>
            ) : (
              <>
                {/* Profile Banner */}
                <section style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-default)', borderRadius: '14px', padding: '22px 22px 18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '18px', flexWrap: 'wrap' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '18px' }}>
                    <div style={{ width: '62px', height: '62px', borderRadius: '50%', background: 'var(--bg-surface-sunken)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-serif)', fontSize: '24px', color: 'var(--text-primary)', overflow: 'hidden' }}>
                      {overview?.user?.avatar ? (
                        <img src={overview.user.avatar} alt={profileName} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      ) : (
                        getInitials(profileName)
                      )}
                    </div>
                    <div>
                      <div style={{ fontFamily: 'var(--font-serif)', fontSize: '26px', fontWeight: 500, color: 'var(--text-primary)', lineHeight: 1.1 }}>{profileName}</div>
                      <div style={{ fontFamily: 'var(--font-sans)', fontSize: '13px', color: 'var(--text-secondary)', marginTop: '4px' }}>{overview?.user?.email || user.email}</div>
                      <div style={{ fontFamily: 'var(--font-sans)', fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>Member since {memberSince}</div>
                    </div>
                  </div>

                  <button type="button" onClick={() => go('/account/profile/edit')} style={{ border: '1px solid var(--border-default)', background: 'transparent', color: 'var(--text-primary)', borderRadius: '999px', padding: '11px 18px', fontFamily: 'var(--font-sans)', fontSize: '10px', letterSpacing: '0.15em', textTransform: 'uppercase', cursor: 'pointer' }}>
                    Edit Profile
                  </button>
                </section>

                {/* Live Stats Row */}
                <section style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: '14px' }} className="ns-stats-grid">
                  <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-default)', borderRadius: '14px', padding: '16px 18px' }}>
                    <div style={{ fontFamily: 'var(--font-sans)', fontSize: '10px', letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>Total Orders</div>
                    <div style={{ fontFamily: 'var(--font-serif)', fontSize: '28px', color: 'var(--text-primary)', marginTop: '6px' }}>{stats.totalOrders}</div>
                  </div>
                  <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-default)', borderRadius: '14px', padding: '16px 18px' }}>
                    <div style={{ fontFamily: 'var(--font-sans)', fontSize: '10px', letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>In Progress</div>
                    <div style={{ fontFamily: 'var(--font-serif)', fontSize: '28px', color: 'var(--color-warning)', marginTop: '6px' }}>{stats.ordersInProgress}</div>
                  </div>
                  <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-default)', borderRadius: '14px', padding: '16px 18px' }}>
                    <div style={{ fontFamily: 'var(--font-sans)', fontSize: '10px', letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>Total Spent</div>
                    <div style={{ fontFamily: 'var(--font-serif)', fontSize: '28px', color: 'var(--text-primary)', marginTop: '6px' }}>{formatMoney(stats.totalSpent)}</div>
                  </div>
                  <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-default)', borderRadius: '14px', padding: '16px 18px' }}>
                    <div style={{ fontFamily: 'var(--font-sans)', fontSize: '10px', letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>Wishlist</div>
                    <div style={{ fontFamily: 'var(--font-serif)', fontSize: '28px', color: 'var(--text-primary)', marginTop: '6px' }}>{stats.wishlistCount}</div>
                  </div>
                </section>

                {/* Quick Link Cards */}
                <section style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '16px' }} className="ns-quick-links">
                  {quickLinkCards.map((card) => (
                    <button
                      key={card.key}
                      type="button"
                      onClick={card.action}
                      style={{
                        width: '100%',
                        background: 'var(--bg-surface)',
                        border: '1px solid var(--border-default)',
                        borderRadius: '14px',
                        textAlign: 'left',
                        padding: '18px 18px 16px',
                        cursor: 'pointer',
                        color: 'var(--text-primary)',
                        display: 'grid',
                        gap: '12px',
                      }}
                    >
                      <div style={{ fontFamily: 'var(--font-serif)', fontSize: '22px', color: 'var(--text-primary)', lineHeight: 1.1 }}>{card.title}</div>
                      <div style={{ fontFamily: 'var(--font-sans)', fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>{card.subtext}</div>
                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontFamily: 'var(--font-sans)', fontSize: '10px', letterSpacing: '0.15em', textTransform: 'uppercase', color: 'var(--text-primary)' }}>
                        <span>Go to {card.title}</span>
                        <span style={{ transition: 'transform 180ms ease' }}>→</span>
                      </div>
                    </button>
                  ))}
                </section>

                {/* Recent Orders */}
                <section>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap', marginBottom: '14px' }}>
                    <h2 style={{ margin: 0, fontFamily: 'var(--font-serif)', fontSize: '30px', color: 'var(--text-primary)', fontWeight: 500 }}>Recent Orders</h2>
                    <button type="button" onClick={() => go('/account/orders')} style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: 'var(--text-primary)', fontFamily: 'var(--font-sans)', fontSize: '10px', letterSpacing: '0.16em', textTransform: 'uppercase' }}>
                      View All Orders ({stats.totalOrders}) →
                    </button>
                  </div>

                  <div style={{ height: '1px', width: '100%', background: 'var(--border-subtle)', marginBottom: '16px' }} />

                  {recentOrders.length === 0 ? (
                    <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-default)', borderRadius: '14px', padding: '28px 20px', textAlign: 'center' }}>
                      <div style={{ fontFamily: 'var(--font-sans)', fontSize: '11px', letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '8px' }}>No orders yet.</div>
                      <button type="button" onClick={() => go('/shop')} style={{ border: 'none', background: 'var(--color-primary)', color: 'var(--color-primary-contrast)', borderRadius: '999px', padding: '12px 20px', fontFamily: 'var(--font-sans)', fontSize: '10px', letterSpacing: '0.14em', textTransform: 'uppercase', cursor: 'pointer' }}>
                        Start Shopping
                      </button>
                    </div>
                  ) : (
                    <div style={{ display: 'grid', gap: '14px' }}>
                      {recentOrders.map((order) => {
                        const statusMeta = getStatusMeta(order.status);
                        const items = order.orderItems || [];
                        const firstItem = items[0];
                        const totalQty = items.reduce((sum, it) => sum + (Number(it.qty) || 1), 0);
                        const otherItemsCount = Math.max(totalQty - (Number(firstItem?.qty) || 1), 0);
                        const orderId = order.orderNumber || order._id;
                        const productName = firstItem?.name || firstItem?.product?.name || 'NovaShop Item';
                        const thumb = firstItem?.image || firstItem?.product?.images?.[0] || 'https://images.unsplash.com/photo-1529139574466-a303027c1d8b?auto=format&fit=crop&w=500&q=80';
                        const orderDate = new Date(order.createdAt || Date.now());

                        return (
                          <div key={order._id} style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-default)', borderRadius: '14px', padding: '18px 20px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap', marginBottom: '12px' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', fontFamily: 'var(--font-sans)', fontSize: '12px', color: 'var(--text-secondary)' }}>
                                <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>#{orderId}</span>
                                <span>·</span>
                                <span>{new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(orderDate)}</span>
                                <span>·</span>
                                <span>{formatMoney(order.totalPrice)}</span>
                              </div>

                              <span style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '7px',
                                borderRadius: '999px',
                                background: statusMeta.chip,
                                border: `1px solid ${statusMeta.border}`,
                                color: statusMeta.color,
                                padding: '6px 10px',
                                fontFamily: 'var(--font-sans)',
                                fontSize: '9px',
                                letterSpacing: '0.12em',
                                textTransform: 'uppercase',
                                fontWeight: 700,
                              }}>
                                <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: statusMeta.color, display: 'inline-block' }} />
                                {statusMeta.label}
                              </span>
                            </div>

                            <div style={{ height: '1px', width: '100%', background: 'var(--border-subtle)', marginBottom: '12px' }} />

                            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '16px', alignItems: 'center', flexWrap: 'wrap' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '14px', minWidth: 0, flex: 1 }}>
                                <img src={thumb} alt={productName} style={{ width: '42px', height: '42px', objectFit: 'cover', borderRadius: '8px', background: 'var(--bg-surface-sunken)' }} />
                                <div style={{ minWidth: 0 }}>
                                  <div style={{ fontFamily: 'var(--font-sans)', fontSize: '13px', color: 'var(--text-primary)', fontWeight: 600, lineHeight: 1.3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{productName}</div>
                                  {otherItemsCount > 0 && (
                                    <div style={{ fontFamily: 'var(--font-sans)', fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>+ {otherItemsCount} more piece{otherItemsCount === 1 ? '' : 's'}</div>
                                  )}
                                </div>
                              </div>

                              <button type="button" onClick={() => go(`/account/orders/${order._id}`)} style={{ border: '1px solid var(--border-default)', background: 'transparent', color: 'var(--text-primary)', borderRadius: '999px', padding: '10px 14px', fontFamily: 'var(--font-sans)', fontSize: '10px', letterSpacing: '0.14em', textTransform: 'uppercase', cursor: 'pointer' }}>
                                View Order →
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </section>

                {/* Default Address & Wishlist Snippet */}
                <div style={{ display: 'grid', gridTemplateColumns: '1.05fr 0.95fr', gap: '18px' }} className="ns-bottom-cards">
                  <section style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-default)', borderRadius: '14px', padding: '18px 18px 14px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', marginBottom: '12px', fontFamily: 'var(--font-sans)', fontSize: '10px', letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>
                      <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>Default Shipping Address</span>
                      {defaultAddress && <span style={{ color: 'var(--color-success)', fontWeight: 700 }}>● Default</span>}
                    </div>

                    <div style={{ height: '1px', width: '100%', background: 'var(--border-subtle)', marginBottom: '12px' }} />

                    {defaultAddress ? (
                      <div style={{ fontFamily: 'var(--font-sans)', fontSize: '14px', color: 'var(--text-primary)', lineHeight: 1.8 }}>
                        <div style={{ fontWeight: 700 }}>{defaultAddress.firstName} {defaultAddress.lastName} ({defaultAddress.label || 'Home'})</div>
                        <div style={{ color: 'var(--text-secondary)' }}>{defaultAddress.street}</div>
                        {defaultAddress.street2 && <div style={{ color: 'var(--text-secondary)' }}>{defaultAddress.street2}</div>}
                        <div style={{ color: 'var(--text-secondary)' }}>{defaultAddress.city}, {defaultAddress.state || defaultAddress.city} {defaultAddress.postalCode}</div>
                        <div style={{ color: 'var(--text-secondary)' }}>{defaultAddress.country} · {defaultAddress.phone}</div>
                      </div>
                    ) : (
                      <div style={{ fontFamily: 'var(--font-sans)', fontSize: '13px', color: 'var(--text-secondary)', padding: '6px 0 6px' }}>No default delivery address saved yet.</div>
                    )}

                    <div style={{ marginTop: '16px' }}>
                      <button type="button" onClick={() => go('/account/addresses')} style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: 'var(--text-primary)', fontFamily: 'var(--font-sans)', fontSize: '10px', letterSpacing: '0.14em', textTransform: 'uppercase' }}>
                        {defaultAddress ? 'Manage Saved Addresses →' : '+ Add Address →'}
                      </button>
                    </div>
                  </section>

                  <section style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-default)', borderRadius: '14px', padding: '18px 18px 14px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', marginBottom: '12px', fontFamily: 'var(--font-sans)', fontSize: '10px', letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>
                      <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>Wishlist Pieces</span>
                      <span>{stats.wishlistCount} saved</span>
                    </div>

                    <div style={{ height: '1px', width: '100%', background: 'var(--border-subtle)', marginBottom: '14px' }} />

                    {stats.wishlistCount === 0 ? (
                      <div style={{ fontFamily: 'var(--font-sans)', fontSize: '13px', color: 'var(--text-secondary)', padding: '6px 0 4px' }}>Nothing saved yet. Explore the latest collections.</div>
                    ) : (
                      <div style={{ fontFamily: 'var(--font-sans)', fontSize: '13px', color: 'var(--text-primary)', padding: '6px 0 4px' }}>
                        You have {stats.wishlistCount} curated piece{stats.wishlistCount === 1 ? '' : 's'} in your personal wishlist.
                      </div>
                    )}

                    <div style={{ marginTop: '16px' }}>
                      <button type="button" onClick={() => go('/account/wishlist')} style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: 'var(--text-primary)', fontFamily: 'var(--font-sans)', fontSize: '10px', letterSpacing: '0.14em', textTransform: 'uppercase' }}>
                        Open Wishlist →
                      </button>
                    </div>
                  </section>
                </div>
              </>
            )}
          </main>
        </div>
      </div>

      <style>{`
        .ns-account-shell * { box-sizing: border-box; }
        .ns-account-shell {
          animation: nsFadeIn 200ms ease;
        }
        .ns-account-shell button:hover {
          opacity: 1;
        }
        .ns-account-shell .ns-quick-links button:hover {
          border-color: rgba(27, 24, 22, 0.2);
          transform: translateY(-1px);
          transition: border-color 180ms ease, transform 180ms ease;
        }
        .ns-account-shell .ns-quick-links button:hover span:last-child {
          transform: translateX(3px);
        }
        @keyframes nsFadeIn {
          from { opacity: 0; transform: translateY(4px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
        @media (max-width: 1023px) {
          .ns-account-shell .ns-account-grid {
            grid-template-columns: 1fr !important;
          }
          .ns-account-shell .ns-quick-links {
            grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
          }
          .ns-account-shell .ns-stats-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
          }
          .ns-account-shell .ns-bottom-cards {
            grid-template-columns: 1fr !important;
          }
        }
        @media (max-width: 767px) {
          .ns-account-shell > div {
            padding-left: 16px !important;
            padding-right: 16px !important;
            padding-bottom: calc(52px + env(safe-area-inset-bottom, 0px)) !important;
          }
          .ns-account-shell .ns-stats-grid {
            grid-template-columns: 1fr !important;
          }
          .ns-account-shell .ns-quick-links {
            grid-template-columns: 1fr !important;
          }
          .ns-account-shell main {
            gap: 18px !important;
          }
          .ns-account-shell aside {
            margin-bottom: 18px;
          }
          .ns-account-shell nav {
            display: flex !important;
            overflow-x: auto !important;
            -webkit-overflow-scrolling: touch !important;
            gap: 8px !important;
            padding-bottom: 8px !important;
          }
          .ns-account-shell nav button {
            white-space: nowrap !important;
            min-width: max-content !important;
            min-height: 44px !important;
            display: inline-flex !important;
            align-items: center !important;
            border-left: none !important;
            border-bottom: 2px solid transparent !important;
            border-radius: 12px;
            background: transparent;
            padding: 10px 16px !important;
          }
        }
      `}</style>
    </div>
  );
}

export default AccountOverviewPage;
