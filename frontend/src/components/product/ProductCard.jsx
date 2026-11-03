import { useCart } from '../../context/CartContext';

/**
 * ProductCard — NovaShop Stitch Design System
 * Sharp rectangular, 3:4 image, minimal typography, subtle wishlist control
 * Fully tokenized for Light / Dark Mode support
 */
export default function ProductCard({ product, go, onAddToCart, onAddToWishlist, showQuickAdd = true }) {
  const { isWishlisted, toggleWishlist } = useCart();
  if (!product) return null;

  const id = product.id || product.productId || product._id || product.slug;
  const wishlisted = isWishlisted(id);
  const name = product.name || '';
  const category = (typeof product.category === 'object' ? product.category?.name : product.category) || product.collection || '';
  const price = product.price || 0;
  const image = product.primaryImage || product.image || '';
  const isNew = Boolean(product.isNew || product.new);
  const brand = product.brand || '';
  const stockCount = Number(
    product.countInStock != null
      ? product.countInStock
      : (product.stockTotal != null ? product.stockTotal : product.stock)
  );
  const isOutOfStock = Number.isFinite(stockCount) ? stockCount <= 0 : false;

  return (
    <article className="group flex flex-col cursor-pointer">
      {/* Image Container — strict 3:4 ratio */}
      <div
        className="relative overflow-hidden bg-[var(--bg-surface-sunken)]"
        style={{ aspectRatio: '3 / 4' }}
        onClick={() => go && go(`/product/${id}`)}
      >
        <img
          src={image}
          alt={name}
          loading="lazy"
          className="w-full h-full object-cover object-top transition-transform duration-700 ease-out group-hover:scale-[1.04]"
        />

        {/* NEW badge — top-left */}
        {isNew && (
          <span className="absolute top-3 left-3 bg-[var(--bg-surface)] text-[var(--text-primary)] border border-[var(--border-subtle)] text-[9px] uppercase tracking-widest font-semibold px-2 py-1 z-10 shadow-sm">
            New
          </span>
        )}

        {/* SOLD OUT badge */}
        {isOutOfStock && (
          <span className="absolute top-3 left-3 bg-[var(--color-primary)] text-[var(--color-primary-contrast)] text-[9px] uppercase tracking-widest font-semibold px-2 py-1 z-10">
            Sold Out
          </span>
        )}

        {/* Wishlist button — top-right */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            toggleWishlist(product);
            onAddToWishlist?.(product);
          }}
          className={`absolute top-3 right-3 z-10 p-1.5 transition-opacity duration-200 border border-[var(--border-subtle)] shadow-sm ${
            wishlisted
              ? 'opacity-100 bg-[var(--bg-surface)] text-[var(--color-primary)]'
              : 'opacity-0 group-hover:opacity-100 bg-[var(--bg-surface)] text-[var(--text-primary)] hover:text-[var(--color-accent)]'
          }`}
          aria-label={wishlisted ? 'Remove from wishlist' : 'Add to wishlist'}
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill={wishlisted ? 'currentColor' : 'none'}
            stroke="currentColor"
            strokeWidth="1.5"
          >
            <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />
          </svg>
        </button>

        {/* Quick Add bar — bottom, appears on hover */}
        {showQuickAdd && (
          <div className="absolute inset-x-0 bottom-0 translate-y-full group-hover:translate-y-0 transition-transform duration-300 ease-out">
            <button
              onClick={(e) => { e.stopPropagation(); if (onAddToCart && !isOutOfStock) onAddToCart(product); }}
              disabled={isOutOfStock}
              className="w-full py-3 bg-[var(--color-primary)] text-[var(--color-primary-contrast)] text-[10px] uppercase tracking-widest font-medium hover:bg-[var(--color-primary-hover)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isOutOfStock ? 'Sold Out' : 'Add to Cart'}
            </button>
          </div>
        )}
      </div>

      {/* Info Block */}
      <div className="pt-3 flex flex-col gap-0.5">
        {/* Category / Brand label */}
        {(category || brand) && (
          <span className="text-[10px] uppercase tracking-widest text-[var(--color-earth)] font-medium">
            {category || brand}
          </span>
        )}

        {/* Name */}
        <h3
          className="text-[14px] leading-snug text-[var(--text-primary)] font-normal line-clamp-2 group-hover:text-[var(--text-muted)] transition-colors"
          style={{ fontFamily: 'var(--font-sans)' }}
          onClick={() => go && go(`/product/${id}`)}
        >
          {name}
        </h3>

        {/* Price */}
        <span className="text-[13px] font-medium text-[var(--text-primary)] mt-1">
          ${Number(price).toFixed(2)}
        </span>
      </div>
    </article>
  );
}
