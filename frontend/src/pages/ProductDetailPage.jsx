import { useEffect, useState } from 'react';
import NewsletterSection from '../components/home/NewsletterSection';
import { ProductCard } from '../components/home/NewArrivalsSection';
import { useCart } from '../context/CartContext';
import { productApi } from '../lib/api/productApi';
import { normalizeCatalog, normalizeProduct } from '../lib/catalog';

const LOW_STOCK_THRESHOLD = 5;
const MAX_QTY_PER_LINE = 10;

function formatPrice(value) {
  return `$${Number(value).toFixed(0)}`;
}

function getStockMeta(stockCount) {
  if (stockCount <= 0) return { text: 'OUT OF STOCK', color: '#C35745' };
  if (stockCount <= LOW_STOCK_THRESHOLD) return { text: `LOW STOCK — ${stockCount} LEFT`, color: '#B78A3D' };
  return { text: `${stockCount} IN STOCK`, color: '#2B7A48' };
}

function renderStars(rating) {
  const filled = Math.round(rating);
  return Array.from({ length: 5 }, (_, index) => (
    <span key={index} style={{ color: index < filled ? '#1B1816' : '#D5CDC5', fontSize: '16px', lineHeight: 1 }}>{index < filled ? '★' : '★'}</span>
  ));
}

export default function ProductDetailPage({ go, slug }) {
  const { addProductToBag, toggleWishlist, isWishlisted } = useCart();
  const [product, setProduct] = useState(null);
  const [relatedProducts, setRelatedProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedColorIndex, setSelectedColorIndex] = useState(0);
  const [selectedSize, setSelectedSize] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [wishlist, setWishlist] = useState(false);
  const [accordionState, setAccordionState] = useState({ description: true, details: false, fit: false, shipping: false });
  const [selectedImage, setSelectedImage] = useState(0);
  const [isLightboxOpen, setLightboxOpen] = useState(false);
  const [recentlyViewed, setRecentlyViewed] = useState([]);

  useEffect(() => {
    let active = true;
    let normalizedProduct;
    setLoading(true);
    setError('');
    setProduct(null);
    setRelatedProducts([]);

    productApi.getProduct(slug)
      .then((payload) => {
        if (!active) return;
        normalizedProduct = normalizeProduct(payload.data);
        if (!normalizedProduct) throw new Error('Product data is unavailable.');
        setProduct(normalizedProduct);
        setSelectedSize(normalizedProduct.sizes.find((size) => size.available)?.label || normalizedProduct.sizes[0]?.label || '');
        const relatedCategory = normalizedProduct.categorySlug || normalizedProduct.categoryId || normalizedProduct.category;
        return productApi.getProducts({ category: relatedCategory, pageSize: 8 });
      })
      .then((payload) => {
        if (!active || !payload) return;
        setRelatedProducts(
          normalizeCatalog(payload.data || [])
            .filter((item) => item.productId !== normalizedProduct.productId && item.slug !== normalizedProduct.slug)
            .slice(0, 4)
        );
      })
      .catch((requestError) => {
        if (active) setError(requestError.message || 'Unable to load this product.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => { active = false; };
  }, [slug]);

  useEffect(() => {
    if (product) setWishlist(isWishlisted(product.productId || product.id));
  }, [product, isWishlisted]);

  useEffect(() => {
    let active = true;
    let slugs = [];
    try {
      const stored = JSON.parse(localStorage.getItem('novashop_recently_viewed') || '[]');
      slugs = Array.isArray(stored) ? stored : [];
    } catch {
      slugs = [];
    }

    Promise.all(slugs.map((itemSlug) => productApi.getProduct(itemSlug).catch(() => null)))
      .then((responses) => {
        if (!active) return;
        setRecentlyViewed(responses
          .map((response) => response ? normalizeProduct(response.data) : null)
          .filter(Boolean)
          .slice(0, 4));
      });

    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!slug) return;
    try {
      const raw = localStorage.getItem('novashop_recently_viewed');
      const nextList = Array.isArray(JSON.parse(raw || '[]')) ? JSON.parse(raw || '[]') : [];
      const deduped = nextList.filter((item) => item !== slug);
      const updated = [slug, ...deduped].slice(0, 8);
      localStorage.setItem('novashop_recently_viewed', JSON.stringify(updated));
    } catch (error) {
      console.warn('Failed to persist recent history', error);
    }
  }, [slug]);

  const activeColor = product?.colors?.[selectedColorIndex] || product?.colors?.[0];
  const colorSizes = activeColor?.sizes || product?.sizes || [];
  const selectedSizeMeta = colorSizes.find((size) => size.label === selectedSize) || colorSizes.find((size) => size.available);
  const selectedVariantId = selectedSizeMeta?.variantId;
  const variantStock = Number(selectedSizeMeta?.stock) || 0;
  const maxQty = Math.max(1, Math.min(variantStock, MAX_QTY_PER_LINE));
  const galleryImages = activeColor?.images || [];
  const currentPrice = product?.price * quantity || 0;
  const stockMeta = getStockMeta(variantStock);
  const isSoldOut = variantStock <= 0;

  useEffect(() => {
    if (!product) return;
    const sizesForColor = (product.colors?.[selectedColorIndex]?.sizes || []).filter(Boolean);
    const firstAvailable = sizesForColor.find((size) => size.available)?.label || sizesForColor[0]?.label || '';
    setSelectedSize(firstAvailable);
    setQuantity(1);
  }, [product, selectedColorIndex]);

  useEffect(() => {
    setQuantity((current) => Math.min(Math.max(1, current), maxQty));
  }, [maxQty]);

  const toggleAccordion = (key) => setAccordionState((prev) => ({ ...prev, [key]: !prev[key] }));

  if (loading) {
    return <div style={{ backgroundColor: '#F9F6F1', minHeight: '60vh', display: 'grid', placeItems: 'center', fontFamily: 'var(--font-sans)', fontSize: '12px', letterSpacing: '0.12em', textTransform: 'uppercase', color: '#7E7570' }}>Loading product…</div>;
  }

  if (error || !product) {
    return <div style={{ backgroundColor: '#F9F6F1', minHeight: '60vh', display: 'grid', placeItems: 'center', padding: '40px', textAlign: 'center' }}><div><h1 style={{ fontFamily: 'var(--font-serif)', fontSize: '38px', fontStyle: 'italic', margin: 0 }}>Product unavailable</h1><p style={{ fontFamily: 'var(--font-sans)', color: '#746C65' }}>{error || 'The product could not be found.'}</p><button onClick={() => go('/shop')} style={{ marginTop: '18px', background: '#1B1816', color: '#FDFBF7', border: 'none', padding: '12px 20px', cursor: 'pointer' }}>Return to shop</button></div></div>;
  }

  return (
    <div style={{ backgroundColor: '#F9F6F1' }}>
      <div style={{ maxWidth: '1400px', margin: '0 auto', padding: '0 40px 80px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '28px 0 18px', fontFamily: 'var(--font-sans)', fontSize: '11px', letterSpacing: '0.13em', textTransform: 'uppercase', color: '#8D837D', flexWrap: 'wrap' }}>
          <button onClick={() => go('/')} style={{ background: 'none', border: 'none', color: '#8D837D', cursor: 'pointer', padding: 0 }}>Home</button>
          <span>/</span>
          <button onClick={() => go('/shop')} style={{ background: 'none', border: 'none', color: '#8D837D', cursor: 'pointer', padding: 0 }}>Shop</button>
          <span>/</span>
          <button onClick={() => go(`/shop?category=${encodeURIComponent(product.category)}`)} style={{ background: 'none', border: 'none', color: '#8D837D', cursor: 'pointer', padding: 0 }}>{product.category}</button>
          <span>/</span>
          <span style={{ color: '#1B1816' }}>{product.name}</span>
        </div>

        <section style={{ display: 'grid', gridTemplateColumns: '110px minmax(0, 1fr) minmax(320px, 520px)', gap: '20px', alignItems: 'start', paddingTop: '12px' }}>
          <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', gap: '12px', paddingTop: '8px' }}>
            <div style={{ fontFamily: 'var(--font-sans)', fontSize: '10px', letterSpacing: '0.14em', textTransform: 'uppercase', color: '#8D837D', paddingLeft: '8px' }}>{String(Math.min(selectedImage + 1, galleryImages.length)).padStart(2, '0')} / {String(galleryImages.length).padStart(2, '0')}</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {galleryImages.map((src, index) => (
                <button
                  key={`${activeColor.name}-${index}`}
                  onClick={() => setSelectedImage(index)}
                  style={{
                    width: '64px',
                    height: '64px',
                    padding: 0,
                    border: index === selectedImage ? '2px solid #1B1816' : '1px solid rgba(27,24,22,0.14)',
                    background: '#F6F1EB',
                    cursor: 'pointer',
                    borderRadius: '8px',
                    overflow: 'hidden',
                    boxShadow: index === selectedImage ? '0 8px 18px rgba(19, 17, 15, 0.08)' : 'none',
                  }}
                >
                  <img src={src} alt={`${product.name} thumbnail ${index + 1}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                </button>
              ))}
            </div>
          </div>

          <div style={{ position: 'relative' }}>
            <div style={{ position: 'relative', borderRadius: '18px', overflow: 'hidden', background: '#EEE7E0', aspectRatio: '4 / 5', boxShadow: '0 18px 36px rgba(17,14,12,0.05)' }}>
              <img
                src={galleryImages[selectedImage] || galleryImages[0]}
                alt={product.name}
                style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', transition: 'opacity 250ms ease', opacity: 1 }}
              />
              <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, rgba(0,0,0,0) 48%, rgba(0,0,0,0.32) 100%)' }} />
              <button
                onClick={() => setLightboxOpen(true)}
                aria-label="Open image gallery"
                style={{ position: 'absolute', top: '16px', right: '16px', width: '38px', height: '38px', borderRadius: '50%', background: 'rgba(255,255,255,0.72)', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#1B1816" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M15 3h6v6M21 3l-9 9M21 14v6H3V4h6" /></svg>
              </button>
              <div style={{ position: 'absolute', left: '18px', bottom: '18px', color: '#F7F3EE', fontFamily: 'var(--font-sans)', fontSize: '10px', letterSpacing: '0.14em', textTransform: 'uppercase', background: 'rgba(0,0,0,0.18)', padding: '8px 10px', borderRadius: '999px', backdropFilter: 'blur(6px)' }}>{product.brand} · {product.category}</div>
            </div>
          </div>

          <div style={{ paddingTop: '6px' }}>
            <div style={{ fontFamily: 'var(--font-sans)', fontSize: '10px', letterSpacing: '0.18em', textTransform: 'uppercase', color: '#8D837D', marginBottom: '14px' }}>{product.collection}</div>
            <h1 style={{ margin: 0, fontFamily: 'var(--font-serif)', fontSize: 'clamp(34px, 3.2vw, 46px)', lineHeight: 1.05, letterSpacing: '-0.04em', fontWeight: 400, color: '#1B1816', fontStyle: 'italic' }}>{product.name}</h1>

            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '18px', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '5px', color: '#1B1816', fontSize: '15px' }}>{renderStars(product.rating)}</div>
              <span style={{ fontFamily: 'var(--font-sans)', fontSize: '15px', fontWeight: 600, color: '#1B1816' }}>{product.rating}</span>
              <button onClick={() => document.getElementById('reviews-section')?.scrollIntoView({ behavior: 'smooth' })} style={{ background: 'none', border: 'none', borderBottom: '1px solid rgba(27,24,22,0.3)', padding: 0, color: '#5B5652', fontFamily: 'var(--font-sans)', fontSize: '13px', cursor: 'pointer' }}>{product.reviewCount} Client Reviews</button>
            </div>

            <div style={{ display: 'flex', alignItems: 'baseline', gap: '10px', marginTop: '22px', flexWrap: 'wrap' }}>
              <span style={{ fontFamily: 'var(--font-sans)', fontSize: '28px', fontWeight: 700, color: '#1B1816' }}>{formatPrice(product.price)}</span>
              <span style={{ fontFamily: 'var(--font-sans)', fontSize: '12px', color: '#8D837D' }}>Duties & taxes included</span>
            </div>

            <div style={{ marginTop: '28px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px', gap: '12px', flexWrap: 'wrap' }}>
                <div style={{ fontFamily: 'var(--font-sans)', fontSize: '11px', fontWeight: 600, letterSpacing: '0.14em', textTransform: 'uppercase', color: '#1B1816' }}>Color — {activeColor.name.toUpperCase()}</div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                {product.colors.map((color, idx) => (
                  <button
                    key={color.name}
                    onClick={() => {
                      setSelectedColorIndex(idx);
                      setSelectedImage(0);
                    }}
                    aria-label={`Select ${color.name}`}
                    style={{
                      width: '32px',
                      height: '32px',
                      borderRadius: '50%',
                      background: color.hex,
                      border: idx === selectedColorIndex ? '2px solid #1B1816' : '1.5px solid rgba(27,24,22,0.2)',
                      boxShadow: idx === selectedColorIndex ? 'inset 0 0 0 2px #fff' : 'none',
                      cursor: 'pointer',
                      padding: 0,
                    }}
                  />
                ))}
              </div>
            </div>

            <div style={{ marginTop: '26px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px', gap: '12px', flexWrap: 'wrap' }}>
                <div style={{ fontFamily: 'var(--font-sans)', fontSize: '11px', fontWeight: 600, letterSpacing: '0.14em', textTransform: 'uppercase', color: '#1B1816' }}>Size — {product.sizeGuideNote}</div>
                <button style={{ background: 'none', border: 'none', borderBottom: '1px solid rgba(27,24,22,0.5)', padding: 0, color: '#1B1816', fontFamily: 'var(--font-sans)', fontSize: '10px', letterSpacing: '0.14em', textTransform: 'uppercase', cursor: 'pointer' }}>Size Guide ⊞</button>
              </div>
              <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                {colorSizes.map((size) => {
                  const isSelected = selectedSize === size.label;
                  const isDisabled = !size.available || Number(size.stock) <= 0;
                  return (
                    <button
                      key={`${size.variantId || size.label}`}
                      type="button"
                      disabled={isDisabled}
                      aria-label={isDisabled ? `${size.label} sold out` : `Select size ${size.label}`}
                      onClick={() => setSelectedSize(size.label)}
                      style={{
                        minWidth: '52px',
                        padding: '11px 14px',
                        borderRadius: '10px',
                        border: isSelected ? '1px solid #1B1816' : '1px solid rgba(27,24,22,0.2)',
                        background: isSelected ? '#1B1816' : '#FDFBF7',
                        color: isSelected ? '#FDFBF7' : isDisabled ? '#B1A9A2' : '#1B1816',
                        fontFamily: 'var(--font-sans)',
                        fontSize: '11px',
                        fontWeight: 600,
                        letterSpacing: '0.12em',
                        textTransform: 'uppercase',
                        cursor: isDisabled ? 'not-allowed' : 'pointer',
                        textDecoration: isDisabled ? 'line-through' : 'none',
                        opacity: isDisabled ? 0.7 : 1,
                      }}
                    >
                      {isDisabled ? `${size.label} · Sold out` : size.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '20px', color: '#6A615B', fontFamily: 'var(--font-sans)', fontSize: '11px', letterSpacing: '0.12em', textTransform: 'uppercase' }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: stockMeta.color, display: 'inline-block' }} />
              <span>{stockMeta.text}</span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginTop: '26px', flexWrap: 'wrap' }}>
              <div style={{ display: 'inline-flex', alignItems: 'center', border: '1px solid rgba(27,24,22,0.18)', borderRadius: '999px', overflow: 'hidden', background: '#FDFBF7' }}>
                <button type="button" aria-label="Decrease quantity" disabled={isSoldOut || quantity <= 1} onClick={() => setQuantity((v) => Math.max(1, v - 1))} style={{ width: '42px', height: '42px', background: 'none', border: 'none', color: '#1B1816', cursor: isSoldOut || quantity <= 1 ? 'not-allowed' : 'pointer', fontSize: '20px', opacity: isSoldOut || quantity <= 1 ? 0.4 : 1 }}>−</button>
                <span aria-live="polite" style={{ width: '42px', textAlign: 'center', fontFamily: 'var(--font-sans)', fontSize: '13px', fontWeight: 600, color: '#1B1816' }}>{quantity}</span>
                <button type="button" aria-label="Increase quantity" disabled={isSoldOut || quantity >= maxQty} onClick={() => setQuantity((v) => Math.min(maxQty, v + 1))} style={{ width: '42px', height: '42px', background: 'none', border: 'none', color: '#1B1816', cursor: isSoldOut || quantity >= maxQty ? 'not-allowed' : 'pointer', fontSize: '20px', opacity: isSoldOut || quantity >= maxQty ? 0.4 : 1 }}>+</button>
              </div>
              <button
                type="button"
                disabled={isSoldOut || !selectedVariantId}
                onClick={() => {
                  addProductToBag(product, {
                    qty: quantity,
                    variantId: selectedVariantId,
                    color: activeColor?.name,
                    size: selectedSize,
                  });
                }}
                style={{ flex: '1 1 260px', minHeight: '56px', background: isSoldOut ? '#B1A9A2' : '#1B1816', color: '#FDFBF7', border: 'none', borderRadius: '999px', fontFamily: 'var(--font-sans)', fontSize: '11px', letterSpacing: '0.16em', textTransform: 'uppercase', fontWeight: 600, cursor: isSoldOut ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', padding: '0 22px', opacity: isSoldOut ? 0.7 : 1 }}
              >
                <svg width="16" height="16" viewBox=" 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z" /><path d="M3 6h18" /><path d="M16 10a4 4 0 0 1-8 0" /></svg>
                {isSoldOut ? 'Sold out' : `Add to Bag • ${formatPrice(currentPrice)}`}
              </button>
              <button onClick={() => {
                toggleWishlist(product);
              }} style={{ width: '54px', height: '54px', borderRadius: '50%', border: '1px solid rgba(27,24,22,0.18)', background: wishlist ? '#1B1816' : '#FDFBF7', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }} aria-label={wishlist ? 'Remove from wishlist' : 'Add to wishlist'}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill={wishlist ? '#FDFBF7' : 'none'} stroke={wishlist ? '#FDFBF7' : '#1B1816'} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78Z" /></svg>
              </button>
            </div>

            <div style={{ marginTop: '20px', borderTop: '1px solid rgba(27,24,22,0.08)', paddingTop: '18px', display: 'grid', gap: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontFamily: 'var(--font-sans)', fontSize: '12px', color: '#3D3936' }}>
                <span>✦</span>
                <span>{product.shippingNote}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontFamily: 'var(--font-sans)', fontSize: '12px', color: '#3D3936' }}>
                <span>↺</span>
                <span>{product.returnNote}</span>
              </div>
            </div>

            <div style={{ marginTop: '28px', borderTop: '1px solid rgba(27,24,22,0.08)', paddingTop: '10px' }}>
              {[
                { key: 'description', label: 'Description', value: product.description },
                { key: 'details', label: 'Details & Materials', value: `${product.details.material} • ${product.details.fit} • ${product.details.care} • ${product.details.origin}` },
                { key: 'fit', label: 'Size & Fit', value: product.fitNotes },
                { key: 'shipping', label: 'Shipping & Returns', value: product.shippingPolicy },
              ].map((item) => (
                <div key={item.key} style={{ borderBottom: '1px solid rgba(27,24,22,0.08)' }}>
                  <button onClick={() => toggleAccordion(item.key)} style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'none', border: 'none', cursor: 'pointer', padding: '16px 0', color: '#1B1816', fontFamily: 'var(--font-sans)', fontSize: '11px', letterSpacing: '0.16em', textTransform: 'uppercase', textAlign: 'left' }}>
                    {item.label}
                    <span style={{ transform: accordionState[item.key] ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 200ms ease' }}>⌃</span>
                  </button>
                  {accordionState[item.key] && <p style={{ margin: '0 0 18px', fontFamily: 'var(--font-sans)', fontSize: '14px', lineHeight: 1.7, color: '#4F4945' }}>{item.value}</p>}
                </div>
              ))}
            </div>
          </div>
        </section>

        <section style={{ marginTop: '80px', borderTop: '1px solid rgba(27,24,22,0.08)', paddingTop: '40px' }}>
          <h2 style={{ margin: 0, textAlign: 'center', fontFamily: 'var(--font-serif)', fontSize: 'clamp(32px, 3vw, 46px)', fontStyle: 'italic', fontWeight: 400, letterSpacing: '-0.04em', color: '#1B1816' }}>Details & Materials</h2>
          <div style={{ marginTop: '28px', display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', borderTop: '1px solid rgba(27,24,22,0.12)', borderBottom: '1px solid rgba(27,24,22,0.12)' }}>
            {Object.entries(product.details).map(([key, value], index) => (
              <div key={key} style={{ padding: '22px 20px', textAlign: 'center', borderLeft: index > 0 ? '1px solid rgba(27,24,22,0.12)' : 'none' }}>
                <div style={{ fontFamily: 'var(--font-sans)', fontSize: '10px', letterSpacing: '0.16em', textTransform: 'uppercase', color: '#8D837D', marginBottom: '8px' }}>{key}</div>
                <div style={{ fontFamily: 'var(--font-sans)', fontSize: '14px', fontWeight: 600, color: '#1B1816' }}>{value}</div>
              </div>
            ))}
          </div>
        </section>

        <section id="reviews-section" style={{ marginTop: '82px', display: 'grid', gridTemplateColumns: '320px 1fr', gap: '28px', alignItems: 'start' }}>
          <div>
            <h2 style={{ margin: 0, fontFamily: 'var(--font-serif)', fontSize: 'clamp(30px, 2.8vw, 42px)', fontStyle: 'italic', fontWeight: 400, letterSpacing: '-0.04em', color: '#1B1816' }}>Customer Reviews</h2>
            <p style={{ margin: '10px 0 0', fontFamily: 'var(--font-sans)', fontSize: '14px', color: '#6C645E' }}>
              {Number(product.numReviews || product.reviewCount) === 0
                ? 'No reviews yet'
                : `Rated ${Number(product.rating || 0).toFixed(1)} out of 5 based on ${product.numReviews || product.reviewCount} verified reviews`}
            </p>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button type="button" disabled title="Coming soon" aria-label="Write a review, coming soon" style={{ background: 'none', border: '1px solid rgba(27,24,22,0.18)', borderRadius: '999px', padding: '12px 18px', fontFamily: 'var(--font-sans)', fontSize: '10px', letterSpacing: '0.14em', textTransform: 'uppercase', cursor: 'not-allowed', color: '#8D837D', opacity: 0.7 }}>Write a Reflection ✎ · Coming soon</button>
          </div>

          <div style={{ display: 'flex', alignItems: 'baseline', gap: '16px', marginTop: '12px' }}>
            <div style={{ fontFamily: 'var(--font-sans)', fontSize: '54px', fontWeight: 700, color: '#1B1816', lineHeight: 1 }}>{Number(product.rating || 0).toFixed(1)}</div>
            <div style={{ fontFamily: 'var(--font-sans)', fontSize: '20px', color: '#1B1816' }}>/ 5.0</div>
          </div>

          <div style={{ marginTop: '16px', display: 'grid', gap: '18px' }}>
            {product.reviews.map((review, index) => (
              <article key={`${review.name}-${index}`} style={{ background: '#FDFBF7', border: '1px solid rgba(27,24,22,0.08)', borderRadius: '18px', padding: '22px 20px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', marginBottom: '12px', flexWrap: 'wrap' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                    <span style={{ fontFamily: 'var(--font-sans)', fontSize: '15px', fontWeight: 700, color: '#1B1816' }}>{review.name}</span>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', borderRadius: '999px', background: '#EFEAE2', padding: '4px 8px', fontFamily: 'var(--font-sans)', fontSize: '9px', letterSpacing: '0.12em', textTransform: 'uppercase', color: '#5D5651' }}><span>✓</span> Verified Purchase</span>
                  </div>
                  <div style={{ display: 'flex', gap: '3px', color: '#1B1816', fontSize: '14px' }}>{renderStars(review.rating)}</div>
                </div>
                <p style={{ margin: 0, fontFamily: 'var(--font-sans)', fontSize: '15px', lineHeight: 1.7, color: '#4E4945' }}>{review.text}</p>
              </article>
            ))}
            {product.reviews.length > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', marginTop: '12px' }}>
              <div style={{ fontFamily: 'var(--font-sans)', fontSize: '10px', letterSpacing: '0.14em', textTransform: 'uppercase', color: '#6E655F' }}>{product.numReviews || product.reviewCount} verified purchases</div>
            </div>
            )}
          </div>
        </section>

        {relatedProducts.length > 0 && (
        <section style={{ marginTop: '88px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: '16px', marginBottom: '22px', flexWrap: 'wrap' }}>
            <div>
              <h2 style={{ margin: 0, fontFamily: 'var(--font-serif)', fontSize: 'clamp(30px, 2.8vw, 42px)', fontStyle: 'italic', fontWeight: 400, letterSpacing: '-0.04em', color: '#1B1816' }}>You May Also Like</h2>
              <p style={{ margin: '8px 0 0', fontFamily: 'var(--font-sans)', fontSize: '14px', color: '#706B66' }}>Complete the look with pieces selected from the NovaShop collection.</p>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: '26px' }}>
            {relatedProducts.map((item) => (
              <div key={item.productId || item.id}>
                <ProductCard
                  product={item}
                  go={go}
                  onAddToCart={(related) => {
                    addProductToBag(related, { qty: 1 });
                  }}
                  onAddToWishlist={() => toggleWishlist(item)}
                  showCartIcon={true}
                  showWishlistAlways={false}
                />
              </div>
            ))}
          </div>
        </section>
        )}

        <section style={{ marginTop: '88px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '16px', marginBottom: '22px', flexWrap: 'wrap' }}>
            <h2 style={{ margin: 0, fontFamily: 'var(--font-serif)', fontSize: 'clamp(28px, 2.6vw, 38px)', fontStyle: 'italic', fontWeight: 400, letterSpacing: '-0.04em', color: '#1B1816' }}>Recently Viewed</h2>
            <button style={{ background: 'none', border: 'none', padding: 0, color: '#6E655F', cursor: 'pointer', fontFamily: 'var(--font-sans)', fontSize: '10px', letterSpacing: '0.14em', textTransform: 'uppercase' }} onClick={() => { localStorage.removeItem('novashop_recently_viewed'); setRecentlyViewed([]); }}>Clear History</button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: '20px' }}>
            {recentlyViewed.length > 0 ? recentlyViewed.map((item) => {
              const isCurrent = item.slug === product.slug;
              return (
                <button key={item.slug} onClick={() => go(`/products/${item.slug}`)} style={{ background: 'none', border: '1px solid rgba(27,24,22,0.08)', borderRadius: '14px', padding: '12px', display: 'flex', alignItems: 'center', gap: '12px', textAlign: 'left', cursor: 'pointer' }}>
                  <img src={item.primaryImage} alt={item.name} style={{ width: '64px', height: '80px', objectFit: 'cover', borderRadius: '10px' }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontFamily: 'var(--font-sans)', fontSize: '12px', lineHeight: 1.4, color: '#1B1816', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.name}</div>
                    <div style={{ fontFamily: 'var(--font-sans)', fontSize: '12px', fontWeight: 600, color: '#1B1816', marginTop: '4px' }}>{formatPrice(item.price)}{isCurrent && <span style={{ color: '#6E655F', fontWeight: 500, marginLeft: '8px' }}>(Viewing)</span>}</div>
                  </div>
                </button>
              );
            }) : <div style={{ fontFamily: 'var(--font-sans)', fontSize: '12px', color: '#726C66' }}>No recent items yet.</div>}
          </div>
        </section>

        <div style={{ marginTop: '90px' }}>
          <NewsletterSection />
        </div>
      </div>

      {isLightboxOpen && (
        <div onClick={() => setLightboxOpen(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(17, 14, 12, 0.76)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ position: 'relative', width: 'min(900px, 88vw)', maxHeight: '88vh', background: '#F2EEE8', borderRadius: '18px', padding: '18px', boxShadow: '0 30px 60px rgba(0,0,0,0.2)' }}>
            <button onClick={() => setLightboxOpen(false)} style={{ position: 'absolute', top: '14px', right: '14px', border: 'none', background: 'rgba(255,255,255,0.75)', width: '36px', height: '36px', borderRadius: '50%', cursor: 'pointer', fontSize: '24px', lineHeight: 1 }}>×</button>
            <div style={{ display: 'grid', gap: '12px' }}>
              <img src={galleryImages[selectedImage]} alt={product.name} style={{ width: '100%', height: '74vh', objectFit: 'cover', borderRadius: '12px' }} />
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <button onClick={() => setSelectedImage((prev) => (prev === 0 ? galleryImages.length - 1 : prev - 1))} style={{ background: 'none', border: 'none', color: '#1B1816', cursor: 'pointer', fontFamily: 'var(--font-sans)', fontSize: '12px', letterSpacing: '0.14em', textTransform: 'uppercase' }}>← Prev</button>
                <span style={{ fontFamily: 'var(--font-sans)', fontSize: '11px', letterSpacing: '0.14em', textTransform: 'uppercase', color: '#6C645E' }}>{selectedImage + 1} / {galleryImages.length}</span>
                <button onClick={() => setSelectedImage((prev) => (prev + 1) % galleryImages.length)} style={{ background: 'none', border: 'none', color: '#1B1816', cursor: 'pointer', fontFamily: 'var(--font-sans)', fontSize: '12px', letterSpacing: '0.14em', textTransform: 'uppercase' }}>Next →</button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
