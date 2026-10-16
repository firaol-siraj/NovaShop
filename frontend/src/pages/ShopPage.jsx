import { useEffect, useMemo, useRef, useState } from 'react';
import { ProductCard } from '../components/home/NewArrivalsSection';
import { useCart } from '../context/CartContext';
import { productApi } from '../lib/api/productApi';
import { normalizeCatalog } from '../lib/catalog';



const CATEGORY_OPTIONS = [
  { label: 'All Pieces', value: 'all', count: null },
  { label: 'New Arrivals', value: 'new', count: null },
  { label: 'Women', value: 'women', count: null },
  { label: 'Men', value: 'men', count: null },
  { label: 'Shoes', value: 'shoes', count: null },
  { label: 'Accessories', value: 'accessories', count: null },
  { label: 'Sale', value: 'sale', count: null },
];

const SORT_OPTIONS = [
  { value: 'recommended', label: 'Recommended' },
  { value: 'low-high', label: 'Price: Low to High' },
  { value: 'high-low', label: 'Price: High to Low' },
  { value: 'newest', label: 'Newest' },
  { value: 'best-selling', label: 'Best Selling' },
];

const FILTER_GROUPS = {
  size: ['XS', 'S', 'M', 'L', 'XL', 'One Size'],
  color: ['Espresso', 'Camel', 'Sand', 'Ivory', 'Stone', 'Olive', 'Cream'],
  price: ['Under $200', '$200–$400', '$400–$600', '$600+'],
};

function parseQuery(search) {
  const params = new URLSearchParams(search || '');
  return {
    category: params.get('category') || 'all',
    sort: params.get('sort') || 'recommended',
    page: Number(params.get('page') || 1),
    filters: params.getAll('filter'),
    searchTerm: params.get('search') || '',
  };
}

function buildProductParams(category, sort, page, filters) {
  const params = { pageNumber: page, pageSize: 8 };
  const categoryValue = category === 'new' || category === 'sale' ? 'all' : category;
  if (categoryValue !== 'all') params.category = categoryValue;

  const size = filters.find((filter) => ['XS', 'S', 'M', 'L', 'XL', 'One Size'].includes(filter));
  const color = filters.find((filter) => ['Espresso', 'Camel', 'Sand', 'Ivory', 'Stone', 'Olive', 'Cream'].includes(filter));
  const price = filters.find((filter) => filter.startsWith('Under') || filter.startsWith('$'));
  if (size) params.size = size;
  if (color) params.color = color;
  if (price) {
    if (price.startsWith('Under')) params.maxPrice = 200;
    else if (price.startsWith('$200–$400')) {
      params.minPrice = 200;
      params.maxPrice = 400;
    } else if (price.startsWith('$400–$600')) {
      params.minPrice = 400;
      params.maxPrice = 600;
    } else if (price.startsWith('$600')) {
      params.minPrice = 600;
    }
  }

  return params;
}

export default function ShopPage({ go, search = '', initialCategory = '' }) {
  const gridRef = useRef(null);
  const { addProductToBag, toggleWishlist } = useCart();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [viewMode, setViewMode] = useState('grid');
  const queryState = useMemo(() => parseQuery(search), [search]);
  const [category, setCategory] = useState(initialCategory || queryState.category);
  const [sort, setSort] = useState(queryState.sort);
  const [page, setPage] = useState(Math.max(1, queryState.page));
  const [activeFilters, setActiveFilters] = useState([]);
  const [sortOpen, setSortOpen] = useState(false);
  const [searchTerm] = useState(queryState.searchTerm);
  const [products, setProducts] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, pages: 1, totalProducts: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const previousPageFilters = useRef({ category, sort, activeFilters });

  const pageSize = 8;

  const handleAddToCart = async (product) => {
    if (Number(product.stockTotal) === 0) return;
    const result = await addProductToBag(product, { qty: 1 });
    if (result?.needsOptions) {
      go(product.path || `/products/${product.slug}`);
    }
  };

  const handleAddToWishlist = (product) => {
    toggleWishlist(product);
  };

  const updateUrl = (nextCategory, nextSort, nextPage, nextFilters) => {
    const params = new URLSearchParams();
    if (nextCategory && nextCategory !== 'all') params.set('category', nextCategory);
    if (nextSort && nextSort !== 'recommended') params.set('sort', nextSort);
    if (nextPage && nextPage > 1) params.set('page', String(nextPage));
    nextFilters.forEach((filter) => params.append('filter', filter));
    const url = `${window.location.pathname}${params.toString() ? `?${params.toString()}` : ''}`;
    window.history.replaceState({}, '', url);
  };

  useEffect(() => {
    updateUrl(category, sort, page, activeFilters);
  }, [category, sort, page, activeFilters]);

  const categoryLabelMap = {
    all: 'All Pieces',
    new: 'New Arrivals',
    women: 'Women',
    men: 'Men',
    shoes: 'Shoes',
    accessories: 'Accessories',
    sale: 'Sale',
  };

  useEffect(() => {
    let active = true;
    const request = buildProductParams(category, sort, page, activeFilters);
    if (searchTerm) request.keyword = searchTerm;

    setLoading(true);
    setError('');
    productApi.getProducts(request)
      .then((payload) => {
        if (!active) return;
        setProducts(normalizeCatalog(payload.data || []));
        setPagination({
          page: payload.page || page,
          pages: payload.pages || 1,
          totalProducts: payload.totalProducts || 0,
        });
      })
      .catch((requestError) => {
        if (active) setError(requestError.message || 'Unable to load the collection.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => { active = false; };
  }, [category, sort, page, activeFilters, searchTerm]);

  const totalFilteredCount = pagination.totalProducts;
  const pagesCount = Math.max(1, pagination.pages);
  const safePage = Math.min(page, pagesCount);
  const pagedProducts = products;

  useEffect(() => {
    const previous = previousPageFilters.current;
    if (
      previous.category !== category
      || previous.sort !== sort
      || previous.activeFilters !== activeFilters
    ) {
      setPage(1);
    }
    previousPageFilters.current = { category, sort, activeFilters };
  }, [category, sort, activeFilters]);

  useEffect(() => {
    if (gridRef.current) {
      gridRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [page, category, sort, activeFilters]);

  const activeCount = activeFilters.length;

  function addFilter(filterValue) {
    const formatted = filterValue.trim();
    if (!formatted || activeFilters.includes(formatted)) return;
    setActiveFilters((prev) => [...prev, formatted]);
  }

  function removeFilter(filterValue) {
    setActiveFilters((prev) => prev.filter((item) => item !== filterValue));
  }

  function clearAllFilters() {
    setActiveFilters([]);
  }

  const filteredCountLabel = `${totalFilteredCount.toLocaleString()} PIECES`;

  return (
    <div style={{ backgroundColor: '#F9F6F1' }}>
      <div style={{ maxWidth: '1440px', margin: '0 auto', padding: '0 40px 90px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '26px 0 12px', fontFamily: 'var(--font-sans)', fontSize: '11px', letterSpacing: '0.14em', color: '#8D837D', textTransform: 'uppercase' }}>
          <button onClick={() => go('/')} style={{ background: 'none', border: 'none', color: '#8D837D', cursor: 'pointer', padding: 0 }}>Home</button>
          <span>/</span>
          <button onClick={() => go('/shop')} style={{ background: 'none', border: 'none', color: '#8D837D', cursor: 'pointer', padding: 0 }}>Shop</button>
          <span>/</span>
          <span style={{ color: '#1B1816' }}>All Pieces</span>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: '24px', paddingTop: '18px', paddingBottom: '30px', borderBottom: '1px solid rgba(27, 24, 22, 0.1)' }}>
          <div>
            <h1 style={{ margin: 0, fontFamily: 'var(--font-serif)', fontSize: 'clamp(40px, 4vw, 54px)', fontStyle: 'italic', fontWeight: 400, letterSpacing: '-0.04em', color: '#1B1816', lineHeight: 1 }}>The Collection</h1>
            <p style={{ margin: '12px 0 0', fontFamily: 'var(--font-sans)', fontSize: '15px', lineHeight: 1.6, color: '#7E7570', maxWidth: '540px' }}>Curated architectural staples for modern everyday wardrobes.</p>
          </div>
          <div style={{ fontFamily: 'var(--font-sans)', fontSize: '11px', letterSpacing: '0.18em', textTransform: 'uppercase', color: '#8D837D', textAlign: 'right' }}>Autumn / Winter 2026 Archive</div>
        </div>

        <div style={{ paddingTop: '18px', borderBottom: '1px solid rgba(27, 24, 22, 0.08)' }}>
          <div style={{ display: 'flex', gap: '26px', flexWrap: 'wrap', alignItems: 'center' }}>
            {CATEGORY_OPTIONS.map((tab) => {
              const isActive = tab.value === category;
              return (
                <button
                  key={tab.value}
                  onClick={() => {
                    setCategory(tab.value);
                    setPage(1);
                  }}
                  style={{
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    padding: '0 0 16px',
                    fontFamily: 'var(--font-sans)',
                    fontSize: '12px',
                    fontWeight: isActive ? 700 : 500,
                    letterSpacing: '0.14em',
                    textTransform: 'uppercase',
                    color: isActive ? '#1B1816' : '#8A817B',
                    borderBottom: isActive ? '2px solid #1B1816' : '2px solid transparent',
                    transition: 'color 0.2s ease, border-color 0.2s ease',
                  }}
                >
                  {tab.label} ({tab.count})
                </button>
              );
            })}
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '20px', padding: '18px 0 12px', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap', fontFamily: 'var(--font-sans)', fontSize: '11px', letterSpacing: '0.14em', textTransform: 'uppercase', color: '#7E7570' }}>
            <span style={{ color: '#1B1816', fontWeight: 600 }}>{filteredCountLabel}</span>
            <span style={{ color: '#B3AAA3' }}>•</span>
            <span>Global Release</span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
            <button onClick={() => setDrawerOpen(true)} style={{ display: 'flex', alignItems: 'center', gap: '8px', border: '1px solid rgba(27,24,22,0.15)', background: '#F7F1E8', padding: '9px 12px', borderRadius: '999px', color: '#1B1816', fontFamily: 'var(--font-sans)', fontSize: '10px', letterSpacing: '0.14em', textTransform: 'uppercase', cursor: 'pointer' }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 6h16M7 12h10M10 18h4" /></svg>
              Filters
              <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '18px', height: '18px', borderRadius: '50%', background: '#1B1816', color: '#FDFBF7', fontSize: '9px' }}>{activeCount}</span>
            </button>

            <div style={{ position: 'relative' }}>
              <button
                onClick={() => setSortOpen((prev) => !prev)}
                style={{ display: 'flex', alignItems: 'center', gap: '8px', border: 'none', background: 'transparent', padding: '0', color: '#1B1816', fontFamily: 'var(--font-sans)', fontSize: '10px', fontWeight: 600, letterSpacing: '0.14em', textTransform: 'uppercase', cursor: 'pointer' }}
              >
                Sort: {SORT_OPTIONS.find((option) => option.value === sort)?.label.toUpperCase() || 'RECOMMENDED'}
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg>
              </button>
              {sortOpen && (
                <div style={{ position: 'absolute', right: 0, top: 'calc(100% + 10px)', background: '#FDFBF7', border: '1px solid rgba(27,24,22,0.12)', boxShadow: '0 14px 30px rgba(27,24,22,0.08)', minWidth: '220px', zIndex: 30 }}>
                  {SORT_OPTIONS.map((option) => (
                    <button
                      key={option.value}
                      onClick={() => {
                        setSort(option.value);
                        setSortOpen(false);
                      }}
                      style={{
                        display: 'block',
                        width: '100%',
                        textAlign: 'left',
                        border: 'none',
                        background: 'transparent',
                        cursor: 'pointer',
                        color: sort === option.value ? '#1B1816' : '#625D59',
                        fontFamily: 'var(--font-sans)',
                        fontSize: '11px',
                        letterSpacing: '0.12em',
                        textTransform: 'uppercase',
                        padding: '12px 14px',
                        borderBottom: '1px solid rgba(27,24,22,0.05)',
                      }}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', border: '1px solid rgba(27,24,22,0.12)', background: '#F2EEE7', borderRadius: '999px', overflow: 'hidden' }}>
              <button onClick={() => setViewMode('grid')} style={{ border: 'none', background: viewMode === 'grid' ? '#1B1816' : 'transparent', color: viewMode === 'grid' ? '#FDFBF7' : '#1B1816', padding: '10px 12px', cursor: 'pointer' }} aria-label="Grid view">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="4" rx="1" /><rect x="14" y="11" width="7" height="10" rx="1" /><rect x="3" y="12" width="7" height="9" rx="1" /></svg>
              </button>
              <button onClick={() => setViewMode('list')} style={{ border: 'none', background: viewMode === 'list' ? '#1B1816' : 'transparent', color: viewMode === 'list' ? '#FDFBF7' : '#1B1816', padding: '10px 12px', cursor: 'pointer' }} aria-label="List view">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" /></svg>
              </button>
            </div>
          </div>
        </div>

        {activeFilters.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', padding: '14px 0 8px' }}>
            <span style={{ fontFamily: 'var(--font-sans)', fontSize: '10px', letterSpacing: '0.16em', textTransform: 'uppercase', color: '#8A817B' }}>Active:</span>
            {activeFilters.map((filter) => (
              <button
                key={filter}
                onClick={() => removeFilter(filter)}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', border: '1px solid rgba(27,24,22,0.15)', background: '#FDFBF7', borderRadius: '999px', padding: '7px 10px', fontFamily: 'var(--font-sans)', fontSize: '10px', letterSpacing: '0.12em', textTransform: 'uppercase', color: '#1B1816', cursor: 'pointer' }}
              >
                {filter}
                <span style={{ fontSize: '12px' }}>×</span>
              </button>
            ))}
            <button onClick={clearAllFilters} style={{ background: 'none', border: 'none', color: '#7E7570', cursor: 'pointer', fontFamily: 'var(--font-sans)', fontSize: '10px', letterSpacing: '0.14em', textTransform: 'uppercase', padding: 0 }}>Clear All</button>
          </div>
        )}

        {loading && (
          <div style={{ padding: '48px 0', textAlign: 'center', fontFamily: 'var(--font-sans)', fontSize: '12px', letterSpacing: '0.12em', textTransform: 'uppercase', color: '#7E7570' }}>Loading the collection…</div>
        )}
        {error && (
          <div style={{ marginTop: '20px', padding: '28px', background: '#F6E7E2', color: '#7F3D2F', fontFamily: 'var(--font-sans)', fontSize: '13px', textAlign: 'center' }}>{error}</div>
        )}
        {!loading && !error && pagedProducts.length === 0 && (
          <div style={{ padding: '72px 20px', textAlign: 'center', fontFamily: 'var(--font-sans)', color: '#746C65' }}>
            <h2 style={{ margin: '0 0 10px', fontFamily: 'var(--font-serif)', fontSize: '30px', fontStyle: 'italic', color: '#1B1816' }}>No pieces found</h2>
            Try removing a filter or using a broader search.
          </div>
        )}
        {!loading && !error && pagedProducts.length > 0 && (
          <div
            ref={gridRef}
            style={{
              display: 'grid',
              gridTemplateColumns: viewMode === 'grid' ? 'repeat(4, minmax(0, 1fr))' : 'repeat(2, minmax(0, 1fr))',
              gap: '28px',
              paddingTop: '20px',
              transition: 'all 260ms ease',
            }}
          >
            {pagedProducts.map((product) => (
              <div key={product.id} style={{ transition: 'opacity 260ms ease, transform 260ms ease' }}>
                <ProductCard
                  product={{
                    ...product,
                    price: `$${product.price.toFixed(2)}`,
                    variant: product.variant,
                    swatches: product.swatches,
                    path: '/product/' + product.id,
                    primaryImage: product.primaryImage,
                    hoverImage: product.hoverImage,
                  }}
                  go={go}
                  onAddToCart={handleAddToCart}
                  onAddToWishlist={handleAddToWishlist}
                  showCartIcon={true}
                  showWishlistAlways={false}
                />
              </div>
            ))}
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '16px', paddingTop: '34px', fontFamily: 'var(--font-sans)', fontSize: '11px', letterSpacing: '0.14em', textTransform: 'uppercase', color: '#7E7570', flexWrap: 'wrap' }}>
          <div>Showing {Math.min((safePage - 1) * pageSize + 1, totalFilteredCount)}–{Math.min(safePage * pageSize, totalFilteredCount)} of {totalFilteredCount} items</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
            <button onClick={() => safePage > 1 && setPage((prev) => prev - 1)} disabled={safePage === 1} style={{ background: 'none', border: 'none', color: safePage === 1 ? '#B7B0A9' : '#1B1816', cursor: safePage === 1 ? 'default' : 'pointer', fontFamily: 'var(--font-sans)', fontSize: '11px', letterSpacing: '0.14em', textTransform: 'uppercase' }}>← Previous</button>
            {[...Array(pagesCount)].map((_, index) => {
              const pageNum = index + 1;
              return (
                <button
                  key={pageNum}
                  onClick={() => setPage(pageNum)}
                  style={{
                    background: pageNum === safePage ? '#1B1816' : 'transparent',
                    color: pageNum === safePage ? '#FDFBF7' : '#1B1816',
                    border: '1px solid rgba(27,24,22,0.12)',
                    width: '32px',
                    height: '32px',
                    borderRadius: '50%',
                    cursor: 'pointer',
                    fontFamily: 'var(--font-sans)',
                    fontSize: '11px',
                    letterSpacing: '0.04em',
                  }}
                >
                  {pageNum}
                </button>
              );
            })}
            <button onClick={() => safePage < pagesCount && setPage((prev) => prev + 1)} disabled={safePage === pagesCount} style={{ background: 'none', border: 'none', color: safePage === pagesCount ? '#B7B0A9' : '#1B1816', cursor: safePage === pagesCount ? 'default' : 'pointer', fontFamily: 'var(--font-sans)', fontSize: '11px', letterSpacing: '0.14em', textTransform: 'uppercase' }}>Next →</button>
          </div>
        </div>
      </div>

      {drawerOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(17,14,12,0.3)', zIndex: 60 }} onClick={() => setDrawerOpen(false)}>
          <aside onClick={(e) => e.stopPropagation()} style={{ position: 'absolute', top: 0, right: 0, width: 'min(420px, 92vw)', height: '100%', background: '#F8F4EE', boxShadow: '-12px 0 28px rgba(17,14,12,0.08)', padding: '24px 20px', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3 style={{ margin: 0, fontFamily: 'var(--font-serif)', fontSize: '28px', fontStyle: 'italic', color: '#1B1816' }}>Filters</h3>
              <button onClick={() => setDrawerOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#1B1816', fontSize: '28px' }}>×</button>
            </div>

            {Object.entries(FILTER_GROUPS).map(([group, values]) => (
              <div key={group} style={{ marginBottom: '24px' }}>
                <div style={{ fontFamily: 'var(--font-sans)', fontSize: '10px', letterSpacing: '0.16em', textTransform: 'uppercase', color: '#8A817B', marginBottom: '12px' }}>{group}</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
                  {values.map((option) => {
                    const id = `${group}-${option}`;
                    const active = activeFilters.includes(option) || activeFilters.includes(option.toLowerCase()) || activeFilters.includes(option.charAt(0).toUpperCase() + option.slice(1));
                    return (
                      <label key={id} style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', border: '1px solid rgba(27,24,22,0.12)', background: active ? '#1B1816' : '#FDFBF7', color: active ? '#FDFBF7' : '#1B1816', borderRadius: '999px', padding: '8px 12px', fontFamily: 'var(--font-sans)', fontSize: '10px', letterSpacing: '0.12em', textTransform: 'uppercase', cursor: 'pointer' }}>
                        <input type="checkbox" checked={active} onChange={() => (active ? removeFilter(option) : addFilter(option))} style={{ accentColor: '#1B1816' }} />
                        {option}
                      </label>
                    );
                  })}
                </div>
              </div>
            ))}

            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', paddingTop: '18px' }}>
              <button onClick={clearAllFilters} style={{ flex: 1, background: 'transparent', border: '1px solid rgba(27,24,22,0.15)', color: '#1B1816', padding: '12px 16px', fontFamily: 'var(--font-sans)', fontSize: '11px', letterSpacing: '0.14em', textTransform: 'uppercase', cursor: 'pointer' }}>Clear All</button>
              <button onClick={() => setDrawerOpen(false)} style={{ flex: 1, background: '#1B1816', border: '1px solid #1B1816', color: '#FDFBF7', padding: '12px 16px', fontFamily: 'var(--font-sans)', fontSize: '11px', letterSpacing: '0.14em', textTransform: 'uppercase', cursor: 'pointer' }}>Apply</button>
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}
