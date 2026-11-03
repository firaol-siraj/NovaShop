import { useEffect, useMemo, useRef, useState } from 'react';
import { AdminIcon } from '../../components/admin/AdminLayout';
import AdminRowActionMenu from '../../components/admin/AdminRowActionMenu';
import adminApi from '../../lib/api/adminApi';
import MediaLibraryModal from '../../components/admin/MediaLibraryModal';
import './admin-heroslides.css';

const DATE_FILTERS = [
  { key: 'All', label: 'All dates' },
  { key: 'Ending soon', label: 'Ending soon' },
  { key: 'Starting soon', label: 'Starting soon' },
  { key: 'No schedule', label: 'No schedule' },
  { key: 'Already ended', label: 'Already ended' },
];

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
  const [slides, setSlides] = useState([]);
  const [loading, setLoading] = useState(true);
  const [totalCount, setTotalCount] = useState(0);
  const [selectedIds, setSelectedIds] = useState([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [dateFilter, setDateFilter] = useState('All');
  const [dateDropdownOpen, setDateDropdownOpen] = useState(false);
  const [openMenu, setOpenMenu] = useState(null);
  const [draggedSlideIndex, setDraggedSlideIndex] = useState(null);
  const [pageSize, setPageSize] = useState('10');
  const [notice, setNotice] = useState('');

  // Slide Edit / Create Modal state
  const [slideModalOpen, setSlideModalOpen] = useState(false);
  const [editingSlide, setEditingSlide] = useState(null);
  const [slideForm, setSlideForm] = useState({
    headline: '',
    subheadline: '',
    image: '',
    mobileImage: '',
    imageFit: 'cover',
    imagePosition: 'right',
    focalPointX: 50,
    focalPointY: 25,
    buttonLabel: 'Shop Now',
    buttonLink: '/shop',
    startsAt: '',
    endsAt: '',
    status: 'active',
  });
  const [mediaPickerOpen, setMediaPickerOpen] = useState(false);
  const [mediaPickerTarget, setMediaPickerTarget] = useState('desktop');
  const [savingSlide, setSavingSlide] = useState(false);
  const [imageMeta, setImageMeta] = useState({ width: null, height: null });

  // Load natural dimensions of current image for resolution warnings
  useEffect(() => {
    if (!slideForm.image) {
      setImageMeta({ width: null, height: null });
      return;
    }
    const img = new Image();
    img.onload = () => {
      setImageMeta({ width: img.naturalWidth, height: img.naturalHeight });
    };
    img.src = slideForm.image;
  }, [slideForm.image]);

  const showImageWarning = useMemo(() => {
    if (!imageMeta.width || !imageMeta.height) return false;
    const isSmall = imageMeta.width < 1600;
    const isPortrait = imageMeta.width / imageMeta.height < 1.4;
    return isSmall || isPortrait;
  }, [imageMeta]);

  const previewEffectiveFit = useMemo(() => {
    if (slideForm.imageFit === 'contain') return 'contain';
    return 'cover';
  }, [slideForm.imageFit]);

  const [stats, setStats] = useState({
    total: 0,
    active: 0,
    scheduled: 0,
    clickRate: '-',
    clickRateTrend: '-',
  });

  const toolbarRef = useRef(null);

  const notify = (message) => {
    setNotice(message);
    window.clearTimeout(window.__novaHeroSlideToast);
    window.__novaHeroSlideToast = window.setTimeout(() => setNotice(''), 2500);
  };

  useEffect(() => {
    const handleOutsideClick = (event) => {
      if (toolbarRef.current && !toolbarRef.current.contains(event.target)) {
        setDateDropdownOpen(false);
      }
      if (!event.target.closest('.hs-row-menu-anchor')) {
        setOpenMenu(null);
      }
    };

    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  const fetchSlides = () => {
    setLoading(true);
    adminApi
      .getHeroSlides({
        limit: parseInt(pageSize, 10) || 10,
        search: search.trim() || undefined,
        status: statusFilter,
        dates: dateFilter,
      })
      .then((res) => {
        if (res?.data) {
          setSlides(res.data.slides || []);
          setTotalCount(res.data.total || 0);
          if (res.data.stats) {
            setStats(res.data.stats);
          }
        }
      })
      .catch((err) => {
        notify(err.response?.data?.message || err.message || 'Failed to load slides.');
      })
      .finally(() => {
        setLoading(false);
      });
  };

  useEffect(() => {
    fetchSlides();
  }, [search, statusFilter, dateFilter, pageSize]);

  const allVisibleSelected =
    slides.length > 0 &&
    slides.every((slide) => selectedIds.includes(slide.id));

  const toggleSelected = (id) => {
    setSelectedIds((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id]
    );
  };

  const toggleAll = () => {
    if (allVisibleSelected) {
      setSelectedIds((current) =>
        current.filter((id) => !slides.some((slide) => slide.id === id))
      );
      return;
    }

    setSelectedIds((current) => [
      ...new Set([...current, ...slides.map((slide) => slide.id)]),
    ]);
  };

  const clearFilters = () => {
    setSearch('');
    setStatusFilter('All');
    setDateFilter('All');
  };

  const duplicateSlide = async (id) => {
    try {
      await adminApi.duplicateHeroSlide(id);
      notify('Slide duplicated as draft');
      fetchSlides();
    } catch (err) {
      notify(err.response?.data?.message || 'Failed to duplicate slide.');
    }
  };

  const moveToTop = async (id) => {
    const slideToMove = slides.find((s) => s.id === id);
    if (!slideToMove) return;

    const remaining = slides.filter((s) => s.id !== id);
    const reordered = [slideToMove, ...remaining];

    try {
      const items = reordered.map((s, idx) => ({ id: s.id, position: idx }));
      await adminApi.reorderHeroSlides(items);
      notify('Slide moved to top');
      fetchSlides();
    } catch (err) {
      notify(err.response?.data?.message || 'Failed to reorder slide.');
    }
  };

  const moveSlide = async (index, direction) => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= slides.length) return;
    const reordered = [...slides];
    const [moved] = reordered.splice(index, 1);
    reordered.splice(targetIndex, 0, moved);
    setSlides(reordered);
    try {
      const items = reordered.map((s, idx) => ({ id: s.id, position: idx }));
      await adminApi.reorderHeroSlides(items);
      notify('Hero slide moved');
      fetchSlides();
    } catch (err) {
      notify(err.response?.data?.message || 'Failed to reorder hero slide.');
      fetchSlides();
    }
  };

  const deleteSlides = async (ids) => {
    const confirmDelete = window.confirm(
      ids.length > 1
        ? `Are you sure you want to delete ${ids.length} slides?`
        : 'Are you sure you want to delete this slide?'
    );
    if (!confirmDelete) return;

    try {
      if (ids.length === 1) {
        await adminApi.deleteHeroSlide(ids[0]);
      } else {
        await adminApi.bulkHeroSlideActions('delete', ids);
      }
      setSelectedIds((current) => current.filter((id) => !ids.includes(id)));
      notify(ids.length > 1 ? `${ids.length} slides deleted` : 'Slide deleted');
      fetchSlides();
    } catch (err) {
      notify(err.response?.data?.message || 'Failed to delete slide.');
    }
  };

  const openCreateModal = () => {
    setEditingSlide(null);
    setSlideForm({
      headline: '',
      subheadline: '',
      image: '',
      mobileImage: '',
      imageFit: 'cover',
      imagePosition: 'right',
      focalPointX: 50,
      focalPointY: 25,
      buttonLabel: 'Shop Now',
      buttonLink: '/shop',
      startsAt: '',
      endsAt: '',
      status: 'active',
    });
    setSlideModalOpen(true);
  };

  const openEditModal = (slide) => {
    setEditingSlide(slide);
    setSlideForm({
      headline: slide.headline,
      subheadline: slide.sub || '',
      image: slide.image,
      mobileImage: slide.mobileImage || '',
      imageFit: slide.imageFit || 'cover',
      imagePosition: slide.imagePosition || 'right',
      focalPointX: typeof slide.focalPointX === 'number' ? slide.focalPointX : 50,
      focalPointY: typeof slide.focalPointY === 'number' ? slide.focalPointY : 25,
      buttonLabel: slide.buttonLabel || 'Shop Now',
      buttonLink: slide.buttonPath || '/shop',
      startsAt: slide.startsAt ? new Date(slide.startsAt).toISOString().slice(0, 10) : '',
      endsAt: slide.endsAt ? new Date(slide.endsAt).toISOString().slice(0, 10) : '',
      status: slide.rawStatus || 'active',
    });
    setSlideModalOpen(true);
  };

  const handleSaveSlide = async (e) => {
    e.preventDefault();
    if (!slideForm.headline.trim()) {
      alert('Headline is required.');
      return;
    }
    if (!slideForm.image.trim()) {
      alert('Desktop image is required.');
      return;
    }

    setSavingSlide(true);
    try {
      const payload = {
        ...slideForm,
        startsAt: slideForm.startsAt ? new Date(slideForm.startsAt).toISOString() : null,
        endsAt: slideForm.endsAt ? new Date(slideForm.endsAt).toISOString() : null,
      };

      if (editingSlide) {
        await adminApi.updateHeroSlide(editingSlide.id, payload);
        notify('Hero slide updated.');
      } else {
        await adminApi.createHeroSlide(payload);
        notify('Hero slide created.');
      }
      setSlideModalOpen(false);
      fetchSlides();
    } catch (err) {
      alert(err.response?.data?.message || err.message || 'Failed to save slide.');
    } finally {
      setSavingSlide(false);
    }
  };

  const handleMenuAction = (action, slide) => {
    setOpenMenu(null);

    switch (action) {
      case 'edit':
        openEditModal(slide);
        break;
      case 'duplicate':
        duplicateSlide(slide.id);
        break;
      case 'draft':
        adminApi
          .updateHeroSlide(slide.id, { status: 'draft' })
          .then(() => {
            notify(`"${slide.headline}" set as draft`);
            fetchSlides();
          })
          .catch((err) => notify(err.response?.data?.message || 'Failed to update slide.'));
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

  const handlePreview = async () => {
    try {
      const res = await adminApi.getHeroPreviewToken();
      const token = res?.data?.token;
      if (token) {
        window.open(`/?preview=true&token=${token}`, '_blank');
      } else {
        window.open('/', '_blank');
      }
    } catch {
      window.open('/', '_blank');
    }
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

          <button type="button" className="admin-action-button is-primary" onClick={openCreateModal}>
            <AdminIcon name="plus" size={15} />
            Add slide
          </button>
        </div>
      </section>

      {/* KPI ROW — shared admin-stat-* classes */}
      <section className="admin-stat-grid hs-stat-grid">
        <article className="admin-stat-card">
          <div className="admin-stat-heading">
            <span className="admin-stat-label">Total slides</span>
          </div>
          <div className="admin-stat-value">{stats.total}</div>
        </article>

        <article className="admin-stat-card">
          <div className="admin-stat-heading">
            <span className="admin-stat-label">Active slides</span>
          </div>
          <div className="admin-stat-value">{stats.active}</div>
        </article>

        <article className="admin-stat-card">
          <div className="admin-stat-heading">
            <span className="admin-stat-label">Scheduled</span>
          </div>
          <div className="admin-stat-value">{stats.scheduled}</div>
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
              {loading ? (
                <tr>
                  <td colSpan="7" className="p-12 text-center text-xs text-[#8A847C]">
                    Loading hero slides…
                  </td>
                </tr>
              ) : (
                slides.map((slide, index) => (
                  <tr
                    key={slide.id}
                    draggable
                    onDragStart={(e) => {
                      setDraggedSlideIndex(index);
                      e.dataTransfer.effectAllowed = 'move';
                      e.dataTransfer.setData('text/plain', String(index));
                    }}
                    onDragOver={(e) => {
                      e.preventDefault();
                      e.dataTransfer.dropEffect = 'move';
                    }}
                    onDrop={async (e) => {
                      e.preventDefault();
                      if (draggedSlideIndex === null || draggedSlideIndex === index) return;
                      const reordered = [...slides];
                      const [moved] = reordered.splice(draggedSlideIndex, 1);
                      reordered.splice(index, 0, moved);
                      setSlides(reordered);
                      setDraggedSlideIndex(null);
                      try {
                        const items = reordered.map((s, idx) => ({ id: s.id, position: idx }));
                        await adminApi.reorderHeroSlides(items);
                        notify('Hero slides reordered');
                        fetchSlides();
                      } catch (err) {
                        notify(err.response?.data?.message || 'Failed to reorder hero slides');
                        fetchSlides();
                      }
                    }}
                    onDragEnd={() => setDraggedSlideIndex(null)}
                    className={draggedSlideIndex === index ? 'opacity-50' : ''}
                  >
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
                      <span className="hs-index-handle" aria-hidden="true" title="Drag to reorder">⠿</span>
                    </td>

                    <td className="hs-slide-cell">
                      <div className="hs-slide-content">
                        <span
                          className="hs-slide-thumb overflow-hidden"
                          style={{ background: '#F3F0EB' }}
                          aria-hidden="true"
                        >
                          {slide.image && (
                            <img
                              src={slide.image}
                              alt={slide.headline}
                              className="w-full h-full object-cover"
                              loading="lazy"
                            />
                          )}
                        </span>

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

                    <td className="hs-actions-cell" onClick={(e) => e.stopPropagation()}>
                      <AdminRowActionMenu
                        item={slide}
                        title={slide.headline || 'Slide'}
                        subtitle={`${slide.status || 'Draft'} · Pos ${index + 1}`}
                        items={[
                          {
                            label: 'Edit slide',
                            icon: 'edit',
                            onClick: () => openEditModal(slide),
                          },
                          {
                            label: 'Duplicate',
                            icon: 'copy',
                            onClick: () => duplicateSlide(slide.id),
                          },
                          {
                            label: slide.status === 'Active' ? 'Deactivate slide' : 'Activate slide',
                            icon: slide.status === 'Active' ? 'close' : 'check',
                            onClick: async () => {
                              const nextStatus = slide.status === 'Active' ? 'draft' : 'active';
                              try {
                                await adminApi.updateHeroSlide(slide.id, { status: nextStatus });
                                notify(`Slide marked as ${nextStatus}`);
                                fetchSlides();
                              } catch (err) {
                                notify(err.response?.data?.message || 'Failed to update slide status');
                              }
                            },
                          },
                          {
                            label: 'Move up',
                            icon: 'sort',
                            disabled: index === 0,
                            disabledReason: 'Slide is already at the top',
                            onClick: () => moveSlide(index, 'up'),
                          },
                          {
                            label: 'Move down',
                            icon: 'sort',
                            disabled: index === slides.length - 1,
                            disabledReason: 'Slide is already at the bottom',
                            onClick: () => moveSlide(index, 'down'),
                          },
                          {
                            label: 'Preview storefront',
                            icon: 'eye',
                            onClick: handlePreview,
                          },
                          {
                            divider: true,
                          },
                          {
                            label: 'Delete slide',
                            icon: 'trash',
                            danger: true,
                            onClick: () => deleteSlides([slide.id]),
                          },
                        ]}
                      />
                    </td>
                  </tr>
                ))
              )}

              {!loading && slides.length === 0 && (
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
            Showing {slides.length > 0 ? `1–${slides.length}` : '0'} of {totalCount} slides
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

          <button
            type="button"
            onClick={async () => {
              await adminApi.bulkHeroSlideActions('active', selectedIds);
              notify('Slides set as active');
              fetchSlides();
            }}
          >
            <AdminIcon name="check" size={14} />
            Set as active
          </button>

          <button
            type="button"
            onClick={async () => {
              await adminApi.bulkHeroSlideActions('draft', selectedIds);
              notify('Slides set as draft');
              fetchSlides();
            }}
          >
            <AdminIcon name="close" size={14} />
            Set as draft
          </button>

          <button
            type="button"
            onClick={async () => {
              for (const id of selectedIds) {
                await adminApi.duplicateHeroSlide(id);
              }
              notify('Slides duplicated');
              fetchSlides();
            }}
          >
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

      {/* HERO SLIDE CREATE / EDIT MODAL */}
      {slideModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
          <div className="relative w-full max-w-lg bg-white border border-[#DDD6CC] rounded-xl shadow-2xl p-6 overflow-hidden">
            <div className="flex items-center justify-between pb-3 border-b border-[#EAE4DC]">
              <h3 className="text-sm font-semibold text-[#1A1A1A]">
                {editingSlide ? 'Edit Hero Slide' : 'Add Hero Slide'}
              </h3>
              <button
                type="button"
                onClick={() => setSlideModalOpen(false)}
                className="text-[#8A847C] hover:text-[#1A1A1A]"
              >
                <AdminIcon name="close" size={16} />
              </button>
            </div>

            <form onSubmit={handleSaveSlide} className="py-4 space-y-3.5 max-h-[75vh] overflow-y-auto">
              <div>
                <label className="block text-xs font-medium text-[#1A1A1A] mb-1">Headline *</label>
                <input
                  type="text"
                  required
                  value={slideForm.headline}
                  onChange={(e) => setSlideForm({ ...slideForm, headline: e.target.value })}
                  placeholder="e.g. Autumn Collection"
                  className="w-full px-3 py-1.5 text-xs bg-[#FAF8F5] border border-[#DDD6CC] rounded-md focus:outline-none focus:border-[#1A1A1A]"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-[#1A1A1A] mb-1">Subheadline</label>
                <input
                  type="text"
                  value={slideForm.subheadline}
                  onChange={(e) => setSlideForm({ ...slideForm, subheadline: e.target.value })}
                  placeholder="e.g. New season colors and silhouettes"
                  className="w-full px-3 py-1.5 text-xs bg-[#FAF8F5] border border-[#DDD6CC] rounded-md focus:outline-none focus:border-[#1A1A1A]"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-[#1A1A1A] mb-1">Desktop Image *</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    required
                    value={slideForm.image}
                    onChange={(e) => setSlideForm({ ...slideForm, image: e.target.value })}
                    placeholder="https://... or choose from library"
                    className="flex-1 px-3 py-1.5 text-xs bg-[#FAF8F5] border border-[#DDD6CC] rounded-md focus:outline-none focus:border-[#1A1A1A]"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setMediaPickerTarget('desktop');
                      setMediaPickerOpen(true);
                    }}
                    className="admin-action-button text-xs whitespace-nowrap"
                  >
                    Choose file
                  </button>
                </div>

                {/* Interactive Focal Point Picker & Preview */}
                {slideForm.image && (
                  <div className="mt-2.5 space-y-2">
                    <div className="flex items-center justify-between text-[11px] text-[#8A847C]">
                      <span>
                        {previewEffectiveFit === 'cover'
                          ? `Focal Point: ${slideForm.focalPointX}% X, ${slideForm.focalPointY}% Y (Click image to reposition)`
                          : `Contain mode: Full photo placed ${slideForm.imagePosition} over blurred fill`}
                      </span>
                      {previewEffectiveFit === 'cover' && (
                        <button
                          type="button"
                          onClick={() => setSlideForm({ ...slideForm, focalPointX: 50, focalPointY: 50 })}
                          className="text-[#6B635B] hover:text-[#1A1A1A] underline text-[10px]"
                        >
                          Reset to center (50/50)
                        </button>
                      )}
                    </div>

                    <div
                      className={`relative w-full max-w-md h-40 rounded-md overflow-hidden border border-[#DDD6CC] select-none bg-[#1A1510] ${
                        previewEffectiveFit === 'cover' ? 'cursor-crosshair' : 'cursor-default'
                      }`}
                      onClick={(e) => {
                        if (previewEffectiveFit !== 'cover') return;
                        const rect = e.currentTarget.getBoundingClientRect();
                        const x = Math.round(Math.min(100, Math.max(0, ((e.clientX - rect.left) / rect.width) * 100)));
                        const y = Math.round(Math.min(100, Math.max(0, ((e.clientY - rect.top) / rect.height) * 100)));
                        setSlideForm({ ...slideForm, focalPointX: x, focalPointY: y });
                      }}
                      title={previewEffectiveFit === 'cover' ? 'Click anywhere on the image to place the focal point' : undefined}
                    >
                      {/* Ambient blurred backdrop if contain mode */}
                      {previewEffectiveFit === 'contain' && (
                        <img
                          src={slideForm.image}
                          alt=""
                          aria-hidden="true"
                          className="absolute inset-0 w-full h-full object-cover filter blur-md brightness-50 scale-110 pointer-events-none"
                        />
                      )}

                      {previewEffectiveFit === 'contain' ? (
                        <div
                          className="absolute inset-0 flex items-center pointer-events-none"
                          style={{
                            justifyContent:
                              slideForm.imagePosition === 'left'
                                ? 'flex-start'
                                : slideForm.imagePosition === 'center'
                                ? 'center'
                                : 'flex-end',
                            padding:
                              slideForm.imagePosition === 'right'
                                ? '0 16px 0 0'
                                : slideForm.imagePosition === 'left'
                                ? '0 0 0 16px'
                                : '0',
                          }}
                        >
                          <img
                            src={slideForm.image}
                            alt="Preview"
                            className="max-h-full h-full w-auto object-contain pointer-events-none"
                          />
                        </div>
                      ) : (
                        <img
                          src={slideForm.image}
                          alt="Preview"
                          className="absolute inset-0 w-full h-full pointer-events-none object-cover"
                          style={{
                            objectPosition: `${slideForm.focalPointX}% ${slideForm.focalPointY}%`,
                          }}
                        />
                      )}

                      {/* Focal point indicator crosshair (only in cover mode) */}
                      {previewEffectiveFit === 'cover' && (
                        <div
                          className="absolute w-5 h-5 -ml-2.5 -mt-2.5 rounded-full border-2 border-white bg-black/40 shadow-md flex items-center justify-center pointer-events-none transition-all duration-75"
                          style={{
                            left: `${slideForm.focalPointX}%`,
                            top: `${slideForm.focalPointY}%`,
                          }}
                        >
                          <div className="w-1.5 h-1.5 rounded-full bg-white shadow-xs" />
                        </div>
                      )}
                    </div>

                    {/* Low resolution / aspect ratio warning banner */}
                    {showImageWarning && (
                      <div className="text-[11px] text-[#A26D24] bg-[#FDF8EE] border border-[#F3E5C8] rounded px-3 py-1.5 flex items-start gap-1.5">
                        <span aria-hidden="true" className="font-bold">⚠️</span>
                        <div>
                          <strong>Image Notice:</strong> For edge-to-edge hero images use a landscape photo, at least 1920x1080.
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Image Fit and Image Position */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-[#1A1A1A] mb-1">Image Fit</label>
                  <select
                    value={slideForm.imageFit}
                    onChange={(e) => setSlideForm({ ...slideForm, imageFit: e.target.value })}
                    className="w-full px-3 py-1.5 text-xs bg-[#FAF8F5] border border-[#DDD6CC] rounded-md focus:outline-none focus:border-[#1A1A1A]"
                  >
                    <option value="cover">Fill (crop) — Full width & height (Default)</option>
                    <option value="contain">Show full image — Contained with blurred fill</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-[#1A1A1A] mb-1">
                    Image Position {slideForm.imageFit === 'cover' ? '(Contain only)' : ''}
                  </label>
                  <select
                    value={slideForm.imagePosition}
                    onChange={(e) => setSlideForm({ ...slideForm, imagePosition: e.target.value })}
                    disabled={slideForm.imageFit === 'cover'}
                    className="w-full px-3 py-1.5 text-xs bg-[#FAF8F5] border border-[#DDD6CC] rounded-md focus:outline-none focus:border-[#1A1A1A] disabled:opacity-50"
                  >
                    <option value="right">Right (recommended)</option>
                    <option value="center">Center</option>
                    <option value="left">Left</option>
                  </select>
                </div>
              </div>

              {/* Mobile Image (Optional) */}
              <div>
                <label className="block text-xs font-medium text-[#1A1A1A] mb-1">Mobile Image (Optional)</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={slideForm.mobileImage}
                    onChange={(e) => setSlideForm({ ...slideForm, mobileImage: e.target.value })}
                    placeholder="https://... for mobile"
                    className="flex-1 px-3 py-1.5 text-xs bg-[#FAF8F5] border border-[#DDD6CC] rounded-md focus:outline-none focus:border-[#1A1A1A]"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setMediaPickerTarget('mobile');
                      setMediaPickerOpen(true);
                    }}
                    className="admin-action-button text-xs whitespace-nowrap"
                  >
                    Choose
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-[#1A1A1A] mb-1">Button Label</label>
                  <input
                    type="text"
                    value={slideForm.buttonLabel}
                    onChange={(e) => setSlideForm({ ...slideForm, buttonLabel: e.target.value })}
                    className="w-full px-3 py-1.5 text-xs bg-[#FAF8F5] border border-[#DDD6CC] rounded-md focus:outline-none focus:border-[#1A1A1A]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#1A1A1A] mb-1">Button Link</label>
                  <input
                    type="text"
                    value={slideForm.buttonLink}
                    onChange={(e) => setSlideForm({ ...slideForm, buttonLink: e.target.value })}
                    placeholder="/categories/hoodies"
                    className="w-full px-3 py-1.5 text-xs bg-[#FAF8F5] border border-[#DDD6CC] rounded-md focus:outline-none focus:border-[#1A1A1A]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-[#1A1A1A] mb-1">Start Date</label>
                  <input
                    type="date"
                    value={slideForm.startsAt}
                    onChange={(e) => setSlideForm({ ...slideForm, startsAt: e.target.value })}
                    className="w-full px-3 py-1.5 text-xs bg-[#FAF8F5] border border-[#DDD6CC] rounded-md focus:outline-none focus:border-[#1A1A1A]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#1A1A1A] mb-1">End Date</label>
                  <input
                    type="date"
                    value={slideForm.endsAt}
                    onChange={(e) => setSlideForm({ ...slideForm, endsAt: e.target.value })}
                    className="w-full px-3 py-1.5 text-xs bg-[#FAF8F5] border border-[#DDD6CC] rounded-md focus:outline-none focus:border-[#1A1A1A]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-[#1A1A1A] mb-1">Status</label>
                <select
                  value={slideForm.status}
                  onChange={(e) => setSlideForm({ ...slideForm, status: e.target.value })}
                  className="w-full px-3 py-1.5 text-xs bg-[#FAF8F5] border border-[#DDD6CC] rounded-md focus:outline-none focus:border-[#1A1A1A]"
                >
                  <option value="active">Active (Schedules automatically)</option>
                  <option value="draft">Draft (Hidden from storefront)</option>
                </select>
              </div>

              <div className="pt-3 border-t border-[#EAE4DC] flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setSlideModalOpen(false)}
                  className="admin-action-button text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingSlide}
                  className="admin-action-button is-primary text-xs"
                >
                  {savingSlide ? 'Saving…' : editingSlide ? 'Save Changes' : 'Create Slide'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Media Picker Modal */}
      <MediaLibraryModal
        isOpen={mediaPickerOpen}
        onClose={() => setMediaPickerOpen(false)}
        onSelect={(file) => {
          if (mediaPickerTarget === 'mobile') {
            setSlideForm({ ...slideForm, mobileImage: file.url });
          } else {
            setSlideForm({ ...slideForm, image: file.url });
          }
        }}
        initialKind="image"
      />

      {notice && (
        <div className="admin-toast" role="status">
          {notice}
        </div>
      )}
    </div>
  );
}
