import { useRef, useState, useEffect } from 'react';
import { AdminIcon } from '../../components/admin/AdminLayout';
import './admin-homepage-content.css';

/* =========================================================
   MOCK DATA
========================================================= */

const INITIAL_SECTIONS = [
  { id: 'announcement', icon: 'bell', label: 'Announcement bar', meta: 'Free shipping on orders over $300', visible: true },
  { id: 'hero', icon: 'content', label: 'Hero slides', meta: '3 active slides', visible: true },
  { id: 'categories', icon: 'categories', label: 'Featured categories', meta: '4 categories · Grid', visible: true },
  { id: 'arrivals', icon: 'package', label: 'New arrivals', meta: '8 products · Automatic', visible: true },
  { id: 'promo', icon: 'discounts', label: 'Promotional banner', meta: 'Autumn Sale · 20% off', visible: true },
  { id: 'bestsellers', icon: 'analytics', label: 'Best sellers', meta: '8 products · Automatic', visible: true },
  { id: 'brandstory', icon: 'document', label: 'Brand story', meta: 'Hidden from your store', visible: false },
  { id: 'newsletter', icon: 'mail', label: 'Newsletter signup', meta: 'Email form', visible: true },
];

const PUBLISH_META = {
  lastPublished: 'Oct 30, 2026, 14:10',
  publishedBy: 'Elena Vasquez',
  version: '2.14',
};

function sectionMeta(section) {
  if (section.id === 'brandstory' && !section.visible) {
    return 'Hidden from your store';
  }
  return section.meta;
}

/* =========================================================
   ROW ACTION MENU
========================================================= */

function SectionMenu({ onAction, canMoveUp, canMoveDown }) {
  return (
    <div className="hc-section-menu">
      <button type="button" onClick={() => onAction('edit')}>
        <AdminIcon name="pencil" size={14} />
        Edit section
      </button>

      <button type="button" disabled={!canMoveUp} onClick={() => onAction('up')}>
        <AdminIcon name="sort" size={14} />
        Move up
      </button>

      <button type="button" disabled={!canMoveDown} onClick={() => onAction('down')}>
        <AdminIcon name="sort" size={14} />
        Move down
      </button>

      <button type="button" onClick={() => onAction('duplicate')}>
        <AdminIcon name="copy" size={14} />
        Duplicate
      </button>

      <div className="hc-menu-divider" />

      <button type="button" className="is-danger" onClick={() => onAction('remove')}>
        <AdminIcon name="trash" size={14} />
        Remove section
      </button>
    </div>
  );
}

/* =========================================================
   PAGE
========================================================= */

export default function AdminHomepageContentPage({ go }) {
  const [sections, setSections] = useState(INITIAL_SECTIONS);
  const [publishedSections, setPublishedSections] = useState(INITIAL_SECTIONS);
  const [publishMeta, setPublishMeta] = useState(PUBLISH_META);
  const [openMenu, setOpenMenu] = useState(null);
  const [previewMode, setPreviewMode] = useState('Desktop');
  const [detailsOpen, setDetailsOpen] = useState(true);
  const [notice, setNotice] = useState('');
  const menuRef = useRef(null);

  useEffect(() => {
    const handleOutsideClick = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setOpenMenu(null);
      }
    };

    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  const isDirty = JSON.stringify(sections) !== JSON.stringify(publishedSections);
  const visibleCount = sections.filter((section) => section.visible).length;

  const notify = (message) => {
    setNotice(message);
    window.setTimeout(() => setNotice(''), 2200);
  };

  const toggleVisibility = (id) => {
    setSections((current) =>
      current.map((section) =>
        section.id === id ? { ...section, visible: !section.visible } : section
      )
    );
  };

  const moveSection = (id, direction) => {
    setSections((current) => {
      const index = current.findIndex((section) => section.id === id);
      const targetIndex = direction === 'up' ? index - 1 : index + 1;

      if (targetIndex < 0 || targetIndex >= current.length) {
        return current;
      }

      const next = [...current];
      [next[index], next[targetIndex]] = [next[targetIndex], next[index]];
      return next;
    });
  };

  const duplicateSection = (id) => {
    setSections((current) => {
      const index = current.findIndex((section) => section.id === id);
      const original = current[index];
      const copy = {
        ...original,
        id: `${original.id}-copy-${Date.now()}`,
        label: `${original.label} (copy)`,
      };

      const next = [...current];
      next.splice(index + 1, 0, copy);
      return next;
    });
    notify('Section duplicated');
  };

  const removeSection = (id) => {
    setSections((current) => current.filter((section) => section.id !== id));
    notify('Section removed');
  };

  const handleMenuAction = (action, section) => {
    setOpenMenu(null);

    switch (action) {
      case 'edit':
        notify(`Editing "${section.label}"`);
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
    notify('Choose a section type to add');
  };

  const handleDiscard = () => {
    setSections(publishedSections);
    notify('Changes discarded');
  };

  const handlePublish = () => {
    setPublishedSections(sections);

    const now = new Date();
    const nextVersion = (Number(publishMeta.version) + 0.01).toFixed(2);

    setPublishMeta({
      lastPublished: now.toLocaleDateString('en-US', {
        month: 'short',
        day: '2-digit',
        year: 'numeric',
      }) + ', ' + now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
      publishedBy: 'Elena Vasquez',
      version: nextVersion,
    });

    notify('Homepage content published');
  };

  const handlePreview = () => {
    if (go) {
      go('/');
      return;
    }
    notify('Opening storefront preview…');
  };

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
            disabled={!isDirty}
            onClick={handleDiscard}
          >
            Discard
          </button>

          <button
            type="button"
            className="admin-action-button is-primary"
            disabled={!isDirty}
            onClick={handlePublish}
          >
            Publish changes
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
              {sections.map((section, index) => (
                <div
                  className={`hc-section-row${section.visible ? '' : ' is-hidden'}`}
                  key={section.id}
                >
                  <span className="hc-drag-handle" aria-hidden="true">⠿</span>

                  <span className="hc-section-icon">
                    <AdminIcon name={section.icon} size={16} />
                  </span>

                  <div className="hc-section-copy">
                    <strong>{section.label}</strong>
                    <small>{sectionMeta(section)}</small>
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
                    <button
                      type="button"
                      className="products-row-menu-button"
                      onClick={() =>
                        setOpenMenu((current) => (current === section.id ? null : section.id))
                      }
                      aria-label={`Actions for ${section.label}`}
                      aria-expanded={openMenu === section.id}
                    >
                      <AdminIcon name="more" size={16} />
                    </button>

                    {openMenu === section.id && (
                      <SectionMenu
                        onAction={(action) => handleMenuAction(action, section)}
                        canMoveUp={index > 0}
                        canMoveDown={index < sections.length - 1}
                      />
                    )}
                  </div>
                </div>
              ))}

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
                <small>novashop.luxury/home</small>
              </div>

              <div className="hc-preview-body">
                {sections.find((s) => s.id === 'announcement')?.visible && (
                  <div className="hc-mock-announcement">FREE SHIPPING OVER $300</div>
                )}

                {sections.find((s) => s.id === 'hero')?.visible && (
                  <div className="hc-mock-hero">
                    <span />
                    <span />
                    <i>EXPLORE</i>
                  </div>
                )}

                {sections.find((s) => s.id === 'categories')?.visible && (
                  <div className="hc-mock-categories">
                    <span>Outerwear</span>
                    <span>Dresses</span>
                    <span>Knitwear</span>
                    <span>Accessories</span>
                  </div>
                )}

                {sections.find((s) => s.id === 'promo')?.visible && (
                  <div className="hc-mock-promo">
                    <span />
                    <i />
                  </div>
                )}

                {sections.find((s) => s.id === 'bestsellers')?.visible && (
                  <div className="hc-mock-bestsellers">
                    <span />
                    <i />
                  </div>
                )}
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

      {notice && (
        <div className="admin-toast" role="status">
          {notice}
        </div>
      )}
    </div>
  );
}