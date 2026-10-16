import { useEffect, useMemo, useState } from 'react';
import { useCart } from '../context/CartContext';

const DEFAULT_ADDRESS_KEY = 'novashop_default_address';

const accountNav = [
  { key: 'overview', label: 'Overview', path: '/account' },
  { key: 'orders', label: 'Orders', path: '/account/orders' },
  { key: 'wishlist', label: 'Wishlist', path: '/account/wishlist' },
  { key: 'addresses', label: 'Addresses', path: '/account/addresses' },
  { key: 'payments', label: 'Payments', path: '/account/payments' },
  { key: 'profile', label: 'Profile', path: '/account/profile' },
  { key: 'settings', label: 'Settings', path: '/account/settings' },
];

import { useAuth } from '../context/AuthContext';

function getStatusMeta(status) {
  const normalized = String(status || '').toLowerCase().replace(/\s+/g, '-');
  const map = {
    processing: { label: 'Processing', tone: 'amber', chip: 'rgba(196, 142, 74, 0.12)', color: '#9A6A2D', border: 'rgba(196, 142, 74, 0.32)' },
    confirmed: { label: 'Confirmed', tone: 'slate', chip: 'rgba(81, 85, 93, 0.10)', color: '#444A52', border: 'rgba(81, 85, 93, 0.20)' },
    'in-transit': { label: 'In Transit', tone: 'amber', chip: 'rgba(196, 142, 74, 0.12)', color: '#9A6A2D', border: 'rgba(196, 142, 74, 0.32)' },
    delivered: { label: 'Delivered', tone: 'green', chip: 'rgba(44, 105, 77, 0.10)', color: '#2A644D', border: 'rgba(44, 105, 77, 0.20)' },
    cancelled: { label: 'Cancelled', tone: 'red', chip: 'rgba(120, 68, 59, 0.10)', color: '#7E423E', border: 'rgba(120, 68, 59, 0.20)' },
    shipped: { label: 'Shipped', tone: 'amber', chip: 'rgba(196, 142, 74, 0.12)', color: '#9A6A2D', border: 'rgba(196, 142, 74, 0.32)' },
    placed: { label: 'Processing', tone: 'amber', chip: 'rgba(196, 142, 74, 0.12)', color: '#9A6A2D', border: 'rgba(196, 142, 74, 0.32)' },
  };

  return map[normalized] || {
    label: 'Confirmed',
    tone: 'slate',
    chip: 'rgba(81, 85, 93, 0.10)',
    color: '#444A52',
    border: 'rgba(81, 85, 93, 0.20)',
  };
}

function getSavedAddress(profileName) {
  try {
    const stored = localStorage.getItem(DEFAULT_ADDRESS_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (parsed && typeof parsed === 'object') return parsed;
    }
  } catch (error) {
    console.warn('Unable to load saved address', error);
  }

  return {
    fullName: profileName || 'Firaol Siraj',
    street: 'Bole Sub-City',
    street2: 'Bole Road, House 14',
    city: 'Addis Ababa',
    country: 'Ethiopia',
    postalCode: '1000',
  };
}

function getInitials(fullName) {
  return (fullName || 'FS')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('') || 'FS';
}

function formatMoney(value) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(Number(value || 0));
}

function AccountOverviewPage({ go, currentPath }) {
  const { orders, wishlistItems } = useCart();
  const { user, logout } = useAuth();
  
  const formattedUser = useMemo(() => {
    if (!user) return null;
    const firstName = user.name ? user.name.split(' ')[0] : 'Firaol';
    const fullName = user.name || 'Firaol Siraj';
    return {
      firstName,
      fullName,
      email: user.email,
      memberSince: user.createdAt || new Date(2026, 0, 1),
    };
  }, [user]);

  const activeKey = useMemo(() => {
    if (currentPath === '/account' || currentPath === '/account/') return 'overview';
    if (currentPath.startsWith('/account/orders')) return 'orders';
    if (currentPath.startsWith('/account/wishlist')) return 'wishlist';
    if (currentPath.startsWith('/account/addresses')) return 'addresses';
    if (currentPath.startsWith('/account/profile')) return 'profile';
    if (currentPath.startsWith('/account/settings')) return 'settings';
    return 'overview';
  }, [currentPath]);

  const recentOrders = useMemo(() => {
    return [...(orders || [])]
      .sort((a, b) => new Date(b.createdAt || b.placedAt || 0) - new Date(a.createdAt || a.placedAt || 0))
      .slice(0, 2);
  }, [orders]);

  const profileName = formattedUser?.fullName || 'Firaol Siraj';
  const defaultAddress = getSavedAddress(profileName);
  const greeting = formattedUser?.firstName || 'Firaol';
  const memberSince = formattedUser?.memberSince ? new Date(formattedUser.memberSince).getFullYear() : 2026;

  const handleNavAction = (item) => {
    if (item.key === 'wishlist') {
      go('/account/wishlist');
      return;
    }
    go(item.path);
  };

  const handleSignOut = () => {
    logout();
    go('/');
  };

  const quickLinkCards = [
    { key: 'orders', title: 'Orders', subtext: 'View and track your purchases', href: '/account/orders', action: () => go('/account/orders') },
    { key: 'wishlist', title: 'Wishlist', subtext: 'Your saved pieces', href: '/account/wishlist', action: () => go('/account/wishlist') },
    { key: 'addresses', title: 'Addresses', subtext: 'Manage delivery addresses', href: '/account/addresses', action: () => go('/account/addresses') },
  ];

  if (!user) return null;

  return (
    <div style={{ background: '#F6F1EA', minHeight: '100vh', color: '#1B1816' }} className="ns-account-shell">
      <div style={{ maxWidth: '1280px', margin: '0 auto', padding: '32px 40px 52px' }}>
        <div style={{ marginBottom: '16px', fontFamily: 'var(--font-sans)', fontSize: '11px', letterSpacing: '0.16em', textTransform: 'uppercase', color: '#7A726C' }}>
          <button type="button" onClick={() => go('/')} style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: '#7A726C', fontFamily: 'inherit', letterSpacing: 'inherit', textTransform: 'inherit' }}>Home</button>
          <span style={{ margin: '0 10px', color: '#B9B1AB' }}>/</span>
          <span style={{ color: '#1B1816' }}>Account</span>
        </div>

        <div style={{ display: 'flex', alignItems: 'end', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px', marginBottom: '14px' }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '14px', flexWrap: 'wrap' }}>
            <h1 style={{ margin: 0, fontFamily: 'var(--font-serif)', fontSize: 'clamp(32px, 3vw, 52px)', letterSpacing: '-0.04em', fontWeight: 500, color: '#1B1816', lineHeight: 1.05 }}>My Account</h1>
            <span style={{ fontFamily: 'var(--font-serif)', fontSize: 'clamp(16px, 2vw, 24px)', fontStyle: 'italic', color: '#7A726C', fontWeight: 400 }}>Welcome back, {greeting}</span>
          </div>
        </div>

        <p style={{ margin: '0 0 18px', fontFamily: 'var(--font-sans)', fontSize: '14px', color: '#6E6962', lineHeight: 1.7 }}>
          Manage your orders, saved pieces, addresses, and account details.
        </p>

        <div style={{ height: '1px', width: '100%', background: 'rgba(27,24,22,0.12)', marginBottom: '28px' }} />

        <div style={{ display: 'grid', gridTemplateColumns: '220px minmax(0, 1fr)', gap: '36px', alignItems: 'start' }}>
          <aside style={{ paddingTop: '4px' }}>
            <div style={{ fontFamily: 'var(--font-sans)', fontSize: '10px', letterSpacing: '0.16em', textTransform: 'uppercase', color: '#7A726C', marginBottom: '14px' }}>
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
                      background: isActive ? '#F0E8DE' : 'transparent',
                      borderLeft: isActive ? '2px solid #1B1816' : '2px solid transparent',
                      padding: '12px 12px 12px 14px',
                      cursor: 'pointer',
                      color: isActive ? '#1B1816' : '#6E6962',
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

            <div style={{ marginTop: '28px', paddingTop: '18px', borderTop: '1px solid rgba(27,24,22,0.1)' }}>
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
                  color: '#6E6962',
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
            <section style={{ background: '#F7F2EA', border: '1px solid rgba(27,24,22,0.12)', borderRadius: '14px', padding: '22px 22px 18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '18px', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '18px' }}>
                <div style={{ width: '62px', height: '62px', borderRadius: '50%', background: '#EFE5DA', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-serif)', fontSize: '24px', color: '#1B1816' }}>
                  {getInitials(profileName)}
                </div>
                <div>
                  <div style={{ fontFamily: 'var(--font-serif)', fontSize: '26px', fontWeight: 500, color: '#1B1816', lineHeight: 1.1 }}>{profileName}</div>
                  <div style={{ fontFamily: 'var(--font-sans)', fontSize: '13px', color: '#6E6962', marginTop: '4px' }}>{formattedUser.email}</div>
                  <div style={{ fontFamily: 'var(--font-sans)', fontSize: '11px', color: '#9B9189', marginTop: '2px' }}>Member since {memberSince}</div>
                </div>
              </div>

              <button type="button" onClick={() => go('/account/profile/edit')} style={{ border: '1px solid #1B1816', background: 'transparent', color: '#1B1816', borderRadius: '999px', padding: '11px 18px', fontFamily: 'var(--font-sans)', fontSize: '10px', letterSpacing: '0.15em', textTransform: 'uppercase', cursor: 'pointer' }}>
                Edit Profile
              </button>
            </section>

            <section style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '16px' }} className="ns-quick-links">
              {quickLinkCards.map((card) => (
                <button
                  key={card.key}
                  type="button"
                  onClick={card.action}
                  style={{
                    width: '100%',
                    background: '#F7F2EA',
                    border: '1px solid rgba(27,24,22,0.12)',
                    borderRadius: '14px',
                    textAlign: 'left',
                    padding: '18px 18px 16px',
                    cursor: 'pointer',
                    color: '#1B1816',
                    display: 'grid',
                    gap: '12px',
                  }}
                >
                  <div style={{ fontFamily: 'var(--font-serif)', fontSize: '22px', color: '#1B1816', lineHeight: 1.1 }}>{card.title}</div>
                  <div style={{ fontFamily: 'var(--font-sans)', fontSize: '13px', color: '#6E6962', lineHeight: 1.5 }}>{card.subtext}</div>
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontFamily: 'var(--font-sans)', fontSize: '10px', letterSpacing: '0.15em', textTransform: 'uppercase', color: '#1B1816' }}>
                    {card.key === 'wishlist' ? 'View Wishlist' : card.key === 'orders' ? 'View Orders' : 'Manage Addresses'}
                    <span style={{ transition: 'transform 180ms ease' }}>→</span>
                  </div>
                </button>
              ))}
            </section>

            <section>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap', marginBottom: '14px' }}>
                <h2 style={{ margin: 0, fontFamily: 'var(--font-serif)', fontSize: '30px', color: '#1B1816', fontWeight: 500 }}>Recent Orders</h2>
                <button type="button" onClick={() => go('/account/orders')} style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: '#1B1816', fontFamily: 'var(--font-sans)', fontSize: '10px', letterSpacing: '0.16em', textTransform: 'uppercase' }}>
                  View All Orders →
                </button>
              </div>

              <div style={{ height: '1px', width: '100%', background: 'rgba(27,24,22,0.12)', marginBottom: '16px' }} />

              {recentOrders.length === 0 ? (
                <div style={{ background: '#F7F2EA', border: '1px solid rgba(27,24,22,0.12)', borderRadius: '14px', padding: '28px 20px', textAlign: 'center' }}>
                  <div style={{ fontFamily: 'var(--font-sans)', fontSize: '11px', letterSpacing: '0.14em', textTransform: 'uppercase', color: '#7A726C', marginBottom: '8px' }}>No orders yet.</div>
                  <button type="button" onClick={() => go('/shop')} style={{ border: 'none', background: '#1B1816', color: '#FDFBF7', borderRadius: '999px', padding: '12px 20px', fontFamily: 'var(--font-sans)', fontSize: '10px', letterSpacing: '0.14em', textTransform: 'uppercase', cursor: 'pointer' }}>
                    Start Shopping
                  </button>
                </div>
              ) : (
                <div style={{ display: 'grid', gap: '14px' }}>
                  {recentOrders.map((order) => {
                    const statusMeta = getStatusMeta(order.status);
                    const firstItem = order.items?.[0];
                    const itemCount = Math.max((order.items || []).length - 1, 0);
                    const orderId = order.orderId || order.id || 'NV-0000';
                    const productName = firstItem?.name || 'Tailored Double-Breasted Wool Blazer';
                    const thumb = firstItem?.image || 'https://images.unsplash.com/photo-1529139574466-a303027c1d8b?auto=format&fit=crop&w=500&q=80';
                    const orderDate = new Date(order.createdAt || order.placedAt || Date.now());

                    return (
                      <div key={orderId} style={{ background: '#F7F2EA', border: '1px solid rgba(27,24,22,0.12)', borderRadius: '14px', padding: '18px 20px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap', marginBottom: '12px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', fontFamily: 'var(--font-sans)', fontSize: '12px', color: '#6E6962' }}>
                            <span style={{ color: '#1B1816', fontWeight: 600 }}>#{orderId}</span>
                            <span>·</span>
                            <span>{new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(orderDate)}</span>
                            <span>·</span>
                            <span>{formatMoney(order.total || order.summary?.totalPaid || 0)}</span>
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

                        <div style={{ height: '1px', width: '100%', background: 'rgba(27,24,22,0.12)', marginBottom: '12px' }} />

                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '16px', alignItems: 'center', flexWrap: 'wrap' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '14px', minWidth: 0, flex: 1 }}>
                            <img src={thumb} alt={productName} style={{ width: '42px', height: '42px', objectFit: 'cover', borderRadius: '8px', background: '#EEE8E0' }} />
                            <div style={{ minWidth: 0 }}>
                              <div style={{ fontFamily: 'var(--font-sans)', fontSize: '13px', color: '#1B1816', fontWeight: 600, lineHeight: 1.3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{productName}</div>
                              {itemCount > 0 && (
                                <div style={{ fontFamily: 'var(--font-sans)', fontSize: '11px', color: '#7A726C', marginTop: '2px' }}>+ {itemCount} more</div>
                              )}
                            </div>
                          </div>

                          <button type="button" onClick={() => go(`/account/orders/${orderId}`)} style={{ border: '1px solid rgba(27,24,22,0.18)', background: 'transparent', color: '#1B1816', borderRadius: '999px', padding: '10px 14px', fontFamily: 'var(--font-sans)', fontSize: '10px', letterSpacing: '0.14em', textTransform: 'uppercase', cursor: 'pointer' }}>
                            View Order →
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>

            <div style={{ display: 'grid', gridTemplateColumns: '1.05fr 0.95fr', gap: '18px' }} className="ns-bottom-cards">
              <section style={{ background: '#F7F2EA', border: '1px solid rgba(27,24,22,0.12)', borderRadius: '14px', padding: '18px 18px 14px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', marginBottom: '12px', fontFamily: 'var(--font-sans)', fontSize: '10px', letterSpacing: '0.14em', textTransform: 'uppercase', color: '#7A726C' }}>
                  <span style={{ color: '#1B1816', fontWeight: 600 }}>Wishlist</span>
                  <span>{wishlistItems.length} saved piece{wishlistItems.length === 1 ? '' : 's'}</span>
                </div>

                <div style={{ height: '1px', width: '100%', background: 'rgba(27,24,22,0.12)', marginBottom: '14px' }} />

                {wishlistItems.length === 0 ? (
                  <div style={{ fontFamily: 'var(--font-sans)', fontSize: '13px', color: '#6E6962', padding: '6px 0 4px' }}>Nothing saved yet.</div>
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '10px' }}>
                    {wishlistItems.slice(0, 3).map((item) => (
                      <div key={item.id} style={{ minWidth: 0 }}>
                        <img src={item.image} alt={item.name} style={{ width: '100%', aspectRatio: '0.8', objectFit: 'cover', borderRadius: '10px', background: '#EFE8DF', display: 'block' }} />
                        <div style={{ marginTop: '8px', fontFamily: 'var(--font-sans)', fontSize: '12px', lineHeight: 1.3, color: '#1B1816', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.name}</div>
                        <div style={{ marginTop: '2px', fontFamily: 'var(--font-sans)', fontSize: '11px', color: '#6E6962' }}>{formatMoney(item.price)}</div>
                      </div>
                    ))}
                  </div>
                )}

                <div style={{ marginTop: '16px' }}>
                  <button type="button" onClick={() => go('/account/wishlist')} style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: '#1B1816', fontFamily: 'var(--font-sans)', fontSize: '10px', letterSpacing: '0.14em', textTransform: 'uppercase' }}>
                    View Wishlist →
                  </button>
                </div>
              </section>

              <section style={{ background: '#F7F2EA', border: '1px solid rgba(27,24,22,0.12)', borderRadius: '14px', padding: '18px 18px 14px' }}>
                <div style={{ fontFamily: 'var(--font-sans)', fontSize: '10px', letterSpacing: '0.14em', textTransform: 'uppercase', color: '#7A726C', marginBottom: '12px' }}>
                  Default Address
                </div>

                <div style={{ height: '1px', width: '100%', background: 'rgba(27,24,22,0.12)', marginBottom: '12px' }} />

                {defaultAddress ? (
                  <div style={{ fontFamily: 'var(--font-sans)', fontSize: '14px', color: '#1B1816', lineHeight: 1.8 }}>
                    <div style={{ fontWeight: 700 }}>{defaultAddress.fullName || profileName}</div>
                    <div style={{ color: '#6E6962' }}>{defaultAddress.street || 'Addis Ababa'}</div>
                    {defaultAddress.street2 && <div style={{ color: '#6E6962' }}>{defaultAddress.street2}</div>}
                    <div style={{ color: '#6E6962' }}>{defaultAddress.city || 'Addis Ababa'}, {defaultAddress.country || 'Ethiopia'} {defaultAddress.postalCode || ''}</div>
                  </div>
                ) : (
                  <div style={{ fontFamily: 'var(--font-sans)', fontSize: '13px', color: '#6E6962', padding: '6px 0 6px' }}>No address saved yet.</div>
                )}

                <div style={{ marginTop: '16px' }}>
                  <button type="button" onClick={() => go('/account/addresses')} style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: '#1B1816', fontFamily: 'var(--font-sans)', fontSize: '10px', letterSpacing: '0.14em', textTransform: 'uppercase' }}>
                    Manage Addresses →
                  </button>
                </div>
              </section>
            </div>
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
        @media (max-width: 1023px) {
          .ns-account-shell .ns-quick-links {
            grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
          }
          .ns-account-shell > div > div:nth-child(3) {
            grid-template-columns: 1fr !important;
          }
          .ns-account-shell .ns-bottom-cards {
            grid-template-columns: 1fr !important;
          }
        }
        @media (max-width: 767px) {
          .ns-account-shell > div {
            padding-left: 18px !important;
            padding-right: 18px !important;
          }
          .ns-account-shell > div > div:nth-child(3) {
            grid-template-columns: 1fr !important;
          }
          .ns-account-shell .ns-quick-links {
            grid-template-columns: 1fr !important;
          }
          .ns-account-shell main {
            gap: 18px !important;
          }
          .ns-account-shell > div > div:nth-child(4) {
            display: block !important;
          }
          .ns-account-shell aside {
            margin-bottom: 18px;
          }
          .ns-account-shell nav {
            display: flex !important;
            overflow-x: auto !important;
            gap: 8px !important;
            padding-bottom: 8px !important;
          }
          .ns-account-shell nav button {
            white-space: nowrap !important;
            min-width: max-content !important;
            border-left: none !important;
            border-bottom: 2px solid transparent !important;
            border-radius: 12px;
            background: transparent;
          }
          .ns-account-shell nav button[style*="border-left: 2px solid rgb(27, 24, 22)"] {
            border-bottom: 2px solid #1B1816 !important;
            border-left: 2px solid transparent !important;
          }
        }
      `}</style>
    </div>
  );
}

export default AccountOverviewPage;
