import { useEffect, useMemo, useRef, useState } from 'react';
import { useCart } from '../../context/CartContext';

const overlayStyle = {
  position: 'fixed',
  inset: 0,
  background: 'rgba(17, 14, 12, 0.42)',
  zIndex: 120,
  opacity: 1,
  transition: 'opacity 300ms ease',
};

const panelStyle = {
  position: 'fixed',
  top: 0,
  right: 0,
  height: '100vh',
  width: 'min(470px, 100vw)',
  background: '#F9F5F0',
  borderLeft: '1px solid rgba(27, 24, 22, 0.12)',
  boxShadow: '-18px 0 38px rgba(17, 14, 12, 0.08)',
  transform: 'translateX(0)',
  transition: 'transform 300ms ease-out',
  zIndex: 130,
  display: 'flex',
  flexDirection: 'column',
};

export default function ShoppingBagDrawer({ go }) {
  const {
    items,
    savedItems,
    subtotal,
    total,
    hasCartIssues,
    removeItem,
    updateQuantity,
    saveForLater,
    moveToBag,
    isCartOpen,
    closeCart,
    distinctItemCount,
    appliedPromo,
    promoDiscount,
    formatCurrency,
  } = useCart();

  const [removingIds, setRemovingIds] = useState([]);
  const [savingIds, setSavingIds] = useState([]);
  const [isClosing, setIsClosing] = useState(false);
  const [isOpening, setIsOpening] = useState(false);
  const [highlightedIds, setHighlightedIds] = useState([]);

  const drawerRef = useRef(null);
  const prevItemsRef = useRef([]);

  useEffect(() => {
    if (!isCartOpen) return;

    setIsClosing(false);
    setIsOpening(true);
    const frame = window.requestAnimationFrame(() => setIsOpening(false));

    const onEscape = (event) => {
      if (event.key === 'Escape' && isCartOpen) {
        setIsClosing(true);
        setTimeout(() => {
          closeCart();
          setIsClosing(false);
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
  }, [isCartOpen, closeCart]);

  useEffect(() => {
    const prevItems = prevItemsRef.current;
    const currentItems = items;

    if (prevItems.length > 0) {
      const changedIds = currentItems
        .filter((current) => {
          const prev = prevItems.find((p) => 
            (p.id === current.id || p.name === current.name) && 
            p.color === current.color && 
            p.size === current.size
          );
          return prev && prev.qty !== current.qty;
        })
        .map((item) => `${item.name}-${item.color}-${item.size}`);

      if (changedIds.length > 0) {
        setHighlightedIds(changedIds);
        setTimeout(() => setHighlightedIds([]), 300);
      }
    }

    prevItemsRef.current = currentItems;
  }, [items]);

  const handleRemove = (id) => {
    setRemovingIds((current) => [...current, id]);
    setTimeout(() => {
      removeItem(id);
      setRemovingIds((current) => current.filter((entry) => entry !== id));
    }, 220);
  };

  const handleSaveForLater = (item) => {
    setSavingIds((current) => (current.includes(item.id) ? current : [...current, item.id]));
    setTimeout(() => {
      saveForLater(item);
      setSavingIds((current) => current.filter((entry) => entry !== item.id));
    }, 180);
  };

  const isEmpty = items.length === 0;

  const subtotalValue = useMemo(() => subtotal || 0, [subtotal]);
  const totalValue = useMemo(() => total || 0, [total]);

  const handleClose = () => {
    setIsClosing(true);
    setTimeout(() => {
      closeCart();
      setIsClosing(false);
    }, 220);
  };

  if (!isCartOpen) return null;

  return (
    <>
      <div
        aria-hidden="true"
        onClick={handleClose}
        style={{
          ...overlayStyle,
          opacity: isClosing ? 0 : isOpening ? 0 : 1,
        }}
      />

      <aside
        ref={drawerRef}
        aria-label="Shopping bag drawer"
        onClick={(event) => event.stopPropagation()}
        style={{
          ...panelStyle,
          transform: isClosing || isOpening ? 'translateX(100%)' : 'translateX(0)',
          opacity: isClosing ? 0 : 1,
        }}
      >
        <header
          style={{
            background: '#F9F5F0',
            borderBottom: '1px solid rgba(27, 24, 22, 0.08)',
            padding: '20px 22px 16px',
            position: 'sticky',
            top: 0,
            zIndex: 2,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px' }}>
            <div>
              <h2
                style={{
                  margin: 0,
                  fontFamily: 'var(--font-serif)',
                  fontSize: 'clamp(28px, 2.6vw, 36px)',
                  lineHeight: 1.05,
                  letterSpacing: '-0.04em',
                  fontWeight: 400,
                  color: '#1B1816',
                  fontStyle: 'italic',
                }}
              >
                SHOPPING BAG ({distinctItemCount})
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
                Review your selected pieces before checkout.
              </p>
            </div>

            <button
              onClick={closeCart}
              aria-label="Close shopping bag"
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
        </header>

        <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
          {!isEmpty || savedItems.length > 0 ? (
            <>
              {!isEmpty && (
                <>
                  <div style={{ padding: '18px 22px 0' }}>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    fontFamily: 'var(--font-sans)',
                    fontSize: '10px',
                    fontWeight: 600,
                    letterSpacing: '0.14em',
                    textTransform: 'uppercase',
                    color: '#8A817B',
                    paddingBottom: '10px',
                  }}
                >
                  <span>Curated Selection</span>
                  <span>Unit Price / Quantity</span>
                </div>
              </div>

                  <div style={{ padding: '0 22px', display: 'flex', flexDirection: 'column', gap: 0 }}>
                {items.map((item, index) => {
                  const isRemoving = removingIds.includes(item.id);
                  const isSaving = savingIds.includes(item.id);
                  const itemKey = `${item.name}-${item.color}-${item.size}`;
                  const isHighlighted = highlightedIds.includes(itemKey);

                  return (
                    <div
                      key={`${itemKey}-${index}`}
                      style={{
                        display: 'grid',
                        gridTemplateColumns: '88px 1fr auto',
                        gap: '14px',
                        padding: '18px 0',
                        borderTop: '1px solid rgba(27, 24, 22, 0.08)',
                        opacity: isRemoving ? 0 : 1,
                        transform: isRemoving ? 'translateX(8px)' : 'translateX(0)',
                        maxHeight: isRemoving ? '0px' : '220px',
                        overflow: 'hidden',
                        background: isHighlighted ? 'rgba(155, 166, 147, 0.15)' : 'transparent',
                        transition: 'background 300ms ease, opacity 220ms ease, transform 220ms ease',
                      }}
                    >
                      <div style={{ width: '88px', height: '88px', borderRadius: '10px', overflow: 'hidden', background: '#EFEAE4' }}>
                        <img
                          src={item.image}
                          alt={item.name}
                          style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                        />
                      </div>

                      <div style={{ minWidth: 0 }}>
                        <div
                          style={{
                            fontFamily: 'var(--font-sans)',
                            fontSize: '15px',
                            fontWeight: 700,
                            color: '#1B1816',
                            lineHeight: 1.35,
                            marginBottom: '6px',
                          }}
                        >
                          {item.name}
                        </div>

                        <div
                          style={{
                            fontFamily: 'var(--font-sans)',
                            fontSize: '12px',
                            color: '#7A726C',
                            lineHeight: 1.6,
                          }}
                        >
                          <span>Color: {item.color}</span>
                          {'    '}
                          <span>Size: {item.size}</span>
                        </div>
 
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '12px', flexWrap: 'wrap' }}>
                          {item.issue && (
                            <div style={{ fontSize: '10px', color: '#A14A3F', marginTop: '6px' }}>
                              {item.issue === 'unavailable'
                                ? 'No longer available'
                                : item.issue === 'out_of_stock'
                                  ? 'Out of stock'
                                  : `Only ${item.maxQuantity} left`}
                            </div>
                          )}
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '12px', flexWrap: 'wrap' }}>
                          <div
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '10px',
                              border: '1px solid rgba(27, 24, 22, 0.16)',
                              borderRadius: '999px',
                              background: '#FDFBF7',
                              padding: '4px 8px',
                            }}
                          >
                            <button
                              type="button"
                              aria-label={`Decrease quantity of ${item.name}`}
                              disabled={item.issue === 'unavailable' || item.qty <= 1}
                              onClick={() => updateQuantity(item.id, item.qty - 1)}
                              style={{
                                border: 'none',
                                background: 'transparent',
                                fontSize: '18px',
                                color: '#1B1816',
                                cursor: item.issue === 'unavailable' || item.qty <= 1 ? 'not-allowed' : 'pointer',
                                width: '18px',
                                height: '18px',
                                lineHeight: 1,
                                opacity: item.issue === 'unavailable' || item.qty <= 1 ? 0.4 : 1,
                              }}
                            >
                              −
                            </button>
                            <span
                              aria-live="polite"
                              style={{
                                fontFamily: 'var(--font-sans)',
                                fontSize: '12px',
                                fontWeight: 600,
                                color: '#1B1816',
                                minWidth: '14px',
                                textAlign: 'center',
                              }}
                            >
                              {item.qty}
                            </span>
                            <button
                              type="button"
                              aria-label={`Increase quantity of ${item.name}`}
                              disabled={Boolean(item.issue) || item.qty >= (item.maxQuantity || 10)}
                              onClick={() => updateQuantity(item.id, item.qty + 1)}
                              style={{
                                border: 'none',
                                background: 'transparent',
                                fontSize: '18px',
                                color: '#1B1816',
                                cursor: Boolean(item.issue) || item.qty >= (item.maxQuantity || 10) ? 'not-allowed' : 'pointer',
                                width: '18px',
                                height: '18px',
                                lineHeight: 1,
                                opacity: Boolean(item.issue) || item.qty >= (item.maxQuantity || 10) ? 0.4 : 1,
                              }}
                            >
                              +
                            </button>
                          </div>

                          <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap' }}>
                            <button
                              type="button"
                              onClick={() => handleSaveForLater(item)}
                              disabled={isSaving}
                              style={{
                                border: 'none',
                                background: 'transparent',
                                color: '#4D4743',
                                padding: 0,
                                cursor: isSaving ? 'default' : 'pointer',
                                fontFamily: 'var(--font-sans)',
                                fontSize: '10px',
                                letterSpacing: '0.12em',
                                textTransform: 'uppercase',
                                textDecoration: 'underline',
                                opacity: isSaving ? 0.5 : 1,
                              }}
                            >
                              ♡ Save for later
                            </button>

                            <button
                              type="button"
                              onClick={() => handleRemove(item.id)}
                              disabled={isRemoving}
                              style={{
                                border: 'none',
                                background: 'transparent',
                                color: '#4D4743',
                                padding: 0,
                                cursor: isRemoving ? 'default' : 'pointer',
                                fontFamily: 'var(--font-sans)',
                                fontSize: '10px',
                                letterSpacing: '0.12em',
                                textTransform: 'uppercase',
                                textDecoration: 'underline',
                                opacity: isRemoving ? 0.5 : 1,
                              }}
                            >
                              ✕ Remove
                            </button>
                          </div>
                        </div>
                      </div>

                      <div
                        style={{
                          fontFamily: 'var(--font-sans)',
                          fontSize: '15px',
                          fontWeight: 700,
                          color: '#1B1816',
                          alignSelf: 'start',
                          justifySelf: 'end',
                          marginTop: '8px',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {formatCurrency(item.price * item.qty)}
                      </div>
                    </div>
                  );
                })}
                  </div>
                </>
              )}

              {savedItems.length > 0 && (
                <div style={{ padding: '26px 22px 0' }}>
                  <h3
                    style={{
                      margin: 0,
                      fontFamily: 'var(--font-sans)',
                      fontSize: '11px',
                      letterSpacing: '0.14em',
                      textTransform: 'uppercase',
                      color: '#8A817B',
                    }}
                  >
                    Saved for Later ({savedItems.length})
                  </h3>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginTop: '14px' }}>
                    {savedItems.map((item, index) => (
                      <div
                        key={`saved-${item.name}-${item.color}-${item.size}-${index}`}
                        style={{
                          display: 'grid',
                          gridTemplateColumns: '72px 1fr auto',
                          gap: '14px',
                          padding: '12px 0',
                          borderTop: '1px solid rgba(27, 24, 22, 0.08)',
                        }}
                      >
                        <img
                          src={item.image}
                          alt={item.name}
                          style={{ width: '72px', height: '72px', objectFit: 'cover', borderRadius: '10px', background: '#EFEAE4' }}
                        />

                        <div>
                          <div
                            style={{
                              fontFamily: 'var(--font-sans)',
                              fontSize: '14px',
                              fontWeight: 700,
                              color: '#1B1816',
                            }}
                          >
                            {item.name}
                          </div>
                          <div
                            style={{
                              fontFamily: 'var(--font-sans)',
                              fontSize: '12px',
                              color: '#7A726C',
                              marginTop: '4px',
                            }}
                          >
                            Color: {item.color}    Size: {item.size}    Qty: {item.qty}
                          </div>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', justifyContent: 'space-between', gap: '10px' }}>
                          <div
                            style={{
                              fontFamily: 'var(--font-sans)',
                              fontSize: '14px',
                              fontWeight: 700,
                              color: '#1B1816',
                            }}
                          >
                            {formatCurrency(item.price)}
                          </div>

                          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <button
                              type="button"
                              onClick={() => moveToBag(item)}
                              style={{
                                border: 'none',
                                background: '#1B1816',
                                color: '#FDFBF7',
                                borderRadius: '999px',
                                padding: '8px 12px',
                                cursor: 'pointer',
                                fontFamily: 'var(--font-sans)',
                                fontSize: '9px',
                                letterSpacing: '0.12em',
                                textTransform: 'uppercase',
                              }}
                            >
                              ⤒ Move to Bag
                            </button>

                            <button
                              type="button"
                              onClick={() => removeItem(item.id)}
                              style={{
                                border: 'none',
                                background: 'transparent',
                                color: '#4D4743',
                                padding: 0,
                                cursor: 'pointer',
                                fontFamily: 'var(--font-sans)',
                                fontSize: '10px',
                                letterSpacing: '0.12em',
                                textTransform: 'uppercase',
                                textDecoration: 'underline',
                              }}
                            >
                              Remove
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          ) : (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                height: '100%',
                padding: '40px 32px',
                textAlign: 'center',
              }}
            >
              <div
                style={{
                  width: '92px',
                  height: '92px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: '50%',
                  background: '#EFEAE4',
                  marginBottom: '22px',
                }}
              >
                <svg width="42" height="42" viewBox="0 0 24 24" fill="none" stroke="#1B1816" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M6 7h12l-1 12H7L6 7Z" />
                  <path d="M9 7V5a3 3 0 0 1 6 0v2" />
                </svg>
              </div>

              <h3
                style={{
                  margin: 0,
                  fontFamily: 'var(--font-serif)',
                  fontSize: '30px',
                  fontStyle: 'italic',
                  color: '#1B1816',
                }}
              >
                Your bag is empty.
              </h3>

              <p
                style={{
                  margin: '12px 0 0',
                  fontFamily: 'var(--font-sans)',
                  color: '#726B66',
                  fontSize: '14px',
                  maxWidth: '260px',
                  lineHeight: 1.6,
                }}
              >
                Save your selections and continue exploring the collection.
              </p>

              <button
                type="button"
                onClick={closeCart}
                style={{
                  marginTop: '22px',
                  border: 'none',
                  background: '#1B1816',
                  color: '#FDFBF7',
                  fontFamily: 'var(--font-sans)',
                  fontSize: '10px',
                  letterSpacing: '0.14em',
                  textTransform: 'uppercase',
                  padding: '14px 22px',
                  borderRadius: '999px',
                  cursor: 'pointer',
                }}
              >
                Continue Shopping
              </button>
            </div>
          )}
        </div>

        {!isEmpty && (
          <footer
            style={{
              background: '#F5F0E9',
              borderTop: '1px solid rgba(27, 24, 22, 0.08)',
              padding: '18px 22px 22px',
              boxShadow: '0 -10px 18px rgba(27,24,22,0.04)',
            }}
          >
            <div style={{ marginBottom: '12px' }}>
              <h4
                style={{
                  margin: 0,
                  fontFamily: 'var(--font-sans)',
                  fontSize: '11px',
                  letterSpacing: '0.14em',
                  textTransform: 'uppercase',
                  color: '#1B1816',
                }}
              >
                Order Summary
              </h4>
            </div>

            <div style={{ display: 'grid', gap: '10px', marginBottom: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontFamily: 'var(--font-sans)', fontSize: '14px', color: '#1B1816' }}>
                <span>Subtotal</span>
                <strong>{formatCurrency(subtotalValue)}</strong>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontFamily: 'var(--font-sans)', fontSize: '14px', color: '#1B1816' }}>
                <span>Shipping</span>
                <span style={{ color: '#227B51', fontWeight: 600 }}>COMPLIMENTARY</span>
              </div>

              {appliedPromo && (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontFamily: 'var(--font-sans)', fontSize: '14px', color: '#1B1816' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ color: '#227B51', fontSize: '12px' }}>✓</span>
                    <span>{appliedPromo}</span>
                  </span>
                  <strong style={{ color: '#1B1816' }}>-{formatCurrency(promoDiscount)}</strong>
                </div>
              )}
            </div>

            <div style={{ marginTop: '12px', marginBottom: '8px' }}>
              <div style={{ fontFamily: 'var(--font-sans)', fontSize: '10px', letterSpacing: '0.14em', textTransform: 'uppercase', color: '#7A726C', marginBottom: '8px' }}>Promo codes</div>
              <p style={{ margin: 0, fontFamily: 'var(--font-sans)', fontSize: '12px', color: '#7A726C', lineHeight: 1.5 }}>
                Promo codes are not available yet.
              </p>
            </div>

            <div style={{ borderTop: '1px solid rgba(27, 24, 22, 0.08)', margin: '16px 0 14px' }} />

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '8px' }}>
              <span style={{ fontFamily: 'var(--font-sans)', fontSize: '14px', color: '#1B1816' }}>Total</span>
              <span style={{ fontFamily: 'var(--font-sans)', fontSize: '30px', fontWeight: 700, color: '#1B1816', lineHeight: 1 }}>{formatCurrency(totalValue)}</span>
            </div>
            <div style={{ fontFamily: 'var(--font-sans)', fontSize: '10px', letterSpacing: '0.12em', textTransform: 'uppercase', color: '#7A726C', marginBottom: '18px' }}>VAT & duties included</div>

            {hasCartIssues && (
              <p style={{ margin: '0 0 12px', fontFamily: 'var(--font-sans)', fontSize: '12px', color: '#A14A3F', lineHeight: 1.5 }}>
                Resolve unavailable or out-of-stock items before checkout.
              </p>
            )}
            <button
              type="button"
              disabled={hasCartIssues}
              onClick={() => {
                if (hasCartIssues) return;
                closeCart();
                if (go) go('/checkout');
              }}
              style={{
                width: '100%',
                background: hasCartIssues ? '#B1A9A2' : '#1B1816',
                border: 'none',
                color: '#FDFBF7',
                borderRadius: '999px',
                padding: '16px 18px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                fontFamily: 'var(--font-sans)',
                fontSize: '10px',
                letterSpacing: '0.14em',
                textTransform: 'uppercase',
                cursor: hasCartIssues ? 'not-allowed' : 'pointer',
                opacity: hasCartIssues ? 0.7 : 1,
              }}
            >
              Proceed to Checkout <span aria-hidden="true">→</span>
            </button>

            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', margin: '16px 0 10px' }}>
              <div style={{ flex: 1, height: '1px', background: 'rgba(27, 24, 22, 0.12)' }} />
              <span style={{ fontFamily: 'var(--font-sans)', fontSize: '10px', letterSpacing: '0.14em', textTransform: 'uppercase', color: '#7A726C' }}>or</span>
              <div style={{ flex: 1, height: '1px', background: 'rgba(27, 24, 22, 0.12)' }} />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '16px' }}>
              <button
                type="button"
                style={{
                  background: '#1B1816',
                  color: '#FDFBF7',
                  border: 'none',
                  borderRadius: '999px',
                  padding: '12px 10px',
                  fontFamily: 'var(--font-sans)',
                  fontSize: '12px',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                Pay
              </button>
              <button
                type="button"
                style={{
                  background: '#1B1816',
                  color: '#FDFBF7',
                  border: 'none',
                  borderRadius: '999px',
                  padding: '12px 10px',
                  fontFamily: 'var(--font-sans)',
                  fontSize: '12px',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                G Pay
              </button>
            </div>

            <div style={{ textAlign: 'center', fontFamily: 'var(--font-sans)', fontSize: '10px', letterSpacing: '0.12em', textTransform: 'uppercase', color: '#7A726C' }}>
              Secure Checkout · Complimentary Returns
            </div>
          </footer>
        )}
      </aside>
    </>
  );
}
