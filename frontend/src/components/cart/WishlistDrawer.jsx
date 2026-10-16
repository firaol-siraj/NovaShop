import { useEffect, useMemo, useRef, useState } from 'react';
import { useCart } from '../../context/CartContext';

const overlayStyle = {
  position: 'fixed',
  inset: 0,
  background: 'rgba(17, 14, 12, 0.42)',
  zIndex: 120,
  opacity: 1,
  transition: 'opacity 250ms ease',
};

const panelStyle = {
  position: 'fixed',
  top: 0,
  right: 0,
  height: '100vh',
  width: 'min(480px, 100vw)',
  background: '#F9F5F0',
  borderLeft: '1px solid rgba(27, 24, 22, 0.12)',
  boxShadow: '-18px 0 38px rgba(17, 14, 12, 0.08)',
  transform: 'translateX(0)',
  opacity: 1,
  transition: 'transform 300ms cubic-bezier(0.25, 0.8, 0.25, 1), opacity 300ms cubic-bezier(0.25, 0.8, 0.25, 1)',
  zIndex: 130,
  display: 'flex',
  flexDirection: 'column',
};

const formatCurrency = (value) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(value);

function StockPill({ stock }) {
  const map = {
    'in-stock': { label: 'IN STOCK', bg: '#EDEAE4', color: '#1F2620' },
    'low-stock': { label: 'LOW STOCK', bg: '#EEE6D9', color: '#5A4631' },
    'out-of-stock': { label: 'SOLD OUT', bg: '#E8D4CF', color: '#8A3B32' },
    waitlist: { label: 'WAITLIST', bg: '#E9E2DB', color: '#473F3A' },
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
    <svg width="14" height="14" viewBox="0 0 24 24" fill="#1B1816" stroke="#1B1816" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78Z" />
    </svg>
  );
}

function PersonIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#1B1816" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M16 19v-1a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v1" />
      <circle cx="10" cy="7" r="4" />
      <path d="M20 19v-1a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

export default function WishlistDrawer() {
  const {
    wishlistItems,
    isWishlistOpen,
    closeWishlist,
    removeWishlistItem,
    addWishlistItemToCart,
    moveAvailableToBag,
    clearWishlist,
  } = useCart();

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

  const handleRemove = (id) => {
    setRemovingIds((current) => [...current, id]);
    setTimeout(() => {
      removeWishlistItem(id);
      setRemovingIds((current) => current.filter((entry) => entry !== id));
    }, 240);
  };

  const handleAddToBag = async (item) => {
    const soldOut = Number(item.stockTotal) === 0 || item.stock === 'out-of-stock';
    if (soldOut) return;
    setRemovingIds((current) => [...current, item.id]);
    const result = await addWishlistItemToCart(item);
    setRemovingIds((current) => current.filter((entry) => entry !== item.id));
    if (result?.needsOptions) return;
    if (result?.ok) {
      const message = result.wasIncremented ? 'Added to bag — quantity updated' : 'Added to bag';
      window.dispatchEvent(new CustomEvent('novashop:toast', { detail: { message } }));
    }
  };

  const handleMoveAvailableToBag = async () => {
    const count = await moveAvailableToBag();
    if (count > 0) {
      window.dispatchEvent(new CustomEvent('novashop:toast', { detail: { message: `${count} items moved to your bag` } }));
    }
  };

  const isEmpty = wishlistItems.length === 0;

  const countLabel = useMemo(() => {
    const count = wishlistItems.length;
    return `${count} saved piece${count === 1 ? '' : 's'} reserved in your personal edit`;
  }, [wishlistItems.length]);

  if (!isWishlistOpen) return null;

  return (
    <>
      <div
        aria-hidden="true"
        onClick={handleClose}
        style={{
          ...overlayStyle,
          opacity: exiting ? 0 : isOpening ? 0 : 1,
        }}
      />

      <aside
        ref={drawerRef}
        aria-label="Wishlist drawer"
        onClick={(event) => event.stopPropagation()}
        style={{
          ...panelStyle,
          transform: exiting || isOpening ? 'translateX(100%)' : 'translateX(0)',
          opacity: exiting ? 0 : 1,
        }}
      >
        <header
          style={{
            background: '#F9F5F0',
            borderBottom: '1px solid rgba(27, 24, 22, 0.08)',
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
                  color: '#7A726C',
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
                  color: '#1B1816',
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
                  color: '#7A726C',
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
                color: '#1B1816',
                fontSize: '30px',
                lineHeight: 1,
                cursor: 'pointer',
                padding: 0,
                marginTop: '2px',
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
                  border: '1px solid rgba(27,24,22,0.2)',
                  color: '#1B1816',
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
                  background: '#1B1816',
                  color: '#FDFBF7',
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
                color: '#1B1816',
              }}
            >
              <div
                style={{
                  width: '70px',
                  height: '70px',
                  borderRadius: '50%',
                  border: '1px solid rgba(27,24,22,0.14)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: '#F3EFE8',
                }}
              >
                <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#1B1816" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
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
                    color: '#6F6862',
                    lineHeight: 1.6,
                  }}
                >
                  Save your favorite pieces and revisit them anytime.
                </p>
              </div>
              <button
                onClick={handleClose}
                style={{
                  background: '#1B1816',
                  color: '#FDFBF7',
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
                    const isRemoving = removingIds.includes(item.id);
                    const isSoldOut = Number(item.stockTotal) === 0 || item.stock === 'out-of-stock';

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
                        <div style={{ position: 'relative', borderRadius: '14px', overflow: 'hidden', background: '#EFEAE4' }}>
                          {item.sale && (
                            <span
                              style={{
                                position: 'absolute',
                                top: '10px',
                                left: '10px',
                                background: '#9B4A3A',
                                color: '#FDFBF7',
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
                            onClick={() => handleRemove(item.id)}
                            style={{
                              position: 'absolute',
                              top: '10px',
                              right: '10px',
                              width: '28px',
                              height: '28px',
                              borderRadius: '50%',
                              border: 'none',
                              background: '#1B1816',
                              color: '#FDFBF7',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              cursor: 'pointer',
                              zIndex: 2,
                              boxShadow: '0 8px 18px rgba(17,14,12,0.18)',
                            }}
                          >
                            <HeartFilled />
                          </button>
                          <img
                            src={item.image}
                            alt={item.name}
                            style={{ width: '100%', aspectRatio: '1 / 1.2', display: 'block', objectFit: 'cover' }}
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
                              color: '#7A726C',
                              fontWeight: 600,
                            }}
                          >
                            {item.category}
                          </div>
                          <div
                            style={{
                              fontFamily: 'var(--font-sans)',
                              fontSize: '14px',
                              fontWeight: 700,
                              color: '#1B1816',
                              lineHeight: 1.35,
                              whiteSpace: 'nowrap',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                            }}
                          >
                            {item.name}
                          </div>

                          <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px', flexWrap: 'wrap' }}>
                            <span style={{ fontFamily: 'var(--font-sans)', fontSize: '14px', fontWeight: 700, color: '#1B1816' }}>
                              {formatCurrency(item.price)}
                            </span>
                            {item.sale && item.originalPrice > item.price && (
                              <span style={{ fontFamily: 'var(--font-sans)', fontSize: '12px', color: '#7A726C', textDecoration: 'line-through' }}>
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
                            border: isSoldOut ? '1px solid rgba(27,24,22,0.2)' : 'none',
                            background: isSoldOut ? 'transparent' : '#1B1816',
                            color: isSoldOut ? '#8D837D' : '#FDFBF7',
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

              <div style={{ padding: '18px 22px 24px' }}>
                <div
                  style={{
                    border: '1px solid rgba(27,24,22,0.12)',
                    borderRadius: '16px',
                    background: '#F3EFE8',
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
                        background: '#FDFBF7',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                        border: '1px solid rgba(27,24,22,0.12)',
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
                          color: '#1B1816',
                          lineHeight: 1.3,
                        }}
                      >
                        Complimentary Styling Consultation
                      </div>
                      <div
                        style={{
                          fontFamily: 'var(--font-sans)',
                          fontSize: '11px',
                          color: '#6F6862',
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
                      border: '1px solid rgba(27,24,22,0.2)',
                      borderRadius: '999px',
                      padding: '10px 14px',
                      fontFamily: 'var(--font-sans)',
                      fontSize: '9px',
                      letterSpacing: '0.14em',
                      textTransform: 'uppercase',
                      color: '#1B1816',
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
