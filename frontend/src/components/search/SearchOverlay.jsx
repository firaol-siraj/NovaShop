import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useCart } from '../../context/CartContext';
import { productApi } from '../../lib/api/productApi';
import { normalizeCatalog } from '../../lib/catalog';
import { useCategories } from '../../context/CategoryContext';

/* ── localStorage helpers ─────────────────────────────── */
const RECENT_KEY = 'novashop_recent_searches';
const MAX_RECENT = 5;

function readRecent() {
  try { return JSON.parse(localStorage.getItem(RECENT_KEY) || '[]').slice(0, MAX_RECENT); }
  catch { return []; }
}
function saveRecent(query) {
  try {
    const q = query.trim();
    if (!q) return;
    const prev = readRecent().filter(r => r !== q);
    localStorage.setItem(RECENT_KEY, JSON.stringify([q, ...prev].slice(0, MAX_RECENT)));
  } catch { /* ignore */ }
}
function clearRecent() {
  try { localStorage.removeItem(RECENT_KEY); } catch { /* ignore */ }
}

/* ── Design tokens ────────────────────────────────────── */
const T = {
  panelBg:    '#FFFFFF',           // white panel
  bandBg:     '#F4F4F4',           // light gray input band
  overlay:    'rgba(17,14,12,0.45)',
  espresso:   '#1A1A1A',           // near-black text
  muted:      '#888888',           // gray labels / subtitles
  mutedLight: '#AAAAAA',
  imgBg:      '#EEEBE6',           // neutral product image bg
  border:     'rgba(0,0,0,0.08)',
  highlight:  '#F0F0F0',
  fontSans:   'var(--font-sans, Inter, "Plus Jakarta Sans", sans-serif)',
};

/* ── Close icon ───────────────────────────────────────── */
const CloseIcon = ({ size = 18 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M18 6 6 18M6 6l12 12" />
  </svg>
);

/* ── Category chip ────────────────────────────────────── */
function CategoryChip({ label, onClick, highlighted }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        background: highlighted ? T.espresso : 'transparent',
        border: `1px solid ${highlighted ? T.espresso : '#CCCCCC'}`,
        borderRadius: 0,
        padding: '7px 16px',
        fontFamily: T.fontSans,
        fontSize: '11px',
        fontWeight: 500,
        letterSpacing: '0.08em',
        textTransform: 'uppercase',
        color: highlighted ? '#FFF' : T.espresso,
        cursor: 'pointer',
        transition: 'all 120ms ease',
        whiteSpace: 'nowrap',
      }}
      onMouseEnter={e => {
        if (!highlighted) {
          e.currentTarget.style.background = T.espresso;
          e.currentTarget.style.color = '#FFF';
          e.currentTarget.style.borderColor = T.espresso;
        }
      }}
      onMouseLeave={e => {
        if (!highlighted) {
          e.currentTarget.style.background = 'transparent';
          e.currentTarget.style.color = T.espresso;
          e.currentTarget.style.borderColor = '#CCCCCC';
        }
      }}
    >
      {label}
    </button>
  );
}

/* ── Recent search row ────────────────────────────────── */
function RecentRow({ term, onClick }) {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', gap: '10px',
        background: 'none', border: 'none', cursor: 'pointer',
        padding: '6px 0',
        fontFamily: T.fontSans, fontSize: '14px',
        color: hovered ? T.espresso : T.muted,
        textAlign: 'left',
        transition: 'color 120ms',
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Clock icon */}
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flexShrink: 0, opacity: 0.5 }}>
        <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
      </svg>
      {term}
    </button>
  );
}

/* ── Product card ─────────────────────────────────────── */
function ProductCard({ product, onClick, highlighted }) {
  const [hovered, setHovered] = useState(false);
  const active = highlighted || hovered;
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: 'flex', flexDirection: 'column',
        background: 'none', border: 'none', cursor: 'pointer',
        textAlign: 'left', padding: 0,
        outline: active ? `2px solid ${T.espresso}` : 'none',
        outlineOffset: '2px',
        transition: 'outline 80ms',
        flexShrink: 0,
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Product image — portrait aspect */}
      <div style={{
        width: '100%',
        paddingBottom: '125%', // portrait 4:5
        position: 'relative',
        background: T.imgBg,
        overflow: 'hidden',
        flexShrink: 0,
      }}>
        <img
          src={product.primaryImage}
          alt={product.name}
          loading="lazy"
          style={{
            position: 'absolute', inset: 0,
            width: '100%', height: '100%',
            objectFit: 'cover',
            display: 'block',
            transition: 'transform 350ms ease',
            transform: hovered ? 'scale(1.04)' : 'scale(1)',
          }}
        />
      </div>
      {/* Info */}
      <div style={{ paddingTop: '10px', width: '100%' }}>
        <div style={{
          fontFamily: T.fontSans, fontSize: '14px', fontWeight: 500,
          color: T.espresso, lineHeight: 1.35,
          marginBottom: '3px',
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        }}>
          {product.name}
        </div>
        <div style={{
          fontFamily: T.fontSans, fontSize: '12px',
          color: T.muted, lineHeight: 1.4, marginBottom: '5px',
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        }}>
          {product.variant}
        </div>
        <div style={{
          fontFamily: T.fontSans, fontSize: '13px', fontWeight: 500,
          color: T.espresso,
        }}>
          {product.price}
        </div>
      </div>
    </button>
  );
}

/* ══════════════════════════════════════════════════════
   MAIN COMPONENT
══════════════════════════════════════════════════════ */
export default function SearchOverlay() {
  const { isSearchOpen, closeSearch } = useCart();
  const { categories } = useCategories();
  const popularCategories = categories.map((category) => ({
    label: category.name,
    path: `/shop?category=${encodeURIComponent(category.slug)}`,
  }));
  const [rawQuery, setRawQuery]       = useState('');
  const [query, setQuery]             = useState('');
  const [recent, setRecent]           = useState([]);
  const [highlighted, setHighlighted] = useState(-1);
  const [isClosing, setIsClosing]     = useState(false);
  const [isOpening, setIsOpening]     = useState(false);
  const [searchResults, setSearchResults] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);

  const inputRef    = useRef(null);
  const gridRef     = useRef(null);
  const debounceRef = useRef(null);
  const [navHeight, setNavHeight] = useState(0);

  /* ── Measure navbar height ──────────────────────────── */
  useEffect(() => {
    const measure = () => {
      const header = document.querySelector('header[role="banner"]');
      if (header) setNavHeight(header.getBoundingClientRect().bottom);
    };
    measure();
    window.addEventListener('resize', measure, { passive: true });
    return () => window.removeEventListener('resize', measure);
  }, [isSearchOpen]);

  /* ── Open / close lifecycle ───────────────────────── */
  useEffect(() => {
    if (!isSearchOpen) return;
    setIsClosing(false);
    setIsOpening(true);
    setRawQuery('');
    setQuery('');
    setHighlighted(-1);
    setRecent(readRecent());

    const frame = requestAnimationFrame(() => {
      setIsOpening(false);
      setTimeout(() => inputRef.current?.focus(), 60);
    });

    // Prevent body scroll but allow panel scroll
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = originalOverflow;
      cancelAnimationFrame(frame);
    };
  }, [isSearchOpen]);

  /* ── Debounce ─────────────────────────────────────── */
  useEffect(() => {
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setQuery(rawQuery);
      setHighlighted(-1);
    }, 250);
    return () => clearTimeout(debounceRef.current);
  }, [rawQuery]);

  /* ── Search results ───────────────────────────────── */
  const q = query.trim().toLowerCase();

  const productResults = useMemo(() => searchResults, [searchResults]);

  useEffect(() => {
    if (!q) {
      setSearchResults([]);
      setSearchLoading(false);
      return;
    }

    const controller = new AbortController();
    setSearchLoading(true);
    productApi.getProducts({ keyword: q, pageSize: 10 })
      .then((payload) => setSearchResults(normalizeCatalog(payload.data || [])))
      .catch(() => setSearchResults([]))
      .finally(() => setSearchLoading(false));

    return () => controller.abort();
  }, [q]);

  const hasResults = productResults.length > 0;

  /* ── Navigate to result ───────────────────────────── */
  const navigate = useCallback((path, queryToSave) => {
    if (queryToSave) saveRecent(queryToSave);
    handleClose(() => {
      window.dispatchEvent(new CustomEvent('novashop:navigate', { detail: { path } }));
    });
  }, []); // eslint-disable-line

  const submitSearch = useCallback(() => {
    const term = rawQuery.trim();
    if (!term) return;
    navigate(`/shop?search=${encodeURIComponent(term)}`, term);
  }, [rawQuery, navigate]);

  /* ── Close with animation ─────────────────────────── */
  const handleClose = useCallback((afterClose) => {
    setIsClosing(true);
    setTimeout(() => {
      closeSearch();
      setIsClosing(false);
      if (typeof afterClose === 'function') afterClose();
    }, 200);
  }, [closeSearch]);

  /* ── Keyboard handler ─────────────────────────────── */
  useEffect(() => {
    if (!isSearchOpen) return;
    const handler = e => {
      if (e.key === 'Escape') { handleClose(); return; }
      if (!q) return;
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
        e.preventDefault();
        setHighlighted(h => Math.min(h + 1, productResults.length - 1));
      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
        e.preventDefault();
        setHighlighted(h => Math.max(h - 1, -1));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (highlighted >= 0 && productResults[highlighted]) {
          navigate(`/products/${productResults[highlighted].id}`, rawQuery);
        } else {
          submitSearch();
        }
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isSearchOpen, q, productResults, highlighted, handleClose, navigate, submitSearch, rawQuery]);

  /* ── Scroll highlighted card into view ────────────── */
  useEffect(() => {
    if (highlighted < 0 || !gridRef.current) return;
    const el = gridRef.current.querySelector(`[data-card-idx="${highlighted}"]`);
    el?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }, [highlighted]);

  if (!isSearchOpen) return null;

  /* ── Transition values ───────────────────────────── */
  const isTransitioning = isClosing || isOpening;
  const panelOpacity    = isTransitioning ? 0 : 1;
  const panelTranslateY = isTransitioning ? '-10px' : '0px';
  const topOffset       = navHeight > 0 ? `${navHeight}px` : '0px';

  return (
    <>
      {/* ── Backdrop overlay (dims page content below the panel) */}
      <div
        aria-hidden="true"
        onClick={() => handleClose()}
        style={{
          position: 'fixed', top: topOffset, left: 0, right: 0, bottom: 0, zIndex: 199,
          background: T.overlay,
          opacity: isTransitioning ? 0 : 1,
          transition: 'opacity 200ms ease',
        }}
      />

      {/* ── Full-width panel ─────────────────────────── */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Search"
        style={{
          position: 'fixed',
          top: topOffset,
          left: 0,
          right: 0,
          zIndex: 200,
          background: T.panelBg,
          boxShadow: '0 4px 24px rgba(0,0,0,0.10)',
          opacity: panelOpacity,
          transform: `translateY(${panelTranslateY})`,
          transition: 'opacity 200ms ease, transform 200ms ease',
          display: 'flex',
          flexDirection: 'column',
          maxHeight: '90vh',
          overflowY: 'auto',
        }}
      >

        {/* ══ INPUT BAND ═══════════════════════════════ */}
        <div style={{
          background: T.bandBg,
          width: '100%',
          flexShrink: 0,
        }}>
          <div style={{
            maxWidth: '1400px',
            margin: '0 auto',
            padding: '20px 40px 22px',
          }}>
            {/* "Search" label */}
            <div style={{
              fontFamily: T.fontSans,
              fontSize: '11px',
              fontWeight: 500,
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              color: T.muted,
              marginBottom: '8px',
            }}>
              Search
            </div>

            {/* Input row */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '16px',
            }}>
              {/* Text input */}
              <input
                ref={inputRef}
                type="search"
                id="global-search-input"
                role="combobox"
                aria-autocomplete="list"
                aria-controls="search-results-grid"
                aria-expanded={hasResults}
                value={rawQuery}
                onChange={e => setRawQuery(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); if (highlighted < 0) submitSearch(); } }}
                placeholder="What are you looking for?"
                autoComplete="off"
                style={{
                  flex: 1,
                  background: 'transparent',
                  border: 'none',
                  outline: 'none',
                  fontFamily: T.fontSans,
                  fontSize: '20px',
                  fontWeight: 400,
                  color: T.espresso,
                  minWidth: 0,
                  caretColor: T.espresso,
                }}
              />

              {/* Right-side controls */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '20px', flexShrink: 0 }}>
                {rawQuery && (
                  <button
                    type="button"
                    aria-label="Clear search"
                    onClick={() => { setRawQuery(''); setQuery(''); setHighlighted(-1); inputRef.current?.focus(); }}
                    style={{
                      background: 'none', border: 'none', cursor: 'pointer',
                      fontFamily: T.fontSans, fontSize: '11px',
                      fontWeight: 500, letterSpacing: '0.10em', textTransform: 'uppercase',
                      color: T.muted, padding: 0,
                      transition: 'color 120ms',
                    }}
                    onMouseEnter={e => e.currentTarget.style.color = T.espresso}
                    onMouseLeave={e => e.currentTarget.style.color = T.muted}
                  >
                    Clear
                  </button>
                )}
                <button
                  type="button"
                  aria-label="Close search"
                  onClick={() => handleClose()}
                  style={{
                    background: 'none', border: 'none', cursor: 'pointer',
                    color: T.muted, display: 'flex', alignItems: 'center',
                    padding: 0, lineHeight: 0,
                    transition: 'color 120ms',
                  }}
                  onMouseEnter={e => e.currentTarget.style.color = T.espresso}
                  onMouseLeave={e => e.currentTarget.style.color = T.muted}
                >
                  <CloseIcon size={20} />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* ══ PANEL BODY ═══════════════════════════════ */}
        <div style={{ flex: 1, background: T.panelBg }}>
          <div style={{ maxWidth: '1400px', margin: '0 auto', padding: '28px 40px 36px' }}>

            {/* ── EMPTY STATE ──────────────────────────── */}
            {!q && (
              <div>
                {/* Recent searches */}
                {recent.length > 0 && (
                  <div style={{ marginBottom: '32px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
                      <span style={{
                        fontFamily: T.fontSans, fontSize: '11px', fontWeight: 600,
                        letterSpacing: '0.13em', textTransform: 'uppercase', color: T.muted,
                      }}>
                        Recent Searches
                      </span>
                      <button
                        type="button"
                        onClick={() => { clearRecent(); setRecent([]); }}
                        style={{
                          background: 'none', border: 'none', cursor: 'pointer',
                          fontFamily: T.fontSans, fontSize: '11px',
                          fontWeight: 500, letterSpacing: '0.08em', textTransform: 'uppercase',
                          color: T.mutedLight, padding: 0,
                          transition: 'color 120ms',
                        }}
                        onMouseEnter={e => e.currentTarget.style.color = T.espresso}
                        onMouseLeave={e => e.currentTarget.style.color = T.mutedLight}
                      >
                        Clear all
                      </button>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                      {recent.map(r => (
                        <RecentRow
                          key={r}
                          term={r}
                          onClick={() => { setRawQuery(r); setQuery(r); inputRef.current?.focus(); }}
                        />
                      ))}
                    </div>
                  </div>
                )}

                {/* Popular categories */}
                <div>
                  <div style={{
                    fontFamily: T.fontSans, fontSize: '11px', fontWeight: 600,
                    letterSpacing: '0.13em', textTransform: 'uppercase', color: T.muted,
                    marginBottom: '16px',
                  }}>
                    Popular Categories
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                    {popularCategories.map(c => (
                      <CategoryChip
                        key={c.path}
                        label={c.label}
                        onClick={() => navigate(c.path, null)}
                      />
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* ── RESULTS STATE ────────────────────────── */}
            {q && hasResults && (
              <div>
                {/* Results count label */}
                <div style={{
                  fontFamily: T.fontSans, fontSize: '11px', fontWeight: 600,
                  letterSpacing: '0.13em', textTransform: 'uppercase',
                  color: T.muted, marginBottom: '20px',
                }}>
                  Products
                </div>

                {/* Grid */}
                <div
                  ref={gridRef}
                  id="search-results-grid"
                  role="listbox"
                  aria-label="Search results"
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(5, 1fr)',
                    gap: '28px',
                    marginBottom: '28px',
                  }}
                  className="ns-search-grid"
                >
                  {productResults.map((product, idx) => (
                    <div
                      key={product.id}
                      role="option"
                      aria-selected={highlighted === idx}
                      data-card-idx={idx}
                    >
                      <ProductCard
                        product={product}
                        highlighted={highlighted === idx}
                        onClick={() => navigate(`/products/${product.id}`, rawQuery)}
                      />
                    </div>
                  ))}
                </div>

                {/* "See all results" outlined button */}
                <div>
                  <button
                    type="button"
                    onClick={submitSearch}
                    style={{
                      display: 'inline-flex', alignItems: 'center',
                      background: 'transparent',
                      border: `1px solid ${T.espresso}`,
                      borderRadius: 0,
                      padding: '11px 24px',
                      fontFamily: T.fontSans,
                      fontSize: '12px',
                      fontWeight: 500,
                      letterSpacing: '0.08em',
                      color: T.espresso,
                      cursor: 'pointer',
                      transition: 'background 150ms, color 150ms',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.background = T.espresso; e.currentTarget.style.color = '#FFF'; }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = T.espresso; }}
                  >
                    See all results for &ldquo;{rawQuery}&rdquo;
                  </button>
                </div>
              </div>
            )}

            {/* ── NO RESULTS STATE ─────────────────────── */}
            {q && !hasResults && (
              <div style={{ textAlign: 'center', padding: '48px 0' }}>
                <div style={{
                  fontFamily: T.fontSans, fontSize: '16px',
                  fontWeight: 500, color: T.espresso, marginBottom: '10px',
                }}>
                  No results for &ldquo;{rawQuery}&rdquo;
                </div>
                <div style={{
                  fontFamily: T.fontSans, fontSize: '13px',
                  color: T.muted, marginBottom: '28px',
                }}>
                  Try a different search term or browse our collections.
                </div>
                <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', flexWrap: 'wrap' }}>
                  <CategoryChip label="Shop All"    onClick={() => navigate('/shop', null)} />
                  <CategoryChip label="Collections" onClick={() => navigate('/collections', null)} />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Responsive overrides ─────────────────────── */}
      <style>{`
        /* Tablet: 3-column grid */
        @media (max-width: 1024px) and (min-width: 601px) {
          .ns-search-grid {
            grid-template-columns: repeat(3, 1fr) !important;
          }
        }
        /* Mobile: 2-column grid, tighter padding */
        @media (max-width: 600px) {
          .ns-search-grid {
            grid-template-columns: repeat(2, 1fr) !important;
            gap: 16px !important;
          }
          [role="dialog"][aria-label="Search"] > div:first-of-type > div {
            padding: 16px 20px 18px !important;
          }
          [role="dialog"][aria-label="Search"] > div:last-of-type > div {
            padding: 20px 20px 28px !important;
          }
        }
        /* Remove browser default search input clear button */
        #global-search-input::-webkit-search-cancel-button {
          display: none;
        }
      `}</style>
    </>
  );
}
