import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import { AdminIcon } from '../../components/admin/AdminLayout';
import adminApi from '../../lib/api/adminApi';
import AdminRowActionMenu from '../../components/admin/AdminRowActionMenu';
import './admin-reviews.css';

/* =========================================================
   STAT CARD
========================================================= */

function StatCard({
  label,
  value,
  change,
  changeTone = 'positive',
}) {
  return (
    <article className="reviews-stat-card">
      <div className="reviews-stat-top">
        <span>{label}</span>

        {change && (
          <span
            className={`reviews-stat-change is-${changeTone}`}
          >
            {change}
          </span>
        )}
      </div>

      <strong>{value}</strong>
    </article>
  );
}

/* =========================================================
   STATUS BADGE
========================================================= */

function StatusBadge({ status }) {
  const config = {
    approved: {
      label: 'Approved',
      className: 'is-approved',
    },
    pending: {
      label: 'Pending',
      className: 'is-pending',
    },
    rejected: {
      label: 'Rejected',
      className: 'is-rejected',
    },
  };

  const current =
    config[status] || config.pending;

  return (
    <span
      className={`reviews-status ${current.className}`}
    >
      <i />
      {current.label}
    </span>
  );
}

/* =========================================================
   STAR RATING
========================================================= */

function StarRating({ rating }) {
  const numericRating = Math.round(Number(rating) || 0);

  return (
    <span
      className="reviews-star-rating"
      aria-label={`${numericRating} out of 5 stars`}
    >
      {[1, 2, 3, 4, 5].map((star) => (
        <span
          key={star}
          className={
            star <= numericRating ? 'is-filled' : ''
          }
        >
          ★
        </span>
      ))}
    </span>
  );
}

/* =========================================================
   FILTER DROPDOWN
========================================================= */

function FilterDropdown({
  label,
  value,
  options,
  isOpen,
  onToggle,
  onChange,
}) {
  const isActive =
    String(value) !== String(options[0]?.value);

  const selectedOption =
    options.find(
      (option) =>
        String(option.value) === String(value),
    ) || options[0] || { label, value };

  return (
    <div className="reviews-filter-dropdown">
      <button
        type="button"
        className={`reviews-filter-button${
          isActive ? ' is-active' : ''
        }`}
        onClick={onToggle}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
      >
        <span>
          {isActive
            ? selectedOption.label
            : label}
        </span>

        <AdminIcon
          name="chevron"
          size={13}
        />
      </button>

      {isOpen && (
        <div
          className="reviews-filter-menu"
          role="listbox"
        >
          {options.map((option) => {
            const selected =
              String(value) ===
              String(option.value);

            return (
              <button
                key={String(option.value)}
                type="button"
                role="option"
                aria-selected={selected}
                className={
                  selected ? 'is-selected' : ''
                }
                onClick={() =>
                  onChange(option.value)
                }
              >
                <span>{option.label}</span>

                {selected && (
                  <AdminIcon
                    name="check"
                    size={12}
                  />
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* =========================================================
   ADMIN REVIEWS PAGE
========================================================= */

export default function AdminReviewsPage({
  go,
}) {
  // Query state (synchronized with URL params)
  const [reviews, setReviews] = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [pageSize, setPageSize] = useState('10');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Tab & Filter states
  const [activeTab, setActiveTab] = useState('all');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [ratingFilter, setRatingFilter] = useState('All ratings');
  const [productFilter, setProductFilter] = useState('All products');
  const [dateFilter, setDateFilter] = useState('All dates');
  const [availableProducts, setAvailableProducts] = useState([]);

  // Selection & Dropdowns
  const [selected, setSelected] = useState([]);
  const [openFilter, setOpenFilter] = useState(null);
  const [openMenu, setOpenMenu] = useState(null);
  const [menuTarget, setMenuTarget] = useState(null);
  const [notice, setNotice] = useState('');

  // Modals for missing features
  const [replyModalReview, setReplyModalReview] = useState(null);
  const [replyText, setReplyText] = useState('');
  const [isSubmittingReply, setIsSubmittingReply] = useState(false);

  const [viewModalReview, setViewModalReview] = useState(null);

  const [rejectModalReview, setRejectModalReview] = useState(null);
  const [rejectionReason, setRejectionReason] = useState('');

  const [confirmDeleteReviewId, setConfirmDeleteReviewId] = useState(null);

  // Real statistics state
  const [stats, setStats] = useState({
    totalReviews: 0,
    totalReviewsChange: '-',
    averageRating: '5.0',
    averageRatingChange: '-',
    pendingReviews: 0,
    pendingReviewsChange: '-',
    replyRate: '0%',
    replyRateChange: '-',
  });

  const [counts, setCounts] = useState({
    all: 0,
    pending: 0,
    approved: 0,
    rejected: 0,
  });

  const toolbarRef = useRef(null);

  /* =======================================================
     NOTICE / TOAST
  ======================================================= */

  const showNotice = useCallback(
    (message) => {
      setNotice(message);

      window.setTimeout(() => {
        setNotice('');
      }, 2400);
    },
    [],
  );

  /* =======================================================
     SEARCH DEBOUNCE
  ======================================================= */

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 350);
    return () => clearTimeout(timer);
  }, [search]);

  /* =======================================================
     URL QUERY INITIALIZATION
  ======================================================= */

  useEffect(() => {
    try {
      const searchParams = new URLSearchParams(window.location.search);
      const urlStatus = searchParams.get('status');
      const urlSearch = searchParams.get('search');
      const urlRating = searchParams.get('rating');
      const urlProduct = searchParams.get('product');
      const urlPage = searchParams.get('page');

      if (urlStatus && ['all', 'pending', 'approved', 'rejected'].includes(urlStatus.toLowerCase())) {
        setActiveTab(urlStatus.toLowerCase());
      }
      if (urlSearch) {
        setSearch(urlSearch);
        setDebouncedSearch(urlSearch);
      }
      if (urlRating) {
        setRatingFilter(urlRating);
      }
      if (urlProduct) {
        setProductFilter(urlProduct);
      }
      if (urlPage && !isNaN(parseInt(urlPage, 10))) {
        setPage(Math.max(1, parseInt(urlPage, 10)));
      }
    } catch {
      // ignore URL parse errors
    }
  }, []);

  /* =======================================================
     FETCH REVIEWS LIST
  ======================================================= */

  const fetchReviews = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const params = {
        page,
        limit: parseInt(pageSize, 10) || 10,
        search: debouncedSearch.trim() || undefined,
        status: activeTab !== 'all' ? activeTab : undefined,
        rating: ratingFilter !== 'All ratings' ? ratingFilter : undefined,
        product: productFilter !== 'All products' ? productFilter : undefined,
        dateRange: dateFilter !== 'All dates' ? dateFilter : undefined,
      };

      const res = await adminApi.getReviews(params);

      if (res && res.data) {
        const payload = res.data.data || res.data;
        const reviewList = payload.reviews || [];
        setReviews(reviewList);
        setTotalCount(payload.total || 0);
        setPages(payload.pages || 1);

        // Collect unique product names for the product filter
        if (reviewList.length > 0) {
          setAvailableProducts((prev) => {
            const names = new Set(prev);
            reviewList.forEach((r) => {
              if (r.product) names.add(r.product);
            });
            return Array.from(names).sort();
          });
        }
      }
    } catch (err) {
      if (err.response?.status === 401 || err.response?.status === 403) {
        if (typeof go === 'function') go('/admin/signin');
        return;
      }
      setError(err.response?.data?.message || err.message || 'Failed to load reviews.');
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, debouncedSearch, activeTab, ratingFilter, productFilter, dateFilter, go]);

  /* =======================================================
     FETCH STATS & TAB COUNTS
  ======================================================= */

  const fetchStats = useCallback(async () => {
    try {
      const res = await adminApi.getReviewStats();
      if (res && res.data) {
        const payload = res.data.data || res.data;
        if (payload.stats) {
          setStats(payload.stats);
        }
        if (payload.counts) {
          setCounts(payload.counts);
        }
      }
    } catch (err) {
      console.warn('Unable to load review statistics:', err);
    }
  }, []);

  useEffect(() => {
    fetchReviews();
  }, [fetchReviews]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  /* =======================================================
     CLOSE FILTERS OUTSIDE TOOLBAR
  ======================================================= */

  useEffect(() => {
    const handleOutsideClick = (event) => {
      if (
        toolbarRef.current &&
        !toolbarRef.current.contains(
          event.target,
        )
      ) {
        setOpenFilter(null);
      }
    };

    const handleEscape = (event) => {
      if (event.key === 'Escape') {
        setOpenFilter(null);
        setOpenMenu(null);
        setReplyModalReview(null);
        setViewModalReview(null);
        setRejectModalReview(null);
        setConfirmDeleteReviewId(null);
      }
    };

    document.addEventListener(
      'mousedown',
      handleOutsideClick,
    );

    document.addEventListener(
      'keydown',
      handleEscape,
    );

    return () => {
      document.removeEventListener(
        'mousedown',
        handleOutsideClick,
      );

      document.removeEventListener(
        'keydown',
        handleEscape,
      );
    };
  }, []);

  /* =======================================================
     FILTER OPTIONS
  ======================================================= */

  const ratingOptions = [
    {
      value: 'All ratings',
      label: 'All ratings',
      buttonLabel: 'Rating',
    },
    {
      value: '5',
      label: '5 stars',
      buttonLabel: '5 stars',
    },
    {
      value: '4',
      label: '4 stars',
      buttonLabel: '4 stars',
    },
    {
      value: '3',
      label: '3 stars',
      buttonLabel: '3 stars',
    },
    {
      value: '2',
      label: '2 stars',
      buttonLabel: '2 stars',
    },
    {
      value: '1',
      label: '1 star',
      buttonLabel: '1 star',
    },
  ];

  const productOptions = useMemo(() => {
    return [
      {
        value: 'All products',
        label: 'All products',
        buttonLabel: 'Product',
      },
      ...availableProducts.map((product) => ({
        value: product,
        label: product,
        buttonLabel: product,
      })),
    ];
  }, [availableProducts]);

  const dateOptions = [
    {
      value: 'All dates',
      label: 'All dates',
      buttonLabel: 'Date',
    },
    {
      value: 'Last 7 days',
      label: 'Last 7 days',
      buttonLabel: 'Last 7 days',
    },
    {
      value: 'Last 14 days',
      label: 'Last 14 days',
      buttonLabel: 'Last 14 days',
    },
    {
      value: 'Last 30 days',
      label: 'Last 30 days',
      buttonLabel: 'Last 30 days',
    },
    {
      value: 'Older than 30 days',
      label: 'Older than 30 days',
      buttonLabel: 'Older than 30 days',
    },
  ];

  /* =======================================================
     FILTER HANDLERS
  ======================================================= */

  const toggleFilter = useCallback(
    (filterName) => {
      setOpenFilter((current) =>
        current === filterName
          ? null
          : filterName,
      );
      setOpenMenu(null);
    },
    [],
  );

  const handleRatingSelect = useCallback(
    (value) => {
      setRatingFilter(String(value));
      setSelected([]);
      setOpenFilter(null);
      setPage(1);
    },
    [],
  );

  const handleProductSelect = useCallback(
    (value) => {
      setProductFilter(String(value));
      setSelected([]);
      setOpenFilter(null);
      setPage(1);
    },
    [],
  );

  const handleDateSelect = useCallback(
    (value) => {
      setDateFilter(String(value));
      setSelected([]);
      setOpenFilter(null);
      setPage(1);
    },
    [],
  );

  const resetFilters = useCallback(() => {
    setRatingFilter('All ratings');
    setProductFilter('All products');
    setDateFilter('All dates');
    setSearch('');
    setSelected([]);
    setOpenFilter(null);
    setPage(1);
  }, []);

  /* =======================================================
     SELECTION
  ======================================================= */

  const selectedVisibleIds =
    reviews
      .filter((review) =>
        selected.includes(review.id),
      )
      .map((review) => review.id);

  const allVisibleSelected =
    reviews.length > 0 &&
    selectedVisibleIds.length ===
      reviews.length;

  const toggleSelectAll = () => {
    if (allVisibleSelected) {
      setSelected((current) =>
        current.filter(
          (id) =>
            !reviews.some(
              (review) =>
                review.id === id,
            ),
        ),
      );
      return;
    }

    setSelected((current) => [
      ...new Set([
        ...current,
        ...reviews.map(
          (review) => review.id,
        ),
      ]),
    ]);
  };

  const toggleSelect = (id) => {
    setSelected((current) =>
      current.includes(id)
        ? current.filter(
            (item) => item !== id,
          )
        : [...current, id],
    );
  };

  /* =======================================================
     REVIEW STATUS (APPROVE / REJECT)
  ======================================================= */

  const updateReviewStatus = async (
    id,
    status,
    reason = '',
  ) => {
    try {
      await adminApi.updateReviewStatus(id, status, reason);

      setReviews((current) =>
        current.map((review) =>
          review.id === id
            ? {
                ...review,
                status,
                rejectionReason: reason,
              }
            : review,
        ),
      );

      setOpenMenu(null);
      setRejectModalReview(null);

      const message =
        status === 'approved'
          ? 'Review approved.'
          : status === 'rejected'
            ? 'Review rejected.'
            : 'Review moved to pending.';

      showNotice(message);
      fetchStats();
    } catch (err) {
      showNotice(err.response?.data?.message || err.message || 'Failed to update review status.');
    }
  };

  /* =======================================================
     FEATURED STAR TOGGLE
  ======================================================= */

  const handleToggleStar = async (review) => {
    try {
      const res = await adminApi.toggleStarReview(review.id);
      const isStarred = res.data?.data?.starred ?? !review.starred;

      setReviews((current) =>
        current.map((item) =>
          item.id === review.id
            ? { ...item, starred: isStarred }
            : item,
        ),
      );

      showNotice(isStarred ? 'Review starred as featured.' : 'Review unstarred.');
    } catch (err) {
      showNotice(err.response?.data?.message || err.message || 'Failed to toggle star.');
    }
  };

  /* =======================================================
     DELETE REVIEW
  ======================================================= */

  const deleteReview = async (id) => {
    try {
      await adminApi.deleteReview(id);

      setReviews((current) =>
        current.filter(
          (review) =>
            review.id !== id,
        ),
      );

      setSelected((current) =>
        current.filter(
          (item) => item !== id,
        ),
      );

      setOpenMenu(null);
      setConfirmDeleteReviewId(null);

      showNotice('Review deleted.');
      fetchStats();
    } catch (err) {
      showNotice(err.response?.data?.message || err.message || 'Failed to delete review.');
    }
  };

  /* =======================================================
     BULK UPDATE
  ======================================================= */

  const bulkUpdate = async (status) => {
    if (!selected.length) return;

    try {
      await adminApi.bulkUpdateReviews(selected, status);

      setReviews((current) =>
        current.map((review) =>
          selected.includes(review.id)
            ? {
                ...review,
                status,
              }
            : review,
        ),
      );

      setSelected([]);

      showNotice(
        status === 'approved'
          ? 'Selected reviews approved.'
          : 'Selected reviews rejected.',
      );
      fetchStats();
    } catch (err) {
      showNotice(err.response?.data?.message || err.message || 'Bulk update failed.');
    }
  };

  /* =======================================================
     BULK DELETE
  ======================================================= */

  const bulkDelete = async () => {
    if (!selected.length) return;

    if (!window.confirm(`Are you sure you want to delete ${selected.length} selected review(s)?`)) {
      return;
    }

    try {
      await adminApi.bulkUpdateReviews(selected, 'delete');

      setReviews((current) =>
        current.filter(
          (review) =>
            !selected.includes(
              review.id,
            ),
        ),
      );

      setSelected([]);

      showNotice(
        'Selected reviews deleted.',
      );
      fetchStats();
    } catch (err) {
      showNotice(err.response?.data?.message || err.message || 'Bulk delete failed.');
    }
  };

  /* =======================================================
     EXPORT REVIEWS (CSV)
  ======================================================= */

  const exportReviews = async () => {
    try {
      showNotice('Generating CSV export…');

      const params = {
        search: debouncedSearch.trim() || undefined,
        status: activeTab !== 'all' ? activeTab : undefined,
        rating: ratingFilter !== 'All ratings' ? ratingFilter : undefined,
        product: productFilter !== 'All products' ? productFilter : undefined,
        dateRange: dateFilter !== 'All dates' ? dateFilter : undefined,
      };

      const res = await adminApi.exportReviews(params);

      const blob = new Blob([res.data], {
        type: 'text/csv;charset=utf-8;',
      });

      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = 'novashop-reviews.csv';
      anchor.click();
      URL.revokeObjectURL(url);

      showNotice('Reviews exported.');
    } catch (err) {
      showNotice(err.response?.data?.message || err.message || 'Failed to export reviews.');
    }
  };

  /* =======================================================
     REPLY SUBMISSION
  ======================================================= */

  const handleOpenReplyModal = (review) => {
    setOpenMenu(null);
    setReplyModalReview(review);
    setReplyText(review.adminReply?.text || '');
  };

  const handleSaveReply = async () => {
    if (!replyModalReview) return;
    if (!replyText.trim()) {
      showNotice('Please write a reply before submitting.');
      return;
    }

    setIsSubmittingReply(true);
    try {
      const res = await adminApi.replyToReview(replyModalReview.id, replyText.trim());
      const replyData = res.data?.data?.adminReply || { text: replyText.trim(), repliedAt: new Date() };

      setReviews((current) =>
        current.map((r) =>
          r.id === replyModalReview.id
            ? { ...r, adminReply: replyData }
            : r,
        ),
      );

      setReplyModalReview(null);
      setReplyText('');
      showNotice(`Reply sent to ${replyModalReview.customer}.`);
      fetchStats();
    } catch (err) {
      showNotice(err.response?.data?.message || err.message || 'Failed to post reply.');
    } finally {
      setIsSubmittingReply(false);
    }
  };

  const handleDeleteReply = async (review) => {
    try {
      await adminApi.deleteReviewReply(review.id);
      setReviews((current) =>
        current.map((r) =>
          r.id === review.id
            ? { ...r, adminReply: { text: '', repliedAt: null } }
            : r,
        ),
      );
      setReplyModalReview(null);
      showNotice('Reply removed.');
      fetchStats();
    } catch (err) {
      showNotice(err.response?.data?.message || err.message || 'Failed to delete reply.');
    }
  };

  /* =======================================================
     ROW MENU ACTIONS
  ======================================================= */

  const handleViewReview = (review) => {
    setOpenMenu(null);
    setViewModalReview(review);
  };

  const handleViewProduct = (review) => {
    setMenuTarget(null);
    setOpenMenu(null);
    const targetProd = review.productId || review.product;
    if (go && targetProd) {
      go(`/admin/products?product=${encodeURIComponent(targetProd)}`);
      return;
    }
    showNotice(`Opening ${review.product}.`);
  };

  const handleViewCustomer = (review) => {
    setMenuTarget(null);
    setOpenMenu(null);
    const targetCust = review.customerId || review.userId;
    if (go && targetCust) {
      go(`/admin/customers?customer=${encodeURIComponent(targetCust)}`);
      return;
    }
    showNotice(`Opening ${review.customer}.`);
  };

  /* =======================================================
     STATUS TAB
  ======================================================= */

  const setTab = (tab) => {
    setActiveTab(tab);
    setSelected([]);
    setOpenMenu(null);
    setOpenFilter(null);
    setPage(1);
  };

  /* =======================================================
     ACTIVE FILTER COUNT
  ======================================================= */

  const activeFilterCount =
    [
      ratingFilter !== 'All ratings',
      productFilter !== 'All products',
      dateFilter !== 'All dates',
    ].filter(Boolean).length;

  /* =======================================================
     PAGINATION CALCULATIONS
  ======================================================= */

  const parsedPageSize = parseInt(pageSize, 10) || 10;
  const startItem = totalCount === 0 ? 0 : (page - 1) * parsedPageSize + 1;
  const endItem = Math.min(page * parsedPageSize, totalCount);

  /* =======================================================
     RENDER
  ======================================================= */

  return (
    <div className="admin-dashboard admin-reviews-page">

      {/* ===================================================
          PAGE HEADER
      =================================================== */}

      <section className="reviews-page-heading">
        <div>
          <h1 className="admin-page-title">
            Reviews
          </h1>

          <p className="admin-page-description">
            Moderate and respond to customer reviews.
          </p>
        </div>

        <button
          type="button"
          className="reviews-export-button"
          onClick={exportReviews}
        >
          <AdminIcon
            name="download"
            size={14}
          />
          Export
        </button>
      </section>

      {/* ===================================================
          STATISTICS
      =================================================== */}

      <section className="reviews-period-label">
        LAST 30 DAYS
      </section>

      <section className="reviews-stats-grid">
        <StatCard
          label="Total reviews"
          value={Number(stats.totalReviews || 0).toLocaleString()}
          change={stats.totalReviewsChange || '-'}
        />

        <StatCard
          label="Average rating"
          value={stats.averageRating || '5.0'}
          change={stats.averageRatingChange || '-'}
        />

        <StatCard
          label="Pending review"
          value={stats.pendingReviews || 0}
          change={stats.pendingReviewsChange || '-'}
          changeTone="warning"
        />

        <StatCard
          label="Reply rate"
          value={stats.replyRate || '0%'}
          change={stats.replyRateChange || '-'}
        />
      </section>

      {/* ===================================================
          FILTER TOOLBAR
      =================================================== */}

      <section
        ref={toolbarRef}
        className="reviews-toolbar reviews-toolbar-with-dropdowns"
      >

        {/* SEARCH */}

        <label className="reviews-search">
          <AdminIcon
            name="search"
            size={15}
          />

          <input
            type="search"
            value={search}
            placeholder="Search by review, product, or customer"
            onChange={(event) => {
              setSearch(
                event.target.value,
              );
              setSelected([]);
            }}
          />
        </label>

        {/* FILTERS */}

        <div className="reviews-filter-group">

          {/* RATING */}

          <FilterDropdown
            value={ratingFilter}
            options={ratingOptions}
            label="Rating"
            isOpen={
              openFilter === 'rating'
            }
            onToggle={() =>
              toggleFilter(
                'rating',
              )
            }
            onChange={
              handleRatingSelect
            }
          />

          {/* PRODUCT */}

          <FilterDropdown
            value={productFilter}
            options={productOptions}
            label="Product"
            isOpen={
              openFilter === 'product'
            }
            onToggle={() =>
              toggleFilter(
                'product',
              )
            }
            onChange={
              handleProductSelect
            }
          />

          {/* DATE */}

          <FilterDropdown
            value={dateFilter}
            options={dateOptions}
            label="Date"
            isOpen={
              openFilter === 'date'
            }
            onToggle={() =>
              toggleFilter(
                'date',
              )
            }
            onChange={
              handleDateSelect
            }
          />

        </div>

      </section>

      {/* ===================================================
          STATUS TABS
      =================================================== */}

      <div className="reviews-tabs">

        <button
          type="button"
          className={
            activeTab === 'all'
              ? 'is-active'
              : ''
          }
          onClick={() =>
            setTab('all')
          }
        >
          All
        </button>

        <button
          type="button"
          className={
            activeTab === 'pending'
              ? 'is-active'
              : ''
          }
          onClick={() =>
            setTab('pending')
          }
        >
          <i className="is-pending" />
          Pending
          <span className="reviews-tab-count">
            {counts.pending}
          </span>
        </button>

        <button
          type="button"
          className={
            activeTab === 'approved'
              ? 'is-active'
              : ''
          }
          onClick={() =>
            setTab('approved')
          }
        >
          <i className="is-approved" />
          Approved
        </button>

        <button
          type="button"
          className={
            activeTab === 'rejected'
              ? 'is-active'
              : ''
          }
          onClick={() =>
            setTab('rejected')
          }
        >
          <i className="is-rejected" />
          Rejected
        </button>

      </div>

      {/* ===================================================
          RESULTS SUMMARY
      =================================================== */}

      {(search ||
        activeFilterCount > 0 ||
        activeTab !== 'all') && (
        <div className="reviews-results-summary">
          Showing{' '}
          <strong>
            {reviews.length}
          </strong>{' '}
          matching review
          {reviews.length === 1
            ? ''
            : 's'}
        </div>
      )}

      {/* ===================================================
          REVIEW TABLE
      =================================================== */}

      <section className="reviews-table-card">

        <div className="reviews-table-scroll">

          <table className="reviews-table">

            <thead>
              <tr>

                <th className="reviews-check-column">
                  <label className="reviews-checkbox">

                    <input
                      type="checkbox"
                      checked={
                        allVisibleSelected
                      }
                      onChange={
                        toggleSelectAll
                      }
                      aria-label="Select all reviews"
                    />

                    <span />

                  </label>
                </th>

                <th className="reviews-rating-column">
                  Rating
                </th>

                <th className="reviews-review-column">
                  Review
                </th>

                <th className="reviews-product-column">
                  Product
                </th>

                <th className="reviews-customer-column">
                  Customer
                </th>

                <th className="reviews-date-column">
                  Date
                </th>

                <th className="reviews-status-column">
                  Status
                </th>

                <th className="reviews-menu-column">
                  Action
                </th>

              </tr>
            </thead>

            <tbody>

              {loading ? (
                // SKELETON LOADING STATE
                [1, 2, 3, 4, 5].map((skeletonId) => (
                  <tr key={skeletonId} className="reviews-loading-row">
                    <td className="reviews-check-column">
                      <div style={{ width: 16, height: 16, background: '#EAE6DF', borderRadius: 4 }} />
                    </td>
                    <td className="reviews-rating-column">
                      <div style={{ width: 70, height: 14, background: '#EAE6DF', borderRadius: 3 }} />
                    </td>
                    <td className="reviews-review-column">
                      <div style={{ display: 'grid', gap: 6 }}>
                        <div style={{ width: '60%', height: 14, background: '#EAE6DF', borderRadius: 3 }} />
                        <div style={{ width: '90%', height: 12, background: '#F2EFEB', borderRadius: 3 }} />
                      </div>
                    </td>
                    <td className="reviews-product-column">
                      <div style={{ width: 110, height: 14, background: '#EAE6DF', borderRadius: 3 }} />
                    </td>
                    <td className="reviews-customer-column">
                      <div style={{ width: 90, height: 14, background: '#EAE6DF', borderRadius: 3 }} />
                    </td>
                    <td className="reviews-date-column">
                      <div style={{ width: 75, height: 14, background: '#EAE6DF', borderRadius: 3 }} />
                    </td>
                    <td className="reviews-status-column">
                      <div style={{ width: 65, height: 20, background: '#EAE6DF', borderRadius: 10 }} />
                    </td>
                    <td className="reviews-menu-column">
                      <div style={{ width: 24, height: 24, background: '#EAE6DF', borderRadius: 4 }} />
                    </td>
                  </tr>
                ))
              ) : error ? (
                <tr>
                  <td colSpan="8" className="reviews-empty">
                    <div>
                      <AdminIcon name="searchSlash" size={22} />
                      <strong>Error loading reviews</strong>
                      <span>{error}</span>
                      <button type="button" onClick={fetchReviews}>
                        Retry
                      </button>
                    </div>
                  </td>
                </tr>
              ) : reviews.length === 0 ? (
                <tr>

                  <td
                    colSpan="8"
                    className="reviews-empty"
                  >

                    <div>

                      <AdminIcon
                        name="searchSlash"
                        size={22}
                      />

                      <strong>
                        No reviews found
                      </strong>

                      <span>
                        Try changing your
                        search or filters.
                      </span>

                      <button
                        type="button"
                        onClick={
                          resetFilters
                        }
                      >
                        Clear filters
                      </button>

                    </div>

                  </td>

                </tr>
              ) : (

                reviews.map(
                  (review) => (
                    <tr
                      key={review.id}
                      className={
                        selected.includes(
                          review.id,
                        )
                          ? 'is-selected'
                          : ''
                      }
                    >

                      {/* SELECT */}

                      <td className="reviews-check-column">

                        <div className="reviews-row-select">

                          <label className="reviews-checkbox">

                            <input
                              type="checkbox"
                              checked={selected.includes(
                                review.id,
                              )}
                              onChange={() =>
                                toggleSelect(
                                  review.id,
                                )
                              }
                              aria-label={`Select ${review.title}`}
                            />

                            <span />

                          </label>

                          <button
                            type="button"
                            className={`reviews-star-button${
                              review.starred
                                ? ' is-starred'
                                : ''
                            }`}
                            onClick={() =>
                              handleToggleStar(review)
                            }
                            aria-label={
                              review.starred
                                ? 'Remove from starred'
                                : 'Star review'
                            }
                          >
                            ★
                          </button>

                        </div>

                      </td>

                      {/* RATING */}

                      <td className="reviews-rating-column">
                        <StarRating
                          rating={
                            review.rating
                          }
                        />
                      </td>

                      {/* REVIEW */}

                      <td className="reviews-review-column">

                        <div className="reviews-review-content">

                          <strong>
                            {review.title}
                          </strong>

                          <span>
                            {review.body}
                          </span>

                          {review.adminReply?.text && (
                            <span style={{ marginTop: 4, display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11, color: '#2B5E43' }}>
                              <AdminIcon name="check" size={11} /> Replied by concierge
                            </span>
                          )}

                        </div>

                      </td>

                      {/* PRODUCT */}

                      <td className="reviews-product-column">

                        <div className="reviews-product-cell">

                          <span className="reviews-product-icon">

                            <AdminIcon
                              name={
                                review.productIcon || 'package'
                              }
                              size={15}
                            />

                          </span>

                          <strong>
                            {review.product}
                          </strong>

                        </div>

                      </td>

                      {/* CUSTOMER */}

                      <td className="reviews-customer-column">

                        <div className="reviews-customer-cell">

                          <strong>
                            {review.customer}
                          </strong>

                          <span>
                            {review.verified
                              ? 'Verified purchase'
                              : 'Not verified'}
                          </span>

                        </div>

                      </td>

                      {/* DATE */}

                      <td className="reviews-date-column">

                        <div className="reviews-date-cell">

                          <strong>
                            {review.date}
                          </strong>

                          <span>
                            {review.age}
                          </span>

                        </div>

                      </td>

                      {/* STATUS */}

                      <td className="reviews-status-column">

                        <StatusBadge
                          status={
                            review.status
                          }
                        />

                      </td>

                      {/* ACTION */}

                      <td className="reviews-menu-column">

                        <div className="reviews-row-menu">
                          <button
                            type="button"
                            className="reviews-more-button"
                            onClick={(e) => {
                              e.stopPropagation();
                              const btn = e.currentTarget;
                              setMenuTarget({ review, triggerRef: { current: btn } });
                            }}
                            aria-label={`Actions for ${review.title}`}
                          >
                            <AdminIcon
                              name="more"
                              size={16}
                            />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ),
                )
              )}

            </tbody>

          </table>

        </div>

        {/* =================================================
            PAGINATION
        ================================================= */}

        <footer className="reviews-table-footer">

          <span>
            Showing {startItem}–{endItem} of {Number(totalCount).toLocaleString()} reviews
          </span>

          <div className="reviews-pagination">

            <label className="reviews-per-page">

              <select
                value={pageSize}
                onChange={(e) => {
                  setPageSize(e.target.value);
                  setPage(1);
                }}
              >

                <option value="10">
                  10 per page
                </option>

                <option value="25">
                  25 per page
                </option>

                <option value="50">
                  50 per page
                </option>

              </select>

              <AdminIcon
                name="chevron"
                size={12}
              />

            </label>

            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              Previous
            </button>

            {Array.from({ length: Math.min(pages, 5) }).map((_, i) => {
              const pNum = i + 1;
              return (
                <button
                  key={pNum}
                  type="button"
                  className={page === pNum ? 'is-current' : ''}
                  onClick={() => setPage(pNum)}
                >
                  {pNum}
                </button>
              );
            })}

            {pages > 5 && (
              <>
                <span>...</span>
                <button
                  type="button"
                  className={page === pages ? 'is-current' : ''}
                  onClick={() => setPage(pages)}
                >
                  {pages}
                </button>
              </>
            )}

            <button
              type="button"
              disabled={page >= pages}
              onClick={() => setPage((p) => Math.min(pages, p + 1))}
            >
              Next
            </button>

          </div>

        </footer>

      </section>

      {/* ===================================================
          BULK ACTION BAR
      =================================================== */}

      {selected.length > 0 && (
        <div className="reviews-bulk-bar">

          <strong>
            {selected.length} selected
          </strong>

          <div className="reviews-bulk-divider" />

          <button
            type="button"
            onClick={() =>
              bulkUpdate('approved')
            }
          >
            <AdminIcon
              name="check"
              size={14}
            />
            Approve
          </button>

          <button
            type="button"
            onClick={() =>
              bulkUpdate('rejected')
            }
          >
            <AdminIcon
              name="stop"
              size={14}
            />
            Reject
          </button>

          <button
            type="button"
            onClick={exportReviews}
          >
            <AdminIcon
              name="download"
              size={14}
            />
            Export
          </button>

          <button
            type="button"
            className="is-danger"
            onClick={bulkDelete}
          >
            <AdminIcon
              name="trash"
              size={14}
            />
            Delete
          </button>

          <div className="reviews-bulk-divider" />

          <button
            type="button"
            className="reviews-bulk-close"
            onClick={() =>
              setSelected([])
            }
            aria-label="Clear selection"
          >
            <AdminIcon
              name="close"
              size={15}
            />
          </button>

        </div>
      )}

      {/* Universal Portal Row Action Menu */}
      <AdminRowActionMenu
        isOpen={Boolean(menuTarget)}
        onClose={() => setMenuTarget(null)}
        triggerRef={menuTarget?.triggerRef}
        header={{
          title: menuTarget?.review?.title,
          subtitle: `${menuTarget?.review?.customer || 'Customer'} · ${menuTarget?.review?.product || 'Product'}`,
        }}
        items={[
          {
            id: 'view',
            label: 'View review details',
            icon: 'eye',
            onClick: () => handleViewReview(menuTarget.review),
          },
          {
            id: 'approve',
            label: 'Approve review',
            icon: 'check',
            hidden: menuTarget?.review?.status === 'approved',
            onClick: () => updateReviewStatus(menuTarget.review.id, 'approved'),
          },
          {
            id: 'reject',
            label: 'Reject review',
            icon: 'stop',
            hidden: menuTarget?.review?.status === 'rejected',
            onClick: () => {
              setRejectModalReview(menuTarget.review);
              setRejectionReason(menuTarget.review.rejectionReason || '');
            },
          },
          {
            id: 'reply',
            label: menuTarget?.review?.adminReply?.text ? 'Edit public reply' : 'Reply to customer',
            icon: 'mail',
            onClick: () => handleOpenReplyModal(menuTarget.review),
          },
          {
            id: 'divider-1',
            isDivider: true,
          },
          {
            id: 'product',
            label: 'View product in catalog',
            icon: 'package',
            onClick: () => handleViewProduct(menuTarget.review),
          },
          {
            id: 'customer',
            label: 'View customer profile',
            icon: 'customers',
            onClick: () => handleViewCustomer(menuTarget.review),
          },
          {
            id: 'divider-2',
            isDivider: true,
          },
          {
            id: 'delete',
            label: 'Delete review',
            icon: 'trash',
            danger: true,
            onClick: () => setConfirmDeleteReviewId(menuTarget.review.id),
          },
        ]}
      />

      {/* ===================================================
          NEW MINIMAL UI MODALS (Matching NovaShop Admin Styles)
      =================================================== */}

      {/* 1. REPLY MODAL */}
      {replyModalReview && (
        <div className="admin-modal-backdrop" onClick={() => setReplyModalReview(null)}>
          <section
            className="admin-order-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="reply-modal-title"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: 480 }}
          >
            <header className="admin-modal-heading">
              <div>
                <span className="admin-modal-eyebrow">Customer Concierge</span>
                <h2 id="reply-modal-title">Reply to {replyModalReview.customer}</h2>
              </div>
              <button
                className="admin-icon-button"
                type="button"
                onClick={() => setReplyModalReview(null)}
                aria-label="Close"
              >
                <AdminIcon name="close" />
              </button>
            </header>

            <div style={{ padding: '0 24px 20px', display: 'grid', gap: 14 }}>
              <div style={{
                background: 'var(--bg-surface-raised)',
                border: '1px solid var(--border-subtle)',
                borderLeft: '3px solid var(--admin-accent, #D4A662)',
                padding: '12px 14px',
                borderRadius: 8,
                fontSize: 13,
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, fontWeight: 600 }}>
                  <span style={{ color: 'var(--text-primary)' }}>{replyModalReview.title}</span>
                  <span style={{ color: '#D4A662' }}>{replyModalReview.rating}★</span>
                </div>
                <div style={{ color: 'var(--text-secondary)', fontSize: 12 }}>"{replyModalReview.body}"</div>
              </div>

              <label style={{ display: 'grid', gap: 6, fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>Your Public Reply</span>
                  <span style={{ fontSize: 11, fontWeight: 400, color: replyText.length > 1500 ? 'var(--color-danger)' : 'var(--text-muted)' }}>
                    {replyText.length} / 1500
                  </span>
                </div>
                <textarea
                  rows={4}
                  maxLength={1500}
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  placeholder="Write a professional, warm reply to this review..."
                  className="reviews-reply-textarea"
                  style={{
                    padding: '10px 12px',
                    border: '1px solid var(--border-default)',
                    borderRadius: 7,
                    fontFamily: 'inherit',
                    fontSize: 13,
                    resize: 'vertical',
                    background: 'var(--bg-input)',
                    color: 'var(--text-primary)',
                    outline: 'none',
                  }}
                />
              </label>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
                {replyModalReview.adminReply?.text ? (
                  <button
                    type="button"
                    onClick={() => handleDeleteReply(replyModalReview)}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: 'var(--color-danger)',
                      fontSize: 12,
                      cursor: 'pointer',
                      padding: 0,
                    }}
                  >
                    Delete reply
                  </button>
                ) : <span />}

                <div style={{ display: 'flex', gap: 10 }}>
                  <button
                    type="button"
                    onClick={() => setReplyModalReview(null)}
                    style={{
                      padding: '8px 16px',
                      background: 'transparent',
                      border: '1px solid var(--border-default)',
                      borderRadius: 6,
                      fontSize: 12,
                      color: 'var(--text-primary)',
                      cursor: 'pointer',
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={isSubmittingReply || !replyText.trim() || replyText.length > 1500}
                    onClick={handleSaveReply}
                    style={{
                      padding: '8px 18px',
                      background: 'var(--admin-primary)',
                      color: 'var(--admin-primary-text, #141210)',
                      border: 'none',
                      borderRadius: 6,
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: (isSubmittingReply || !replyText.trim() || replyText.length > 1500) ? 'not-allowed' : 'pointer',
                      opacity: (isSubmittingReply || !replyText.trim() || replyText.length > 1500) ? 0.6 : 1,
                    }}
                  >
                    {isSubmittingReply ? 'Sending…' : 'Send Reply'}
                  </button>
                </div>
              </div>
            </div>
          </section>
        </div>
      )}

      {/* 2. VIEW REVIEW MODAL */}
      {viewModalReview && (
        <div className="admin-modal-backdrop" onClick={() => setViewModalReview(null)}>
          <section
            className="admin-order-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="view-modal-title"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: 520, background: 'var(--bg-surface)', border: '1px solid var(--border-default)' }}
          >
            <header className="admin-modal-heading">
              <div>
                <span className="admin-modal-eyebrow">Review Details · {viewModalReview.reviewCode}</span>
                <h2 id="view-modal-title" style={{ color: 'var(--text-primary)' }}>{viewModalReview.title}</h2>
              </div>
              <button
                className="admin-icon-button"
                type="button"
                onClick={() => setViewModalReview(null)}
                aria-label="Close"
              >
                <AdminIcon name="close" />
              </button>
            </header>

            <div style={{ padding: '0 24px 24px', display: 'grid', gap: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <StarRating rating={viewModalReview.rating} />
                <StatusBadge status={viewModalReview.status} />
              </div>

              <div style={{ background: 'var(--bg-surface-raised)', border: '1px solid var(--border-subtle)', padding: 14, borderRadius: 8 }}>
                <p style={{ margin: 0, fontSize: 14, lineHeight: 1.6, color: 'var(--text-primary)' }}>
                  {viewModalReview.body}
                </p>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, fontSize: 12 }}>
                <div>
                  <span style={{ color: 'var(--text-muted)' }}>Product</span>
                  <div style={{ fontWeight: 600, marginTop: 2, color: 'var(--text-primary)' }}>{viewModalReview.product}</div>
                </div>
                <div>
                  <span style={{ color: 'var(--text-muted)' }}>Customer</span>
                  <div style={{ fontWeight: 600, marginTop: 2, color: 'var(--text-primary)' }}>
                    {viewModalReview.customer} ({viewModalReview.verified ? 'Verified' : 'Not verified'})
                  </div>
                </div>
                <div>
                  <span style={{ color: 'var(--text-muted)' }}>Order</span>
                  <div style={{ fontWeight: 600, marginTop: 2, color: 'var(--text-primary)' }}>{viewModalReview.order}</div>
                </div>
                <div>
                  <span style={{ color: 'var(--text-muted)' }}>Submitted</span>
                  <div style={{ fontWeight: 600, marginTop: 2, color: 'var(--text-primary)' }}>{viewModalReview.date} ({viewModalReview.age})</div>
                </div>
              </div>

              {viewModalReview.adminReply?.text && (
                <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: 12 }}>
                  <span style={{ fontSize: 11, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--color-success)', fontWeight: 600 }}>
                    Concierge Response
                  </span>
                  <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--text-secondary)' }}>
                    {viewModalReview.adminReply.text}
                  </p>
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 8 }}>
                {viewModalReview.status !== 'approved' && (
                  <button
                    type="button"
                    onClick={() => {
                      updateReviewStatus(viewModalReview.id, 'approved');
                      setViewModalReview(null);
                    }}
                    style={{
                      padding: '8px 16px',
                      background: 'var(--color-success)',
                      color: '#FFF',
                      border: 'none',
                      borderRadius: 6,
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    Approve
                  </button>
                )}
                {viewModalReview.status !== 'rejected' && (
                  <button
                    type="button"
                    onClick={() => {
                      setViewModalReview(null);
                      setRejectModalReview(viewModalReview);
                    }}
                    style={{
                      padding: '8px 16px',
                      background: 'var(--color-danger)',
                      color: '#FFF',
                      border: 'none',
                      borderRadius: 6,
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    Reject
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => {
                    setViewModalReview(null);
                    handleOpenReplyModal(viewModalReview);
                  }}
                  style={{
                    padding: '8px 16px',
                    background: 'var(--admin-primary)',
                    color: 'var(--admin-primary-text, #141210)',
                    border: 'none',
                    borderRadius: 6,
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  Reply
                </button>
              </div>
            </div>
          </section>
        </div>
      )}

      {/* 3. REJECT REASON MODAL */}
      {rejectModalReview && (
        <div className="admin-modal-backdrop" onClick={() => setRejectModalReview(null)}>
          <section
            className="admin-order-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="reject-modal-title"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: 440, background: 'var(--bg-surface)', border: '1px solid var(--border-default)' }}
          >
            <header className="admin-modal-heading">
              <div>
                <span className="admin-modal-eyebrow">Moderation Action</span>
                <h2 id="reject-modal-title" style={{ color: 'var(--text-primary)' }}>Reject Review</h2>
              </div>
              <button
                className="admin-icon-button"
                type="button"
                onClick={() => setRejectModalReview(null)}
                aria-label="Close"
              >
                <AdminIcon name="close" />
              </button>
            </header>

            <div style={{ padding: '0 24px 20px', display: 'grid', gap: 14 }}>
              <p style={{ margin: 0, fontSize: 13, color: 'var(--text-secondary)' }}>
                Reject review by <strong>{rejectModalReview.customer}</strong>. You may provide an optional reason to be shared in the customer notification.
              </p>

              <label style={{ display: 'grid', gap: 6, fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>
                Rejection Reason (Optional)
                <input
                  type="text"
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  placeholder="e.g. Inappropriate language, unrelated content..."
                  style={{
                    padding: '9px 12px',
                    border: '1px solid var(--border-default)',
                    borderRadius: 6,
                    fontFamily: 'inherit',
                    fontSize: 13,
                    background: 'var(--bg-input)',
                    color: 'var(--text-primary)',
                    outline: 'none',
                  }}
                />
              </label>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 6 }}>
                <button
                  type="button"
                  onClick={() => setRejectModalReview(null)}
                  style={{
                    padding: '8px 16px',
                    background: 'transparent',
                    border: '1px solid var(--border-default)',
                    borderRadius: 6,
                    fontSize: 12,
                    color: 'var(--text-primary)',
                    cursor: 'pointer',
                  }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => updateReviewStatus(rejectModalReview.id, 'rejected', rejectionReason)}
                  style={{
                    padding: '8px 18px',
                    background: 'var(--color-danger)',
                    color: '#FFFFFF',
                    border: 'none',
                    borderRadius: 6,
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  Confirm Rejection
                </button>
              </div>
            </div>
          </section>
        </div>
      )}

      {/* 4. CONFIRM DELETE DIALOG */}
      {confirmDeleteReviewId && (
        <div className="admin-modal-backdrop" onClick={() => setConfirmDeleteReviewId(null)}>
          <section
            className="admin-order-modal"
            role="dialog"
            aria-modal="true"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: 400 }}
          >
            <header className="admin-modal-heading">
              <div>
                <span className="admin-modal-eyebrow">Confirm Deletion</span>
                <h2>Delete this review?</h2>
              </div>
              <button
                className="admin-icon-button"
                type="button"
                onClick={() => setConfirmDeleteReviewId(null)}
                aria-label="Close"
              >
                <AdminIcon name="close" />
              </button>
            </header>
            <div style={{ padding: '0 24px 20px', display: 'grid', gap: 14 }}>
              <p style={{ margin: 0, fontSize: 13, color: '#685F5B' }}>
                This review will be removed from your catalog and product rating aggregates will be recalculated automatically.
              </p>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 6 }}>
                <button
                  type="button"
                  onClick={() => setConfirmDeleteReviewId(null)}
                  style={{
                    padding: '8px 16px',
                    background: '#F0ECE4',
                    border: 'none',
                    borderRadius: 6,
                    fontSize: 12,
                    cursor: 'pointer',
                  }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => deleteReview(confirmDeleteReviewId)}
                  style={{
                    padding: '8px 18px',
                    background: '#B83227',
                    color: '#FFF',
                    border: 'none',
                    borderRadius: 6,
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  Delete
                </button>
              </div>
            </div>
          </section>
        </div>
      )}

      {/* ===================================================
          TOAST
      =================================================== */}

      {notice && (
        <div
          className="admin-toast reviews-toast"
          role="status"
        >
          <span className="reviews-toast-dot" />
          {notice}
        </div>
      )}

    </div>
  );
}
