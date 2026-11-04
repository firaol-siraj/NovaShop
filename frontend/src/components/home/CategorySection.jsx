import { useState, useRef } from "react";
import { useCategories } from "../../context/CategoryContext";

/* ─── Arrow icon ────────────────────────────────────────────────────────── */

function ArrowIcon({ color = "var(--text-primary)", size = 16 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      style={{ color, transition: "color 0.2s ease" }}
    >
      <path d="M5 12h14M12 5l7 7-7 7" />
    </svg>
  );
}

/* ─── Single category card ───────────────────────────────────────────────── */

function CategoryCard({ cat, go }) {
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const cardRef = useRef(null);

  const isHighlighted = hovered || focused;

  return (
    <article
      style={{
        display: "flex",
        flexDirection: "column",
        cursor: "pointer",
        outline: focused ? "2px solid var(--border-focus)" : "none",
        outlineOffset: "4px",
        textDecoration: "none",
      }}
      role="link"
      tabIndex={0}
      onClick={() => go(cat.path)}
      onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && go(cat.path)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      aria-label={`Explore ${cat.label} — ${cat.count} items`}
      ref={cardRef}
    >
      {/* ── Image container ──────────────────────────────────────── */}
      <div
        style={{
          position: "relative",
          overflow: "hidden",
          aspectRatio: "3 / 4",
          flexShrink: 0,
        }}
      >
        <img
          src={cat.image}
          alt={cat.alt}
          loading="lazy"
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
            objectPosition: "center",
            display: "block",
            transform: isHighlighted ? "scale(1.04)" : "scale(1)",
            transition: "transform 500ms ease",
            willChange: "transform",
          }}
        />
      </div>

      {/* ── Caption band ─────────────────────────────────────────── */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          paddingTop: "20px",
          background: "transparent",
        }}
      >
        {/* Left: name + explore label */}
        <div
          style={{
            transform: isHighlighted ? "translateY(-2px)" : "translateY(0)",
            transition: "transform 300ms ease",
          }}
        >
          <h3
            style={{
              margin: "0 0 6px",
              fontFamily: "var(--font-serif)",
              fontSize: "22px",
              fontWeight: 400,
              letterSpacing: "-0.01em",
              color: "var(--text-primary)",
              lineHeight: 1.1,
            }}
          >
            {cat.label}
          </h3>
          <p
            style={{
              margin: 0,
              fontFamily: "var(--font-sans)",
              fontSize: "11px",
              fontWeight: 500,
              letterSpacing: "0.15em",
              textTransform: "uppercase",
              color: "var(--text-muted)",
              lineHeight: 1,
            }}
          >
            Explore &middot; {cat.count}
          </p>
        </div>

        {/* Right: circular arrow button */}
        <div
          style={{
            width: "42px",
            height: "42px",
            borderRadius: "50%",
            border: "1px solid var(--border-strong)",
            background: isHighlighted ? "var(--color-primary)" : "transparent",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
            transition: "background 200ms ease",
          }}
        >
          <ArrowIcon color={isHighlighted ? "var(--color-primary-contrast)" : "var(--text-primary)"} size={16} />
        </div>
      </div>
    </article>
  );
}

/* ─── Section component ─────────────────────────────────────────────────── */

export default function CategorySection({ go }) {
  const { categories, loading, error } = useCategories();

  const visibleCategories = categories
    .filter((category) => category.name && category.slug)
    .slice(0, 4);

  return (
    <section
      aria-labelledby="category-heading"
      style={{
        backgroundColor: "var(--bg-main)",
        padding: "70px 0",
      }}
    >
      <div
        style={{
          maxWidth: "1440px",
          margin: "0 auto",
          padding: "0 40px",
        }}
        className="category-container"
      >
        <div
          className="category-header"
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-end",
            marginBottom: "48px",
            gap: "24px",
            flexWrap: "wrap",
          }}
        >
          <div>
            <span
              style={{
                display: "block",
                fontFamily: "var(--font-sans)",
                fontSize: "11px",
                letterSpacing: "0.2em",
                textTransform: "uppercase",
                color: "var(--text-muted)",
                marginBottom: "14px",
              }}
            >
              Curated Archives
            </span>

            <h2
              id="category-heading"
              style={{
                fontFamily: "var(--font-serif)",
                fontSize: "clamp(32px, 4vw, 40px)",
                fontWeight: 400,
                lineHeight: 1.05,
                color: "var(--text-primary)",
                margin: 0,
              }}
            >
              Shop by Category
            </h2>
          </div>

          <div
            className="category-header-right"
            style={{
              display: "flex",
              alignItems: "center",
              gap: "24px",
              flexWrap: "wrap",
            }}
          >
            <p
              className="category-header-para"
              style={{
                fontSize: "15px",
                lineHeight: 1.65,
                color: "var(--text-muted)",
                maxWidth: "280px",
                margin: 0,
                textAlign: "right",
              }}
            >
              Explore refined essentials and seasonal pieces designed for everyday wear.
            </p>

            <button
              type="button"
              onClick={() => go("/collections")}
              className="category-explore-btn"
              style={{
                background: "transparent",
                border: "1px solid var(--border-strong)",
                padding: "11px 22px",
                color: "var(--text-primary)",
                cursor: "pointer",
                fontSize: "11px",
                letterSpacing: "0.12em",
                textTransform: "uppercase",
                whiteSpace: "nowrap",
                fontFamily: "var(--font-sans)",
                transition: "background 180ms ease, color 180ms ease",
              }}
            >
              Explore All Categories →
            </button>
          </div>
        </div>

        {loading && visibleCategories.length === 0 ? (
          <p>Loading categories...</p>
        ) : error && visibleCategories.length === 0 ? (
          <p role="alert">{error}</p>
        ) : visibleCategories.length === 0 ? (
          <p>No categories available yet.</p>
        ) : (
          <div
            className="category-grid"
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(4, 1fr)",
              gap: "24px",
            }}
          >
            {visibleCategories.map((category) => {
              const slug = category.slug.toLowerCase();

              const cat = {
                label: category.name,
                count: Number(category.productCount) || 0,
                path: `/shop?category=${encodeURIComponent(slug)}`,
                image: category.image || "",
                alt: `${category.name} collection`,
              };

              return (
                <CategoryCard
                  key={category._id || category.slug}
                  cat={cat}
                  go={go}
                />
              );
            })}
          </div>
        )}
      </div>
      <style>{`
        @media (max-width: 1023px) {
          .category-grid {
            grid-template-columns: repeat(2, 1fr) !important;
          }
          .category-header-right {
            align-items: flex-start !important;
          }
          .category-header-para {
            text-align: left !important;
          }
        }

        @media (max-width: 767px) {
          .category-container {
            padding: 0 24px !important;
          }
          .category-header {
            flex-direction: column !important;
            align-items: flex-start !important;
            gap: 20px !important;
          }
          .category-header-right {
            flex-direction: column !important;
            align-items: flex-start !important;
            gap: 16px !important;
            width: 100% !important;
          }
          .category-header-para {
            text-align: left !important;
            max-width: 100% !important;
          }
          .category-explore-btn {
            width: 100% !important;
            min-height: 44px !important;
            display: inline-flex !important;
            align-items: center !important;
            justify-content: center !important;
            text-align: center !important;
          }
          .category-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
            gap: 16px !important;
          }
        }

        @media (max-width: 360px) {
          .category-grid {
            grid-template-columns: 1fr !important;
            gap: 24px !important;
          }
        }
      `}</style>
    </section>
  );
}
