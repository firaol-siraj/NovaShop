import { useMemo, useState } from 'react';
import AccountLayout from '../components/account/AccountLayout';
import { useCart } from '../context/CartContext';

const formatMoney = (value) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(Number(value || 0));

function StockBadge({ stock }) {
  const stockMap = {
    'in-stock': { label: 'In stock', bg: '#EAE4DC', color: '#1B1816' },
    'low-stock': { label: 'Low stock', bg: '#EFE2C8', color: '#5A4631' },
    'out-of-stock': { label: 'Sold out', bg: '#E8D4CF', color: '#8A3B32' },
    waitlist: { label: 'Waitlist', bg: '#E6E0DB', color: '#4A453F' },
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
  const { wishlistItems, removeWishlistItem, addWishlistItemToCart } = useCart();
  const [removingIds, setRemovingIds] = useState([]);

  const summary = useMemo(() => {
    const count = wishlistItems.length;
    return `${count} saved piece${count === 1 ? '' : 's'}`;
  }, [wishlistItems.length]);

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

  return (
    <AccountLayout go={go} currentPath={currentPath || '/account/wishlist'}>
      <section style={{ background: '#F7F2EA', border: '1px solid rgba(27,24,22,0.12)', borderRadius: '14px', padding: '26px 22px 22px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontFamily: 'var(--font-sans)', fontSize: '10px', letterSpacing: '0.16em', textTransform: 'uppercase', color: '#7A726C', marginBottom: '8px' }}>
              Saved Pieces
            </div>
            <h2 style={{ margin: 0, fontFamily: 'var(--font-serif)', fontSize: 'clamp(30px, 3vw, 42px)', fontWeight: 500, letterSpacing: '-0.04em', color: '#1B1816' }}>
              My Wishlist
            </h2>
          </div>

          <div style={{ fontFamily: 'var(--font-sans)', fontSize: '11px', letterSpacing: '0.12em', textTransform: 'uppercase', color: '#6E6962' }}>
            {summary}
          </div>
        </div>
      </section>

      {wishlistItems.length === 0 ? (
        <section style={{ background: '#F7F2EA', border: '1px solid rgba(27,24,22,0.12)', borderRadius: '14px', padding: '34px 22px', textAlign: 'center' }}>
          <div style={{ fontFamily: 'var(--font-serif)', fontSize: '28px', color: '#1B1816', marginBottom: '8px' }}>Your wishlist is empty.</div>
          <p style={{ margin: '0 0 18px', fontFamily: 'var(--font-sans)', fontSize: '14px', color: '#6E6962', lineHeight: 1.6 }}>
            Save a few pieces you love and come back here anytime.
          </p>
          <button type="button" onClick={() => go('/shop')} style={{ border: 'none', background: '#1B1816', color: '#FDFBF7', borderRadius: '999px', padding: '12px 20px', fontFamily: 'var(--font-sans)', fontSize: '10px', letterSpacing: '0.14em', textTransform: 'uppercase', cursor: 'pointer' }}>
            Continue Shopping
          </button>
        </section>
      ) : (
        <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '18px' }}>
          {wishlistItems.map((item) => {
            const isRemoving = removingIds.includes(item.id);
            return (
              <article
                key={item.id}
                style={{
                  background: '#F7F2EA',
                  border: '1px solid rgba(27,24,22,0.12)',
                  borderRadius: '16px',
                  overflow: 'hidden',
                  opacity: isRemoving ? 0 : 1,
                  transform: isRemoving ? 'translateX(8px)' : 'translateX(0)',
                  transition: 'opacity 250ms ease, transform 250ms ease, max-height 250ms ease',
                  maxHeight: isRemoving ? '0px' : '520px',
                }}
              >
                <img src={item.image} alt={item.name} style={{ display: 'block', width: '100%', height: '280px', objectFit: 'cover', background: '#EFE8DF' }} />

              <div style={{ padding: '16px 16px 18px', display: 'grid', gap: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
                  <StockBadge stock={item.stock} />
                  <button
                    type="button"
                    onClick={() => removeWishlistItem(item.id)}
                    style={{
                      background: 'transparent',
                      border: '1px solid rgba(27,24,22,0.18)',
                      borderRadius: '999px',
                      padding: '8px 10px',
                      cursor: 'pointer',
                      fontFamily: 'var(--font-sans)',
                      fontSize: '9px',
                      letterSpacing: '0.12em',
                      textTransform: 'uppercase',
                      color: '#1B1816',
                    }}
                  >
                    Remove
                  </button>
                </div>

                <div>
                  <div style={{ fontFamily: 'var(--font-sans)', fontSize: '11px', letterSpacing: '0.14em', textTransform: 'uppercase', color: '#7A726C', marginBottom: '6px' }}>
                    {item.category}
                  </div>
                  <div style={{ fontFamily: 'var(--font-serif)', fontSize: '22px', color: '#1B1816', lineHeight: 1.15 }}>{item.name}</div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', flexWrap: 'wrap' }}>
                  <div style={{ fontFamily: 'var(--font-sans)', fontSize: '13px', color: '#1B1816', fontWeight: 600 }}>
                    {formatMoney(item.price)}
                    {item.originalPrice && Number(item.originalPrice) > Number(item.price) && (
                      <span style={{ marginLeft: '8px', color: '#7A726C', textDecoration: 'line-through', fontWeight: 400 }}>
                        {formatMoney(item.originalPrice)}
                      </span>
                    )}
                  </div>
                  <div style={{ fontFamily: 'var(--font-sans)', fontSize: '11px', color: '#7A726C' }}>{item.size}</div>
                </div>

                <button
                  type="button"
                  disabled={Number(item.stockTotal) === 0 || item.stock === 'out-of-stock'}
                  onClick={() => handleAddToBag(item)}
                  style={{
                    background: Number(item.stockTotal) === 0 || item.stock === 'out-of-stock' ? '#B1A9A2' : '#1B1816',
                    color: '#FDFBF7',
                    border: 'none',
                    borderRadius: '999px',
                    padding: '12px 14px',
                    cursor: Number(item.stockTotal) === 0 || item.stock === 'out-of-stock' ? 'not-allowed' : 'pointer',
                    fontFamily: 'var(--font-sans)',
                    fontSize: '10px',
                    letterSpacing: '0.14em',
                    textTransform: 'uppercase',
                    opacity: Number(item.stockTotal) === 0 || item.stock === 'out-of-stock' ? 0.7 : 1,
                  }}
                >
                  {Number(item.stockTotal) === 0 || item.stock === 'out-of-stock' ? 'Sold out' : 'Add to Bag'}
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
