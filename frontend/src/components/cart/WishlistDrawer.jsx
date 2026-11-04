/* eslint-disable react-hooks/set-state-in-effect */
import { useEffect, useMemo, useRef, useState } from 'react';
import { useCart } from '../../context/CartContext';
import { useAuth } from '../../context/AuthContext';

const overlayStyle = {
  position: 'fixed',
  inset: 0,
  background: 'rgba(17, 14, 12, 0.42)',
  zIndex: 120,
  opacity: 1,
  transition: 'opacity 300ms cubic-bezier(0.25, 0.8, 0.25, 1)',
};

const panelStyle = {
  position: 'fixed',
  top: 0,
  right: 0,
  height: '100dvh',
  width: 'min(480px, 100vw)',
  background: 'var(--bg-surface)',
  borderLeft: '1px solid var(--border-default)',
  boxShadow: 'var(--shadow-lg)',
  transform: 'translateX(0)',
  opacity: 1,
  transition: 'transform 300ms cubic-bezier(0.25, 0.8, 0.25, 1), opacity 300ms cubic-bezier(0.25, 0.8, 0.25, 1)',
  zIndex: 130,
  display: 'flex',
  flexDirection: 'column',
  color: 'var(--text-primary)',
};

const formatCurrency = (value) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(value);

function StockPill({ stock }) {
  const map = {
    'in-stock': { label: 'IN STOCK', bg: 'var(--color-success-soft)', color: 'var(--color-success)' },
    'low-stock': { label: 'LOW STOCK', bg: 'var(--color-warning-soft)', color: 'var(--color-warning)' },
    'out-of-stock': { label: 'SOLD OUT', bg: 'var(--color-danger-soft)', color: 'var(--color-danger)' },
    waitlist: { label: 'WAITLIST', bg: 'var(--bg-surface-sunken)', color: 'var(--text-secondary)' },
  };

  const meta = map[stock] || map['in-stock'];

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '5px 8px',
        borderRadius: '999px',
        background: meta.bg,
        color: meta.color,
        fontFamily: 'var(--font-sans)',
        fontSize: '9px',
        letterSpacing: '0.12em',
        textTransform: 'uppercase',
        fontWeight: 600,
        lineHeight: 1,
      }}
    >
      {meta.label}
    </span>
  );
}

function HeartFilled() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78Z" />
    </svg>
  );
}

function PersonIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M16 19v-1a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v1" />
      <circle cx="10" cy="7" r="4" />
      <path d="M20 19v-1a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

export default function WishlistDrawer({ go }) {
  const {
    wishlistItems,
    isWishlistOpen,
    closeWishlist,
    removeWishlistItem,
    addWishlistItemToCart,
    moveAvailableToBag,
    clearWishlist,
  } = useCart();
  const { isAuthenticated } = useAuth();

  const [exiting, setExiting] = useState(false);
  const [isOpening, setIsOpening] = useState(false);
  const [removingIds, setRemovingIds] = useState([]);
  const drawerRef = useRef(null);

  useEffect(() => {
    if (!isWishlistOpen) {
      setExiting(false);
      return;
    }

    setExiting(false);
    setIsOpening(true);
    const frame = window.requestAnimationFrame(() => setIsOpening(false));

    const onEscape = (event) => {
      if (event.key === 'Escape') {
        setExiting(true);
        setTimeout(() => {
          closeWishlist();
          setExiting(false);
        }, 220);
      }
    };

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onEscape);

    return () => {
      document.body.style.overflow = originalOverflow;
      window.removeEventListener('keydown', onEscape);
      window.cancelAnimationFrame(frame);
    };
  }, [isWishlistOpen, closeWishlist]);

  const handleClose = () => {
    setExiting(true);
    setTimeout(() => {
      closeWishlist();
      setExiting(false);
    }, 220);
  };

  const handleRemove = (productId) => {
    setRemovingIds((prev) => [...prev, productId]);
    setTimeout(() => {
      removeWishlistItem(productId);
      setRemovingIds((prev) => prev.filter((id) => id !== productId));
    }, 240);
  };

  const handleAddToBag = (item) => {
    addWishlistItemToCart(item);
  };

  const handleMoveAvailableToBag = () => {
    moveAvailableToBag();
  };

  const navigateToLogin = () => {
    handleClose();
    if (go) {
      go('/login');
    } else {
      window.dispatchEvent(
        new CustomEvent('novashop:navigate', {
          detail: { path: '/login' },
        })
      );
    }
  };

  const isEmpty = wishlistItems.length === 0;
  const countLabel = useMemo(() => {
    if (isEmpty) return 'No saved pieces';
    return `${wishlistItems.length} curated ${wishlistItems.length === 1 ? 'piece' : 'pieces'}`;
  }, [wishlistItems.length, isEmpty]);

  if (!isWishlistOpen && !exiting) return null;

  return (
    <>
      <div
        role="presentation"
        aria-hidden="true"
        onClick={handleClose}
        style={{
          ...overlayStyle,
          opacity: exiting ? 0 : 1,
        }}
      />

      <aside
        ref={drawerRef}
        role="dialog"
        aria-modal="true"
        aria-label="Wishlist drawer"
        style={{
          ...panelStyle,
          transform: exiting || isOpening ? 'translateX(100%)' : 'translateX(0)',
          opacity: exiting ? 0 : 1,
        }}
      >
        <header
          style={{
            background: 'var(--bg-surface)',
            borderBottom: '1px solid var(--border-subtle)',
            padding: '20px 22px 18px',
            position: 'sticky',
            top: 0,
            zIndex: 2,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px' }}>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div
                style={{
                  fontFamily: 'var(--font-sans)',
                  fontSize: '10px',
                  letterSpacing: '0.16em',
                  textTransform: 'uppercase',
                  color: 'var(--text-muted)',
                  marginBottom: '8px',
                }}
              >
                HOME / WISHLIST
              </div>
              <h2
                style={{
                  margin: 0,
                  fontFamily: 'var(--font-serif)',
                  fontSize: 'clamp(28px, 2.5vw, 38px)',
                  lineHeight: 1.05,
                  letterSpacing: '-0.04em',
                  fontWeight: 400,
                  color: 'var(--text-primary)',
                  fontStyle: 'italic',
                }}
              >
                My Wishlist
              </h2>
              <p
                style={{
                  margin: '8px 0 0',
                  fontFamily: 'var(--font-sans)',
                  fontSize: '12px',
                  color: 'var(--text-muted)',
                  letterSpacing: '0.01em',
                }}
              >
                {countLabel}
              </p>
            </div>

            <button
              onClick={handleClose}
              aria-label="Close wishlist"
              style={{
                border: 'none',
                background: 'transparent',
                color: 'var(--text-primary)',
                fontSize: '28px',
                lineHeight: 1,
                cursor: 'pointer',
                padding: 0,
                minWidth: '44px',
                minHeight: '44px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              ×
            </button>
          </div>

          {!isEmpty && (
            <div
              style={{
                display: 'flex',
                gap: '10px',
                marginTop: '18px',
                alignItems: 'center',
                justifyContent: 'flex-end',
                flexWrap: 'wrap',
              }}
            >
              <button
                onClick={clearWishlist}
                style={{
                  background: 'transparent',
                  border: '1px solid var(--border-default)',
                  color: 'var(--text-primary)',
                  borderRadius: '999px',
                  padding: '9px 12px',
                  fontFamily: 'var(--font-sans)',
                  fontSize: '10px',
                  letterSpacing: '0.14em',
                  textTransform: 'uppercase',
                  cursor: 'pointer',
                  minWidth: '118px',
                }}
              >
                Clear All
              </button>
              <button
                onClick={handleMoveAvailableToBag}
                style={{
                  background: 'var(--color-primary)',
                  color: 'var(--color-primary-contrast)',
                  border: 'none',
                  borderRadius: '999px',
                  padding: '9px 12px',
                  fontFamily: 'var(--font-sans)',
                  fontSize: '10px',
                  letterSpacing: '0.14em',
                  textTransform: 'uppercase',
                  cursor: 'pointer',
                  minWidth: '182px',
                }}
              >
                Move Available to Bag
              </button>
            </div>
          )}
        </header>

        <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
          {isEmpty ? (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexDirection: 'column',
                textAlign: 'center',
                padding: '56px 24px 28px',
                gap: '14px',
                color: 'var(--text-primary)',
              }}
            >
              <div
                style={{
                  width: '70px',
                  height: '70px',
                  borderRadius: '50%',
                  border: '1px solid var(--border-default)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: 'var(--bg-surface-sunken)',
                }}
              >
                <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" style={{ color: 'var(--text-primary)' }} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78Z" />
                </svg>
              </div>
              <div>
                <h3
                  style={{
                    margin: 0,
                    fontFamily: 'var(--font-serif)',
                    fontSize: 'clamp(28px, 2vw, 34px)',
                    fontStyle: 'italic',
                    fontWeight: 400,
                    letterSpacing: '-0.04em',
                  }}
                >
                  Your wishlist is empty.
                </h3>
                <p
                  style={{
                    margin: '10px 0 0',
                    fontFamily: 'var(--font-sans)',
                    fontSize: '14px',
                    color: 'var(--text-muted)',
                    lineHeight: 1.6,
                  }}
                >
                  Save your favorite pieces and revisit them anytime.
                </p>
              </div>
              <button
                type="button"
                onClick={handleClose}
                style={{
                  background: 'var(--color-primary)',
                  color: 'var(--color-primary-contrast)',
                  border: 'none',
                  borderRadius: '999px',
                  padding: '12px 22px',
                  fontFamily: 'var(--font-sans)',
                  fontSize: '10px',
                  letterSpacing: '0.14em',
                  textTransform: 'uppercase',
                  cursor: 'pointer',
                  marginTop: '6px',
                }}
              >
                Continue Shopping
              </button>
            </div>
          ) : (
            <>
              {!isAuthenticated && (
                <div
                  style={{
                    margin: '14px 22px 0',
                    padding: '12px 16px',
                    borderRadius: '12px',
                    background: 'var(--bg-surface-sunken)',
                    border: '1px solid var(--border-subtle)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '10px',
                  }}
                >
                  <span style={{ fontFamily: 'var(--font-sans)', fontSize: '11px', color: 'var(--text-primary)' }}>
                    Sign in to sync your wishlist across devices
                  </span>
                  <button
                    type="button"
                    onClick={navigateToLogin}
                    style={{
                      border: 'none',
                      background: 'var(--color-primary)',
                      color: 'var(--color-primary-contrast)',
                      borderRadius: '999px',
                      padding: '6px 14px',
                      fontFamily: 'var(--font-sans)',
                      fontSize: '9px',
                      letterSpacing: '0.1em',
                      textTransform: 'uppercase',
                      cursor: 'pointer',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    Sign In
                  </button>
                </div>
              )}
              <div style={{ padding: '18px 22px 0' }}>
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
                    gap: '14px',
                    alignItems: 'stretch',
                  }}
                >
                  {wishlistItems.map((item) => {
                    const isRemoving =
                      removingIds.includes(item.id) ||
                      removingIds.includes(item.productId);
                    const stockCount = Number(
                      item.countInStock != null
                        ? item.countInStock
                        : (item.stockTotal != null ? item.stockTotal : item.stock)
                    );
                    const isSoldOut = Number.isFinite(stockCount) ? stockCount <= 0 : false;

                    return (
                      <div
                        key={item.id}
                        style={{
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '10px',
                          opacity: isRemoving ? 0 : 1,
                          transform: isRemoving ? 'translateX(8px)' : 'translateX(0)',
                          transition: 'opacity 250ms ease, transform 250ms ease, max-height 250ms ease',
                          maxHeight: isRemoving ? '0px' : '520px',
                          overflow: 'hidden',
                        }}
                      >
                        <div style={{ position: 'relative', borderRadius: '14px', overflow: 'hidden', background: 'var(--bg-surface-sunken)' }}>
                          {item.sale && (
                            <span
                              style={{
                                position: 'absolute',
                                top: '10px',
                                left: '10px',
                                background: 'var(--color-danger)',
                                color: 'var(--color-primary-contrast)',
                                borderRadius: '999px',
                                fontFamily: 'var(--font-sans)',
                                fontSize: '8px',
                                letterSpacing: '0.12em',
                                textTransform: 'uppercase',
                                padding: '5px 8px',
                                fontWeight: 700,
                                zIndex: 1,
                              }}
                            >
                              SALE -25%
                            </span>
                          )}
                          <button
                            type="button"
                            aria-label={`Remove ${item.name} from wishlist`}
                            onClick={() => handleRemove(item.productId || item.id)}
                            style={{
                              position: 'absolute',
                              top: '10px',
                              right: '10px',
                              width: '28px',
                              height: '28px',
                              borderRadius: '50%',
                              border: 'none',
                              background: 'var(--color-primary)',
                              color: 'var(--color-primary-contrast)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              cursor: 'pointer',
                              zIndex: 2,
                              boxShadow: 'var(--shadow-md)',
                            }}
                          >
                            <HeartFilled />
                          </button>
                          <img
                            src={item.image}
                            alt={item.name}
                            onClick={() => {
                              handleClose();
                              const productSlug = item.slug || item.productId || item.id || item._id;
                              const productPath = item.path || `/products/${productSlug}`;
                              if (go) go(productPath);
                              else window.dispatchEvent(new CustomEvent('novashop:navigate', { detail: { path: productPath } }));
                            }}
                            style={{ width: '100%', aspectRatio: '1 / 1.2', display: 'block', objectFit: 'cover', cursor: 'pointer' }}
                          />
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', minWidth: 0 }}>
                          <StockPill stock={item.stock} />
                          <div
                            style={{
                              fontFamily: 'var(--font-sans)',
                              fontSize: '9px',
                              letterSpacing: '0.14em',
                              textTransform: 'uppercase',
                              color: 'var(--text-muted)',
                              fontWeight: 600,
                            }}
                          >
                            {item.category}
                          </div>
                          <div
                            onClick={() => {
                              handleClose();
                              const productSlug = item.slug || item.productId || item.id || item._id;
                              const productPath = item.path || `/products/${productSlug}`;
                              if (go) go(productPath);
                              else window.dispatchEvent(new CustomEvent('novashop:navigate', { detail: { path: productPath } }));
                            }}
                            style={{
                              fontFamily: 'var(--font-sans)',
                              fontSize: '14px',
                              fontWeight: 700,
                              color: 'var(--text-primary)',
                              lineHeight: 1.35,
                              whiteSpace: 'nowrap',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              cursor: 'pointer',
                            }}
                          >
                            {item.name}
                          </div>

                          <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px', flexWrap: 'wrap' }}>
                            <span style={{ fontFamily: 'var(--font-sans)', fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)' }}>
                              {formatCurrency(item.price)}
                            </span>
                            {item.sale && item.originalPrice > item.price && (
                              <span style={{ fontFamily: 'var(--font-sans)', fontSize: '12px', color: 'var(--text-muted)', textDecoration: 'line-through' }}>
                                {formatCurrency(item.originalPrice)}
                              </span>
                            )}
                          </div>
                        </div>

                        <button
                          type="button"
                          disabled={isSoldOut}
                          onClick={() => handleAddToBag(item)}
                          style={{
                            width: '100%',
                            padding: '11px 12px',
                            borderRadius: '999px',
                            border: isSoldOut ? '1px solid var(--border-default)' : 'none',
                            background: isSoldOut ? 'transparent' : 'var(--color-primary)',
                            color: isSoldOut ? 'var(--text-muted)' : 'var(--color-primary-contrast)',
                            fontFamily: 'var(--font-sans)',
                            fontSize: '10px',
                            letterSpacing: '0.14em',
                            textTransform: 'uppercase',
                            cursor: isSoldOut ? 'not-allowed' : 'pointer',
                            fontWeight: 600,
                            opacity: isSoldOut ? 0.7 : 1,
                          }}
                        >
                          {isSoldOut ? 'Sold out' : 'Add to Bag'}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div style={{ padding: '18px 22px calc(24px + env(safe-area-inset-bottom, 0px))' }}>
                <div
                  style={{
                    border: '1px solid var(--border-default)',
                    borderRadius: '16px',
                    background: 'var(--bg-surface-sunken)',
                    padding: '16px 14px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '12px',
                    flexWrap: 'wrap',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0, flex: 1 }}>
                    <div
                      style={{
                        width: '38px',
                        height: '38px',
                        borderRadius: '50%',
                        background: 'var(--bg-surface)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                        border: '1px solid var(--border-default)',
                        color: 'var(--text-primary)',
                      }}
                    >
                      <PersonIcon />
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div
                        style={{
                          fontFamily: 'var(--font-sans)',
                          fontSize: '13px',
                          fontWeight: 700,
                          color: 'var(--text-primary)',
                          lineHeight: 1.3,
                        }}
                      >
                        Complimentary Styling Consultation
                      </div>
                      <div
                        style={{
                          fontFamily: 'var(--font-sans)',
                          fontSize: '11px',
                          color: 'var(--text-muted)',
                          lineHeight: 1.45,
                          marginTop: '2px',
                        }}
                      >
                        Our private client advisors are available to assist with fit, coordination, and bespoke reservations.
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => window.open('https://example.com/advisor-booking', '_blank', 'noopener,noreferrer')}
                    style={{
                      background: 'transparent',
                      border: '1px solid var(--border-default)',
                      borderRadius: '999px',
                      padding: '10px 14px',
                      fontFamily: 'var(--font-sans)',
                      fontSize: '9px',
                      letterSpacing: '0.14em',
                      textTransform: 'uppercase',
                      color: 'var(--text-primary)',
                      cursor: 'pointer',
                    }}
                  >
                    Book Private Advisor
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </aside>
    </>
  );
}
