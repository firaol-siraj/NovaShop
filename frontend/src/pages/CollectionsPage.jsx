import { useEffect, useMemo, useState } from "react";
import { useCategories } from "../context/CategoryContext";

const T = {
  bg: "#FAF7F2",
  espresso: "#231E1B",
  muted: "#6E6962",
  border: "#E8E2D9",
  card: "#F0EBE4",
};

const FALLBACK_IMAGE =
  "https://images.unsplash.com/photo-1441986300917-64674bd600d8?auto=format&fit=crop&w=1200&q=80";

function getCategoryImage(category) {
  return (
    category.image ||
    category.imageUrl ||
    category.coverImage ||
    category.thumbnail ||
    FALLBACK_IMAGE
  );
}

function getCategoryDescription(category) {
  return (
    category.description?.trim() ||
    `Discover our ${category.name.toLowerCase()} collection, thoughtfully selected for your wardrobe.`
  );
}

function getProductCount(category) {
  const possibleCounts = [
    category.productCount,
    category.productsCount,
    category.products,
  ];

  for (const value of possibleCounts) {
    if (typeof value === "number" && Number.isFinite(value)) {
      return Math.max(0, value);
    }

    if (Array.isArray(value)) {
      return value.length;
    }
  }

  return null;
}

function isVisibleCategory(category) {
  const status = String(category.status || "").toLowerCase();

  if (["draft", "hidden", "archived", "inactive"].includes(status)) {
    return false;
  }

  if (category.isActive === false || category.isPublished === false) {
    return false;
  }

  // Respect an explicit navigation setting if the API supplies it.
  if (
    category.showInNavigation === false ||
    category.showInNavigation === "false"
  ) {
    return false;
  }

  return Boolean(category.name && category.slug);
}

export default function CollectionsPage({ go }) {
  const {
    categories = [],
    loading,
    error,
    refreshCategories,
  } = useCategories();

  const [failedImages, setFailedImages] = useState({});
  const [retrying, setRetrying] = useState(false);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" });
  }, []);

  const collections = useMemo(() => {
    return categories
      .filter(isVisibleCategory)
      .filter((category) => !category.parentId && !category.parent)
      .sort((a, b) => {
        const aOrder = Number(a.sortOrder ?? a.position ?? 0);
        const bOrder = Number(b.sortOrder ?? b.position ?? 0);

        return aOrder - bOrder || a.name.localeCompare(b.name);
      });
  }, [categories]);

  const handleCollectionClick = (collection) => {
    if (!collection.slug) return;

    go(`/shop?category=${encodeURIComponent(collection.slug)}`);
  };

  const handleRetry = async () => {
    if (retrying) return;

    setRetrying(true);

    try {
      if (typeof refreshCategories === "function") {
        await refreshCategories();
      } else {
        window.location.reload();
      }
    } finally {
      setRetrying(false);
    }
  };

  return (
    <>
      <style>{`
        .col-page {
          min-height: 70vh;
          background: ${T.bg};
          color: ${T.espresso};
        }

        .col-container {
          width: 100%;
          max-width: 1480px;
          margin: 0 auto;
          padding: 76px 48px 112px;
        }

        .col-header {
          max-width: 700px;
          margin: 0 auto 64px;
          text-align: center;
        }

        .col-eyebrow {
          display: block;
          margin-bottom: 17px;
          color: ${T.muted};
          font-family: var(--font-sans);
          font-size: 10px;
          font-weight: 600;
          letter-spacing: 0.19em;
          text-transform: uppercase;
        }

        .col-title {
          margin: 0 0 18px;
          color: ${T.espresso};
          font-family: var(--font-serif);
          font-size: clamp(38px, 5vw, 58px);
          font-weight: 400;
          letter-spacing: -0.035em;
          line-height: 1.12;
        }

        .col-subtext {
          max-width: 510px;
          margin: 0 auto;
          color: ${T.muted};
          font-family: var(--font-sans);
          font-size: 14px;
          font-weight: 400;
          line-height: 1.8;
        }

        .col-results {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 16px;
          margin-bottom: 24px;
          padding-bottom: 15px;
          border-bottom: 1px solid ${T.border};
        }

        .col-results-label {
          color: ${T.muted};
          font-family: var(--font-sans);
          font-size: 10px;
          letter-spacing: 0.13em;
          text-transform: uppercase;
        }

        .col-grid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 48px 28px;
        }

        .col-card {
          display: flex;
          min-width: 0;
          flex-direction: column;
          padding: 0;
          border: 0;
          background: transparent;
          color: inherit;
          text-align: left;
          cursor: pointer;
        }

        .col-card:focus-visible {
          outline: 2px solid ${T.espresso};
          outline-offset: 5px;
        }

        .col-img-wrapper {
          position: relative;
          width: 100%;
          aspect-ratio: 3 / 4;
          overflow: hidden;
          margin-bottom: 22px;
          background: ${T.card};
        }

        .col-img {
          display: block;
          width: 100%;
          height: 100%;
          object-fit: cover;
          transition: transform 650ms cubic-bezier(.2,.65,.3,1);
        }

        .col-card:hover .col-img {
          transform: scale(1.035);
        }

        .col-image-fallback {
          display: flex;
          width: 100%;
          height: 100%;
          align-items: center;
          justify-content: center;
          padding: 20px;
          color: ${T.muted};
          font-family: var(--font-serif);
          font-size: 25px;
          text-align: center;
        }

        .col-image-overlay {
          position: absolute;
          right: 16px;
          bottom: 16px;
          display: flex;
          width: 42px;
          height: 42px;
          align-items: center;
          justify-content: center;
          border-radius: 50%;
          background: ${T.bg};
          color: ${T.espresso};
          font-size: 20px;
          opacity: 0;
          transform: translateY(5px);
          transition: opacity 200ms ease, transform 200ms ease;
        }

        .col-card:hover .col-image-overlay,
        .col-card:focus-visible .col-image-overlay {
          opacity: 1;
          transform: translateY(0);
        }

        .col-name {
          margin: 0 0 9px;
          color: ${T.espresso};
          font-family: var(--font-serif);
          font-size: clamp(20px, 2vw, 25px);
          font-weight: 400;
          line-height: 1.3;
        }

        .col-desc {
          display: -webkit-box;
          overflow: hidden;
          margin: 0 0 17px;
          color: ${T.muted};
          font-family: var(--font-sans);
          font-size: 13px;
          line-height: 1.75;
          -webkit-box-orient: vertical;
          -webkit-line-clamp: 2;
        }

        .col-card-footer {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          margin-top: auto;
          padding-top: 14px;
          border-top: 1px solid ${T.border};
        }

        .col-count {
          color: ${T.espresso};
          font-family: var(--font-sans);
          font-size: 10px;
          font-weight: 500;
          letter-spacing: 0.12em;
          text-transform: uppercase;
        }

        .col-explore {
          color: ${T.muted};
          font-family: var(--font-sans);
          font-size: 11px;
          letter-spacing: 0.04em;
          transition: color 180ms ease;
        }

        .col-card:hover .col-explore {
          color: ${T.espresso};
        }

        .col-state {
          padding: 65px 24px;
          text-align: center;
        }

        .col-state h2 {
          margin: 0 0 12px;
          font-family: var(--font-serif);
          font-size: 28px;
          font-weight: 400;
        }

        .col-state p {
          margin: 0 auto 22px;
          color: ${T.muted};
          font-family: var(--font-sans);
          font-size: 13px;
          line-height: 1.7;
        }

        .col-state-button {
          display: inline-flex;
          min-height: 44px;
          align-items: center;
          justify-content: center;
          padding: 0 22px;
          border: 1px solid ${T.espresso};
          background: ${T.espresso};
          color: white;
          font-family: var(--font-sans);
          font-size: 11px;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          cursor: pointer;
        }

        .col-state-button:disabled {
          opacity: .6;
          cursor: wait;
        }

        .col-skeleton {
          aspect-ratio: 3 / 4;
          margin-bottom: 20px;
          background: linear-gradient(
            100deg,
            #eee8e0 20%,
            #f7f3ed 40%,
            #eee8e0 60%
          );
          background-size: 200% 100%;
          animation: col-shimmer 1.4s ease infinite;
        }

        @keyframes col-shimmer {
          to { background-position-x: -200%; }
        }

        @media (prefers-reduced-motion: reduce) {
          .col-img,
          .col-image-overlay,
          .col-explore {
            transition: none;
          }

          .col-skeleton {
            animation: none;
          }
        }

        @media (max-width: 1024px) {
          .col-container {
            padding: 64px 32px 90px;
          }

          .col-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 40px 24px;
          }
        }

        @media (max-width: 600px) {
          .col-container {
            padding: 48px 20px 72px;
          }

          .col-header {
            margin-bottom: 38px;
          }

          .col-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 30px 14px;
          }

          .col-img-wrapper {
            margin-bottom: 14px;
          }

          .col-name {
            font-size: 19px;
          }

          .col-desc {
            font-size: 12px;
            line-height: 1.6;
          }

          .col-card-footer {
            align-items: flex-start;
            flex-direction: column;
            gap: 8px;
          }

          .col-image-overlay {
            right: 9px;
            bottom: 9px;
            width: 34px;
            height: 34px;
            font-size: 16px;
          }
        }
      `}</style>

      <main className="col-page">
        <div className="col-container">
          <header className="col-header">
            <span className="col-eyebrow">The NovaShop Edit</span>
            <h1 className="col-title">Our Collections</h1>
            <p className="col-subtext">
              Explore thoughtfully curated collections, timeless essentials,
              and considered pieces for every occasion.
            </p>
          </header>

          {loading ? (
            <div
              className="col-grid"
              aria-label="Loading collections"
              aria-busy="true"
            >
              {Array.from({ length: 6 }).map((_, index) => (
                <div key={index}>
                  <div className="col-skeleton" />
                  <div
                    style={{
                      height: 18,
                      width: "65%",
                      marginBottom: 12,
                      background: T.card,
                    }}
                  />
                  <div
                    style={{
                      height: 12,
                      width: "90%",
                      background: T.card,
                    }}
                  />
                </div>
              ))}
            </div>
          ) : error ? (
            <section className="col-state" role="alert">
              <h2>Collections are temporarily unavailable</h2>
              <p>
                We couldn't load our collections. Please try again in a moment.
              </p>
              <button
                className="col-state-button"
                type="button"
                onClick={handleRetry}
                disabled={retrying}
              >
                {retrying ? "Retrying..." : "Try again"}
              </button>
            </section>
          ) : collections.length === 0 ? (
            <section className="col-state">
              <h2>Something new is taking shape</h2>
              <p>
                Our collections are being curated. Please check back soon.
              </p>
              <button
                className="col-state-button"
                type="button"
                onClick={() => go("/shop")}
              >
                Explore the shop
              </button>
            </section>
          ) : (
            <>
              <div className="col-results">
                <span className="col-results-label">
                  Curated collections
                </span>
                <span className="col-results-label">
                  {collections.length}{" "}
                  {collections.length === 1 ? "collection" : "collections"}
                </span>
              </div>

              <div className="col-grid">
                {collections.map((collection) => {
                  const count = getProductCount(collection);
                  const image = getCategoryImage(collection);
                  const imageFailed = failedImages[collection.id || collection.slug];

                  return (
                    <button
                      key={collection.id || collection.slug}
                      type="button"
                      className="col-card"
                      onClick={() => handleCollectionClick(collection)}
                      aria-label={`Explore ${collection.name} collection`}
                    >
                      <div className="col-img-wrapper">
                        {imageFailed ? (
                          <div className="col-image-fallback">
                            {collection.name}
                          </div>
                        ) : (
                          <img
                            src={image}
                            alt={collection.name}
                            className="col-img"
                            loading="lazy"
                            onError={() =>
                              setFailedImages((current) => ({
                                ...current,
                                [collection.id || collection.slug]: true,
                              }))
                            }
                          />
                        )}

                        <span className="col-image-overlay" aria-hidden="true">
                          ↗
                        </span>
                      </div>

                      <h2 className="col-name">{collection.name}</h2>

                      <p className="col-desc">
                        {getCategoryDescription(collection)}
                      </p>

                      <div className="col-card-footer">
                        <span className="col-count">
                          {count === null
                            ? "Explore collection"
                            : `${count} ${count === 1 ? "piece" : "pieces"}`}
                        </span>
                        <span className="col-explore">
                          Discover collection →
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </main>
    </>
  );
}
