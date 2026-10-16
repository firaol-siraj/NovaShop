import { useMemo, useState, useEffect } from "react";
import { useCart } from "../../context/CartContext";

function HeartIcon({ filled }) {
  return (
    <svg
      width="17"
      height="17"
      viewBox="0 0 24 24"
      fill={filled ? "#1B1816" : "none"}
      stroke="#1B1816"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
    </svg>
  );
}

function BagIcon({ added }) {
  return added ? (
    <svg
      width="17"
      height="17"
      viewBox="0 0 24 24"
      fill="none"
      stroke="#1B1816"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <polyline points="20 6 9 17 4 12" />
    </svg>
  ) : (
    <svg
      width="17"
      height="17"
      viewBox="0 0 24 24"
      fill="none"
      stroke="#1B1816"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" />
      <line x1="3" y1="6" x2="21" y2="6" />
      <path d="M16 10a4 4 0 0 1-8 0" />
    </svg>
  );
}

function EyeIcon() {
  return (
    <svg
      width="17"
      height="17"
      viewBox="0 0 24 24"
      fill="none"
      stroke="#1B1816"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function ProductTile({ product, go, onAddToCart, onAddToWishlist }) {
  const { isWishlisted, toggleWishlist } = useCart();
  const [hovered, setHovered] = useState(false);
  const [wishlisted, setWishlisted] = useState(
    isWishlisted(product.productId || product.id),
  );
  const [cartAdded, setCartAdded] = useState(false);
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    setWishlisted(isWishlisted(product.productId || product.id));
  }, [isWishlisted, product.productId, product.id]);
  const showActions = hovered || focused;

  const imageSrc = product.primaryImage || product.image;
  const hoverSrc = product.hoverImage || imageSrc;

  const handleWishlist = (e) => {
    e.stopPropagation();
    toggleWishlist(product);
    setWishlisted((value) => !value);
    onAddToWishlist?.(product);
  };

  const productPath = product.path || `/products/${product.slug || product.id}`;
  const soldOut = Number(product.stockTotal) === 0;

  const handleCart = (e) => {
    e.stopPropagation();
    if (cartAdded || soldOut) return;
    setCartAdded(true);
    onAddToCart?.({ ...product, stock: product.stock || "in-stock" });
    setTimeout(() => setCartAdded(false), 1600);
  };

  const handleView = (e) => {
    e.stopPropagation();
    go?.(productPath);
  };

  return (
    <article
      onClick={() => go?.(productPath)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      tabIndex={0}
      aria-label={`View ${product.name}`}
      style={{
        cursor: "pointer",
        outline: "none",
        transition: "transform 260ms cubic-bezier(0.22, 1, 0.36, 1)",
        transform: showActions ? "translateY(-4px)" : "translateY(0)",
      }}
    >
      <div
        style={{
          position: "relative",
          overflow: "hidden",
          borderRadius: "14px",
          aspectRatio: "1 / 1.1",
          backgroundColor: "#F0EBE0",
          boxShadow: showActions
            ? "0 18px 32px rgba(17, 14, 12, 0.08)"
            : "0 8px 18px rgba(17, 14, 12, 0.03)",
          transition: "box-shadow 260ms ease",
        }}
      >
        <img
          src={imageSrc}
          alt={product.name}
          loading="lazy"
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            objectFit: "cover",
            objectPosition: "center",
            opacity: showActions ? 0 : 1,
            transform: showActions ? "scale(1.04)" : "scale(1)",
            transition: "opacity 360ms ease, transform 420ms ease",
          }}
        />
        <img
          src={hoverSrc}
          alt={`${product.name} alternate view`}
          loading="lazy"
          aria-hidden="true"
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            objectFit: "cover",
            objectPosition: "center",
            opacity: showActions ? 1 : 0,
            transform: showActions ? "scale(1.04)" : "scale(1)",
            transition: "opacity 360ms ease, transform 420ms ease",
          }}
        />

        {soldOut && (
          <span
            style={{
              position: "absolute",
              top: "12px",
              left: "12px",
              background: "#1B1816",
              color: "#FDFBF7",
              fontSize: "9px",
              fontFamily: "var(--font-sans)",
              fontWeight: 600,
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              padding: "4px 10px",
              borderRadius: "100px",
              zIndex: 2,
            }}
          >
            Sold out
          </span>
        )}
        <div
          style={{
            position: "absolute",
            top: "12px",
            right: "12px",
            display: "flex",
            flexDirection: "column",
            gap: "8px",
            zIndex: 3,
            opacity: showActions ? 1 : 0,
            transform: showActions ? "scale(1)" : "scale(0.85)",
            transition: "opacity 200ms ease, transform 200ms ease",
          }}
        >
          <button
            type="button"
            onClick={handleWishlist}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            aria-label={wishlisted ? "Remove from wishlist" : "Add to wishlist"}
            style={{
              width: "38px",
              height: "38px",
              borderRadius: "50%",
              border: "none",
              background: "#FDFBF7",
              boxShadow: "0 8px 18px rgba(17, 14, 12, 0.12)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              transition: "transform 200ms ease, box-shadow 200ms ease",
              transform: showActions ? "translateY(0)" : "translateY(2px)",
            }}
          >
            <HeartIcon filled={wishlisted} />
          </button>

          <button
            type="button"
            onClick={handleView}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            aria-label="View product details"
            style={{
              width: "38px",
              height: "38px",
              borderRadius: "50%",
              border: "none",
              background: "#FDFBF7",
              boxShadow: "0 8px 18px rgba(17, 14, 12, 0.12)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              transition: "transform 200ms ease, box-shadow 200ms ease",
              transform: showActions ? "translateY(0)" : "translateY(2px)",
            }}
          >
            <EyeIcon />
          </button>

          {!soldOut && (
          <button
            type="button"
            onClick={handleCart}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            aria-label="Add to cart"
            style={{
              width: "38px",
              height: "38px",
              borderRadius: "50%",
              border: "none",
              background: "#FDFBF7",
              boxShadow: "0 8px 18px rgba(17, 14, 12, 0.12)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              transition: "transform 200ms ease, box-shadow 200ms ease",
              transform: showActions ? "translateY(0)" : "translateY(2px)",
            }}
          >
            <BagIcon added={cartAdded} />
          </button>
          )}
        </div>
      </div>

      <div style={{ padding: "14px 2px 0" }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "baseline",
            gap: "8px",
            marginBottom: "4px",
          }}
        >
          <p
            style={{
              margin: 0,
              flex: 1,
              minWidth: 0,
              fontFamily: "var(--font-sans)",
              fontSize: "15px",
              fontWeight: 500,
              color: "#1B1816",
              lineHeight: 1.3,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {product.name}
          </p>
          <p
            style={{
              margin: 0,
              fontFamily: "var(--font-sans)",
              fontSize: "15px",
              fontWeight: 600,
              color: "#1B1816",
              flexShrink: 0,
            }}
          >
            {product.price}
          </p>
        </div>

        <p
          style={{
            margin: "0 0 10px",
            fontFamily: "var(--font-sans)",
            fontSize: "12px",
            color: "#8C837C",
            lineHeight: 1.5,
          }}
        >
          {product.variant}
        </p>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "6px",
            flexWrap: "wrap",
          }}
        >
          {(product.swatches || []).map((swatch, index) => (
            <span
              key={`${product.id}-swatch-${index}`}
              aria-label={`${product.name} ${index + 1} color`}
              style={{
                width: "15px",
                height: "15px",
                borderRadius: "50%",
                background: swatch,
                border: "1.5px solid rgba(0,0,0,0.12)",
                display: "inline-block",
                boxSizing: "border-box",
              }}
            />
          ))}
          <span
            style={{
              fontFamily: "var(--font-sans)",
              fontSize: "11px",
              color: "#9B9189",
              letterSpacing: "0.04em",
            }}
          >
            {product.shadeCount || product.swatches?.length || 1} Shade
            {(product.shadeCount || product.swatches?.length || 1) !== 1
              ? "s"
              : ""}
          </span>
        </div>
      </div>
    </article>
  );
}

export default function ProductSection({
  go,
  label,
  heading,
  description,
  viewAllPath,
  viewAllLabel = "View all",
  products = [],
  loading = false,
  filters = null,
  activeFilter = "all",
  onFilterChange = null,
  onAddToCart,
  onAddToWishlist,
}) {
  const skeletonArr = Array.from({ length: 4 });

  const filteredProducts = useMemo(() => products, [products]);

  return (
    <section style={{ backgroundColor: "#FDFBF7", padding: "76px 0" }}>
      <div style={{ maxWidth: "1400px", margin: "0 auto", padding: "0 40px" }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-end",
            gap: "32px",
            marginBottom: "42px",
          }}
          className="trending-header"
        >
          <div>
            {label && (
              <span
                style={{
                  display: "block",
                  marginBottom: "12px",
                  fontFamily: "var(--font-sans)",
                  fontSize: "11px",
                  fontWeight: 500,
                  letterSpacing: "0.2em",
                  textTransform: "uppercase",
                  color: "#9B9189",
                }}
              >
                {label}
              </span>
            )}
            <h2
              style={{
                margin: 0,
                fontFamily: "var(--font-serif)",
                fontSize: "clamp(38px, 4vw, 48px)",
                lineHeight: 1.0,
                fontWeight: 400,
                fontStyle: "italic",
                letterSpacing: "-0.03em",
                color: "#1B1816",
              }}
            >
              {heading}
            </h2>
            {description && (
              <p
                style={{
                  margin: "10px 0 0",
                  maxWidth: "420px",
                  fontFamily: "var(--font-sans)",
                  fontSize: "14px",
                  lineHeight: 1.6,
                  color: "#6E6962",
                  fontWeight: 300,
                }}
              >
                {description}
              </p>
            )}
          </div>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "12px",
              flexShrink: 0,
            }}
          >
            {filters && filters.length > 0 && (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
                  overflowX: "auto",
                  scrollbarWidth: "none",
                  msOverflowStyle: "none",
                  whiteSpace: "nowrap",
                  paddingBottom: "2px",
                }}
                className="trending-filters"
              >
                {filters.map((f) => (
                  <button
                    key={f.value}
                    type="button"
                    onClick={() => onFilterChange && onFilterChange(f.value)}
                    style={{
                      border: "1px solid #D9D0C7",
                      borderRadius: "999px",
                      background:
                        activeFilter === f.value ? "#1B1816" : "#F6F1EA",
                      color: activeFilter === f.value ? "#FDFBF7" : "#1B1816",
                      fontFamily: "var(--font-sans)",
                      fontSize: "10px",
                      fontWeight: 600,
                      letterSpacing: "0.14em",
                      textTransform: "uppercase",
                      padding: "10px 16px",
                      cursor: "pointer",
                      transition: "all 220ms ease",
                    }}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            )}

            {viewAllPath && (
              <button
                type="button"
                onClick={() => go(viewAllPath)}
                style={{
                  background: "transparent",
                  border: "none",
                  padding: 0,
                  cursor: "pointer",
                  fontFamily: "var(--font-sans)",
                  fontSize: "10px",
                  fontWeight: 600,
                  letterSpacing: "0.14em",
                  textTransform: "uppercase",
                  color: "#1B1816",
                  borderBottom: "1px solid #1B1816",
                  paddingBottom: "2px",
                  whiteSpace: "nowrap",
                }}
              >
                {viewAllLabel}
              </button>
            )}
          </div>
        </div>

        {loading ? (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
              gap: "26px",
            }}
            className="trending-grid"
          >
            {skeletonArr.map((_, i) => (
              <div key={i}>
                <div
                  style={{
                    aspectRatio: "1 / 1.1",
                    width: "100%",
                    borderRadius: "14px",
                    background: "#EFECE6",
                    animation: "trending-pulse 1.5s ease-in-out infinite",
                  }}
                />
                <div
                  style={{
                    paddingTop: "14px",
                    display: "flex",
                    flexDirection: "column",
                    gap: "8px",
                  }}
                >
                  <div
                    style={{
                      height: "12px",
                      width: "60%",
                      background: "#EFECE6",
                      borderRadius: "4px",
                      animation: "trending-pulse 1.5s ease-in-out infinite",
                    }}
                  />
                  <div
                    style={{
                      height: "11px",
                      width: "45%",
                      background: "#EFECE6",
                      borderRadius: "4px",
                      animation: "trending-pulse 1.5s ease-in-out infinite",
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
              gap: "26px",
              transition: "all 300ms ease",
            }}
            className="trending-grid"
          >
            {filteredProducts.map((product) => (
              <div
                key={product.id}
                style={{
                  transition: "opacity 300ms ease, transform 300ms ease",
                }}
              >
                <ProductTile
                  product={product}
                  go={go}
                  onAddToCart={onAddToCart}
                  onAddToWishlist={onAddToWishlist}
                />
              </div>
            ))}
          </div>
        )}
      </div>

      <style>{`
        @keyframes trending-pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.52; }
        }

        @media (max-width: 1023px) {
          .trending-header {
            flex-direction: column !important;
            align-items: flex-start !important;
          }
          .trending-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
          }
        }

        @media (max-width: 640px) {
          .trending-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
            gap: 16px !important;
          }
          .trending-filters {
            width: 100%;
            padding-bottom: 0;
          }
        }
      `}</style>
    </section>
  );
}
