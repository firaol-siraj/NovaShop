import { useEffect, useMemo } from 'react';
import { useCategories } from '../context/CategoryContext';
import ShopPage from './ShopPage';

export default function CollectionDetailPage({ go, slug, search = '' }) {
  const { categories = [], loading } = useCategories();

  const collection = useMemo(() => {
    if (!slug) return null;
    const cleanSlug = String(slug).toLowerCase().trim();
    return categories.find(
      (c) =>
        String(c.slug || '').toLowerCase() === cleanSlug ||
        String(c._id || '') === cleanSlug
    );
  }, [categories, slug]);

  const collectionName = collection?.name || (slug ? slug.replace(/-/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase()) : 'Collection');
  const collectionDesc = collection?.description || `Explore our curated selection of ${collectionName.toLowerCase()}, designed with architectural restraint and refined craftsmanship.`;
  const collectionImage = collection?.image || collection?.imageUrl || '';

  useEffect(() => {
    document.title = `${collectionName} | NovaShop Collections`;
  }, [collectionName]);

  return (
    <div style={{ backgroundColor: 'var(--bg-main)', minHeight: '100vh' }}>
      {/* ── Collection Header Hero ── */}
      <section
        style={{
          borderBottom: '1px solid var(--border-subtle)',
          backgroundColor: 'var(--bg-surface)',
          padding: '48px 0 36px',
        }}
      >
        <div style={{ maxWidth: '1440px', margin: '0 auto', padding: '0 clamp(16px, 4vw, 40px)' }}>
          {/* Breadcrumb */}
          <nav
            aria-label="Breadcrumb"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              marginBottom: '20px',
              fontSize: '11px',
              fontFamily: 'var(--font-sans)',
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
              color: 'var(--text-muted)',
            }}
          >
            <button
              type="button"
              onClick={() => go('/')}
              style={{ background: 'none', border: 'none', padding: 0, color: 'inherit', cursor: 'pointer' }}
            >
              Home
            </button>
            <span aria-hidden="true">/</span>
            <button
              type="button"
              onClick={() => go('/collections')}
              style={{ background: 'none', border: 'none', padding: 0, color: 'inherit', cursor: 'pointer' }}
            >
              Collections
            </button>
            <span aria-hidden="true">/</span>
            <span style={{ color: 'var(--text-primary)' }}>{collectionName}</span>
          </nav>

          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'flex-end',
              gap: '32px',
              flexWrap: 'wrap',
            }}
          >
            <div style={{ maxWidth: '640px' }}>
              <span
                style={{
                  display: 'block',
                  fontSize: '10px',
                  fontFamily: 'var(--font-sans)',
                  fontWeight: 600,
                  letterSpacing: '0.2em',
                  textTransform: 'uppercase',
                  color: 'var(--text-muted)',
                  marginBottom: '10px',
                }}
              >
                Curated Collection
              </span>
              <h1
                style={{
                  margin: '0 0 12px',
                  fontFamily: 'var(--font-serif)',
                  fontSize: 'clamp(36px, 4.5vw, 48px)',
                  fontWeight: 400,
                  lineHeight: 1.1,
                  letterSpacing: '-0.02em',
                  color: 'var(--text-primary)',
                }}
              >
                {collectionName}
              </h1>
              <p
                style={{
                  margin: 0,
                  fontSize: '15px',
                  fontFamily: 'var(--font-sans)',
                  lineHeight: 1.6,
                  color: 'var(--text-secondary)',
                }}
              >
                {collectionDesc}
              </p>
            </div>

            <button
              type="button"
              onClick={() => go('/collections')}
              style={{
                background: 'transparent',
                border: '1px solid var(--border-strong)',
                minHeight: '44px',
                padding: '11px 20px',
                fontSize: '11px',
                fontFamily: 'var(--font-sans)',
                letterSpacing: '0.12em',
                textTransform: 'uppercase',
                color: 'var(--text-primary)',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                transition: 'background 180ms ease, color 180ms ease',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              ← Back to All Collections
            </button>
          </div>
        </div>
      </section>

      {/* ── Scoped Product Grid with Filters & Sort ── */}
      <ShopPage
        go={go}
        search={search}
        initialCategory={slug}
      />
    </div>
  );
}
