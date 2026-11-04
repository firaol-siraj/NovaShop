/* eslint-disable react-hooks/set-state-in-effect */
import { useEffect, useState } from 'react';
import NewsletterSection from '../components/home/NewsletterSection';
import { ProductCard } from '../components/home/NewArrivalsSection';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
import { productApi } from '../lib/api/productApi';
import { reviewApi } from '../lib/api/reviewApi';
import { normalizeCatalog, normalizeProduct } from '../lib/catalog';
import { trackProductView } from '../lib/tracker';

const LOW_STOCK_THRESHOLD = 5;
const MAX_QTY_PER_LINE = 10;

function formatPrice(value) {
  return `$${Number(value).toFixed(0)}`;
}

function getStockMeta(stockCount) {
  if (stockCount <= 0) return { text: 'OUT OF STOCK', color: 'var(--color-danger)' };
  if (stockCount <= LOW_STOCK_THRESHOLD) return { text: `LOW STOCK — ${stockCount} LEFT`, color: 'var(--color-warning)' };
  return { text: `${stockCount} IN STOCK`, color: 'var(--color-success)' };
}

function renderStars(rating) {
  const filled = Math.round(rating);
  return Array.from({ length: 5 }, (_, index) => (
    <span key={index} style={{ color: index < filled ? 'var(--color-accent)' : 'var(--border-strong)', fontSize: '16px', lineHeight: 1 }}>★</span>
  ));
}

export default function ProductDetailPage({ go, slug }) {
  const { user, isAuthenticated } = useAuth();
  const { addProductToBag, toggleWishlist, isWishlisted, openCart } = useCart();
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

  // Real review state
  const [realReviews, setRealReviews] = useState([]);
  const [realRating, setRealRating] = useState(0);
  const [realReviewCount, setRealReviewCount] = useState(0);
  const [writeModalOpen, setWriteModalOpen] = useState(false);
  const [eligibleOrderId, setEligibleOrderId] = useState(null);
  const [newReviewRating, setNewReviewRating] = useState(5);
  const [newReviewTitle, setNewReviewTitle] = useState('');
  const [newReviewBody, setNewReviewBody] = useState('');
  const [isSubmittingReview, setIsSubmittingReview] = useState(false);
  const [reviewNotice, setReviewNotice] = useState('');

  const fetchReviewsForProduct = (prodId) => {
    if (!prodId) return;
    reviewApi.getProductReviews(prodId)
      .then((res) => {
        const payload = res.data?.data || res.data;
        if (payload) {
          setRealReviews(payload.reviews || []);
          if (payload.averageRating != null) setRealRating(payload.averageRating);
          if (payload.total != null) setRealReviewCount(payload.total);
        }
      })
      .catch((err) => console.warn('Failed to load product reviews:', err));
  };

  const handleOpenWriteReview = async () => {
    if (!isAuthenticated) {
      if (typeof go === 'function') {
        go('/login');
      } else {
        setReviewNotice('Please sign in to share your client reflection.');
      }
      return;
    }
    const prodId = product?.productId || product?.id;
    try {
      const res = await reviewApi.checkUserReviewEligibility(prodId);
      const data = res.data?.data || res.data;
      if (data?.eligible) {
        setEligibleOrderId(data.orderId);
        setWriteModalOpen(true);
        setReviewNotice('');
      } else {
        setReviewNotice(data?.reason || 'Verified purchase required to review this piece.');
      }
    } catch (err) {
      setReviewNotice(err.response?.data?.message || err.message || 'Unable to verify order eligibility.');
    }
  };

  const handleSubmitReview = async (e) => {
    e.preventDefault();
    if (!newReviewTitle.trim() || !newReviewBody.trim()) {
      setReviewNotice('Please provide both title and reflection details.');
      return;
    }
    const prodId = product?.productId || product?.id;
    setIsSubmittingReview(true);
    try {
      await reviewApi.createReview({
        product: prodId,
        order: eligibleOrderId,
        rating: Number(newReviewRating),
        title: newReviewTitle.trim(),
        body: newReviewBody.trim(),
      });
      setWriteModalOpen(false);
      setNewReviewTitle('');
      setNewReviewBody('');
      setNewReviewRating(5);
      setReviewNotice('Thank you! Your reflection has been submitted and is awaiting moderation.');
    } catch (err) {
      setReviewNotice(err.response?.data?.message || err.message || 'Failed to submit review.');
    } finally {
      setIsSubmittingReview(false);
    }
  };

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
        trackProductView(normalizedProduct);
        fetchReviewsForProduct(normalizedProduct.productId || normalizedProduct.id);
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
    let slugs;
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
  const variantStock = Number.isFinite(Number(selectedSizeMeta?.stock)) && Number(selectedSizeMeta?.stock) >= 0
    ? Number(selectedSizeMeta?.stock)
    : 0;
  const isSoldOut = variantStock <= 0;
  const maxQty = isSoldOut ? 1 : Math.max(1, Math.min(variantStock, MAX_QTY_PER_LINE));
  const galleryImages = activeColor?.images || [];
  const currentPrice = product?.price * quantity || 0;
  const stockMeta = getStockMeta(variantStock);

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
    return <div style={{ backgroundColor: 'var(--bg-main)', minHeight: '60vh', display: 'grid', placeItems: 'center', fontFamily: 'var(--font-sans)', fontSize: '12px', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>Loading product…</div>;
  }

  if (error || !product) {
    return <div style={{ backgroundColor: 'var(--bg-main)', minHeight: '60vh', display: 'grid', placeItems: 'center', padding: '40px', textAlign: 'center' }}><div><h1 style={{ fontFamily: 'var(--font-serif)', fontSize: '38px', fontStyle: 'italic', margin: 0, color: 'var(--text-primary)' }}>Product unavailable</h1><p style={{ fontFamily: 'var(--font-sans)', color: 'var(--text-secondary)' }}>{error || 'The product could not be found.'}</p><button onClick={() => go('/shop')} style={{ marginTop: '18px', background: 'var(--color-primary)', color: 'var(--color-primary-contrast)', border: 'none', padding: '12px 20px', cursor: 'pointer' }}>Return to shop</button></div></div>;
  }

  return (
    <div style={{ backgroundColor: 'var(--bg-main)' }}>
      <style>{`
        .pdp-container {
          max-width: 1400px;
          margin: 0 auto;
          padding: 0 40px 80px;
        }
        .pdp-main-section {
          display: grid;
          grid-template-columns: 110px minmax(0, 1fr) minmax(320px, 520px);
          gap: 20px;
          align-items: start;
          padding-top: 12px;
        }
        .pdp-thumbs-col {
          position: relative;
          display: flex;
          flex-direction: column;
          gap: 12px;
          padding-top: 8px;
        }
        .pdp-thumbs-list {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }
        .pdp-details-grid {
          margin-top: 28px;
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          border-top: 1px solid var(--border-default);
          border-bottom: 1px solid var(--border-default);
        }
        .pdp-reviews-grid {
          margin-top: 82px;
          display: grid;
          grid-template-columns: 320px 1fr;
          gap: 28px;
          align-items: start;
        }
        .pdp-related-grid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 26px;
        }
        .pdp-recent-grid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 20px;
        }
        .pdp-sticky-bar {
          display: none;
        }

        @media (max-width: 1023px) {
          .pdp-container {
            padding: 0 24px 60px;
          }
          .pdp-main-section {
            grid-template-columns: 1fr;
            gap: 24px;
          }
          .pdp-thumbs-col {
            order: 2;
            padding-top: 0;
          }
          .pdp-thumbs-list {
            flex-direction: row;
            overflow-x: auto;
            -webkit-overflow-scrolling: touch;
            padding-bottom: 6px;
          }
          .pdp-main-image-wrap {
            order: 1;
          }
          .pdp-buy-box {
            order: 3;
          }
          .pdp-reviews-grid {
            grid-template-columns: 1fr;
            gap: 20px;
          }
          .pdp-related-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 16px;
          }
          .pdp-recent-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 14px;
          }
        }

        @media (max-width: 767px) {
          .pdp-container {
            padding: 0 16px 80px;
          }
          .pdp-details-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
          .pdp-details-grid > div {
            border-left: none !important;
            border-bottom: 1px solid var(--border-default);
          }
          .pdp-sticky-bar {
            display: flex;
            position: fixed;
            bottom: 0;
            left: 0;
            right: 0;
            background: var(--bg-surface);
            border-top: 1px solid var(--border-default);
            padding: 12px 16px calc(12px + env(safe-area-inset-bottom, 0px));
            z-index: 90;
            box-shadow: var(--shadow-lg);
            align-items: center;
            justify-content: space-between;
            gap: 12px;
          }
          .pdp-modal-input {
            font-size: 16px !important;
          }
        }

        @media (max-width: 480px) {
          .pdp-recent-grid {
            grid-template-columns: 1fr;
          }
        }

        @media (max-width: 360px) {
          .pdp-details-grid {
            grid-template-columns: 1fr;
          }
          .pdp-related-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
      <div className="pdp-container">
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '28px 0 18px', fontFamily: 'var(--font-sans)', fontSize: '11px', letterSpacing: '0.13em', textTransform: 'uppercase', color: 'var(--text-muted)', flexWrap: 'wrap' }}>
          <button onClick={() => go('/')} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 0 }}>Home</button>
          <span>/</span>
          <button onClick={() => go('/shop')} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 0 }}>Shop</button>
          <span>/</span>
          <button onClick={() => go(`/shop?category=${encodeURIComponent(product.category)}`)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 0 }}>{product.category}</button>
          <span>/</span>
          <span style={{ color: 'var(--text-primary)' }}>{product.name}</span>
        </div>

        <section className="pdp-main-section">
          <div className="pdp-thumbs-col">
            <div style={{ fontFamily: 'var(--font-sans)', fontSize: '10px', letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--text-muted)', paddingLeft: '8px' }}>{String(Math.min(selectedImage + 1, galleryImages.length)).padStart(2, '0')} / {String(galleryImages.length).padStart(2, '0')}</div>
            <div className="pdp-thumbs-list">
              {galleryImages.map((src, index) => (
                <button
                  key={`${activeColor.name}-${index}`}
                  onClick={() => setSelectedImage(index)}
                  style={{
                    width: '64px',
                    height: '64px',
                    minWidth: '64px',
                    padding: 0,
                    border: index === selectedImage ? '2px solid var(--color-primary)' : '1px solid var(--border-default)',
                    background: 'var(--bg-surface-sunken)',
                    cursor: 'pointer',
                    borderRadius: '8px',
                    overflow: 'hidden',
                    boxShadow: index === selectedImage ? 'var(--shadow-sm)' : 'none',
                  }}
                >
                  <img src={src} alt={`${product.name} thumbnail ${index + 1}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                </button>
              ))}
            </div>
          </div>

          <div className="pdp-main-image-wrap" style={{ position: 'relative' }}>
            <div style={{ position: 'relative', borderRadius: '18px', overflow: 'hidden', background: 'var(--bg-surface-sunken)', aspectRatio: '4 / 5', boxShadow: 'var(--shadow-md)' }}>
              <img
                src={galleryImages[selectedImage] || galleryImages[0]}
                alt={product.name}
                style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', transition: 'opacity 250ms ease', opacity: 1 }}
              />
              <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, rgba(0,0,0,0) 48%, rgba(0,0,0,0.32) 100%)' }} />
              <button
                onClick={() => setLightboxOpen(true)}
                aria-label="Open image gallery"
                style={{ position: 'absolute', top: '16px', right: '16px', width: '44px', height: '44px', borderRadius: '50%', background: 'var(--bg-surface)', border: '1px solid var(--border-default)', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M15 3h6v6M21 3l-9 9M21 14v6H3V4h6" /></svg>
              </button>
              <div style={{ position: 'absolute', left: '18px', bottom: '18px', color: 'var(--text-inverse)', fontFamily: 'var(--font-sans)', fontSize: '10px', letterSpacing: '0.14em', textTransform: 'uppercase', background: 'var(--bg-overlay)', padding: '8px 10px', borderRadius: '999px', backdropFilter: 'blur(6px)' }}>{product.brand} · {product.category}</div>
            </div>
          </div>

          <div className="pdp-buy-box" style={{ paddingTop: '6px' }}>
            <div style={{ fontFamily: 'var(--font-sans)', fontSize: '10px', letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '14px' }}>{product.collection}</div>
            <h1 style={{ margin: 0, fontFamily: 'var(--font-serif)', fontSize: 'clamp(34px, 3.2vw, 46px)', lineHeight: 1.05, letterSpacing: '-0.04em', fontWeight: 400, color: 'var(--text-primary)', fontStyle: 'italic' }}>{product.name}</h1>

            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '18px', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '5px', color: 'var(--color-accent)', fontSize: '15px' }}>{renderStars(product.rating)}</div>
              <span style={{ fontFamily: 'var(--font-sans)', fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)' }}>{product.rating}</span>
              <button onClick={() => document.getElementById('reviews-section')?.scrollIntoView({ behavior: 'smooth' })} style={{ background: 'none', border: 'none', borderBottom: '1px solid var(--border-strong)', padding: 0, color: 'var(--text-secondary)', fontFamily: 'var(--font-sans)', fontSize: '13px', cursor: 'pointer' }}>{product.reviewCount} Client Reviews</button>
            </div>

            <div style={{ display: 'flex', alignItems: 'baseline', gap: '10px', marginTop: '22px', flexWrap: 'wrap' }}>
              <span style={{ fontFamily: 'var(--font-sans)', fontSize: '28px', fontWeight: 700, color: 'var(--text-primary)' }}>{formatPrice(product.price)}</span>
              <span style={{ fontFamily: 'var(--font-sans)', fontSize: '12px', color: 'var(--text-muted)' }}>Duties & taxes included</span>
            </div>

            <div style={{ marginTop: '28px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px', gap: '12px', flexWrap: 'wrap' }}>
                <div style={{ fontFamily: 'var(--font-sans)', fontSize: '11px', fontWeight: 600, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--text-primary)' }}>Color — {activeColor.name.toUpperCase()}</div>
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
                      border: idx === selectedColorIndex ? '2px solid var(--color-primary)' : '1.5px solid var(--border-default)',
                      boxShadow: idx === selectedColorIndex ? 'inset 0 0 0 2px var(--bg-surface)' : 'none',
                      cursor: 'pointer',
                      padding: 0,
                    }}
                  />
                ))}
              </div>
            </div>

            <div style={{ marginTop: '26px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px', gap: '12px', flexWrap: 'wrap' }}>
                <div style={{ fontFamily: 'var(--font-sans)', fontSize: '11px', fontWeight: 600, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--text-primary)' }}>Size — {product.sizeGuideNote}</div>
                <button style={{ background: 'none', border: 'none', borderBottom: '1px solid var(--border-strong)', padding: 0, color: 'var(--text-primary)', fontFamily: 'var(--font-sans)', fontSize: '10px', letterSpacing: '0.14em', textTransform: 'uppercase', cursor: 'pointer' }}>Size Guide ⊞</button>
              </div>
              <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                {colorSizes.map((size) => {
                  const isSelected = selectedSize === size.label;
                  const isDisabled = Number(size.stock) <= 0 || !size.available;
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
                        border: isSelected ? '1px solid var(--color-primary)' : '1px solid var(--border-default)',
                        background: isSelected ? 'var(--color-primary)' : 'var(--bg-surface)',
                        color: isSelected ? 'var(--color-primary-contrast)' : isDisabled ? 'var(--text-faint)' : 'var(--text-primary)',
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

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '20px', color: 'var(--text-secondary)', fontFamily: 'var(--font-sans)', fontSize: '11px', letterSpacing: '0.12em', textTransform: 'uppercase' }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: stockMeta.color, display: 'inline-block' }} />
              <span>{stockMeta.text}</span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginTop: '26px', flexWrap: 'wrap' }}>
              <div style={{ display: 'inline-flex', alignItems: 'center', border: '1px solid var(--border-default)', borderRadius: '999px', overflow: 'hidden', background: 'var(--bg-surface)' }}>
                <button type="button" aria-label="Decrease quantity" disabled={isSoldOut || quantity <= 1} onClick={() => setQuantity((v) => Math.max(1, v - 1))} style={{ width: '44px', height: '44px', background: 'none', border: 'none', color: 'var(--text-primary)', cursor: isSoldOut || quantity <= 1 ? 'not-allowed' : 'pointer', fontSize: '20px', opacity: isSoldOut || quantity <= 1 ? 0.4 : 1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>−</button>
                <span aria-live="polite" style={{ width: '42px', textAlign: 'center', fontFamily: 'var(--font-sans)', fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>{quantity}</span>
                <button type="button" aria-label="Increase quantity" disabled={isSoldOut || quantity >= maxQty} onClick={() => setQuantity((v) => Math.min(maxQty, v + 1))} style={{ width: '44px', height: '44px', background: 'none', border: 'none', color: 'var(--text-primary)', cursor: isSoldOut || quantity >= maxQty ? 'not-allowed' : 'pointer', fontSize: '20px', opacity: isSoldOut || quantity >= maxQty ? 0.4 : 1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>+</button>
              </div>
              <button
                type="button"
                disabled={isSoldOut || !selectedVariantId}
                onClick={async () => {
                  const result = await addProductToBag(product, {
                    qty: quantity,
                    variantId: selectedVariantId,
                    color: activeColor?.name,
                    size: selectedSize,
                  });
                  if (result?.ok) {
                    openCart?.();
                  }
                }}
                style={{ flex: '1 1 260px', minHeight: '56px', background: isSoldOut ? 'var(--border-strong)' : 'var(--color-primary)', color: 'var(--color-primary-contrast)', border: 'none', borderRadius: '999px', fontFamily: 'var(--font-sans)', fontSize: '11px', letterSpacing: '0.16em', textTransform: 'uppercase', fontWeight: 600, cursor: isSoldOut ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', padding: '0 22px', opacity: isSoldOut ? 0.7 : 1 }}
              >
                <svg width="16" height="16" viewBox=" 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z" /><path d="M3 6h18" /><path d="M16 10a4 4 0 0 1-8 0" /></svg>
                {isSoldOut ? 'Sold out' : `Add to Bag • ${formatPrice(currentPrice)}`}
              </button>
              <button onClick={async () => {
                const res = await toggleWishlist(product);
                if (res?.ok) setWishlist(Boolean(res.added));
              }} style={{ width: '54px', height: '54px', borderRadius: '50%', border: '1px solid var(--border-default)', background: wishlist ? 'var(--color-primary)' : 'var(--bg-surface)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }} aria-label={wishlist ? 'Remove from wishlist' : 'Add to wishlist'}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill={wishlist ? 'var(--color-primary-contrast)' : 'none'} stroke={wishlist ? 'var(--color-primary-contrast)' : 'var(--text-primary)'} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78Z" /></svg>
              </button>
            </div>

            <div style={{ marginTop: '20px', borderTop: '1px solid var(--border-subtle)', paddingTop: '18px', display: 'grid', gap: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontFamily: 'var(--font-sans)', fontSize: '12px', color: 'var(--text-secondary)' }}>
                <span>✦</span>
                <span>{product.shippingNote}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontFamily: 'var(--font-sans)', fontSize: '12px', color: 'var(--text-secondary)' }}>
                <span>↺</span>
                <span>{product.returnNote}</span>
              </div>
            </div>

            <div style={{ marginTop: '28px', borderTop: '1px solid var(--border-subtle)', paddingTop: '10px' }}>
              {[
                { key: 'description', label: 'Description', value: product.description },
                { key: 'details', label: 'Details & Materials', value: `${product.details.material} • ${product.details.fit} • ${product.details.care} • ${product.details.origin}` },
                { key: 'fit', label: 'Size & Fit', value: product.fitNotes },
                { key: 'shipping', label: 'Shipping & Returns', value: product.shippingPolicy },
              ].map((item) => (
                <div key={item.key} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                  <button onClick={() => toggleAccordion(item.key)} style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'none', border: 'none', cursor: 'pointer', padding: '16px 0', color: 'var(--text-primary)', fontFamily: 'var(--font-sans)', fontSize: '11px', letterSpacing: '0.16em', textTransform: 'uppercase', textAlign: 'left' }}>
                    {item.label}
                    <span style={{ transform: accordionState[item.key] ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 200ms ease' }}>⌃</span>
                  </button>
                  {accordionState[item.key] && <p style={{ margin: '0 0 18px', fontFamily: 'var(--font-sans)', fontSize: '14px', lineHeight: 1.7, color: 'var(--text-secondary)' }}>{item.value}</p>}
                </div>
              ))}
            </div>
          </div>
        </section>

        <section style={{ marginTop: '80px', borderTop: '1px solid var(--border-subtle)', paddingTop: '40px' }}>
          <h2 style={{ margin: 0, textAlign: 'center', fontFamily: 'var(--font-serif)', fontSize: 'clamp(32px, 3vw, 46px)', fontStyle: 'italic', fontWeight: 400, letterSpacing: '-0.04em', color: 'var(--text-primary)' }}>Details & Materials</h2>
          <div className="pdp-details-grid">
            {Object.entries(product.details).map(([key, value], index) => (
              <div key={key} style={{ padding: '22px 20px', textAlign: 'center', borderLeft: index > 0 ? '1px solid var(--border-default)' : 'none' }}>
                <div style={{ fontFamily: 'var(--font-sans)', fontSize: '10px', letterSpacing: '0.16em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '8px' }}>{key}</div>
                <div style={{ fontFamily: 'var(--font-sans)', fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>{value}</div>
              </div>
            ))}
          </div>
        </section>

        <section id="reviews-section" className="pdp-reviews-grid">
          <div>
            <h2 style={{ margin: 0, fontFamily: 'var(--font-serif)', fontSize: 'clamp(30px, 2.8vw, 42px)', fontStyle: 'italic', fontWeight: 400, letterSpacing: '-0.04em', color: 'var(--text-primary)' }}>Customer Reviews</h2>
            <p style={{ margin: '10px 0 0', fontFamily: 'var(--font-sans)', fontSize: '14px', color: 'var(--text-secondary)' }}>
              {Number(realReviewCount || product.numReviews || product.reviewCount) === 0
                ? 'No reviews yet'
                : `Rated ${Number(realRating || product.rating || 0).toFixed(1)} out of 5 based on ${realReviewCount || product.numReviews || product.reviewCount} verified reviews`}
            </p>
            {reviewNotice && (
              <p style={{ margin: '10px 0 0', fontFamily: 'var(--font-sans)', fontSize: '12px', color: 'var(--color-success)', background: 'var(--color-success-soft)', padding: '8px 12px', borderRadius: '6px' }}>
                {reviewNotice}
              </p>
            )}
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button
              type="button"
              onClick={handleOpenWriteReview}
              aria-label="Write a reflection"
              style={{
                background: 'var(--color-primary)',
                border: 'none',
                borderRadius: '999px',
                padding: '12px 20px',
                fontFamily: 'var(--font-sans)',
                fontSize: '11px',
                letterSpacing: '0.12em',
                textTransform: 'uppercase',
                cursor: 'pointer',
                color: 'var(--color-primary-contrast)',
                fontWeight: 600,
              }}
            >
              Write a Reflection ✎
            </button>
          </div>

          <div style={{ display: 'flex', alignItems: 'baseline', gap: '16px', marginTop: '12px' }}>
            <div style={{ fontFamily: 'var(--font-sans)', fontSize: '54px', fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1 }}>{Number(realRating || product.rating || 0).toFixed(1)}</div>
            <div style={{ fontFamily: 'var(--font-sans)', fontSize: '20px', color: 'var(--text-secondary)' }}>/ 5.0</div>
          </div>

          <div style={{ marginTop: '16px', display: 'grid', gap: '18px' }}>
            {(realReviews.length > 0 ? realReviews : product.reviews).map((review, index) => (
              <article key={`${review.name}-${index}`} style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-default)', borderRadius: '18px', padding: '22px 20px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', marginBottom: '12px', flexWrap: 'wrap' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                    <span style={{ fontFamily: 'var(--font-sans)', fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)' }}>{review.name}</span>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', borderRadius: '999px', background: 'var(--bg-surface-raised)', padding: '4px 8px', fontFamily: 'var(--font-sans)', fontSize: '9px', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--text-secondary)' }}><span>✓</span> Verified Purchase</span>
                  </div>
                  <div style={{ display: 'flex', gap: '3px', color: 'var(--color-accent)', fontSize: '14px' }}>{renderStars(review.rating)}</div>
                </div>
                {review.title && (
                  <h4 style={{ margin: '0 0 6px', fontFamily: 'var(--font-sans)', fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)' }}>
                    {review.title}
                  </h4>
                )}
                <p style={{ margin: 0, fontFamily: 'var(--font-sans)', fontSize: '15px', lineHeight: 1.7, color: 'var(--text-secondary)' }}>{review.text || review.body}</p>

                {review.adminReply?.text && (
                  <div style={{ marginTop: '14px', background: 'var(--bg-surface-raised)', padding: '12px 14px', borderRadius: '10px', borderLeft: '3px solid var(--color-primary)' }}>
                    <div style={{ fontSize: '10px', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--color-success)', fontWeight: 700, marginBottom: '4px' }}>
                      NovaShop Concierge
                    </div>
                    <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                      {review.adminReply.text}
                    </p>
                  </div>
                )}
              </article>
            ))}
            {(realReviews.length > 0 || product.reviews.length > 0) && (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', marginTop: '12px' }}>
              <div style={{ fontFamily: 'var(--font-sans)', fontSize: '10px', letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>{realReviewCount || product.numReviews || product.reviewCount} verified purchases</div>
            </div>
            )}
          </div>
        </section>

        {/* WRITE REVIEW MODAL */}
        {writeModalOpen && (
          <div
            style={{
              position: 'fixed',
              inset: 0,
              background: 'var(--bg-overlay)',
              backdropFilter: 'blur(4px)',
              display: 'grid',
              placeItems: 'center',
              zIndex: 1000,
              padding: '16px',
            }}
            onClick={() => setWriteModalOpen(false)}
          >
            <div
              style={{
                background: 'var(--bg-surface)',
                border: '1px solid var(--border-default)',
                borderRadius: '16px',
                width: '100%',
                maxWidth: '460px',
                padding: '28px',
                boxShadow: 'var(--shadow-lg)',
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '20px' }}>
                <h3 style={{ margin: 0, fontFamily: 'var(--font-serif)', fontSize: '24px', fontStyle: 'italic', fontWeight: 400, color: 'var(--text-primary)' }}>
                  Write a Reflection
                </h3>
                <button
                  type="button"
                  onClick={() => setWriteModalOpen(false)}
                  style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', color: 'var(--text-muted)' }}
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleSubmitReview} style={{ display: 'grid', gap: '14px' }}>
                <div>
                  <div style={{ fontFamily: 'var(--font-sans)', fontSize: '11px', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '6px' }}>
                    Rating
                  </div>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    {[1, 2, 3, 4, 5].map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => setNewReviewRating(s)}
                        style={{
                          background: 'none',
                          border: 'none',
                          fontSize: '24px',
                          color: s <= newReviewRating ? 'var(--color-accent)' : 'var(--border-strong)',
                          cursor: 'pointer',
                          padding: 0,
                        }}
                      >
                        ★
                      </button>
                    ))}
                  </div>
                </div>

                <label style={{ display: 'grid', gap: '6px' }}>
                  <span style={{ fontFamily: 'var(--font-sans)', fontSize: '11px', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>Title</span>
                  <input
                    type="text"
                    required
                    className="pdp-modal-input"
                    value={newReviewTitle}
                    onChange={(e) => setNewReviewTitle(e.target.value)}
                    placeholder="Headline for your reflection..."
                    style={{
                      padding: '10px 14px',
                      border: '1px solid var(--border-input)',
                      background: 'var(--bg-input)',
                      color: 'var(--text-primary)',
                      borderRadius: '8px',
                      fontFamily: 'var(--font-sans)',
                      fontSize: '13px',
                    }}
                  />
                </label>

                <label style={{ display: 'grid', gap: '6px' }}>
                  <span style={{ fontFamily: 'var(--font-sans)', fontSize: '11px', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>Reflection</span>
                  <textarea
                    required
                    rows={4}
                    className="pdp-modal-input"
                    value={newReviewBody}
                    onChange={(e) => setNewReviewBody(e.target.value)}
                    placeholder="Describe the fit, craftsmanship, and wearability..."
                    style={{
                      padding: '10px 14px',
                      border: '1px solid var(--border-input)',
                      background: 'var(--bg-input)',
                      color: 'var(--text-primary)',
                      borderRadius: '8px',
                      fontFamily: 'var(--font-sans)',
                      fontSize: '13px',
                      resize: 'vertical',
                    }}
                  />
                </label>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
                  <button
                    type="button"
                    onClick={() => setWriteModalOpen(false)}
                    style={{
                      background: 'none',
                      border: '1px solid var(--border-default)',
                      borderRadius: '999px',
                      padding: '10px 18px',
                      fontFamily: 'var(--font-sans)',
                      fontSize: '11px',
                      letterSpacing: '0.1em',
                      textTransform: 'uppercase',
                      cursor: 'pointer',
                      color: 'var(--text-secondary)',
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmittingReview}
                    style={{
                      background: 'var(--color-primary)',
                      color: 'var(--color-primary-contrast)',
                      border: 'none',
                      borderRadius: '999px',
                      padding: '10px 22px',
                      fontFamily: 'var(--font-sans)',
                      fontSize: '11px',
                      letterSpacing: '0.1em',
                      textTransform: 'uppercase',
                      fontWeight: 600,
                      cursor: isSubmittingReview ? 'not-allowed' : 'pointer',
                    }}
                  >
                    {isSubmittingReview ? 'Submitting…' : 'Submit Reflection'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {relatedProducts.length > 0 && (
        <section style={{ marginTop: '88px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: '16px', marginBottom: '22px', flexWrap: 'wrap' }}>
            <div>
              <h2 style={{ margin: 0, fontFamily: 'var(--font-serif)', fontSize: 'clamp(30px, 2.8vw, 42px)', fontStyle: 'italic', fontWeight: 400, letterSpacing: '-0.04em', color: 'var(--text-primary)' }}>You May Also Like</h2>
              <p style={{ margin: '8px 0 0', fontFamily: 'var(--font-sans)', fontSize: '14px', color: 'var(--text-secondary)' }}>Complete the look with pieces selected from the NovaShop collection.</p>
            </div>
          </div>
          <div className="pdp-related-grid">
            {relatedProducts.map((item) => (
              <div key={item.productId || item.id}>
                <ProductCard
                  product={item}
                  go={go}
                  onAddToCart={(related) => addProductToBag(related, { qty: 1 })}
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
            <h2 style={{ margin: 0, fontFamily: 'var(--font-serif)', fontSize: 'clamp(28px, 2.6vw, 38px)', fontStyle: 'italic', fontWeight: 400, letterSpacing: '-0.04em', color: 'var(--text-primary)' }}>Recently Viewed</h2>
            <button style={{ background: 'none', border: 'none', padding: 0, color: 'var(--text-muted)', cursor: 'pointer', fontFamily: 'var(--font-sans)', fontSize: '10px', letterSpacing: '0.14em', textTransform: 'uppercase' }} onClick={() => { localStorage.removeItem('novashop_recently_viewed'); setRecentlyViewed([]); }}>Clear History</button>
          </div>
          <div className="pdp-recent-grid">
            {recentlyViewed.length > 0 ? recentlyViewed.map((item) => {
              const isCurrent = item.slug === product.slug;
              return (
                <button key={item.slug} onClick={() => go(`/products/${item.slug}`)} style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-default)', borderRadius: '14px', padding: '12px', display: 'flex', alignItems: 'center', gap: '12px', textAlign: 'left', cursor: 'pointer' }}>
                  <img src={item.primaryImage} alt={item.name} style={{ width: '64px', height: '80px', objectFit: 'cover', borderRadius: '10px' }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontFamily: 'var(--font-sans)', fontSize: '12px', lineHeight: 1.4, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.name}</div>
                    <div style={{ fontFamily: 'var(--font-sans)', fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)', marginTop: '4px' }}>{formatPrice(item.price)}{isCurrent && <span style={{ color: 'var(--text-muted)', fontWeight: 500, marginLeft: '8px' }}>(Viewing)</span>}</div>
                  </div>
                </button>
              );
            }) : <div style={{ fontFamily: 'var(--font-sans)', fontSize: '12px', color: 'var(--text-muted)' }}>No recent items yet.</div>}
          </div>
        </section>

        <div style={{ marginTop: '90px' }}>
          <NewsletterSection />
        </div>
      </div>

      {/* Mobile Sticky Add to Bag Bar */}
      <div className="pdp-sticky-bar">
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontFamily: 'var(--font-sans)', fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {product.name}
          </div>
          <div style={{ fontFamily: 'var(--font-sans)', fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px' }}>
            {formatPrice(currentPrice)}
            {selectedSize && <span style={{ marginLeft: '6px', color: 'var(--text-muted)' }}>· Size {selectedSize}</span>}
          </div>
        </div>
        <button
          type="button"
          disabled={isSoldOut || !selectedVariantId}
          onClick={async () => {
            const result = await addProductToBag(product, {
              qty: quantity,
              variantId: selectedVariantId,
              color: activeColor?.name,
              size: selectedSize,
            });
            if (result?.ok) {
              openCart?.();
            }
          }}
          style={{
            minHeight: '44px',
            background: isSoldOut ? 'var(--border-strong)' : 'var(--color-primary)',
            color: 'var(--color-primary-contrast)',
            border: 'none',
            borderRadius: '999px',
            fontFamily: 'var(--font-sans)',
            fontSize: '11px',
            letterSpacing: '0.14em',
            textTransform: 'uppercase',
            fontWeight: 600,
            cursor: isSoldOut ? 'not-allowed' : 'pointer',
            padding: '0 20px',
            whiteSpace: 'nowrap',
            opacity: isSoldOut ? 0.7 : 1,
          }}
        >
          {isSoldOut ? 'Sold out' : 'Add to Bag'}
        </button>
      </div>

      {isLightboxOpen && (
        <div onClick={() => setLightboxOpen(false)} style={{ position: 'fixed', inset: 0, background: 'var(--bg-overlay)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200, padding: '16px' }}>
          <div onClick={(e) => e.stopPropagation()} style={{ position: 'relative', width: 'min(900px, 94vw)', maxHeight: '90dvh', background: 'var(--bg-surface)', border: '1px solid var(--border-default)', borderRadius: '18px', padding: '16px', boxShadow: 'var(--shadow-lg)' }}>
            <button onClick={() => setLightboxOpen(false)} style={{ position: 'absolute', top: '14px', right: '14px', border: 'none', background: 'var(--bg-surface-raised)', color: 'var(--text-primary)', width: '44px', height: '44px', borderRadius: '50%', cursor: 'pointer', fontSize: '24px', lineHeight: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10 }}>×</button>
            <div style={{ display: 'grid', gap: '12px' }}>
              <img src={galleryImages[selectedImage]} alt={product.name} style={{ width: '100%', height: 'calc(80dvh - 80px)', objectFit: 'contain', borderRadius: '12px' }} />
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <button onClick={() => setSelectedImage((prev) => (prev === 0 ? galleryImages.length - 1 : prev - 1))} style={{ background: 'none', border: 'none', color: 'var(--text-primary)', cursor: 'pointer', fontFamily: 'var(--font-sans)', fontSize: '12px', letterSpacing: '0.14em', textTransform: 'uppercase', minHeight: '44px', minWidth: '44px', display: 'flex', alignItems: 'center' }}>← Prev</button>
                <span style={{ fontFamily: 'var(--font-sans)', fontSize: '11px', letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>{selectedImage + 1} / {galleryImages.length}</span>
                <button onClick={() => setSelectedImage((prev) => (prev + 1) % galleryImages.length)} style={{ background: 'none', border: 'none', color: 'var(--text-primary)', cursor: 'pointer', fontFamily: 'var(--font-sans)', fontSize: '12px', letterSpacing: '0.14em', textTransform: 'uppercase', minHeight: '44px', minWidth: '44px', display: 'flex', alignItems: 'center' }}>Next →</button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
