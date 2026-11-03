import { useState, useCallback } from 'react';
import { useCart } from '../../context/CartContext';

/* ─── SVG icons ──────────────────────────────────────────────────────────── */

function HeartIcon({ filled }) {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill={filled ? 'currentColor' : 'none'}
      stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
    </svg>
  );
}

function BagIcon({ added }) {
  return added ? (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  ) : (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" />
      <line x1="3" y1="6" x2="21" y2="6" />
      <path d="M16 10a4 4 0 0 1-8 0" />
    </svg>
  );
}

function EyeIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function ArrowIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M5 12h14M12 5l7 7-7 7" />
    </svg>
  );
}

/* ─── Circular icon button ───────────────────────────────────────────────── */

function IconBtn({ onClick, label, children }) {
  const [btnHovered, setBtnHovered] = useState(false);
  return (
    <button
      onClick={onClick}
      aria-label={label}
      onMouseEnter={() => setBtnHovered(true)}
      onMouseLeave={() => setBtnHovered(false)}
      style={{
        width: '38px',
        height: '38px',
        borderRadius: '50%',
        border: '1px solid var(--border-default)',
        background: btnHovered ? 'var(--bg-hover)' : 'var(--bg-surface)',
        color: 'var(--text-primary)',
        boxShadow: btnHovered ? 'var(--shadow-md)' : 'var(--shadow-sm)',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        transition: 'all 220ms cubic-bezier(0.22, 1, 0.36, 1)',
        transform: btnHovered ? 'translateY(-1px)' : 'translateY(0)',
        flexShrink: 0,
      }}
    >
      {children}
    </button>
  );
}

/* ─── Helper for Swatch Styling ─────────────────────────────────────────── */

function getSwatchVisual(rawSwatch, isActive) {
  const hex = (typeof rawSwatch === 'object' && rawSwatch !== null ? rawSwatch.hex : rawSwatch) || '';
  const cleanHex = typeof hex === 'string' ? hex.trim().toLowerCase() : '';
  const isValidHex = /^#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(cleanHex);
  const isWhite = cleanHex === '#fff' || cleanHex === '#ffffff' || cleanHex === '#ffffffff' || cleanHex === 'white';

  const useFallback = !isValidHex || isWhite;
  const background = useFallback ? 'var(--bg-surface-raised)' : cleanHex;
  const border = isActive
    ? '2px solid var(--color-primary)'
    : useFallback
    ? '1.5px solid var(--border-strong)'
    : '1.5px solid var(--border-subtle)';

  return { background, border, title: cleanHex || 'Color swatch' };
}

/* ─── Product card ───────────────────────────────────────────────────────── */

export function ProductCard({ product, go, onAddToCart, onAddToWishlist, showCartIcon = true }) {
  const { isWishlisted, toggleWishlist } = useCart();
  const [hovered, setHovered] = useState(false);
  const [cartAdded, setCartAdded] = useState(false);
  const [activeSwatch, setActiveSwatch] = useState(null); // index of active swatch

  const wishlisted = isWishlisted(product.productId || product.id);

  const displayImage =
    activeSwatch !== null && product.swatches[activeSwatch]?.image
      ? product.swatches[activeSwatch].image
      : product.primaryImage;

  const handleWishlist = useCallback(async (e) => {
    e.stopPropagation();
    const result = await toggleWishlist(product);
    if (result?.ok) {
      onAddToWishlist?.(product);
    }
  }, [product, onAddToWishlist, toggleWishlist]);

  const stockCount = Number(
    product.countInStock != null
      ? product.countInStock
      : (product.stockTotal != null ? product.stockTotal : product.stock)
  );
  const soldOut = Number.isFinite(stockCount) ? stockCount <= 0 : false;

  const handleCart = useCallback(async (e) => {
    e.stopPropagation();
    if (cartAdded || soldOut) return;
    const result = await onAddToCart?.({ ...product, stock: product.stock || 'in-stock' });
    if (result?.ok) {
      setCartAdded(true);
      setTimeout(() => setCartAdded(false), 1800);
    }
  }, [cartAdded, product, onAddToCart, soldOut]);

  const handleView = useCallback((e) => {
    e.stopPropagation();
    go?.(product.path || `/products/${product.slug || product.id}`);
  }, [go, product]);

  const handleSwatchClick = useCallback((e, idx) => {
    e.stopPropagation();
    setActiveSwatch((prev) => (prev === idx ? null : idx));
  }, []);

  const showHeart = hovered;
  const showCart = showCartIcon && hovered;
  const showView = hovered;

  return (
    <article
      onClick={() => go(product.path)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        cursor: 'pointer',
        transition: 'transform 320ms cubic-bezier(0.22, 1, 0.36, 1), box-shadow 320ms cubic-bezier(0.22, 1, 0.36, 1)',
        transform: hovered ? 'translateY(-6px)' : 'translateY(0)',
        borderRadius: '12px',
        willChange: 'transform, box-shadow',
      }}
      aria-label={`View ${product.name}`}
    >
      {/* ── Image container ──────────────────────────────────────── */}
      <div
        style={{
          position: 'relative',
          overflow: 'hidden',
          borderRadius: '4px',
          aspectRatio: '4 / 5',
          backgroundColor: 'var(--bg-surface-sunken)',
          boxShadow: hovered ? 'var(--shadow-md)' : 'var(--shadow-sm)',
          transition: 'box-shadow 320ms cubic-bezier(0.22, 1, 0.36, 1)',
          transform: hovered ? 'translateY(-2px)' : 'translateY(0)',
          willChange: 'transform, box-shadow',
        }}
      >
        {/* Primary image */}
        <img
          src={displayImage}
          alt={product.name}
          loading="lazy"
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            objectPosition: 'center top',
            opacity: hovered && !activeSwatch ? 0 : 1,
            transform: hovered && !activeSwatch ? 'scale(1.06)' : 'scale(1)',
            transition: 'opacity 420ms cubic-bezier(0.22, 1, 0.36, 1), transform 500ms cubic-bezier(0.22, 1, 0.36, 1)',
            willChange: 'opacity, transform',
          }}
        />
        {/* Hover / secondary image */}
        <img
          src={product.hoverImage}
          alt={`${product.name} — alternate view`}
          loading="lazy"
          aria-hidden="true"
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            objectPosition: 'center top',
            opacity: hovered && !activeSwatch ? 1 : 0,
            transform: hovered && !activeSwatch ? 'scale(1.06)' : 'scale(1)',
            transition: 'opacity 420ms cubic-bezier(0.22, 1, 0.36, 1), transform 500ms cubic-bezier(0.22, 1, 0.36, 1)',
            willChange: 'opacity, transform',
          }}
        />

        {/* Bestseller badge */}
        {soldOut && (
          <span
            style={{
              position: 'absolute',
              top: '12px',
              left: '12px',
              background: 'var(--color-primary)',
              color: 'var(--color-primary-contrast)',
              fontSize: '9px',
              fontFamily: 'var(--font-sans)',
              fontWeight: 600,
              letterSpacing: '0.14em',
              textTransform: 'uppercase',
              padding: '4px 10px',
              borderRadius: '100px',
              zIndex: 2,
            }}
          >
            Sold out
          </span>
        )}
        {product.bestseller && !soldOut && (
          <span
            style={{
              position: 'absolute',
              top: '12px',
              left: '12px',
              background: 'var(--color-primary)',
              color: 'var(--color-primary-contrast)',
              fontSize: '9px',
              fontFamily: 'var(--font-sans)',
              fontWeight: 600,
              letterSpacing: '0.14em',
              textTransform: 'uppercase',
              padding: '4px 10px',
              borderRadius: '100px',
              zIndex: 2,
            }}
          >
            Bestseller
          </span>
        )}

        {/* Hover-reveal action icons (top-right) */}
        <div
          style={{
            position: 'absolute',
            top: '12px',
            right: '12px',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
            zIndex: 3,
            opacity: showHeart || showCart || showView ? 1 : 0,
            transform: showHeart || showCart || showView ? 'translateY(0) scale(1)' : 'translateY(6px) scale(0.9)',
            transition: 'opacity 260ms cubic-bezier(0.22, 1, 0.36, 1), transform 260ms cubic-bezier(0.22, 1, 0.36, 1)',
            willChange: 'opacity, transform',
          }}
        >
          <div style={{ opacity: showHeart ? 1 : 0, transition: 'opacity 220ms ease' }}>
            <IconBtn onClick={handleWishlist} label={wishlisted ? 'Remove from wishlist' : 'Add to wishlist'}>
              <HeartIcon filled={wishlisted} />
            </IconBtn>
          </div>
          <div style={{ opacity: showView ? 1 : 0, transition: 'opacity 220ms ease' }}>
            <IconBtn onClick={handleView} label="View product details">
              <EyeIcon />
            </IconBtn>
          </div>
          {showCartIcon && !soldOut && (
            <div style={{ opacity: showCart ? 1 : 0, transition: 'opacity 220ms ease' }}>
              <IconBtn onClick={handleCart} label="Add to cart">
                <BagIcon added={cartAdded} />
              </IconBtn>
            </div>
          )}
        </div>
      </div>

      {/* ── Product info ─────────────────────────────────────────── */}
      <div style={{ padding: '14px 2px 0' }}>
        {product.contextNote && (
          <p style={{
            margin: '0 0 8px',
            fontFamily: 'var(--font-serif)',
            fontStyle: 'italic',
            fontSize: '12px',
            color: 'var(--text-muted)',
            lineHeight: 1.4,
          }}>
            {product.contextNote}
          </p>
        )}

        {/* Row 1: Name + Price */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '8px', marginBottom: '5px' }}>
          <p style={{
            margin: 0,
            fontFamily: 'var(--font-sans)',
            fontSize: '14px',
            fontWeight: 500,
            color: 'var(--text-primary)',
            lineHeight: 1.3,
            flex: 1,
            minWidth: 0,
            overflow: 'hidden',
            whiteSpace: 'nowrap',
            textOverflow: 'ellipsis',
          }}>
            {product.name}
          </p>
          <p style={{
            margin: 0,
            fontFamily: 'var(--font-sans)',
            fontSize: '14px',
            fontWeight: 600,
            color: 'var(--text-primary)',
            flexShrink: 0,
          }}>
            {typeof product.price === 'number' ? `$${product.price.toFixed(2)}` : product.price}
          </p>
        </div>

        {/* Row 2: Variant */}
        <div style={{ marginBottom: '10px', minHeight: '18px' }}>
          <p style={{
            margin: 0,
            fontFamily: 'var(--font-sans)',
            fontSize: '12px',
            color: 'var(--text-muted)',
            letterSpacing: '0.01em',
          }}>
            {product.variant}
          </p>
        </div>

        {/* Row 3: Swatches */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
          {(product.swatches || []).map((swatch, idx) => {
            const visual = getSwatchVisual(swatch, activeSwatch === idx);
            return (
              <button
                key={idx}
                type="button"
                onClick={(e) => handleSwatchClick(e, idx)}
                aria-label={`Select colour swatch ${idx + 1}`}
                title={visual.title}
                style={{
                  width: '15px',
                  height: '15px',
                  borderRadius: '50%',
                  background: visual.background,
                  border: visual.border,
                  cursor: 'pointer',
                  padding: 0,
                  flexShrink: 0,
                  transition: 'border-color 0.15s, transform 0.15s',
                  transform: activeSwatch === idx ? 'scale(1.15)' : 'scale(1)',
                }}
              />
            );
          })}
          <span style={{
            fontFamily: 'var(--font-sans)',
            fontSize: '11px',
            color: 'var(--text-muted)',
            letterSpacing: '0.04em',
          }}>
            {product.swatches?.length || 1} Shade{(product.swatches?.length || 1) !== 1 ? 's' : ''}
          </span>
        </div>
      </div>
    </article>
  );
}

/* ─── Section ────────────────────────────────────────────────────────────── */

export default function NewArrivalsSection({ go, products = [], loading = false, onAddToCart, onAddToWishlist }) {
  return (
    <section
      aria-labelledby="new-arrivals-heading"
      style={{
        backgroundColor: 'var(--bg-main)',
        padding: '80px 0',
      }}
    >
      <div
        style={{ maxWidth: '1400px', margin: '0 auto', padding: '0 40px' }}
        className="na-container"
      >
        {/* ── Section header ───────────────────────────────────────── */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-end',
            marginBottom: '48px',
            gap: '24px',
          }}
          className="na-header"
        >
          {/* Left */}
          <div>
            <span style={{
              display: 'block',
              fontFamily: 'var(--font-sans)',
              fontSize: '11px',
              fontWeight: 500,
              letterSpacing: '0.2em',
              textTransform: 'uppercase',
              color: 'var(--text-muted)',
              marginBottom: '12px',
            }}>
              Seasonal Editions
            </span>
            <h2
              id="new-arrivals-heading"
              style={{
                fontFamily: 'var(--font-serif)',
                fontSize: 'clamp(38px, 4.5vw, 52px)',
                fontWeight: 400,
                fontStyle: 'italic',
                lineHeight: 1.0,
                letterSpacing: '-0.02em',
                color: 'var(--text-primary)',
                margin: '0 0 12px',
              }}
            >
              New Arrivals
            </h2>
            <p style={{
              fontFamily: 'var(--font-sans)',
              fontSize: '14px',
              fontWeight: 300,
              color: 'var(--text-muted)',
              margin: 0,
              lineHeight: 1.5,
            }}>
              Discover the latest pieces made for the changing season.
            </p>
          </div>

          {/* Right: View All link */}
          <button
            type="button"
            onClick={() => go('/shop?sort=newest')}
            aria-label="View all new arrivals"
            style={{
              background: 'none',
              border: 'none',
              padding: 0,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              fontFamily: 'var(--font-sans)',
              fontSize: '11px',
              fontWeight: 500,
              letterSpacing: '0.14em',
              textTransform: 'uppercase',
              color: 'var(--text-primary)',
              whiteSpace: 'nowrap',
              flexShrink: 0,
              borderBottom: '1px solid var(--text-primary)',
              paddingBottom: '2px',
              transition: 'opacity 0.2s',
            }}
            onMouseEnter={e => (e.currentTarget.style.opacity = '0.55')}
            onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
            className="na-view-all"
          >
            View all new arrivals
            <ArrowIcon />
          </button>
        </div>

        {/* ── Product grid ─────────────────────────────────────────── */}
        {loading ? (
          /* Skeleton */
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '28px' }} className="na-grid">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i}>
                <div style={{ aspectRatio: '4/5', background: 'var(--skeleton-base)', borderRadius: '4px', animation: 'na-pulse 1.5s ease-in-out infinite' }} />
                <div style={{ padding: '14px 2px 0', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div style={{ height: '13px', background: 'var(--skeleton-base)', borderRadius: '2px', width: '70%', animation: 'na-pulse 1.5s ease-in-out infinite' }} />
                  <div style={{ height: '11px', background: 'var(--skeleton-base)', borderRadius: '2px', width: '40%', animation: 'na-pulse 1.5s ease-in-out infinite' }} />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '28px' }} className="na-grid">
            {products.map((product) => (
              <ProductCard
                key={product.id || product.slug}
                product={product}
                go={go}
                onAddToCart={onAddToCart}
                onAddToWishlist={onAddToWishlist}
              />
            ))}
          </div>
        )}
      </div>

      {/* ── Responsive + skeleton animation ─────────────────────────── */}
      <style>{`
        @keyframes na-pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
        @media (max-width: 1023px) {
          .na-grid { grid-template-columns: repeat(2, 1fr) !important; }
        }
        @media (max-width: 767px) {
          .na-container { padding: 0 20px !important; }
          .na-header { flex-direction: column !important; align-items: flex-start !important; gap: 20px !important; }
          .na-view-all { align-self: flex-start; }
          .na-grid { grid-template-columns: repeat(2, 1fr) !important; gap: 16px !important; }
        }
      `}</style>
    </section>
  );
}
