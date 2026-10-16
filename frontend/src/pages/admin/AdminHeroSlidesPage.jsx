import { useEffect, useMemo, useRef, useState } from 'react';
import { AdminIcon } from '../../components/admin/AdminLayout';
import './admin-heroslides.css';

/* =========================================================
   MOCK DATA
========================================================= */

const INITIAL_SLIDES = [
  {
    id: 1,
    headline: 'Autumn Collection',
    sub: 'New season colors and silhouettes',
    swatch: '#C9BBA8',
    buttonLabel: 'Shop Outerwear',
    buttonPath: '/categories/outerwear',
    start: 'Sep 01',
    end: 'Dec 31, 2026',
    relative: '91 days left',
    status: 'Active',
    created: 'Created Aug 20, 2026 · 12,480 views · 4.8% click rate',
  },
  {
    id: 2,
    headline: 'Evening Dresses',
    sub: 'Silk and satin dresses for the season',
    swatch: '#8E7B6B',
    buttonLabel: 'Shop Dresses',
    buttonPath: '/categories/dresses',
    start: 'Sep 15',
    end: 'Nov 30, 2026',
    relative: '60 days left',
    status: 'Active',
    created: 'Created Aug 24, 2026 · 9,120 views · 5.1% click rate',
  },
  {
    id: 3,
    headline: 'Free Shipping',
    sub: 'Free shipping on orders over $300',
    swatch: '#D9CBB4',
    buttonLabel: 'Shop Now',
    buttonPath: '/products',
    start: 'Sep 01',
    end: 'Dec 31, 2026',
    relative: '91 days left',
    status: 'Active',
    created: 'Created Aug 20, 2026 · 18,940 views · 6.2% click rate',
  },
  {
    id: 4,
    headline: 'Black Friday',
    sub: 'Up to 30% off storewide',
    swatch: '#3A332B',
    buttonLabel: 'Shop Sale',
    buttonPath: '/discounts/bf30',
    start: 'Nov 27',
    end: 'Nov 30, 2026',
    relative: 'Starts in 57 days',
    status: 'Scheduled',
    created: 'Created Sep 12, 2026 · Not yet live',
  },
  {
    id: 5,
    headline: 'Winter Accessories',
    sub: 'Scarves, bags, and cold-weather layers',
    swatch: '#AFA393',
    buttonLabel: 'Shop Accessories',
    buttonPath: '/categories/accessories',
    start: null,
    end: null,
    relative: 'No schedule',
    status: 'Draft',
    created: 'Created Sep 20, 2026 · Draft, not published',
  },
  {
    id: 6,
    headline: 'Summer Sale',
    sub: '20% off all products',
    swatch: '#B9AA95',
    buttonLabel: 'Shop Sale',
    buttonPath: '/products',
    start: 'Jun 01',
    end: 'Aug 31, 2026',
    relative: 'Ended Aug 31',
    status: 'Expired',
    created: 'Created May 18, 2026 · 24,610 views · 4.3% click rate',
  },
];

const DATE_FILTERS = [
  { key: 'All', label: 'All dates' },
  { key: 'Ending soon', label: 'Ending soon' },
  { key: 'Starting soon', label: 'Starting soon' },
  { key: 'No schedule', label: 'No schedule' },
  { key: 'Already ended', label: 'Already ended' },
];

function matchesDateFilter(slide, dateFilter) {
  if (dateFilter === 'All') return true;
  if (dateFilter === 'Ending soon') return slide.relative.includes('days left');
  if (dateFilter === 'Starting soon') return slide.relative.includes('Starts in');
  if (dateFilter === 'No schedule') return slide.relative === 'No schedule';
  if (dateFilter === 'Already ended') return slide.relative.startsWith('Ended');
  return true;
}

function SlideStatus({ status }) {
  return (
    <span className={`hs-status-pill ${status.toLowerCase()}`}>
      {status !== 'Draft' && <i />}
      {status}
    </span>
  );
}

/* =========================================================
   DATE FILTER DROPDOWN
========================================================= */

function DateDropdown({ value, isOpen, onToggle, onChange }) {
  const activeLabel = DATE_FILTERS.find((item) => item.key === value)?.label ?? 'Dates';
  const isActive = value !== 'All';

  return (
    <div className="hs-filter-dropdown">
      <button
        type="button"
        className={`hs-filter-button${isActive ? ' is-active' : ''}`}
        onClick={onToggle}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
      >
        <AdminIcon name="calendar" size={14} />
        <span>{activeLabel}</span>
        <AdminIcon name="chevron" size={12} />
      </button>

      {isOpen && (
        <div className="hs-filter-menu" role="listbox">
          {DATE_FILTERS.map((option) => (
            <button
              key={option.key}
              type="button"
              role="option"
              aria-selected={value === option.key}
              className={value === option.key ? 'is-selected' : ''}
              onClick={() => onChange(option.key)}
            >
              {option.label}
              {value === option.key && <AdminIcon name="check" size={12} />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* =========================================================
   PAGE
========================================================= */

export default function AdminHeroSlidesPage({ go }) {
  const [slides, setSlides] = useState(INITIAL_SLIDES);
  const [selectedIds, setSelectedIds] = useState([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [dateFilter, setDateFilter] = useState('All');
  const [dateDropdownOpen, setDateDropdownOpen] = useState(false);
  const [openMenu, setOpenMenu] = useState(null);
  const [pageSize, setPageSize] = useState('10');
  const [notice, setNotice] = useState('');
  const toolbarRef = useRef(null);

  const notify = (message) => {
    setNotice(message);
    window.clearTimeout(window.__novaHeroSlideToast);
    window.__novaHeroSlideToast = window.setTimeout(() => setNotice(''), 2300);
  };

  useEffect(() => {
    const handleOutsideClick = (event) => {
      if (toolbarRef.current && !toolbarRef.current.contains(event.target)) {
        setDateDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  const stats = useMemo(() => {
    const active = slides.filter((slide) => slide.status === 'Active').length;
    const scheduled = slides.filter((slide) => slide.status === 'Scheduled').length;
    return { total: slides.length, active, scheduled };
  }, [slides]);

  const filteredSlides = useMemo(() => {
    const query = search.trim().toLowerCase();

    return slides.filter((slide) => {
      const matchesSearch =
        !query ||
        slide.headline.toLowerCase().includes(query) ||
        slide.sub.toLowerCase().includes(query);

      const matchesStatus = statusFilter === 'All' || slide.status === statusFilter;
      const matchesDate = matchesDateFilter(slide, dateFilter);

      return matchesSearch && matchesStatus && matchesDate;
    });
  }, [slides, search, statusFilter, dateFilter]);

  const allVisibleSelected =
    filteredSlides.length > 0 &&
    filteredSlides.every((slide) => selectedIds.includes(slide.id));

  const toggleSelected = (id) => {
    setSelectedIds((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id]
    );
  };

  const toggleAll = () => {
    if (allVisibleSelected) {
      setSelectedIds((current) =>
        current.filter((id) => !filteredSlides.some((slide) => slide.id === id))
      );
      return;
    }

    setSelectedIds((current) => [
      ...new Set([...current, ...filteredSlides.map((slide) => slide.id)]),
    ]);
  };

  const clearFilters = () => {
    setSearch('');
    setStatusFilter('All');
    setDateFilter('All');
  };

  const setSlideStatus = (ids, status) => {
    setSlides((current) =>
      current.map((slide) => (ids.includes(slide.id) ? { ...slide, status } : slide))
    );
  };

  const duplicateSlide = (id) => {
    setSlides((current) => {
      const index = current.findIndex((slide) => slide.id === id);
      const original = current[index];
      const copy = {
        ...original,
        id: Math.max(...current.map((slide) => slide.id)) + 1,
        headline: `${original.headline} (copy)`,
        status: 'Draft',
        relative: 'No schedule',
        start: null,
        end: null,
      };

      const next = [...current];
      next.splice(index + 1, 0, copy);
      return next;
    });
    notify('Slide duplicated as draft');
  };

  const moveToTop = (id) => {
    setSlides((current) => {
      const slide = current.find((item) => item.id === id);
      return [slide, ...current.filter((item) => item.id !== id)];
    });
    notify('Slide moved to top');
  };

  const deleteSlides = (ids) => {
    setSlides((current) => current.filter((slide) => !ids.includes(slide.id)));
    setSelectedIds((current) => current.filter((id) => !ids.includes(id)));
    notify(ids.length > 1 ? `${ids.length} slides deleted` : 'Slide deleted');
  };

  const handleMenuAction = (action, slide) => {
    setOpenMenu(null);

    switch (action) {
      case 'edit':
        go ? go(`/admin/content/hero-slides/${slide.id}/edit`) : notify(`Editing "${slide.headline}"`);
        break;
      case 'duplicate':
        duplicateSlide(slide.id);
        break;
      case 'draft':
        setSlideStatus([slide.id], 'Draft');
        notify(`"${slide.headline}" set as draft`);
        break;
      case 'top':
        moveToTop(slide.id);
        break;
      case 'delete':
        deleteSlides([slide.id]);
        break;
      default:
        break;
    }
  };

  const handleAddSlide = () => {
    if (go) {
      go('/admin/content/hero-slides/add');
      return;
    }
    notify('Add slide');
  };

  const handlePreview = () => {
    if (go) {
      go('/');
      return;
    }
    notify('Opening storefront preview…');
  };

  return (
    <div className="admin-dashboard hs-page">

      {/* PAGE HEADER — shared admin-page-* classes, same as other admin pages */}
      <section className="admin-page-heading hs-page-heading">
        <div>
          <h1 className="admin-page-title">Hero Slides</h1>
          <p className="admin-page-description">
            Manage the banners shown at the top of your homepage.
          </p>
        </div>

        <div className="admin-page-actions">
          <button type="button" className="admin-action-button" onClick={handlePreview}>
            Preview
            <span aria-hidden="true">↗</span>
          </button>

          <button type="button" className="admin-action-button is-primary" onClick={handleAddSlide}>
            <AdminIcon name="plus" size={15} />
            Add slide
          </button>
        </div>
      </section>

      <div className="hs-kpi-label">
        <AdminIcon name="calendar" size={11} />
        PERFORMANCE METRICS — LAST 30 DAYS
      </div>

      {/* KPI ROW — shared admin-stat-* classes */}
      <section className="admin-stat-grid hs-stat-grid">
        <article className="admin-stat-card">
          <div className="admin-stat-heading">
            <span className="admin-stat-label">Total slides</span>
            <span className="admin-trend-pill">+1 this month</span>
          </div>
          <div className="admin-stat-value">{stats.total}</div>
        </article>

        <article className="admin-stat-card">
          <div className="admin-stat-heading">
            <span className="admin-stat-label">Active slides</span>
            <span className="admin-trend-pill is-neutral">No change</span>
          </div>
          <div className="admin-stat-value">{stats.active}</div>
        </article>

        <article className="admin-stat-card">
          <div className="admin-stat-heading">
            <span className="admin-stat-label">Scheduled</span>
            <span className="admin-trend-pill">+1 this month</span>
          </div>
          <div className="admin-stat-value">{stats.scheduled}</div>
        </article>

        <article className="admin-stat-card">
          <div className="admin-stat-heading">
            <span className="admin-stat-label">Click rate</span>
            <span className="admin-trend-pill">+0.6%</span>
          </div>
          <div className="admin-stat-value">4.8%</div>
        </article>
      </section>

      {/* SEARCH / FILTER TOOLBAR */}
      <section className="hs-toolbar" ref={toolbarRef}>
        <div className="hs-filter-row">
          <label className="products-search-field hs-search-field">
            <AdminIcon name="search" size={16} />
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search by headline"
              aria-label="Search by headline"
            />
          </label>

          <DateDropdown
            value={dateFilter}
            isOpen={dateDropdownOpen}
            onToggle={() => setDateDropdownOpen((current) => !current)}
            onChange={(value) => {
              setDateFilter(value);
              setDateDropdownOpen(false);
            }}
          />
        </div>

        <div className="hs-quick-row">
          <div className="hs-quick-filters" role="group" aria-label="Slide filters">
            {['All', 'Active', 'Scheduled', 'Draft', 'Expired'].map((filter) => (
              <button
                key={filter}
                type="button"
                className={`hs-quick-filter${statusFilter === filter ? ' is-active' : ''}`}
                onClick={() => setStatusFilter(filter)}
                aria-pressed={statusFilter === filter}
              >
                {filter !== 'All' && filter !== 'Draft' && (
                  <i className={filter.toLowerCase()} />
                )}
                {filter}
              </button>
            ))}
          </div>

          {(statusFilter !== 'All' || dateFilter !== 'All' || search) && (
            <button type="button" className="hs-clear-filters" onClick={clearFilters}>
              Clear filters
            </button>
          )}
        </div>
      </section>

      {/* TABLE */}
      <section className="hs-table-card" aria-label="Hero slides">
        <div className="hs-table-scroll">
          <table className="hs-table">
            <thead>
              <tr>
                <th className="hs-checkbox-cell">
                  <input
                    type="checkbox"
                    checked={allVisibleSelected}
                    onChange={toggleAll}
                    aria-label="Select all slides"
                  />
                </th>
                <th className="hs-index-cell">#</th>
                <th>SLIDE</th>
                <th>BUTTON ACTION</th>
                <th>SCHEDULE DATES</th>
                <th>STATUS</th>
                <th className="hs-actions-heading">ACTION</th>
              </tr>
            </thead>

            <tbody>
              {filteredSlides.map((slide, index) => (
                <tr key={slide.id}>
                  <td className="hs-checkbox-cell">
                    <input
                      type="checkbox"
                      checked={selectedIds.includes(slide.id)}
                      onChange={() => toggleSelected(slide.id)}
                      aria-label={`Select ${slide.headline}`}
                    />
                  </td>

                  <td className="hs-index-cell">
                    <span className="hs-index-number">{index + 1}</span>
                    <span className="hs-index-handle" aria-hidden="true">⠿</span>
                  </td>

                  <td className="hs-slide-cell">
                    <div className="hs-slide-content">
                      <span
                        className="hs-slide-thumb"
                        style={{ background: slide.swatch }}
                        aria-hidden="true"
                      />

                      <div className="hs-slide-copy" title={slide.created}>
                        <strong>{slide.headline}</strong>
                        <span className="hs-slide-sub">{slide.sub}</span>
                        <span className="hs-created-tooltip">{slide.created}</span>
                      </div>
                    </div>
                  </td>

                  <td>
                    <div className="hs-main-text">{slide.buttonLabel}</div>
                    <div className="hs-subtext">{slide.buttonPath}</div>
                  </td>

                  <td>
                    <div className="hs-main-text">
                      {slide.end ? `${slide.start} – ${slide.end}` : 'No schedule'}
                    </div>
                    <div
                      className={`hs-subtext${
                        slide.relative.startsWith('Starts in') ? ' is-upcoming' : ''
                      }`}
                    >
                      {slide.end ? `(${slide.relative})` : '—'}
                    </div>
                  </td>

                  <td>
                    <SlideStatus status={slide.status} />
                  </td>

                  <td className="hs-actions-cell">
                    <div className="hs-row-menu-anchor">
                      <button
                        type="button"
                        className="products-row-menu-button"
                        onClick={() =>
                          setOpenMenu((current) => (current === slide.id ? null : slide.id))
                        }
                        aria-label={`Actions for ${slide.headline}`}
                        aria-expanded={openMenu === slide.id}
                      >
                        <AdminIcon name="more" size={16} />
                      </button>

                      {openMenu === slide.id && (
                        <div className="products-row-menu hs-row-menu">
                          <button type="button" onClick={() => handleMenuAction('edit', slide)}>
                            <AdminIcon name="pencil" size={14} />
                            Edit slide
                          </button>

                          <button type="button" onClick={() => handleMenuAction('duplicate', slide)}>
                            <AdminIcon name="copy" size={14} />
                            Duplicate
                          </button>

                          {slide.status !== 'Draft' && (
                            <button type="button" onClick={() => handleMenuAction('draft', slide)}>
                              <AdminIcon name="close" size={14} />
                              Set as draft
                            </button>
                          )}

                          <button type="button" onClick={() => handleMenuAction('top', slide)}>
                            <AdminIcon name="sort" size={14} />
                            Move to top
                          </button>

                          <div className="hs-menu-divider" />

                          <button
                            type="button"
                            className="is-danger"
                            onClick={() => handleMenuAction('delete', slide)}
                          >
                            <AdminIcon name="trash" size={14} />
                            Delete slide
                          </button>
                        </div>
                      )}
                    </div>
                  </td>
                </tr>
              ))}

              {filteredSlides.length === 0 && (
                <tr>
                  <td colSpan="7" className="hs-empty-state">
                    <AdminIcon name="searchSlash" size={20} />
                    <strong>No slides match these filters.</strong>
                    <button type="button" onClick={clearFilters}>
                      Reset filters
                    </button>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="hs-pagination">
          <span>
            Showing{' '}
            {filteredSlides.length > 0 ? `1–${filteredSlides.length}` : '0'} of {slides.length}{' '}
            slides
          </span>

          <div className="hs-pagination-controls">
            <label>
              <select
                value={pageSize}
                onChange={(event) => setPageSize(event.target.value)}
                aria-label="Slides per page"
              >
                <option value="10">10 per page</option>
                <option value="25">25 per page</option>
                <option value="50">50 per page</option>
              </select>
              <AdminIcon name="chevron" size={12} />
            </label>

            <button type="button" disabled>
              <AdminIcon name="left" size={13} />
            </button>

            <button type="button" className="is-active">1</button>

            <button type="button" disabled>
              <AdminIcon name="chevron" size={13} />
            </button>
          </div>
        </div>
      </section>

      {/* BULK ACTION BAR */}
      {selectedIds.length > 0 && (
        <div className="hs-bulk-bar">
          <strong>{selectedIds.length} selected</strong>

          <button type="button" onClick={() => {
            setSlideStatus(selectedIds, 'Active');
            notify('Slides set as active');
          }}>
            <AdminIcon name="check" size={14} />
            Set as active
          </button>

          <button type="button" onClick={() => {
            setSlideStatus(selectedIds, 'Draft');
            notify('Slides set as draft');
          }}>
            <AdminIcon name="close" size={14} />
            Set as draft
          </button>

          <button type="button" onClick={() => {
            selectedIds.forEach((id) => duplicateSlide(id));
          }}>
            <AdminIcon name="copy" size={14} />
            Duplicate
          </button>

          <button type="button" className="is-danger" onClick={() => deleteSlides(selectedIds)}>
            <AdminIcon name="trash" size={14} />
            Delete
          </button>

          <button
            className="hs-bulk-clear"
            type="button"
            aria-label="Clear selection"
            onClick={() => setSelectedIds([])}
          >
            <AdminIcon name="close" size={16} />
          </button>
        </div>
      )}

      {notice && (
        <div className="admin-toast" role="status">
          {notice}
        </div>
      )}
    </div>
  );
}