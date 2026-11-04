/* eslint-disable react-hooks/set-state-in-effect */
import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { ProductCard } from '../components/home/NewArrivalsSection';
import { useCart } from '../context/CartContext';
import { useCategories } from '../context/CategoryContext';
import { productApi } from '../lib/api/productApi';
import { normalizeCatalog } from '../lib/catalog';

const PAGE_SIZE = 12;

const SORT_OPTIONS = [
  { value: 'recommended', label: 'Recommended' },
  { value: 'newest', label: 'Newest' },
  { value: 'low-high', label: 'Price: Low to High' },
  { value: 'high-low', label: 'Price: High to Low' },
  { value: 'bestselling', label: 'Best Selling' },
];

function parseQuery(search) {
  const params = new URLSearchParams(search || (typeof window !== 'undefined' ? window.location.search : ''));
  return {
    category: params.get('category') || 'all',
    sort: params.get('sort') || 'recommended',
    page: Math.max(1, parseInt(params.get('page') || '1', 10) || 1),
    minPrice: params.get('minPrice') || '',
    maxPrice: params.get('maxPrice') || '',
    size: params.get('size') ? params.get('size').split(',').map((s) => s.trim().toUpperCase()).filter(Boolean) : [],
    color: params.get('color') ? params.get('color').split(',').map((c) => c.trim()).filter(Boolean) : [],
    inStock: params.get('inStock') === 'true',
    searchTerm: params.get('search') || '',
  };
}

function buildProductParams({ category, sort, page, minPrice, maxPrice, size, color, inStock, searchTerm }) {
  const params = {
    pageNumber: page,
    pageSize: PAGE_SIZE,
  };

  if (sort && sort !== 'recommended') {
    params.sort = sort;
  }

  if (category && category !== 'all') {
    params.category = category;
  }

  if (minPrice !== '' && !Number.isNaN(Number(minPrice))) {
    params.minPrice = Number(minPrice);
  }
  if (maxPrice !== '' && !Number.isNaN(Number(maxPrice))) {
    params.maxPrice = Number(maxPrice);
  }

  if (size && size.length > 0) {
    params.size = size.join(',');
  }

  if (color && color.length > 0) {
    params.color = color.join(',');
  }

  if (inStock) {
    params.inStock = true;
  }

  if (searchTerm) {
    params.keyword = searchTerm;
  }

  return params;
}

function getSwatchVisual(hex, isSelected) {
  const cleanHex = typeof hex === 'string' ? hex.trim().toLowerCase() : '';
  const isValidHex = /^#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(cleanHex);
  const isWhite = cleanHex === '#fff' || cleanHex === '#ffffff' || cleanHex === 'white';
  const useFallback = !isValidHex || isWhite;

  return {
    backgroundColor: useFallback ? 'var(--bg-surface-raised)' : cleanHex,
    border: isSelected
      ? '2px solid var(--color-primary)'
      : useFallback
      ? '1.5px solid var(--border-strong)'
      : '1.5px solid var(--border-subtle)',
  };
}

function generatePageNumbers(currentPage, totalPages) {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }

  const pages = [];
  pages.push(1);

  if (currentPage > 3) {
    pages.push('...');
  }

  const start = Math.max(2, currentPage - 1);
  const end = Math.min(totalPages - 1, currentPage + 1);

  for (let i = start; i <= end; i++) {
    pages.push(i);
  }

  if (currentPage < totalPages - 2) {
    pages.push('...');
  }

  pages.push(totalPages);
  return pages;
}

export default function ShopPage({ go, search = '', initialCategory = '' }) {
  const gridRef = useRef(null);
  const sortRef = useRef(null);
  const tabsContainerRef = useRef(null);
  const abortControllerRef = useRef(null);

  const { addProductToBag, toggleWishlist, openCart, formatCurrency } = useCart();
  const { categories: backendCategories = [], refreshCategories } = useCategories();

  // State parsed from URL
  const queryState = useMemo(() => {
    const parsed = parseQuery(search);
    if (initialCategory && (!parsed.category || parsed.category === 'all')) {
      parsed.category = initialCategory;
    }
    return parsed;
  }, [search, initialCategory]);

  const [category, setCategory] = useState(queryState.category);
  const [sort, setSort] = useState(queryState.sort);
  const [page, setPage] = useState(queryState.page);
  const [minPrice, setMinPrice] = useState(queryState.minPrice);
  const [maxPrice, setMaxPrice] = useState(queryState.maxPrice);
  const [sizeFilter, setSizeFilter] = useState(queryState.size);
  const [colorFilter, setColorFilter] = useState(queryState.color);
  const [inStockOnly, setInStockOnly] = useState(queryState.inStock);
  const [searchTerm, setSearchTerm] = useState(queryState.searchTerm);

  // Draft filter state for drawer
  const [draftCategory, setDraftCategory] = useState(queryState.category);
  const [draftMinPrice, setDraftMinPrice] = useState(queryState.minPrice);
  const [draftMaxPrice, setDraftMaxPrice] = useState(queryState.maxPrice);
  const [draftSizes, setDraftSizes] = useState(queryState.size);
  const [draftColors, setDraftColors] = useState(queryState.color);
  const [draftInStock, setDraftInStock] = useState(queryState.inStock);

  // UI state
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [sortOpen, setSortOpen] = useState(false);
  const [viewMode, setViewMode] = useState('grid'); // 'grid' | 'list'
  const [products, setProducts] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, pages: 1, pageSize: PAGE_SIZE, totalProducts: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Facets from backend
  const [facets, setFacets] = useState({
    categories: [],
    priceRange: { min: 0, max: 1000 },
    sizes: [],
    colors: [],
    inStockCount: 0,
  });

  // Combine categories from CategoryContext with graceful fallback to facets.categories
  const allAvailableCategories = useMemo(() => {
    if (Array.isArray(backendCategories) && backendCategories.length > 0) {
      return backendCategories;
    }
    if (Array.isArray(facets?.categories) && facets.categories.length > 0) {
      return facets.categories;
    }
    return [];
  }, [backendCategories, facets]);

  // Top-level categories (deduplicated)
  const topCategories = useMemo(() => {
    return allAvailableCategories
      .filter((cat) => cat && !cat.parent && !cat.parentId)
      .sort((a, b) => (a.name || '').localeCompare(b.name || ''));
  }, [allAvailableCategories]);

  // Current category object
  const currentCategoryObj = useMemo(() => {
    if (category === 'all') return null;
    return allAvailableCategories.find(
      (c) => c && (c.slug === category.toLowerCase() || c._id === category)
    );
  }, [category, allAvailableCategories]);

  // Page title & subtitle determination
  const pageTitle = useMemo(() => {
    if (category !== 'all') {
      return currentCategoryObj?.name || category.charAt(0).toUpperCase() + category.slice(1);
    }
    if (sort === 'newest') return 'New Arrivals';
    if (sort === 'bestselling') return 'Best Sellers';
    return 'Shop';
  }, [category, sort, currentCategoryObj]);

  const pageSubtitle = useMemo(() => {
    if (category !== 'all') {
      return currentCategoryObj?.description?.trim() || 'Browse all products in this category.';
    }
    if (sort === 'newest') return 'Explore our newest architectural staples and latest wardrobe additions.';
    if (sort === 'bestselling') return 'Discover the most sought-after products curated for everyday living.';
    return 'Browse all products.';
  }, [category, sort, currentCategoryObj]);

  // Dynamic document.title
  useEffect(() => {
    document.title = `${pageTitle} | NovaShop`;
  }, [pageTitle]);

  // Active filter count
  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (category !== 'all') count += 1;
    if (minPrice !== '' || maxPrice !== '') count += 1;
    count += Array.isArray(sizeFilter) ? sizeFilter.length : 0;
    count += Array.isArray(colorFilter) ? colorFilter.length : 0;
    if (inStockOnly) count += 1;
    return count;
  }, [category, minPrice, maxPrice, sizeFilter, colorFilter, inStockOnly]);

  // Navigate URL helper
  const navigateWithQuery = useCallback(
    (overrides = {}, replace = false) => {
      const nextCategory = 'category' in overrides ? overrides.category : category;
      const nextSort = 'sort' in overrides ? overrides.sort : sort;
      const nextPage = 'page' in overrides ? overrides.page : page;
      const nextMinPrice = 'minPrice' in overrides ? overrides.minPrice : minPrice;
      const nextMaxPrice = 'maxPrice' in overrides ? overrides.maxPrice : maxPrice;
      const nextSize = 'size' in overrides ? overrides.size : sizeFilter;
      const nextColor = 'color' in overrides ? overrides.color : colorFilter;
      const nextInStock = 'inStock' in overrides ? overrides.inStock : inStockOnly;

      const params = new URLSearchParams();
      if (nextCategory && nextCategory !== 'all') params.set('category', nextCategory);
      if (nextSort && nextSort !== 'recommended') params.set('sort', nextSort);
      if (nextPage && nextPage > 1) params.set('page', String(nextPage));
      if (nextMinPrice !== '' && nextMinPrice != null) params.set('minPrice', String(nextMinPrice));
      if (nextMaxPrice !== '' && nextMaxPrice != null) params.set('maxPrice', String(nextMaxPrice));
      if (Array.isArray(nextSize) && nextSize.length > 0) params.set('size', nextSize.join(','));
      if (Array.isArray(nextColor) && nextColor.length > 0) params.set('color', nextColor.join(','));
      if (nextInStock) params.set('inStock', 'true');
      if (searchTerm) params.set('search', searchTerm);

      const qs = params.toString();
      const targetUrl = `/shop${qs ? `?${qs}` : ''}`;

      if (replace && typeof window !== 'undefined') {
        window.history.replaceState({}, '', targetUrl);
      } else if (go) {
        go(targetUrl);
      }
    },
    [category, sort, page, minPrice, maxPrice, sizeFilter, colorFilter, inStockOnly, searchTerm, go]
  );

  const navigateWithQueryRef = useRef(navigateWithQuery);
  useEffect(() => {
    navigateWithQueryRef.current = navigateWithQuery;
  }, [navigateWithQuery]);

  const handleOpenDrawer = () => {
    setDraftCategory(category);
    setDraftMinPrice(minPrice);
    setDraftMaxPrice(maxPrice);
    setDraftSizes(Array.isArray(sizeFilter) ? [...sizeFilter] : []);
    setDraftColors(Array.isArray(colorFilter) ? [...colorFilter] : []);
    setDraftInStock(Boolean(inStockOnly));
    setDrawerOpen(true);
  };

  const handleCloseDrawer = () => {
    setDrawerOpen(false);
  };

  const handleApplyDrawer = () => {
    navigateWithQuery({
      category: draftCategory,
      minPrice: draftMinPrice,
      maxPrice: draftMaxPrice,
      size: draftSizes,
      color: draftColors,
      inStock: draftInStock,
      page: 1,
    });
    setDrawerOpen(false);
  };

  const handleClearAllDrawer = () => {
    setDraftCategory('all');
    setDraftMinPrice('');
    setDraftMaxPrice('');
    setDraftSizes([]);
    setDraftColors([]);
    setDraftInStock(false);
    navigateWithQuery({
      category: 'all',
      minPrice: '',
      maxPrice: '',
      size: [],
      color: [],
      inStock: false,
      page: 1,
    });
    setDrawerOpen(false);
  };

  // Close drawer on Escape
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && drawerOpen) {
        setDrawerOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [drawerOpen]);

  // Horizontal tabs scrolling state and controls
  const [canScrollTabsLeft, setCanScrollTabsLeft] = useState(false);
  const [canScrollTabsRight, setCanScrollTabsRight] = useState(false);

  const checkTabsScroll = useCallback(() => {
    const el = tabsContainerRef.current;
    if (!el) return;
    setCanScrollTabsLeft(el.scrollLeft > 4);
    setCanScrollTabsRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
  }, []);

  const handleScrollTabs = (direction) => {
    if (!tabsContainerRef.current) return;
    const amount = 220;
    tabsContainerRef.current.scrollBy({
      left: direction === 'left' ? -amount : amount,
      behavior: 'smooth',
    });
  };

  // Sync internal state with URL prop changes (popstate or router navigation)
  useEffect(() => {
    const next = parseQuery(search);
    if (initialCategory && (!next.category || next.category === 'all')) {
      next.category = initialCategory;
    }
    setCategory(next.category);
    setSort(next.sort);
    setPage(next.page);
    setMinPrice(next.minPrice);
    setMaxPrice(next.maxPrice);
    setSizeFilter(next.size);
    setColorFilter(next.color);
    setInStockOnly(next.inStock);
    setSearchTerm(next.searchTerm);
  }, [search, initialCategory]);

  // Close dropdowns on outside click
  useEffect(() => {
    function handleOutsideClick(e) {
      if (sortRef.current && !sortRef.current.contains(e.target)) {
        setSortOpen(false);
      }
    }
    window.addEventListener('click', handleOutsideClick);
    return () => window.removeEventListener('click', handleOutsideClick);
  }, []);

  // Auto-scroll active tab into view in the horizontal tabs container
  useEffect(() => {
    if (tabsContainerRef.current) {
      const activeEl = tabsContainerRef.current.querySelector('[data-active="true"]');
      if (activeEl) {
        activeEl.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
      }
    }
  }, [category, sort]);

  // Check tab scrollability on mount, resize, and category changes
  useEffect(() => {
    const el = tabsContainerRef.current;
    if (!el) return;
    checkTabsScroll();
    el.addEventListener('scroll', checkTabsScroll, { passive: true });
    window.addEventListener('resize', checkTabsScroll);
    return () => {
      el.removeEventListener('scroll', checkTabsScroll);
      window.removeEventListener('resize', checkTabsScroll);
    };
  }, [checkTabsScroll, topCategories]);

  // Fetch filter facets from backend
  useEffect(() => {
    let active = true;

    productApi
      .getProductFilters({ category: category !== 'all' ? category : '', keyword: searchTerm })
      .then((res) => {
        if (!active) return;
        const facetsPayload = res?.data?.categories ? res.data : (res?.data?.data || res?.data || null);
        if (facetsPayload && typeof facetsPayload === 'object') {
          setFacets((prev) => ({
            ...prev,
            ...facetsPayload,
            categories: Array.isArray(facetsPayload.categories) ? facetsPayload.categories : prev.categories,
            priceRange: facetsPayload.priceRange || prev.priceRange,
            sizes: Array.isArray(facetsPayload.sizes) ? facetsPayload.sizes : prev.sizes,
            colors: Array.isArray(facetsPayload.colors) ? facetsPayload.colors : prev.colors,
          }));
        }
      })
      .catch((err) => {
        if (
          err?.name === 'CanceledError' ||
          err?.code === 'ERR_CANCELED' ||
          err?.isCanceled ||
          err?.message === 'Request canceled'
        ) {
          return;
        }
        console.error('Failed to load product facets:', err);
      });

    return () => {
      active = false;
    };
  }, [category, searchTerm]);

  // Fetch products with AbortController for race condition protection
  const fetchProducts = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const controller = new AbortController();
    abortControllerRef.current = controller;

    const requestParams = buildProductParams({
      category,
      sort,
      page,
      minPrice,
      maxPrice,
      size: sizeFilter,
      color: colorFilter,
      inStock: inStockOnly,
      searchTerm,
    });

    setLoading(true);
    setError('');

    productApi
      .getProducts(requestParams, { signal: controller.signal })
      .then((payload) => {
        if (abortControllerRef.current !== controller) return;

        // Extract products array safely from any possible response shape
        const rawProducts = Array.isArray(payload?.data)
          ? payload.data
          : Array.isArray(payload?.data?.data)
          ? payload.data.data
          : Array.isArray(payload)
          ? payload
          : Array.isArray(payload?.products)
          ? payload.products
          : [];

        const normalized = normalizeCatalog(rawProducts);
        setProducts(normalized);

        // Extract pagination metadata from envelope
        const meta =
          payload && typeof payload === 'object' && !Array.isArray(payload)
            ? (payload.data && typeof payload.data === 'object' && !Array.isArray(payload.data)
                ? payload.data
                : payload)
            : {};

        const serverTotalPages = meta.pages ?? (meta.totalPages ?? 1);
        const serverCurrentPage = meta.page ?? (meta.pageNumber ?? page);
        const serverPageSize = meta.pageSize ?? PAGE_SIZE;
        const serverTotalProducts = meta.totalProducts ?? (meta.total ?? normalized.length);

        setPagination({
          page: serverCurrentPage,
          pages: serverTotalPages,
          pageSize: serverPageSize,
          totalProducts: serverTotalProducts,
        });

        // Clamp page in URL if out of range
        if (serverTotalPages > 0 && serverCurrentPage > serverTotalPages) {
          navigateWithQueryRef.current?.({ page: serverTotalPages }, true);
        }
      })
      .catch((err) => {
        if (
          err?.name === 'CanceledError' ||
          err?.code === 'ERR_CANCELED' ||
          err?.isCanceled ||
          err?.message === 'Request canceled'
        ) {
          return;
        }
        setError(err?.message || 'Unable to load products. Please try again.');
      })
      .finally(() => {
        if (abortControllerRef.current === controller) {
          setLoading(false);
        }
      });
  }, [category, sort, page, minPrice, maxPrice, sizeFilter, colorFilter, inStockOnly, searchTerm]);

  useEffect(() => {
    fetchProducts();
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [fetchProducts]);

  // Auto-refresh categories if context has not loaded them
  useEffect(() => {
    if (!backendCategories || backendCategories.length === 0) {
      refreshCategories?.({ silent: true });
    }
  }, [backendCategories, refreshCategories]);

  // Filter change handlers (all reset page to 1)
  const handleSelectCategory = (catSlug) => {
    navigateWithQuery({ category: catSlug, page: 1 });
  };

  const handleSelectSort = (sortValue) => {
    navigateWithQuery({ sort: sortValue, page: 1 });
    setSortOpen(false);
  };

  const handlePageChange = (newPage) => {
    if (newPage < 1 || newPage > pagination.pages || newPage === page) return;
    navigateWithQuery({ page: newPage });
    if (gridRef.current) {
      gridRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const handleToggleSize = (sizeVal) => {
    const next = sizeFilter.includes(sizeVal)
      ? sizeFilter.filter((s) => s !== sizeVal)
      : [...sizeFilter, sizeVal];
    navigateWithQuery({ size: next, page: 1 });
  };

  const handleToggleColor = (colorName) => {
    const next = colorFilter.includes(colorName)
      ? colorFilter.filter((c) => c !== colorName)
      : [...colorFilter, colorName];
    navigateWithQuery({ color: next, page: 1 });
  };

  const handleToggleInStock = () => {
    navigateWithQuery({ inStock: !inStockOnly, page: 1 });
  };

  const handlePriceApply = (min, max) => {
    navigateWithQuery({ minPrice: min, maxPrice: max, page: 1 });
  };

  const handleClearAllFilters = () => {
    navigateWithQuery({
      category: 'all',
      minPrice: '',
      maxPrice: '',
      size: [],
      color: [],
      inStock: false,
      page: 1,
    });
  };

  const handleAddToCart = async (product) => {
    const result = await addProductToBag(product, { qty: 1 });
    if (result?.needsOptions) {
      go(product.path || `/products/${product.slug || product.id}`);
    } else if (result?.ok) {
      openCart?.();
    }
    return result;
  };

  const handleAddToWishlist = (product) => {
    toggleWishlist(product);
  };

  // Showing range calculation
  const total = pagination.totalProducts;
  const safePage = Math.min(page, Math.max(1, pagination.pages));
  const startItem = total === 0 ? 0 : (safePage - 1) * PAGE_SIZE + 1;
  const endItem = Math.min(safePage * PAGE_SIZE, total);


  return (
    <div style={{ backgroundColor: 'var(--bg-main)', minHeight: '100vh', color: 'var(--text-primary)' }}>
      <div style={{ maxWidth: '1440px', margin: '0 auto', padding: '0 40px 90px' }}>

        {/* ── BREADCRUMB ────────────────────────────────────────── */}
        <nav
          aria-label="Breadcrumb"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            padding: '24px 0 14px',
            fontFamily: 'var(--font-sans)',
            fontSize: '11px',
            letterSpacing: '0.14em',
            color: 'var(--text-muted)',
            textTransform: 'uppercase',
          }}
        >
          <button
            onClick={() => go('/')}
            style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 0 }}
          >
            Home
          </button>
          <span>/</span>
          <button
            onClick={() => {
              if (category !== 'all' || sort !== 'recommended') {
                navigateWithQuery({ category: 'all', sort: 'recommended', page: 1 });
              }
            }}
            style={{
              background: 'none',
              border: 'none',
              color: category === 'all' && sort === 'recommended' ? 'var(--text-primary)' : 'var(--text-muted)',
              fontWeight: category === 'all' && sort === 'recommended' ? 600 : 400,
              cursor: 'pointer',
              padding: 0,
            }}
          >
            Shop
          </button>
          {category !== 'all' && (
            <>
              <span>/</span>
              <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{pageTitle}</span>
            </>
          )}
        </nav>

        {/* ── HEADER (H1, Subtitle, Count) ──────────────────────── */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-end',
            gap: '24px',
            paddingTop: '12px',
            paddingBottom: '28px',
            borderBottom: '1px solid var(--border-default)',
            flexWrap: 'wrap',
          }}
        >
          <div>
            <h1
              style={{
                margin: 0,
                fontFamily: 'var(--font-serif)',
                fontSize: 'clamp(36px, 4vw, 52px)',
                fontStyle: 'italic',
                fontWeight: 400,
                letterSpacing: '-0.03em',
                color: 'var(--text-primary)',
                lineHeight: 1.1,
              }}
            >
              {pageTitle}
            </h1>
            <p
              style={{
                margin: '12px 0 0',
                fontFamily: 'var(--font-sans)',
                fontSize: '14px',
                lineHeight: 1.6,
                color: 'var(--text-secondary)',
                maxWidth: '560px',
              }}
            >
              {pageSubtitle}
            </p>
          </div>
          <div
            style={{
              fontFamily: 'var(--font-sans)',
              fontSize: '12px',
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              color: 'var(--text-muted)',
              fontWeight: 500,
            }}
          >
            {total} {total === 1 ? 'product' : 'products'}
          </div>
        </div>

        {/* ── TABS (Real backend categories & curated views with horizontal scroll) ───── */}
        <div
          style={{
            position: 'relative',
            paddingTop: '16px',
            borderBottom: '1px solid var(--border-subtle)',
          }}
        >
          {/* Left chevron & fade mask */}
          {canScrollTabsLeft && (
            <>
              <div
                style={{
                  position: 'absolute',
                  left: 0,
                  top: '16px',
                  bottom: 0,
                  width: '48px',
                  pointerEvents: 'none',
                  background: 'linear-gradient(to right, var(--bg-main), transparent)',
                  zIndex: 2,
                }}
              />
              <button
                type="button"
                onClick={() => handleScrollTabs('left')}
                aria-label="Scroll tabs left"
                style={{
                  position: 'absolute',
                  left: '4px',
                  top: 'calc(50% + 8px)',
                  transform: 'translateY(-50%)',
                  zIndex: 3,
                  background: 'var(--bg-surface)',
                  border: '1px solid var(--border-default)',
                  borderRadius: '50%',
                  width: '28px',
                  height: '28px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  color: 'var(--text-primary)',
                  boxShadow: '0 2px 6px rgba(0,0,0,0.1)',
                }}
              >
                ‹
              </button>
            </>
          )}

          {/* Right chevron & fade mask */}
          {canScrollTabsRight && (
            <>
              <div
                style={{
                  position: 'absolute',
                  right: 0,
                  top: '16px',
                  bottom: 0,
                  width: '48px',
                  pointerEvents: 'none',
                  background: 'linear-gradient(to left, var(--bg-main), transparent)',
                  zIndex: 2,
                }}
              />
              <button
                type="button"
                onClick={() => handleScrollTabs('right')}
                aria-label="Scroll tabs right"
                style={{
                  position: 'absolute',
                  right: '4px',
                  top: 'calc(50% + 8px)',
                  transform: 'translateY(-50%)',
                  zIndex: 3,
                  background: 'var(--bg-surface)',
                  border: '1px solid var(--border-default)',
                  borderRadius: '50%',
                  width: '28px',
                  height: '28px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  color: 'var(--text-primary)',
                  boxShadow: '0 2px 6px rgba(0,0,0,0.1)',
                }}
              >
                ›
              </button>
            </>
          )}

          {/* Horizontal scroll container */}
          <div
            ref={tabsContainerRef}
            style={{
              display: 'flex',
              gap: '24px',
              alignItems: 'center',
              overflowX: 'auto',
              scrollbarWidth: 'none',
              msOverflowStyle: 'none',
              WebkitOverflowScrolling: 'touch',
              padding: '0 4px',
            }}
          >
            {/* All Products Tab */}
            <button
              onClick={() => navigateWithQuery({ category: 'all', sort: 'recommended', page: 1 })}
              data-active={category === 'all' && sort === 'recommended' ? 'true' : 'false'}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: '0 0 14px',
                fontFamily: 'var(--font-sans)',
                fontSize: '12px',
                fontWeight: category === 'all' && sort === 'recommended' ? 700 : 500,
                letterSpacing: '0.14em',
                textTransform: 'uppercase',
                color: category === 'all' && sort === 'recommended' ? 'var(--text-primary)' : 'var(--text-muted)',
                borderBottom: category === 'all' && sort === 'recommended' ? '2px solid var(--text-primary)' : '2px solid transparent',
                transition: 'color 0.2s ease, border-color 0.2s ease',
                whiteSpace: 'nowrap',
                flexShrink: 0,
              }}
            >
              All Products
            </button>

            {/* New Arrivals Tab */}
            <button
              onClick={() => navigateWithQuery({ category: 'all', sort: 'newest', page: 1 })}
              data-active={category === 'all' && sort === 'newest' ? 'true' : 'false'}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: '0 0 14px',
                fontFamily: 'var(--font-sans)',
                fontSize: '12px',
                fontWeight: category === 'all' && sort === 'newest' ? 700 : 500,
                letterSpacing: '0.14em',
                textTransform: 'uppercase',
                color: category === 'all' && sort === 'newest' ? 'var(--text-primary)' : 'var(--text-muted)',
                borderBottom: category === 'all' && sort === 'newest' ? '2px solid var(--text-primary)' : '2px solid transparent',
                transition: 'color 0.2s ease, border-color 0.2s ease',
                whiteSpace: 'nowrap',
                flexShrink: 0,
              }}
            >
              New Arrivals
            </button>

            {/* Best Sellers Tab */}
            <button
              onClick={() => navigateWithQuery({ category: 'all', sort: 'bestselling', page: 1 })}
              data-active={category === 'all' && sort === 'bestselling' ? 'true' : 'false'}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: '0 0 14px',
                fontFamily: 'var(--font-sans)',
                fontSize: '12px',
                fontWeight: category === 'all' && sort === 'bestselling' ? 700 : 500,
                letterSpacing: '0.14em',
                textTransform: 'uppercase',
                color: category === 'all' && sort === 'bestselling' ? 'var(--text-primary)' : 'var(--text-muted)',
                borderBottom: category === 'all' && sort === 'bestselling' ? '2px solid var(--text-primary)' : '2px solid transparent',
                transition: 'color 0.2s ease, border-color 0.2s ease',
                whiteSpace: 'nowrap',
                flexShrink: 0,
              }}
            >
              Best Sellers
            </button>

            {/* Real Top-Level Categories */}
            {topCategories.map((cat) => {
              const isActive = category === cat.slug;
              return (
                <button
                  key={cat._id}
                  onClick={() => handleSelectCategory(cat.slug)}
                  data-active={isActive ? 'true' : 'false'}
                  style={{
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    padding: '0 0 14px',
                    fontFamily: 'var(--font-sans)',
                    fontSize: '12px',
                    fontWeight: isActive ? 700 : 500,
                    letterSpacing: '0.14em',
                    textTransform: 'uppercase',
                    color: isActive ? 'var(--text-primary)' : 'var(--text-muted)',
                    borderBottom: isActive ? '2px solid var(--text-primary)' : '2px solid transparent',
                    transition: 'color 0.2s ease, border-color 0.2s ease',
                    whiteSpace: 'nowrap',
                    flexShrink: 0,
                  }}
                >
                  {cat.name}
                </button>
              );
            })}
          </div>
        </div>

        {/* ── CONTROLS ROW (Filters Button, Sort Dropdown, Grid/List) ─ */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: '16px',
            padding: '18px 0 14px',
            flexWrap: 'wrap',
          }}
        >
          {/* Showing count indicator */}
          <div
            style={{
              fontFamily: 'var(--font-sans)',
              fontSize: '11px',
              letterSpacing: '0.14em',
              textTransform: 'uppercase',
              color: 'var(--text-secondary)',
            }}
          >
            Showing <strong style={{ color: 'var(--text-primary)' }}>{total > 0 ? `${startItem}–${endItem}` : '0'}</strong> of{' '}
            <strong style={{ color: 'var(--text-primary)' }}>{total}</strong> products
          </div>

          {/* Right Controls: Filters, Sort, Layout View */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>

            {/* Filters Trigger Button */}
            <button
              onClick={handleOpenDrawer}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                border: '1px solid var(--border-default)',
                background: 'var(--bg-surface)',
                padding: '9px 16px',
                borderRadius: '999px',
                color: 'var(--text-primary)',
                fontFamily: 'var(--font-sans)',
                fontSize: '11px',
                letterSpacing: '0.14em',
                textTransform: 'uppercase',
                cursor: 'pointer',
                fontWeight: 600,
                transition: 'background 0.2s ease',
              }}
              aria-label="Open filters drawer"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M4 6h16M7 12h10M10 18h4" />
              </svg>
              Filters
              {activeFiltersCount > 0 && (
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: '18px',
                    height: '18px',
                    borderRadius: '50%',
                    background: 'var(--color-primary)',
                    color: 'var(--color-primary-contrast)',
                    fontSize: '10px',
                    fontWeight: 700,
                  }}
                >
                  {activeFiltersCount}
                </span>
              )}
            </button>

            {/* Sort Dropdown */}
            <div ref={sortRef} style={{ position: 'relative' }}>
              <button
                onClick={() => setSortOpen((prev) => !prev)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  border: '1px solid var(--border-default)',
                  background: 'var(--bg-surface)',
                  padding: '9px 16px',
                  borderRadius: '999px',
                  color: 'var(--text-primary)',
                  fontFamily: 'var(--font-sans)',
                  fontSize: '11px',
                  fontWeight: 600,
                  letterSpacing: '0.14em',
                  textTransform: 'uppercase',
                  cursor: 'pointer',
                }}
                aria-haspopup="listbox"
                aria-expanded={sortOpen}
              >
                Sort by: {SORT_OPTIONS.find((opt) => opt.value === sort)?.label.toUpperCase() || 'RECOMMENDED'}
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="m6 9 6 6 6-6" />
                </svg>
              </button>

              {sortOpen && (
                <div
                  style={{
                    position: 'absolute',
                    right: 0,
                    top: 'calc(100% + 8px)',
                    background: 'var(--bg-surface)',
                    border: '1px solid var(--border-default)',
                    boxShadow: 'var(--shadow-lg)',
                    minWidth: '220px',
                    zIndex: 40,
                  }}
                  role="listbox"
                >
                  {SORT_OPTIONS.map((option) => (
                    <button
                      key={option.value}
                      onClick={() => handleSelectSort(option.value)}
                      style={{
                        display: 'block',
                        width: '100%',
                        textAlign: 'left',
                        border: 'none',
                        background: sort === option.value ? 'var(--bg-selected)' : 'transparent',
                        cursor: 'pointer',
                        color: 'var(--text-primary)',
                        fontWeight: sort === option.value ? 700 : 500,
                        fontFamily: 'var(--font-sans)',
                        fontSize: '11px',
                        letterSpacing: '0.12em',
                        textTransform: 'uppercase',
                        padding: '12px 16px',
                        borderBottom: '1px solid var(--border-subtle)',
                      }}
                      role="option"
                      aria-selected={sort === option.value}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Grid / List View Toggle */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                border: '1px solid var(--border-default)',
                background: 'var(--bg-surface-sunken)',
                borderRadius: '999px',
                overflow: 'hidden',
              }}
            >
              <button
                onClick={() => setViewMode('grid')}
                style={{
                  border: 'none',
                  background: viewMode === 'grid' ? 'var(--color-primary)' : 'transparent',
                  color: viewMode === 'grid' ? 'var(--color-primary-contrast)' : 'var(--text-primary)',
                  padding: '9px 12px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                }}
                aria-label="Grid view"
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <rect x="3" y="3" width="7" height="7" rx="1" />
                  <rect x="14" y="3" width="7" height="4" rx="1" />
                  <rect x="14" y="11" width="7" height="10" rx="1" />
                  <rect x="3" y="12" width="7" height="9" rx="1" />
                </svg>
              </button>
              <button
                onClick={() => setViewMode('list')}
                style={{
                  border: 'none',
                  background: viewMode === 'list' ? 'var(--color-primary)' : 'transparent',
                  color: viewMode === 'list' ? 'var(--color-primary-contrast)' : 'var(--text-primary)',
                  padding: '9px 12px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                }}
                aria-label="List view"
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" />
                </svg>
              </button>
            </div>
          </div>
        </div>

        {/* ── ACTIVE FILTER CHIPS ───────────────────────────────── */}
        {activeFiltersCount > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', padding: '10px 0 18px' }}>
            <span style={{ fontFamily: 'var(--font-sans)', fontSize: '10px', letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>
              Active:
            </span>

            {category !== 'all' && (
              <button
                onClick={() => handleSelectCategory('all')}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  border: '1px solid var(--border-default)',
                  background: 'var(--bg-surface)',
                  borderRadius: '999px',
                  padding: '6px 12px',
                  fontFamily: 'var(--font-sans)',
                  fontSize: '10px',
                  letterSpacing: '0.12em',
                  textTransform: 'uppercase',
                  color: 'var(--text-primary)',
                  cursor: 'pointer',
                }}
              >
                Category: {currentCategoryObj?.name || category}
                <span style={{ fontSize: '13px' }}>×</span>
              </button>
            )}

            {(minPrice !== '' || maxPrice !== '') && (
              <button
                onClick={() => handlePriceApply('', '')}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  border: '1px solid var(--border-default)',
                  background: 'var(--bg-surface)',
                  borderRadius: '999px',
                  padding: '6px 12px',
                  fontFamily: 'var(--font-sans)',
                  fontSize: '10px',
                  letterSpacing: '0.12em',
                  textTransform: 'uppercase',
                  color: 'var(--text-primary)',
                  cursor: 'pointer',
                }}
              >
                Price: {minPrice ? (formatCurrency ? formatCurrency(minPrice) : `$${minPrice}`) : (formatCurrency ? formatCurrency(0) : '$0')} – {maxPrice ? (formatCurrency ? formatCurrency(maxPrice) : `$${maxPrice}`) : 'Any'}
                <span style={{ fontSize: '13px' }}>×</span>
              </button>
            )}

            {sizeFilter.map((sizeVal) => (
              <button
                key={sizeVal}
                onClick={() => handleToggleSize(sizeVal)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  border: '1px solid var(--border-default)',
                  background: 'var(--bg-surface)',
                  borderRadius: '999px',
                  padding: '6px 12px',
                  fontFamily: 'var(--font-sans)',
                  fontSize: '10px',
                  letterSpacing: '0.12em',
                  textTransform: 'uppercase',
                  color: 'var(--text-primary)',
                  cursor: 'pointer',
                }}
              >
                Size: {sizeVal}
                <span style={{ fontSize: '13px' }}>×</span>
              </button>
            ))}

            {colorFilter.map((colorName) => (
              <button
                key={colorName}
                onClick={() => handleToggleColor(colorName)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  border: '1px solid var(--border-default)',
                  background: 'var(--bg-surface)',
                  borderRadius: '999px',
                  padding: '6px 12px',
                  fontFamily: 'var(--font-sans)',
                  fontSize: '10px',
                  letterSpacing: '0.12em',
                  textTransform: 'uppercase',
                  color: 'var(--text-primary)',
                  cursor: 'pointer',
                }}
              >
                Color: {colorName}
                <span style={{ fontSize: '13px' }}>×</span>
              </button>
            ))}

            {inStockOnly && (
              <button
                onClick={handleToggleInStock}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  border: '1px solid var(--border-default)',
                  background: 'var(--bg-surface)',
                  borderRadius: '999px',
                  padding: '6px 12px',
                  fontFamily: 'var(--font-sans)',
                  fontSize: '10px',
                  letterSpacing: '0.12em',
                  textTransform: 'uppercase',
                  color: 'var(--text-primary)',
                  cursor: 'pointer',
                }}
              >
                In Stock Only
                <span style={{ fontSize: '13px' }}>×</span>
              </button>
            )}

            <button
              onClick={handleClearAllFilters}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--text-secondary)',
                cursor: 'pointer',
                fontFamily: 'var(--font-sans)',
                fontSize: '10px',
                letterSpacing: '0.14em',
                textTransform: 'uppercase',
                padding: '4px 8px',
                textDecoration: 'underline',
              }}
            >
              Clear All
            </button>
          </div>
        )}

        {/* ── ERROR STATE ───────────────────────────────────────── */}
        {error && (
          <div
            style={{
              margin: '24px 0',
              padding: '24px',
              background: 'var(--color-danger-soft)',
              border: '1px solid var(--color-danger)',
              borderRadius: '4px',
              textAlign: 'center',
            }}
          >
            <p style={{ margin: '0 0 14px', fontFamily: 'var(--font-sans)', fontSize: '13px', color: 'var(--color-danger)' }}>
              {error}
            </p>
            <button
              onClick={fetchProducts}
              style={{
                background: 'var(--color-primary)',
                color: 'var(--color-primary-contrast)',
                border: 'none',
                padding: '10px 20px',
                fontFamily: 'var(--font-sans)',
                fontSize: '11px',
                letterSpacing: '0.14em',
                textTransform: 'uppercase',
                cursor: 'pointer',
              }}
            >
              Retry
            </button>
          </div>
        )}

        {/* ── LOADING SKELETON (12 Cards: 4x3 Grid) ─────────────── */}
        {loading && (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns:
                viewMode === 'grid'
                  ? 'repeat(auto-fill, minmax(260px, 1fr))'
                  : 'repeat(1, minmax(0, 1fr))',
              gap: '28px',
              paddingTop: '20px',
            }}
          >
            {Array.from({ length: PAGE_SIZE }).map((_, index) => (
              <div key={index} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div
                  style={{
                    aspectRatio: '4 / 5',
                    background: 'var(--skeleton-base)',
                    borderRadius: '4px',
                    animation: 'pulse 1.8s infinite ease-in-out',
                  }}
                />
                <div style={{ height: '14px', width: '70%', background: 'var(--skeleton-base)', borderRadius: '2px' }} />
                <div style={{ height: '12px', width: '40%', background: 'var(--skeleton-base)', borderRadius: '2px' }} />
              </div>
            ))}
          </div>
        )}

        {/* ── EMPTY STATE ───────────────────────────────────────── */}
        {!loading && !error && products.length === 0 && (
          <div style={{ padding: '80px 20px', textAlign: 'center' }}>
            <h2
              style={{
                margin: '0 0 12px',
                fontFamily: 'var(--font-serif)',
                fontSize: '32px',
                fontStyle: 'italic',
                color: 'var(--text-primary)',
              }}
            >
              No products found
            </h2>
            <p style={{ margin: '0 0 24px', fontFamily: 'var(--font-sans)', fontSize: '14px', color: 'var(--text-secondary)' }}>
              We could not find any products matching your selected filters or search criteria.
            </p>
            <button
              onClick={handleClearAllFilters}
              style={{
                background: 'var(--color-primary)',
                color: 'var(--color-primary-contrast)',
                border: 'none',
                padding: '12px 24px',
                fontFamily: 'var(--font-sans)',
                fontSize: '11px',
                letterSpacing: '0.14em',
                textTransform: 'uppercase',
                cursor: 'pointer',
              }}
            >
              Clear filters
            </button>
          </div>
        )}

        {/* ── PRODUCT GRID (4 columns on desktop, 12 products) ─── */}
        {!loading && !error && products.length > 0 && (
          <div
            ref={gridRef}
            className="novashop-product-grid"
            style={{
              display: 'grid',
              gridTemplateColumns:
                viewMode === 'grid'
                  ? 'repeat(4, minmax(0, 1fr))'
                  : 'repeat(1, minmax(0, 1fr))',
              gap: '28px',
              paddingTop: '20px',
            }}
          >
            {products.map((product) => (
              <ProductCard
                key={product.id || product._id}
                product={{
                  ...product,
                  price:
                    typeof product.price === 'number'
                      ? `$${product.price.toFixed(2)}`
                      : String(product.price || '$0.00'),
                  variant: product.variant,
                  swatches: product.swatches || [],
                  path: `/products/${product.slug || product.id}`,
                  primaryImage: product.primaryImage,
                  hoverImage: product.hoverImage,
                  stock: product.stockTotal > 0 ? 'in-stock' : 'out-of-stock',
                }}
                go={go}
                onAddToCart={handleAddToCart}
                onAddToWishlist={handleAddToWishlist}
                showCartIcon={true}
              />
            ))}
          </div>
        )}

        {/* ── PAGINATION ROW ────────────────────────────────────── */}
        {!loading && pagination.pages > 1 && (
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: '16px',
              paddingTop: '48px',
              fontFamily: 'var(--font-sans)',
              fontSize: '11px',
              letterSpacing: '0.14em',
              textTransform: 'uppercase',
              color: 'var(--text-secondary)',
              flexWrap: 'wrap',
            }}
          >
            <div>
              Showing {startItem}–{endItem} of {total} products
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              {/* Previous button */}
              <button
                onClick={() => handlePageChange(page - 1)}
                disabled={page <= 1}
                style={{
                  background: 'none',
                  border: 'none',
                  color: page <= 1 ? 'var(--text-faint)' : 'var(--text-primary)',
                  cursor: page <= 1 ? 'default' : 'pointer',
                  fontFamily: 'var(--font-sans)',
                  fontSize: '11px',
                  fontWeight: 600,
                  letterSpacing: '0.14em',
                  textTransform: 'uppercase',
                  padding: '6px 10px',
                }}
                aria-label="Previous page"
              >
                ← Previous
              </button>

              {/* Numbered page buttons with ellipsis */}
              {generatePageNumbers(page, pagination.pages).map((p, idx) => {
                if (p === '...') {
                  return (
                    <span key={`ellipsis-${idx}`} style={{ padding: '0 4px', color: 'var(--text-muted)' }}>
                      …
                    </span>
                  );
                }
                const isCurrent = p === page;
                return (
                  <button
                    key={p}
                    onClick={() => handlePageChange(p)}
                    style={{
                      background: isCurrent ? 'var(--color-primary)' : 'transparent',
                      color: isCurrent ? 'var(--color-primary-contrast)' : 'var(--text-primary)',
                      border: '1px solid var(--border-default)',
                      width: '32px',
                      height: '32px',
                      borderRadius: '50%',
                      cursor: 'pointer',
                      fontFamily: 'var(--font-sans)',
                      fontSize: '11px',
                      fontWeight: isCurrent ? 700 : 500,
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      transition: 'background 0.2s ease',
                    }}
                    aria-current={isCurrent ? 'page' : undefined}
                    aria-label={`Page ${p}`}
                  >
                    {p}
                  </button>
                );
              })}

              {/* Next button */}
              <button
                onClick={() => handlePageChange(page + 1)}
                disabled={page >= pagination.pages}
                style={{
                  background: 'none',
                  border: 'none',
                  color: page >= pagination.pages ? 'var(--text-faint)' : 'var(--text-primary)',
                  cursor: page >= pagination.pages ? 'default' : 'pointer',
                  fontFamily: 'var(--font-sans)',
                  fontSize: '11px',
                  fontWeight: 600,
                  letterSpacing: '0.14em',
                  textTransform: 'uppercase',
                  padding: '6px 10px',
                }}
                aria-label="Next page"
              >
                Next →
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── FILTERS DRAWER / SLIDE-OVER ───────────────────────── */}
      {drawerOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'var(--bg-overlay)',
            zIndex: 90,
            display: 'flex',
            justifyContent: 'flex-end',
          }}
          onClick={handleCloseDrawer}
        >
          <aside
            onClick={(e) => e.stopPropagation()}
            style={{
              width: 'min(440px, 92vw)',
              height: '100%',
              background: 'var(--bg-surface)',
              borderLeft: '1px solid var(--border-default)',
              boxShadow: 'var(--shadow-lg)',
              display: 'flex',
              flexDirection: 'column',
            }}
            role="dialog"
            aria-label="Filter products"
          >
            {/* Drawer Header */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '24px 28px',
                borderBottom: '1px solid var(--border-default)',
              }}
            >
              <h2
                style={{
                  margin: 0,
                  fontFamily: 'var(--font-serif)',
                  fontSize: '28px',
                  fontStyle: 'italic',
                  color: 'var(--text-primary)',
                  fontWeight: 400,
                }}
              >
                Filters
              </h2>
              <button
                type="button"
                onClick={handleCloseDrawer}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: 'var(--text-primary)',
                  fontSize: '28px',
                  lineHeight: 1,
                  padding: 0,
                  minWidth: '44px',
                  minHeight: '44px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
                aria-label="Close filters"
              >
                ×
              </button>
            </div>

            {/* Drawer Scrollable Content */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '24px 28px' }}>

              {/* Category Filter Group */}
              <div style={{ marginBottom: '28px' }}>
                <div
                  style={{
                    fontFamily: 'var(--font-sans)',
                    fontSize: '11px',
                    letterSpacing: '0.14em',
                    textTransform: 'uppercase',
                    color: 'var(--text-muted)',
                    fontWeight: 600,
                    marginBottom: '14px',
                  }}
                >
                  Categories
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <label
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      fontFamily: 'var(--font-sans)',
                      fontSize: '12px',
                      color: draftCategory === 'all' ? 'var(--text-primary)' : 'var(--text-secondary)',
                      fontWeight: draftCategory === 'all' ? 600 : 400,
                      cursor: 'pointer',
                    }}
                  >
                    <span style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <input
                        type="radio"
                        name="drawer-category"
                        checked={draftCategory === 'all'}
                        onChange={() => setDraftCategory('all')}
                        style={{ accentColor: 'var(--color-primary)' }}
                      />
                      All Categories
                    </span>
                  </label>

                  {(Array.isArray(facets?.categories) ? facets.categories : [])
                    .filter((cat) => cat && !cat.parent)
                    .map((cat) => {
                      const isSelected = draftCategory === cat.slug;
                      return (
                        <label
                          key={cat._id}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            fontFamily: 'var(--font-sans)',
                            fontSize: '12px',
                            color: isSelected ? 'var(--text-primary)' : 'var(--text-secondary)',
                            fontWeight: isSelected ? 600 : 400,
                            cursor: 'pointer',
                          }}
                        >
                          <span style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <input
                              type="radio"
                              name="drawer-category"
                              checked={isSelected}
                              onChange={() => setDraftCategory(cat.slug)}
                              style={{ accentColor: 'var(--color-primary)' }}
                            />
                            {cat.name}
                          </span>
                          <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                            ({cat.count})
                          </span>
                        </label>
                      );
                    })}
                </div>
              </div>

              {/* Price Range Filter Group */}
              <div style={{ marginBottom: '28px' }}>
                <div
                  style={{
                    fontFamily: 'var(--font-sans)',
                    fontSize: '11px',
                    letterSpacing: '0.14em',
                    textTransform: 'uppercase',
                    color: 'var(--text-muted)',
                    fontWeight: 600,
                    marginBottom: '14px',
                  }}
                >
                  Price Range
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{ flex: 1 }}>
                    <label style={{ display: 'block', fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '4px' }}>
                      Min Price
                    </label>
                    <input
                      type="number"
                      placeholder={String(facets?.priceRange?.min ?? 0)}
                      value={draftMinPrice}
                      onChange={(e) => setDraftMinPrice(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '10px 12px',
                        border: '1px solid var(--border-input)',
                        background: 'var(--bg-input)',
                        color: 'var(--text-primary)',
                        fontFamily: 'var(--font-sans)',
                        fontSize: '16px',
                        minHeight: '44px',
                        boxSizing: 'border-box',
                      }}
                    />
                  </div>
                  <span style={{ paddingTop: '16px', color: 'var(--text-muted)' }}>–</span>
                  <div style={{ flex: 1 }}>
                    <label style={{ display: 'block', fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '4px' }}>
                      Max Price
                    </label>
                    <input
                      type="number"
                      placeholder={String(facets?.priceRange?.max ?? 1000)}
                      value={draftMaxPrice}
                      onChange={(e) => setDraftMaxPrice(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '10px 12px',
                        border: '1px solid var(--border-input)',
                        background: 'var(--bg-input)',
                        color: 'var(--text-primary)',
                        fontFamily: 'var(--font-sans)',
                        fontSize: '16px',
                        minHeight: '44px',
                        boxSizing: 'border-box',
                      }}
                    />
                  </div>
                </div>
              </div>

              {/* Sizes Filter Group */}
              {Array.isArray(facets?.sizes) && facets.sizes.length > 0 && (
                <div style={{ marginBottom: '28px' }}>
                  <div
                    style={{
                      fontFamily: 'var(--font-sans)',
                      fontSize: '11px',
                      letterSpacing: '0.14em',
                      textTransform: 'uppercase',
                      color: 'var(--text-muted)',
                      fontWeight: 600,
                      marginBottom: '14px',
                    }}
                  >
                    Size
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                    {facets.sizes.map((s) => {
                      const isSelected = draftSizes.includes(s.value);
                      return (
                        <button
                          key={s.value}
                          type="button"
                          onClick={() => {
                            setDraftSizes((prev) =>
                              prev.includes(s.value) ? prev.filter((x) => x !== s.value) : [...prev, s.value]
                            );
                          }}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '6px',
                            border: isSelected ? '1px solid var(--color-primary)' : '1px solid var(--border-default)',
                            background: isSelected ? 'var(--color-primary)' : 'var(--bg-surface)',
                            color: isSelected ? 'var(--color-primary-contrast)' : 'var(--text-primary)',
                            borderRadius: '4px',
                            padding: '6px 12px',
                            fontFamily: 'var(--font-sans)',
                            fontSize: '11px',
                            fontWeight: isSelected ? 600 : 500,
                            letterSpacing: '0.08em',
                            cursor: 'pointer',
                            transition: 'all 0.15s ease',
                          }}
                        >
                          {s.value}
                          <span style={{ fontSize: '9px', opacity: 0.7 }}>({s.count})</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Colors Filter Group */}
              {Array.isArray(facets?.colors) && facets.colors.length > 0 && (
                <div style={{ marginBottom: '28px' }}>
                  <div
                    style={{
                      fontFamily: 'var(--font-sans)',
                      fontSize: '11px',
                      letterSpacing: '0.14em',
                      textTransform: 'uppercase',
                      color: 'var(--text-muted)',
                      fontWeight: 600,
                      marginBottom: '14px',
                    }}
                  >
                    Color
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                    {facets.colors.map((c) => {
                      const isSelected = draftColors.includes(c.name);
                      const swatchStyle = getSwatchVisual(c.hex, isSelected);
                      return (
                        <button
                          key={c.name}
                          type="button"
                          onClick={() => {
                            setDraftColors((prev) =>
                              prev.includes(c.name) ? prev.filter((x) => x !== c.name) : [...prev, c.name]
                            );
                          }}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '8px',
                            border: isSelected ? '1px solid var(--color-primary)' : '1px solid var(--border-default)',
                            background: isSelected ? 'var(--color-primary)' : 'var(--bg-surface)',
                            color: isSelected ? 'var(--color-primary-contrast)' : 'var(--text-primary)',
                            borderRadius: '999px',
                            padding: '6px 12px',
                            fontFamily: 'var(--font-sans)',
                            fontSize: '11px',
                            fontWeight: isSelected ? 600 : 500,
                            letterSpacing: '0.08em',
                            cursor: 'pointer',
                          }}
                        >
                          <span
                            style={{
                              width: '12px',
                              height: '12px',
                              borderRadius: '50%',
                              backgroundColor: swatchStyle.backgroundColor,
                              border: swatchStyle.border,
                              flexShrink: 0,
                            }}
                          />
                          {c.name}
                          <span style={{ fontSize: '9px', opacity: 0.7 }}>({c.count})</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* In Stock Only Toggle */}
              <div style={{ marginBottom: '28px', paddingTop: '8px', borderTop: '1px solid var(--border-subtle)' }}>
                <label
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    fontFamily: 'var(--font-sans)',
                    fontSize: '12px',
                    fontWeight: 600,
                    letterSpacing: '0.08em',
                    textTransform: 'uppercase',
                    color: 'var(--text-primary)',
                    cursor: 'pointer',
                  }}
                >
                  <input
                    type="checkbox"
                    checked={draftInStock}
                    onChange={(e) => setDraftInStock(e.target.checked)}
                    style={{ width: '16px', height: '16px', accentColor: 'var(--color-primary)' }}
                  />
                  In Stock Only
                </label>
              </div>

            </div>

            {/* Drawer Footer Actions */}
            <div
              style={{
                display: 'flex',
                gap: '12px',
                padding: '16px 24px calc(16px + env(safe-area-inset-bottom, 0px))',
                borderTop: '1px solid var(--border-default)',
                background: 'var(--bg-surface)',
              }}
            >
              <button
                type="button"
                onClick={handleClearAllDrawer}
                style={{
                  flex: 1,
                  background: 'transparent',
                  border: '1px solid var(--border-default)',
                  color: 'var(--text-primary)',
                  padding: '12px',
                  minHeight: '44px',
                  fontFamily: 'var(--font-sans)',
                  fontSize: '11px',
                  letterSpacing: '0.14em',
                  textTransform: 'uppercase',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Clear All
              </button>
              <button
                type="button"
                onClick={handleApplyDrawer}
                style={{
                  flex: 1,
                  background: 'var(--color-primary)',
                  border: '1px solid var(--color-primary)',
                  color: 'var(--color-primary-contrast)',
                  padding: '12px',
                  minHeight: '44px',
                  fontFamily: 'var(--font-sans)',
                  fontSize: '11px',
                  letterSpacing: '0.14em',
                  textTransform: 'uppercase',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Apply
              </button>
            </div>
          </aside>
        </div>
      )}

      {/* Global CSS helper for 4x3 responsive columns & pulse */}
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.55; }
        }
        @media (min-width: 1024px) {
          .novashop-product-grid {
            grid-template-columns: repeat(4, minmax(0, 1fr)) !important;
          }
        }
        @media (min-width: 768px) and (max-width: 1023px) {
          .novashop-product-grid {
            grid-template-columns: repeat(3, minmax(0, 1fr)) !important;
          }
        }
        @media (max-width: 767px) {
          .novashop-product-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
            gap: 16px !important;
          }
        }
        @media (max-width: 640px) {
          aside[role="dialog"][aria-label="Filter products"] {
            width: 100vw !important;
          }
        }
        @media (max-width: 360px) {
          .novashop-product-grid {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </div>
  );
}
