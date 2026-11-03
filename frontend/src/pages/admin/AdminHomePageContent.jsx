import { useRef, useState, useEffect } from 'react';
import { AdminIcon } from '../../components/admin/AdminLayout';
import AdminRowActionMenu from '../../components/admin/AdminRowActionMenu';
import adminApi from '../../lib/api/adminApi';
import MediaLibraryModal from '../../components/admin/MediaLibraryModal';
import './admin-homepage-content.css';

/* =========================================================
   PAGE
========================================================= */

export default function AdminHomePageContentPage({ go }) {
  const [sections, setSections] = useState([]);
  const [categories, setCategories] = useState([]);
  const [draggedIndex, setDraggedIndex] = useState(null);
  const [publishMeta, setPublishMeta] = useState({
    lastPublished: '-',
    publishedBy: '-',
    version: '1.0',
  });
  const [currentVersion, setCurrentVersion] = useState(1);
  const [isDirty, setIsDirty] = useState(false);
  const [loading, setLoading] = useState(true);
  const [publishing, setPublishing] = useState(false);

  const [previewMode, setPreviewMode] = useState('Desktop');
  const [detailsOpen, setDetailsOpen] = useState(true);
  const [notice, setNotice] = useState('');
  const [activeHeroSlide, setActiveHeroSlide] = useState(null);

  // Section Edit Modal state
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editingSection, setEditingSection] = useState(null);
  const [editConfig, setEditConfig] = useState({});
  const [mediaPickerOpen, setMediaPickerOpen] = useState(false);

  const menuRef = useRef(null);

  const notify = (message) => {
    setNotice(message);
    window.clearTimeout(window.__novaHomeContentToast);
    window.__novaHomeContentToast = window.setTimeout(() => setNotice(''), 2500);
  };

  const fetchContent = () => {
    setLoading(true);
    adminApi
      .getHomepageContent()
      .then((res) => {
        if (res?.data) {
          const list = res.data.sections || [];
          setSections(list);
          setIsDirty(Boolean(res.data.isDirty));
          if (res.data.meta) {
            setPublishMeta(res.data.meta);
          }
          if (res.data.version) {
            setCurrentVersion(res.data.version);
          }
        }
      })
      .catch((err) => {
        notify(err.response?.data?.message || 'Failed to load homepage content.');
      })
      .finally(() => {
        setLoading(false);
      });
  };

  useEffect(() => {
    fetchContent();
    adminApi.getHeroSlides({ limit: 1, status: 'Active' }).then((res) => {
      if (res?.data?.slides?.[0]) {
        setActiveHeroSlide(res.data.slides[0]);
      }
    }).catch(() => {});
    adminApi.getCategories().then((res) => {
      const list = res?.data?.categories || res?.data || [];
      setCategories(Array.isArray(list) ? list : []);
    }).catch(() => {});
  }, []);

  const visibleCount = sections.filter((section) => section.visible).length;

  const saveDraftChanges = async (newSections) => {
    const previous = [...sections];
    setSections(newSections);
    setIsDirty(true);
    try {
      const res = await adminApi.updateHomepageDraft(newSections, currentVersion);
      if (res?.data?.version) {
        setCurrentVersion(res.data.version);
      }
    } catch (err) {
      setSections(previous); // Rollback on failure
      if (err.response?.status === 409) {
        alert(err.response?.data?.message || 'Conflict: Draft was updated concurrently.');
        fetchContent();
      } else {
        notify(err.response?.data?.message || 'Failed to save draft changes.');
      }
    }
  };

  const toggleVisibility = (id) => {
    const next = sections.map((section) =>
      section.id === id ? { ...section, visible: !section.visible } : section
    );
    saveDraftChanges(next);
  };

  const moveSection = (id, direction) => {
    const index = sections.findIndex((section) => section.id === id);
    const targetIndex = direction === 'up' ? index - 1 : index + 1;

    if (targetIndex < 0 || targetIndex >= sections.length) return;

    const next = [...sections];
    [next[index], next[targetIndex]] = [next[targetIndex], next[index]];
    const updated = next.map((s, idx) => ({ ...s, order: idx }));
    saveDraftChanges(updated);
  };

  const duplicateSection = (id) => {
    const index = sections.findIndex((section) => section.id === id);
    const original = sections[index];
    const copy = {
      ...original,
      id: `${original.id}-copy-${Date.now().toString().slice(-4)}`,
      label: `${original.label} (copy)`,
      order: sections.length,
    };

    const next = [...sections];
    next.splice(index + 1, 0, copy);
    saveDraftChanges(next);
    notify('Section duplicated in draft');
  };

  const removeSection = (id) => {
    const next = sections.filter((section) => section.id !== id);
    saveDraftChanges(next);
    notify('Section removed from draft');
  };

  const openSectionEditor = (section) => {
    setEditingSection(section);
    setEditConfig({ ...(section.config || {}) });
    setEditModalOpen(true);
  };

  const handleSaveSectionConfig = (e) => {
    e.preventDefault();
    if (!editingSection) return;

    const next = sections.map((s) =>
      s.id === editingSection.id ? { ...s, config: editConfig } : s
    );

    saveDraftChanges(next);
    setEditModalOpen(false);
    notify(`Saved settings for "${editingSection.label}"`);
  };

  const handleMenuAction = (action, section) => {
    setOpenMenu(null);

    switch (action) {
      case 'edit':
        openSectionEditor(section);
        break;
      case 'up':
        moveSection(section.id, 'up');
        break;
      case 'down':
        moveSection(section.id, 'down');
        break;
      case 'duplicate':
        duplicateSection(section.id);
        break;
      case 'remove':
        removeSection(section.id);
        break;
      default:
        break;
    }
  };

  const addSection = () => {
    const sectionTypes = [
      { id: `custom-promo-${Date.now()}`, type: 'promo', label: 'Promo banner', icon: 'discounts' },
      { id: `custom-brand-${Date.now()}`, type: 'brandstory', label: 'Brand story', icon: 'document' },
    ];
    const chosen = sectionTypes[0];
    const newSection = {
      id: chosen.id,
      type: chosen.type,
      label: chosen.label,
      icon: chosen.icon,
      visible: true,
      order: sections.length,
      config: { title: 'New Promotion', text: 'Special Limited Offer' },
    };
    saveDraftChanges([...sections, newSection]);
    notify('New section added to draft');
  };

  const handleDiscard = async () => {
    const confirmDiscard = window.confirm('Discard all draft changes and revert to the published layout?');
    if (!confirmDiscard) return;

    try {
      await adminApi.discardHomepage();
      notify('Changes discarded');
      fetchContent();
    } catch (err) {
      notify(err.response?.data?.message || 'Failed to discard draft.');
    }
  };

  const handlePublish = async () => {
    setPublishing(true);
    try {
      const res = await adminApi.publishHomepage();
      if (res?.data?.meta) {
        setPublishMeta(res.data.meta);
      }
      setIsDirty(false);
      notify('Homepage content published');
      fetchContent();
    } catch (err) {
      notify(err.response?.data?.message || 'Failed to publish homepage.');
    } finally {
      setPublishing(false);
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

  const announcementText =
    sections.find((s) => s.id === 'announcement')?.config?.text || 'FREE SHIPPING ON ORDERS OVER $300';

  return (
    <div className="admin-dashboard hc-page">

      {/* PAGE HEADER — shared admin-page-* classes, same as other admin pages */}
      <section className="admin-page-heading hc-page-heading">
        <div>
          <div className="hc-title-row">
            <h1 className="admin-page-title">Homepage Content</h1>
            <span className={`hc-status-pill${isDirty ? ' is-pending' : ''}`}>
              <i />
              {isDirty ? 'Unpublished changes' : 'Published'}
            </span>
          </div>
          <p className="admin-page-description">
            Control the sections shown on your storefront homepage.
          </p>
        </div>

        <div className="admin-page-actions">
          <button type="button" className="admin-action-button" onClick={handlePreview}>
            Preview
            <span aria-hidden="true">↗</span>
          </button>

          <button
            type="button"
            className="admin-action-button"
            disabled={!isDirty || publishing}
            onClick={handleDiscard}
          >
            Discard
          </button>

          <button
            type="button"
            className="admin-action-button is-primary"
            disabled={!isDirty || publishing}
            onClick={handlePublish}
          >
            {publishing ? 'Publishing…' : 'Publish changes'}
          </button>
        </div>
      </section>

      <div className="hc-layout">

        {/* LEFT COLUMN — SECTIONS LIST */}
        <div className="hc-main-column">
          <article className="hc-card">
            <div className="hc-card-heading">
              <h2>Sections</h2>
              <span className="hc-eyebrow">
                {sections.length} sections · {visibleCount} visible
              </span>
            </div>

            <div className="hc-section-list" ref={menuRef}>
              {loading ? (
                <div className="p-8 text-center text-xs text-[#8A847C]">Loading sections…</div>
              ) : (
                sections.map((section, index) => (
                  <div
                    className={`hc-section-row${section.visible ? '' : ' is-hidden'}${draggedIndex === index ? ' is-dragging opacity-60' : ''}`}
                    key={section.id}
                    draggable
                    onDragStart={(e) => {
                      setDraggedIndex(index);
                      e.dataTransfer.effectAllowed = 'move';
                      e.dataTransfer.setData('text/plain', String(index));
                    }}
                    onDragOver={(e) => {
                      e.preventDefault();
                      e.dataTransfer.dropEffect = 'move';
                    }}
                    onDrop={(e) => {
                      e.preventDefault();
                      if (draggedIndex === null || draggedIndex === index) return;
                      const next = [...sections];
                      const [moved] = next.splice(draggedIndex, 1);
                      next.splice(index, 0, moved);
                      const updated = next.map((s, idx) => ({ ...s, order: idx }));
                      setDraggedIndex(null);
                      saveDraftChanges(updated);
                    }}
                    onDragEnd={() => setDraggedIndex(null)}
                  >
                    <span className="hc-drag-handle" aria-hidden="true" title="Drag to reorder">⠿</span>

                    <span className="hc-section-icon">
                      <AdminIcon name={section.icon || 'document'} size={16} />
                    </span>

                    <div className="hc-section-copy">
                      <strong>{section.label}</strong>
                      <small>{section.meta || (section.visible ? 'Configured' : 'Hidden from your store')}</small>
                    </div>

                    <button
                      type="button"
                      className={`hc-toggle${section.visible ? ' is-on' : ''}`}
                      onClick={() => toggleVisibility(section.id)}
                      role="switch"
                      aria-checked={section.visible}
                      aria-label={`Toggle ${section.label} visibility`}
                    >
                      <span />
                    </button>

                    <div className="hc-section-menu-anchor">
                      <AdminRowActionMenu
                        title={section.label}
                        subtitle={section.meta || (section.visible ? 'Visible' : 'Hidden')}
                        items={[
                          {
                            label: 'Edit settings',
                            icon: 'edit',
                            onClick: () => openSectionEditor(section),
                          },
                          {
                            label: section.visible ? 'Hide section' : 'Show section',
                            icon: section.visible ? 'eyeOff' : 'eye',
                            onClick: () => toggleVisibility(section.id),
                          },
                          {
                            label: 'Move up',
                            icon: 'sort',
                            disabled: index === 0,
                            disabledReason: 'Section is already at the top',
                            onClick: () => moveSection(section.id, 'up'),
                          },
                          {
                            label: 'Move down',
                            icon: 'sort',
                            disabled: index === sections.length - 1,
                            disabledReason: 'Section is already at the bottom',
                            onClick: () => moveSection(section.id, 'down'),
                          },
                          {
                            label: 'Duplicate',
                            icon: 'copy',
                            onClick: () => duplicateSection(section.id),
                          },
                          {
                            divider: true,
                          },
                          {
                            label: 'Remove section',
                            icon: 'trash',
                            danger: true,
                            onClick: () => {
                              if (window.confirm(`Are you sure you want to remove "${section.label}" from draft layout?`)) {
                                removeSection(section.id);
                              }
                            },
                          },
                        ]}
                      />
                    </div>
                  </div>
                ))
              )}

              <button type="button" className="hc-add-section" onClick={addSection}>
                <AdminIcon name="plus" size={14} />
                Add section
              </button>
            </div>
          </article>

          <div className="hc-hint-card">
            <AdminIcon name="document" size={16} />
            <div>
              <strong>Layout hierarchy guidance:</strong>
              <p>
                Visible sections are loaded chronologically to build the guest experience.
                Drag sections to reorder or click the toggle to immediately hide any element
                without discarding its configured content.
              </p>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN — PREVIEW + PUBLISHING + DETAILS */}
        <aside className="hc-side-column">
          <article className="hc-card hc-preview-card">
            <div className="hc-card-heading">
              <h2>Preview</h2>

              <div className="hc-segmented-control">
                {['Desktop', 'Mobile'].map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    className={previewMode === mode ? 'is-selected' : ''}
                    onClick={() => setPreviewMode(mode)}
                  >
                    {mode}
                  </button>
                ))}
              </div>
            </div>

            <div className={`hc-preview-frame is-${previewMode.toLowerCase()}`}>
              <div className="hc-browser-chrome">
                <span />
                <span />
                <span />
                <small>{typeof window !== 'undefined' ? `${window.location.host}/` : 'novashop.luxury/'}</small>
              </div>

              <div className="hc-preview-body">
                {[...sections]
                  .filter((s) => s.visible)
                  .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
                  .map((sec) => {
                    switch (sec.id) {
                      case 'announcement':
                        return (
                          <div key="prev-announcement" className="hc-mock-announcement">
                            {(sec.config?.text || announcementText).toUpperCase()}
                          </div>
                        );

                      case 'hero':
                        return (
                          <div
                            key="prev-hero"
                            className="hc-mock-hero relative overflow-hidden"
                            style={{
                              height: previewMode === 'Mobile' ? '110px' : '140px',
                              padding: '12px',
                              justifyContent: 'flex-end',
                              backgroundColor: '#1A1510',
                            }}
                          >
                            {activeHeroSlide?.image ? (
                              (() => {
                                const rawFit = activeHeroSlide.imageFit || 'cover';
                                const isContain = rawFit === 'contain';
                                const position = activeHeroSlide.imagePosition || 'right';

                                return (
                                  <>
                                    {isContain && (
                                      <img
                                        src={activeHeroSlide.image}
                                        alt=""
                                        aria-hidden="true"
                                        className="absolute inset-0 w-full h-full object-cover filter blur-xs brightness-50 scale-110 pointer-events-none"
                                      />
                                    )}
                                    {isContain ? (
                                      <div
                                        className="absolute inset-0 flex items-center pointer-events-none"
                                        style={{
                                          justifyContent: previewMode === 'Mobile' ? 'center' : (position === 'left' ? 'flex-start' : position === 'center' ? 'center' : 'flex-end'),
                                          padding: previewMode === 'Mobile' ? '0' : (position === 'right' ? '0 12px 0 0' : position === 'left' ? '0 0 0 12px' : '0'),
                                        }}
                                      >
                                        <img
                                          src={activeHeroSlide.image}
                                          alt=""
                                          aria-hidden="true"
                                          className="max-h-full h-full w-auto object-contain pointer-events-none"
                                        />
                                      </div>
                                    ) : (
                                      <img
                                        src={activeHeroSlide.image}
                                        alt=""
                                        aria-hidden="true"
                                        className="absolute inset-0 w-full h-full pointer-events-none object-cover"
                                        style={{
                                          objectPosition: `${activeHeroSlide.focalPointX ?? 50}% ${activeHeroSlide.focalPointY ?? 50}%`,
                                        }}
                                      />
                                    )}
                                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/25 to-transparent pointer-events-none" />
                                    <span style={{ position: 'relative', zIndex: 2, background: 'transparent', height: 'auto', color: '#fff', fontSize: '9px', fontWeight: 600, width: '100%' }}>
                                      {activeHeroSlide.headline}
                                    </span>
                                    <i style={{ position: 'relative', zIndex: 2 }}>
                                      {activeHeroSlide.buttonLabel || 'EXPLORE'}
                                    </i>
                                  </>
                                );
                              })()
                            ) : (
                              <>
                                <span />
                                <span />
                                <i>EXPLORE</i>
                              </>
                            )}
                          </div>
                        );

                      case 'categories':
                        return (
                          <div key="prev-categories" className="hc-mock-categories">
                            {categories.length > 0 ? (
                              categories.slice(0, 4).map((c) => (
                                <span key={c._id || c.name}>{c.name}</span>
                              ))
                            ) : (
                              <>
                                <span>Hoodies</span>
                                <span>T-Shirts</span>
                                <span>Shoes</span>
                                <span>Dresses</span>
                              </>
                            )}
                          </div>
                        );

                      case 'promo':
                        return (
                          <div key="prev-promo" className="hc-mock-promo">
                            <span>{sec.config?.title || 'Special Promotion'}</span>
                            <i>{sec.config?.discountCode || 'SALE'}</i>
                          </div>
                        );

                      case 'arrivals':
                      case 'bestsellers':
                        return (
                          <div key={`prev-${sec.id}`} className="hc-mock-bestsellers">
                            <span>{sec.config?.title || (sec.id === 'arrivals' ? 'New Arrivals' : 'Best Sellers')}</span>
                            <i>{sec.meta || 'Curated'}</i>
                          </div>
                        );

                      case 'brandstory':
                        return (
                          <div key="prev-brandstory" style={{ padding: '8px 12px', background: 'var(--color-sand, #f7f5f0)', borderRadius: '6px', textAlign: 'center', margin: '4px 0' }}>
                            <strong style={{ fontSize: '10px', color: 'var(--text-primary)', display: 'block' }}>{sec.config?.title || 'Brand Story'}</strong>
                          </div>
                        );

                      case 'newsletter':
                        return (
                          <div key="prev-newsletter" style={{ padding: '6px 12px', background: 'var(--surface-2, #faf8f5)', borderRadius: '6px', textAlign: 'center', margin: '4px 0' }}>
                            <span style={{ fontSize: '9px', color: '#8F897E' }}>{sec.config?.title || 'Newsletter Signup'}</span>
                          </div>
                        );

                      default:
                        return null;
                    }
                  })}
              </div>
            </div>
          </article>

          <article className="hc-card hc-publish-card">
            <div className="hc-card-heading">
              <h2>Publishing</h2>
            </div>

            <div className="hc-publish-status">
              <span className={`hc-status-pill${isDirty ? ' is-pending' : ''}`}>
                <i />
                {isDirty ? 'Unpublished changes' : 'Published'}
              </span>

              <p>
                {isDirty
                  ? 'You have unsaved changes to publish.'
                  : 'Your storefront is up to date.'}
              </p>
            </div>
          </article>

          <article className="hc-card hc-details-card">
            <button
              type="button"
              className="hc-details-toggle"
              onClick={() => setDetailsOpen((current) => !current)}
              aria-expanded={detailsOpen}
            >
              <h2>Details</h2>
              <span className={`hc-details-chevron${detailsOpen ? ' is-open' : ''}`}>
                <AdminIcon name="chevron" size={14} />
              </span>
            </button>

            {detailsOpen && (
              <div className="hc-details-body">
                <div>
                  <span>Last published:</span>
                  <strong>{publishMeta.lastPublished}</strong>
                </div>
                <div>
                  <span>Published by:</span>
                  <strong>{publishMeta.publishedBy}</strong>
                </div>
                <div>
                  <span>Version:</span>
                  <strong>{publishMeta.version}</strong>
                </div>
              </div>
            )}
          </article>
        </aside>
      </div>

      {/* SECTION CONFIGURATION MODAL */}
      {editModalOpen && editingSection && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
          <div className="relative w-full max-w-lg bg-white border border-[#DDD6CC] rounded-xl shadow-2xl p-6 overflow-hidden">
            <div className="flex items-center justify-between pb-3 border-b border-[#EAE4DC]">
              <h3 className="text-sm font-semibold text-[#1A1A1A]">
                Edit Section: {editingSection.label}
              </h3>
              <button
                type="button"
                onClick={() => setEditModalOpen(false)}
                className="text-[#8A847C] hover:text-[#1A1A1A]"
              >
                <AdminIcon name="close" size={16} />
              </button>
            </div>

            <form onSubmit={handleSaveSectionConfig} className="py-4 space-y-3.5 max-h-[75vh] overflow-y-auto">
              {editingSection.id === 'announcement' && (
                <>
                  <div>
                    <label className="block text-xs font-medium text-[#1A1A1A] mb-1">Announcement Text</label>
                    <input
                      type="text"
                      value={editConfig.text || ''}
                      onChange={(e) => setEditConfig({ ...editConfig, text: e.target.value })}
                      placeholder="e.g. Free shipping on orders over $300"
                      className="w-full px-3 py-1.5 text-xs bg-[#FAF8F5] border border-[#DDD6CC] rounded-md focus:outline-none focus:border-[#1A1A1A]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-[#1A1A1A] mb-1">Action Link</label>
                    <input
                      type="text"
                      value={editConfig.link || ''}
                      onChange={(e) => setEditConfig({ ...editConfig, link: e.target.value })}
                      placeholder="/shop"
                      className="w-full px-3 py-1.5 text-xs bg-[#FAF8F5] border border-[#DDD6CC] rounded-md focus:outline-none focus:border-[#1A1A1A]"
                    />
                  </div>
                </>
              )}

              {editingSection.id === 'promo' && (
                <>
                  <div>
                    <label className="block text-xs font-medium text-[#1A1A1A] mb-1">Banner Title</label>
                    <input
                      type="text"
                      value={editConfig.title || ''}
                      onChange={(e) => setEditConfig({ ...editConfig, title: e.target.value })}
                      placeholder="e.g. Autumn Sale"
                      className="w-full px-3 py-1.5 text-xs bg-[#FAF8F5] border border-[#DDD6CC] rounded-md focus:outline-none focus:border-[#1A1A1A]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-[#1A1A1A] mb-1">Linked Discount Code</label>
                    <input
                      type="text"
                      value={editConfig.discountCode || ''}
                      onChange={(e) => setEditConfig({ ...editConfig, discountCode: e.target.value.toUpperCase() })}
                      placeholder="WELCOME10"
                      className="w-full px-3 py-1.5 text-xs bg-[#FAF8F5] border border-[#DDD6CC] rounded-md focus:outline-none focus:border-[#1A1A1A]"
                    />
                    <small className="text-[10px] text-[#8A847C] block mt-0.5">
                      The banner will automatically hide when this discount code expires or is disabled.
                    </small>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-[#1A1A1A] mb-1">Banner Image</label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={editConfig.image || ''}
                        onChange={(e) => setEditConfig({ ...editConfig, image: e.target.value })}
                        placeholder="https://... or choose from library"
                        className="flex-1 px-3 py-1.5 text-xs bg-[#FAF8F5] border border-[#DDD6CC] rounded-md focus:outline-none focus:border-[#1A1A1A]"
                      />
                      <button
                        type="button"
                        onClick={() => setMediaPickerOpen(true)}
                        className="admin-action-button text-xs whitespace-nowrap"
                      >
                        Choose file
                      </button>
                    </div>
                  </div>
                </>
              )}

              {editingSection.id === 'categories' && (
                <div>
                  <label className="block text-xs font-medium text-[#1A1A1A] mb-1">Layout Mode</label>
                  <select
                    value={editConfig.layout || 'Grid'}
                    onChange={(e) => setEditConfig({ ...editConfig, layout: e.target.value })}
                    className="w-full px-3 py-1.5 text-xs bg-[#FAF8F5] border border-[#DDD6CC] rounded-md focus:outline-none focus:border-[#1A1A1A]"
                  >
                    <option value="Grid">Grid</option>
                    <option value="Carousel">Carousel</option>
                  </select>
                </div>
              )}

              {(editingSection.id === 'arrivals' || editingSection.id === 'bestsellers') && (
                <div>
                  <label className="block text-xs font-medium text-[#1A1A1A] mb-1">Product Limit</label>
                  <select
                    value={editConfig.limit || 8}
                    onChange={(e) => setEditConfig({ ...editConfig, limit: Number(e.target.value) })}
                    className="w-full px-3 py-1.5 text-xs bg-[#FAF8F5] border border-[#DDD6CC] rounded-md focus:outline-none focus:border-[#1A1A1A]"
                  >
                    <option value={4}>4 products</option>
                    <option value={8}>8 products</option>
                    <option value={12}>12 products</option>
                  </select>
                </div>
              )}

              {editingSection.id === 'brandstory' && (
                <>
                  <div>
                    <label className="block text-xs font-medium text-[#1A1A1A] mb-1">Story Heading</label>
                    <input
                      type="text"
                      value={editConfig.title || ''}
                      onChange={(e) => setEditConfig({ ...editConfig, title: e.target.value })}
                      placeholder="e.g. Modern Essentials."
                      className="w-full px-3 py-1.5 text-xs bg-[#FAF8F5] border border-[#DDD6CC] rounded-md focus:outline-none focus:border-[#1A1A1A]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-[#1A1A1A] mb-1">Description</label>
                    <textarea
                      rows={3}
                      value={editConfig.description || ''}
                      onChange={(e) => setEditConfig({ ...editConfig, description: e.target.value })}
                      className="w-full px-3 py-1.5 text-xs bg-[#FAF8F5] border border-[#DDD6CC] rounded-md focus:outline-none focus:border-[#1A1A1A]"
                    />
                  </div>
                </>
              )}

              <div className="pt-3 border-t border-[#EAE4DC] flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setEditModalOpen(false)}
                  className="admin-action-button text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="admin-action-button is-primary text-xs"
                >
                  Save Section
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
        onSelect={(file) => setEditConfig({ ...editConfig, image: file.url })}
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
