import { useMemo, useState } from 'react';
import AccountLayout from '../components/account/AccountLayout';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';

const formatMoney = (value) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(Number(value || 0));

function StockBadge({ stock }) {
  const stockMap = {
    'in-stock': { label: 'In stock', bg: 'var(--bg-surface-raised)', color: 'var(--text-primary)' },
    'low-stock': { label: 'Low stock', bg: 'rgba(212,166,98,0.2)', color: 'var(--color-warning)' },
    'out-of-stock': { label: 'Sold out', bg: 'rgba(217,83,79,0.2)', color: 'var(--color-danger)' },
    waitlist: { label: 'Waitlist', bg: 'var(--bg-surface-sunken)', color: 'var(--text-secondary)' },
  };

  const meta = stockMap[stock] || stockMap['in-stock'];

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: '999px',
        padding: '5px 8px',
        background: meta.bg,
        color: meta.color,
        fontFamily: 'var(--font-sans)',
        fontSize: '9px',
        letterSpacing: '0.12em',
        textTransform: 'uppercase',
        fontWeight: 700,
      }}
    >
      {meta.label}
    </span>
  );
}

export default function WishlistPage({ go, currentPath }) {
  const { wishlistItems, removeWishlistItem, addWishlistItemToCart, openCart } = useCart();
  const { isAuthenticated } = useAuth();
  const [removingIds, setRemovingIds] = useState([]);

  const summary = useMemo(() => {
    const count = wishlistItems.length;
    if (count === 0) return '0 saved pieces';
    return `${count} saved piece${count === 1 ? '' : 's'}`;
  }, [wishlistItems.length]);

  const handleAddToBag = async (item) => {
    const itemId = item.productId || item.id || item._id;
    setRemovingIds((current) => [...current, itemId]);
    const result = await addWishlistItemToCart(item);
    setRemovingIds((current) => current.filter((entry) => entry !== itemId));

    if (result?.ok) {
      openCart?.();
    }
  };

  return (
    <AccountLayout go={go} currentPath={currentPath || '/account/wishlist'}>
      <section style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-default)', borderRadius: '14px', padding: '26px 22px 22px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontFamily: 'var(--font-sans)', fontSize: '10px', letterSpacing: '0.16em', textTransform: 'uppercase', color: 'var(--text-secondary)', marginBottom: '8px' }}>
              Saved Pieces
            </div>
            <h2 style={{ margin: 0, fontFamily: 'var(--font-serif)', fontSize: 'clamp(30px, 3vw, 42px)', fontWeight: 500, letterSpacing: '-0.04em', color: 'var(--text-primary)' }}>
              My Wishlist
            </h2>
          </div>

          <div style={{ fontFamily: 'var(--font-sans)', fontSize: '11px', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--text-secondary)' }}>
            {summary}
          </div>
        </div>
      </section>

      {!isAuthenticated && (
        <section
          style={{
            background: 'var(--bg-surface)',
            border: '1px solid var(--border-default)',
            borderRadius: '14px',
            padding: '16px 22px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '16px',
            flexWrap: 'wrap',
          }}
        >
          <div>
            <div style={{ fontFamily: 'var(--font-sans)', fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>
              Sync your wishlist across devices
            </div>
            <div style={{ fontFamily: 'var(--font-sans)', fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px' }}>
              Sign in to save your curated edit permanently to your account.
            </div>
          </div>
          <button
            type="button"
            onClick={() => go ? go('/login') : window.dispatchEvent(new CustomEvent('novashop:navigate', { detail: { path: '/login' } }))}
            style={{
              border: 'none',
              background: 'var(--color-primary)',
              color: 'var(--color-primary-contrast)',
              borderRadius: '999px',
              padding: '10px 22px',
              fontFamily: 'var(--font-sans)',
              fontSize: '10px',
              letterSpacing: '0.14em',
              textTransform: 'uppercase',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
            }}
          >
            Sign In
          </button>
        </section>
      )}

      {wishlistItems.length === 0 ? (
        <section style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-default)', borderRadius: '14px', padding: '48px 22px', textAlign: 'center' }}>
          <div style={{ fontFamily: 'var(--font-serif)', fontSize: '28px', color: 'var(--text-primary)', marginBottom: '8px' }}>Your wishlist is empty.</div>
          <p style={{ margin: '0 0 18px', fontFamily: 'var(--font-sans)', fontSize: '14px', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
            Save a few pieces you love and come back here anytime.
          </p>
          <button
            type="button"
            onClick={() => go ? go('/shop') : window.dispatchEvent(new CustomEvent('novashop:navigate', { detail: { path: '/shop' } }))}
            style={{ border: 'none', background: 'var(--color-primary)', color: 'var(--color-primary-contrast)', borderRadius: '999px', padding: '12px 24px', fontFamily: 'var(--font-sans)', fontSize: '10px', letterSpacing: '0.14em', textTransform: 'uppercase', cursor: 'pointer' }}
          >
            Explore Catalog
          </button>
        </section>
      ) : (
        <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '18px' }}>
          {wishlistItems.map((item) => {
            const isRemoving = removingIds.includes(item.id) || removingIds.includes(item.productId);
            const stockCount = Number(
              item.countInStock != null
                ? item.countInStock
                : (item.stockTotal != null ? item.stockTotal : item.stock)
            );
            const isSoldOut = Number.isFinite(stockCount) ? stockCount <= 0 : item.stock === 'out-of-stock';
            return (
              <article
                key={item.id}
                style={{
                  background: 'var(--bg-surface)',
                  border: '1px solid var(--border-default)',
                  borderRadius: '16px',
                  overflow: 'hidden',
                  opacity: isRemoving ? 0 : 1,
                  transform: isRemoving ? 'translateX(8px)' : 'translateX(0)',
                  transition: 'opacity 250ms ease, transform 250ms ease, max-height 250ms ease',
                  maxHeight: isRemoving ? '0px' : '520px',
                }}
              >
                <img
                  src={item.image}
                  alt={item.name}
                  onClick={() => {
                    const productSlug = item.slug || item.productId || item.id || item._id;
                    const productPath = item.path || `/products/${productSlug}`;
                    if (go) go(productPath);
                    else window.dispatchEvent(new CustomEvent('novashop:navigate', { detail: { path: productPath } }));
                  }}
                  style={{ display: 'block', width: '100%', height: '280px', objectFit: 'cover', background: 'var(--bg-surface-sunken)', cursor: 'pointer' }}
                />

                <div style={{ padding: '16px 16px 18px', display: 'grid', gap: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
                    <StockBadge stock={item.stock} />
                    <button
                      type="button"
                      onClick={() => removeWishlistItem(item.productId || item.id)}
                      style={{
                        background: 'transparent',
                        border: '1px solid var(--border-default)',
                        borderRadius: '999px',
                        padding: '8px 10px',
                        cursor: 'pointer',
                        fontFamily: 'var(--font-sans)',
                        fontSize: '9px',
                        letterSpacing: '0.12em',
                        textTransform: 'uppercase',
                        color: 'var(--text-primary)',
                      }}
                    >
                      Remove
                    </button>
                  </div>

                  <div
                    onClick={() => {
                      const productSlug = item.slug || item.productId || item.id || item._id;
                      const productPath = item.path || `/products/${productSlug}`;
                      if (go) go(productPath);
                      else window.dispatchEvent(new CustomEvent('novashop:navigate', { detail: { path: productPath } }));
                    }}
                    style={{ cursor: 'pointer' }}
                  >
                    <div style={{ fontFamily: 'var(--font-sans)', fontSize: '11px', letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--text-secondary)', marginBottom: '6px' }}>
                      {item.category}
                    </div>
                    <div style={{ fontFamily: 'var(--font-serif)', fontSize: '22px', color: 'var(--text-primary)', lineHeight: 1.15 }}>{item.name}</div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', flexWrap: 'wrap' }}>
                    <div style={{ fontFamily: 'var(--font-sans)', fontSize: '13px', color: 'var(--text-primary)', fontWeight: 600 }}>
                      {formatMoney(item.price)}
                      {item.originalPrice && Number(item.originalPrice) > Number(item.price) && (
                        <span style={{ marginLeft: '8px', color: 'var(--text-muted)', textDecoration: 'line-through', fontWeight: 400 }}>
                          {formatMoney(item.originalPrice)}
                        </span>
                      )}
                    </div>
                    <div style={{ fontFamily: 'var(--font-sans)', fontSize: '11px', color: 'var(--text-secondary)' }}>{item.size}</div>
                  </div>

                  <button
                    type="button"
                    disabled={isSoldOut}
                    onClick={() => handleAddToBag(item)}
                    style={{
                      background: isSoldOut ? 'var(--text-muted)' : 'var(--color-primary)',
                      color: 'var(--color-primary-contrast)',
                      border: 'none',
                      borderRadius: '999px',
                      padding: '12px 14px',
                      cursor: isSoldOut ? 'not-allowed' : 'pointer',
                      fontFamily: 'var(--font-sans)',
                      fontSize: '10px',
                      letterSpacing: '0.14em',
                      textTransform: 'uppercase',
                      opacity: isSoldOut ? 0.7 : 1,
                    }}
                  >
                    {isSoldOut ? 'Sold out' : 'Add to Bag'}
                  </button>
                </div>
              </article>
            );
          })}
        </section>
      )}
    </AccountLayout>
  );
}
