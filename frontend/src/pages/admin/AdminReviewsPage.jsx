import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import { AdminIcon } from '../../components/admin/AdminLayout';
import './admin-reviews.css';

/* =========================================================
   INITIAL REVIEWS
========================================================= */

const INITIAL_REVIEWS = [
  {
    id: 1,
    rating: 5,
    title: 'Beautiful quality',
    body: 'The cashmere is incredibly soft and the fit is perfect.',
    product: 'Cashmere Overcoat',
    productIcon: 'package',
    customer: 'Sarah Mitchell',
    date: 'Sep 29, 2026',
    age: '2 days ago',
    verified: true,
    status: 'approved',
    order: '#NS-10482',
    reviewCode: 'REV-2041',
    starred: false,
  },
  {
    id: 2,
    rating: 4,
    title: 'Runs slightly small',
    body: 'Lovely fabric, but I would size up next time.',
    product: 'Silk Slip Dress',
    productIcon: 'inventory',
    customer: 'Amelia Chen',
    date: 'Sep 28, 2026',
    age: '3 days ago',
    verified: true,
    status: 'pending',
    order: '#NS-10476',
    reviewCode: 'REV-2040',
    starred: false,
  },
  {
    id: 3,
    rating: 5,
    title: 'Worth every penny',
    body: 'Sturdy leather and a great size for daily use.',
    product: 'Leather Tote Bag',
    productIcon: 'package',
    customer: 'James Okafor',
    date: 'Sep 26, 2026',
    age: '5 days ago',
    verified: true,
    status: 'approved',
    order: '#NS-10461',
    reviewCode: 'REV-2039',
    starred: true,
  },
  {
    id: 4,
    rating: 2,
    title: 'Pilling after two weeks',
    body: 'It started pilling much sooner than I expected.',
    product: 'Merino Wool Sweater',
    productIcon: 'package',
    customer: 'Lucas Meyer',
    date: 'Sep 25, 2026',
    age: '6 days ago',
    verified: true,
    status: 'approved',
    order: '#NS-10458',
    reviewCode: 'REV-2038',
    starred: false,
  },
  {
    id: 5,
    rating: 3,
    title: 'Arrived damaged',
    body: 'The box was crushed and the scarf had a snag.',
    product: 'Silk Scarf',
    productIcon: 'package',
    customer: 'Priya Raman',
    date: 'Sep 22, 2026',
    age: '1 week ago',
    verified: true,
    status: 'pending',
    order: '#NS-10441',
    reviewCode: 'REV-2037',
    starred: false,
  },
  {
    id: 6,
    rating: 5,
    title: 'Comfortable from day one',
    body: 'No break-in needed and the suede feels great.',
    product: 'Suede Chelsea Boots',
    productIcon: 'package',
    customer: 'Sofia Rossi',
    date: 'Sep 18, 2026',
    age: '2 weeks ago',
    verified: true,
    status: 'approved',
    order: '#NS-10424',
    reviewCode: 'REV-2036',
    starred: false,
  },
  {
    id: 7,
    rating: 2,
    title: 'Good but pricey',
    body: 'Nice cut, though I expected a heavier fabric.',
    product: 'Tailored Wool Trousers',
    productIcon: 'inventory',
    customer: 'Daniel Kim',
    date: 'Sep 15, 2026',
    age: '2 weeks ago',
    verified: false,
    status: 'rejected',
    order: '#NS-10402',
    reviewCode: 'REV-2035',
    starred: false,
  },
  {
    id: 8,
    rating: 5,
    title: 'Beautifully made',
    body: 'Excellent construction and beautiful materials.',
    product: 'Cashmere Overcoat',
    productIcon: 'package',
    customer: 'Noah Williams',
    date: 'Sep 12, 2026',
    age: '3 weeks ago',
    verified: true,
    status: 'approved',
    order: '#NS-10394',
    reviewCode: 'REV-2034',
    starred: false,
  },
  {
    id: 9,
    rating: 4,
    title: 'Lovely texture',
    body: 'Soft, comfortable and looks exactly like the photos.',
    product: 'Merino Wool Sweater',
    productIcon: 'package',
    customer: 'Emma Johnson',
    date: 'Sep 10, 2026',
    age: '3 weeks ago',
    verified: true,
    status: 'pending',
    order: '#NS-10387',
    reviewCode: 'REV-2033',
    starred: false,
  },
  {
    id: 10,
    rating: 5,
    title: 'Perfect everyday bag',
    body: 'Spacious without being bulky. Very happy with it.',
    product: 'Leather Tote Bag',
    productIcon: 'package',
    customer: 'Olivia Brown',
    date: 'Sep 8, 2026',
    age: '4 weeks ago',
    verified: true,
    status: 'approved',
    order: '#NS-10372',
    reviewCode: 'REV-2032',
    starred: false,
  },
];

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
  return (
    <span
      className="reviews-star-rating"
      aria-label={`${rating} out of 5 stars`}
    >
      {[1, 2, 3, 4, 5].map((star) => (
        <span
          key={star}
          className={
            star <= rating ? 'is-filled' : ''
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
    String(value) !== String(options[0].value);

  const selectedOption =
    options.find(
      (option) =>
        String(option.value) === String(value),
    ) || options[0];

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
  const [reviews, setReviews] =
    useState(INITIAL_REVIEWS);

  const [selected, setSelected] =
    useState([]);

  const [search, setSearch] =
    useState('');

  const [activeTab, setActiveTab] =
    useState('all');

  const [ratingFilter, setRatingFilter] =
    useState('All ratings');

  const [productFilter, setProductFilter] =
    useState('All products');

  const [dateFilter, setDateFilter] =
    useState('All dates');

  const [openFilter, setOpenFilter] =
    useState(null);

  const [openMenu, setOpenMenu] =
    useState(null);

  const [notice, setNotice] =
    useState('');

  const toolbarRef = useRef(null);

  /* =======================================================
     STATISTICS
  ======================================================= */

  const totalReviews = 1284;
  const pendingReviews = 18;
  const averageRating = '4.6';
  const replyRate = '72%';

  /* =======================================================
     NOTICE
  ======================================================= */

  const showNotice = useCallback(
    (message) => {
      setNotice(message);

      window.setTimeout(() => {
        setNotice('');
      }, 2200);
    },
    [],
  );

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
    const products = [
      ...new Set(
        reviews.map(
          (review) => review.product,
        ),
      ),
    ].sort();

    return [
      {
        value: 'All products',
        label: 'All products',
        buttonLabel: 'Product',
      },

      ...products.map((product) => ({
        value: product,
        label: product,
        buttonLabel: product,
      })),
    ];
  }, [reviews]);

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
    },
    [],
  );

  const handleProductSelect = useCallback(
    (value) => {
      setProductFilter(String(value));
      setSelected([]);
      setOpenFilter(null);
    },
    [],
  );

  const handleDateSelect = useCallback(
    (value) => {
      setDateFilter(String(value));
      setSelected([]);
      setOpenFilter(null);
    },
    [],
  );

  const resetFilters = useCallback(() => {
    setRatingFilter('All ratings');
    setProductFilter('All products');
    setDateFilter('All dates');
    setSelected([]);
    setOpenFilter(null);
  }, []);

  /* =======================================================
     FILTERED REVIEWS
  ======================================================= */

  const filteredReviews = useMemo(() => {
    const query =
      search.trim().toLowerCase();

    const today = new Date(
      2026,
      9,
      5,
      23,
      59,
      59,
    );

    return reviews.filter((review) => {
      const matchesTab =
        activeTab === 'all' ||
        review.status === activeTab;

      const matchesSearch =
        !query ||
        review.title
          .toLowerCase()
          .includes(query) ||
        review.body
          .toLowerCase()
          .includes(query) ||
        review.product
          .toLowerCase()
          .includes(query) ||
        review.customer
          .toLowerCase()
          .includes(query) ||
        review.order
          .toLowerCase()
          .includes(query);

      const matchesRating =
        ratingFilter === 'All ratings' ||
        String(review.rating) ===
          String(ratingFilter);

      const matchesProduct =
        productFilter === 'All products' ||
        String(review.product) ===
          String(productFilter);

      let matchesDate = true;

      if (dateFilter !== 'All dates') {
        const reviewDate = new Date(
          review.date,
        );

        const normalizedToday =
          new Date(
            today.getFullYear(),
            today.getMonth(),
            today.getDate(),
          );

        const normalizedReviewDate =
          new Date(
            reviewDate.getFullYear(),
            reviewDate.getMonth(),
            reviewDate.getDate(),
          );

        const differenceInDays = Math.floor(
          (normalizedToday -
            normalizedReviewDate) /
            (1000 * 60 * 60 * 24),
        );

        switch (dateFilter) {
          case 'Last 7 days':
            matchesDate =
              differenceInDays >= 0 &&
              differenceInDays <= 7;
            break;

          case 'Last 14 days':
            matchesDate =
              differenceInDays >= 0 &&
              differenceInDays <= 14;
            break;

          case 'Last 30 days':
            matchesDate =
              differenceInDays >= 0 &&
              differenceInDays <= 30;
            break;

          case 'Older than 30 days':
            matchesDate =
              differenceInDays > 30;
            break;

          default:
            matchesDate = true;
        }
      }

      return (
        matchesTab &&
        matchesSearch &&
        matchesRating &&
        matchesProduct &&
        matchesDate
      );
    });
  }, [
    reviews,
    activeTab,
    search,
    ratingFilter,
    productFilter,
    dateFilter,
  ]);

  /* =======================================================
     SELECTION
  ======================================================= */

  const selectedVisibleIds =
    filteredReviews
      .filter((review) =>
        selected.includes(review.id),
      )
      .map((review) => review.id);

  const allVisibleSelected =
    filteredReviews.length > 0 &&
    selectedVisibleIds.length ===
      filteredReviews.length;

  const pendingCount =
    reviews.filter(
      (review) =>
        review.status === 'pending',
    ).length;

  /* =======================================================
     SELECTION HELPERS
  ======================================================= */

  const toggleSelectAll = () => {
    if (allVisibleSelected) {
      setSelected((current) =>
        current.filter(
          (id) =>
            !filteredReviews.some(
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
        ...filteredReviews.map(
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
     REVIEW STATUS
  ======================================================= */

  const updateReviewStatus = (
    id,
    status,
  ) => {
    setReviews((current) =>
      current.map((review) =>
        review.id === id
          ? {
              ...review,
              status,
            }
          : review,
      ),
    );

    setOpenMenu(null);

    const message =
      status === 'approved'
        ? 'Review approved.'
        : status === 'rejected'
          ? 'Review rejected.'
          : 'Review moved to pending.';

    showNotice(message);
  };

  /* =======================================================
     DELETE REVIEW
  ======================================================= */

  const deleteReview = (id) => {
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

    showNotice('Review deleted.');
  };

  /* =======================================================
     BULK UPDATE
  ======================================================= */

  const bulkUpdate = (status) => {
    if (!selected.length) return;

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
  };

  /* =======================================================
     BULK DELETE
  ======================================================= */

  const bulkDelete = () => {
    if (!selected.length) return;

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
  };

  /* =======================================================
     EXPORT
  ======================================================= */

  const exportReviews = () => {
    const rows = filteredReviews.map(
      (review) => ({
        review: review.title,
        rating: review.rating,
        product: review.product,
        customer: review.customer,
        date: review.date,
        status: review.status,
      }),
    );

    const header =
      'Review,Rating,Product,Customer,Date,Status';

    const csv = [
      header,
      ...rows.map((row) =>
        [
          row.review,
          row.rating,
          row.product,
          row.customer,
          row.date,
          row.status,
        ]
          .map(
            (value) =>
              `"${String(
                value,
              ).replaceAll('"', '""')}"`,
          )
          .join(','),
      ),
    ].join('\n');

    const blob = new Blob([csv], {
      type: 'text/csv;charset=utf-8;',
    });

    const url =
      URL.createObjectURL(blob);

    const anchor =
      document.createElement('a');

    anchor.href = url;
    anchor.download =
      'novashop-reviews.csv';

    anchor.click();

    URL.revokeObjectURL(url);

    showNotice('Reviews exported.');
  };

  /* =======================================================
     REVIEW ACTIONS
  ======================================================= */

  const handleReply = (review) => {
    setOpenMenu(null);

    showNotice(
      `Replying to ${review.customer}.`,
    );
  };

  const handleViewReview = (
    review,
  ) => {
    setOpenMenu(null);

    showNotice(
      `Opening ${review.reviewCode}.`,
    );
  };

  const handleViewProduct = (
    review,
  ) => {
    setOpenMenu(null);

    if (go) {
      go('/admin/products');
      return;
    }

    showNotice(
      `Opening ${review.product}.`,
    );
  };

  const handleViewCustomer = (
    review,
  ) => {
    setOpenMenu(null);

    if (go) {
      go('/admin/customers');
      return;
    }

    showNotice(
      `Opening ${review.customer}.`,
    );
  };

  /* =======================================================
     STATUS TAB
  ======================================================= */

  const setTab = (tab) => {
    setActiveTab(tab);
    setSelected([]);
    setOpenMenu(null);
    setOpenFilter(null);
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
          value={totalReviews.toLocaleString()}
          change="+86 this month"
        />

        <StatCard
          label="Average rating"
          value={averageRating}
          change="+0.1"
        />

        <StatCard
          label="Pending review"
          value={pendingReviews}
          change="+5 this week"
          changeTone="warning"
        />

        <StatCard
          label="Reply rate"
          value={replyRate}
          change="+4%"
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
            {pendingCount}
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
            {filteredReviews.length}
          </strong>{' '}
          matching review
          {filteredReviews.length === 1
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

              {filteredReviews.length === 0 ? (
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

                filteredReviews.map(
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
                              setReviews(
                                (current) =>
                                  current.map(
                                    (
                                      item,
                                    ) =>
                                      item.id ===
                                      review.id
                                        ? {
                                            ...item,
                                            starred:
                                              !item.starred,
                                          }
                                        : item,
                                  ),
                              )
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

                        </div>

                      </td>

                      {/* PRODUCT */}

                      <td className="reviews-product-column">

                        <div className="reviews-product-cell">

                          <span className="reviews-product-icon">

                            <AdminIcon
                              name={
                                review.productIcon
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
                            onClick={() => {
                              setOpenFilter(
                                null,
                              );

                              setOpenMenu(
                                (current) =>
                                  current ===
                                  review.id
                                    ? null
                                    : review.id,
                              );
                            }}
                            aria-label={`Actions for ${review.title}`}
                          >

                            <AdminIcon
                              name="more"
                              size={16}
                            />

                          </button>

                          {openMenu ===
                            review.id && (
                            <div className="reviews-action-menu">

                              <button
                                type="button"
                                onClick={() =>
                                  handleViewReview(
                                    review,
                                  )
                                }
                              >
                                <AdminIcon
                                  name="eye"
                                  size={14}
                                />
                                View review
                              </button>

                              <button
                                type="button"
                                onClick={() =>
                                  updateReviewStatus(
                                    review.id,
                                    'approved',
                                  )
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
                                  updateReviewStatus(
                                    review.id,
                                    'rejected',
                                  )
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
                                onClick={() =>
                                  handleReply(
                                    review,
                                  )
                                }
                              >
                                <AdminIcon
                                  name="left"
                                  size={14}
                                />
                                Reply
                              </button>

                              <div className="reviews-menu-divider" />

                              <button
                                type="button"
                                onClick={() =>
                                  handleViewProduct(
                                    review,
                                  )
                                }
                              >
                                <AdminIcon
                                  name="eye"
                                  size={14}
                                />
                                View product
                              </button>

                              <button
                                type="button"
                                onClick={() =>
                                  handleViewCustomer(
                                    review,
                                  )
                                }
                              >
                                <AdminIcon
                                  name="customers"
                                  size={14}
                                />
                                View customer
                              </button>

                              <div className="reviews-menu-divider" />

                              <button
                                type="button"
                                className="is-danger"
                                onClick={() =>
                                  deleteReview(
                                    review.id,
                                  )
                                }
                              >
                                <AdminIcon
                                  name="trash"
                                  size={14}
                                />
                                Delete review
                              </button>

                            </div>
                          )}

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
            Showing 1–
            {Math.min(
              10,
              filteredReviews.length,
            )}{' '}
            of 1,284 reviews
          </span>

          <div className="reviews-pagination">

            <label className="reviews-per-page">

              <select defaultValue="10">

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
              disabled
            >
              Previous
            </button>

            <button
              type="button"
              className="is-current"
            >
              1
            </button>

            <button type="button">
              2
            </button>

            <button type="button">
              3
            </button>

            <span>...</span>

            <button type="button">
              129
            </button>

            <button type="button">
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