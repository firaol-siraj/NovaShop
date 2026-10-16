import { useEffect, useMemo, useRef, useState } from 'react';
import { AdminIcon } from '../../components/admin/AdminLayout';
import './admin-medialibrary.css';

/* =========================================================
   MOCK DATA
========================================================= */

const INITIAL_FILES = [
  { id: 1, name: 'cashmere-overcoat.jpg', type: 'image', dims: '1600 × 2000', size: '840 KB', folder: 'Product photography', usage: 'Used', swatch: '#C9C2E0' },
  { id: 2, name: 'silk-slip-dress-01.jpg', type: 'image', dims: '1600 × 2000', size: '790 KB', folder: 'Product photography', usage: 'Used', swatch: '#C9C2E0' },
  { id: 3, name: 'leather-tote-bag.jpg', type: 'image', dims: '1600 × 2000', size: '910 KB', folder: 'Product photography', usage: 'Used', swatch: '#C9C2E0' },
  { id: 4, name: 'merino-sweater-detail.jpg', type: 'image', dims: '1600 × 2000', size: '720 KB', folder: 'Product photography', usage: 'Used', swatch: '#C9C2E0' },
  { id: 5, name: 'tailored-trousers.jpg', type: 'image', dims: '1600 × 2000', size: '680 KB', folder: 'Product photography', usage: 'Unused', swatch: '#C9C2E0' },
  { id: 6, name: 'suede-chelsea-boots.jpg', type: 'image', dims: '1600 × 2000', size: '860 KB', folder: 'Product photography', usage: 'Used', swatch: '#C9C2E0' },
  { id: 7, name: 'silk-scarf-detail.jpg', type: 'image', dims: '1600 × 2000', size: '640 KB', folder: 'Product photography', usage: 'Unused', swatch: '#C9C2E0' },
  { id: 8, name: 'autumn-hero-banner.jpg', type: 'image', dims: '2400 × 1350', size: '1.2 MB', folder: 'Hero banners', usage: 'Used', swatch: '#C9C2E0' },
  { id: 9, name: 'outerwear-category.jpg', type: 'image', dims: '1200 × 1200', size: '520 KB', folder: 'Hero banners', usage: 'Used', swatch: '#C9C2E0' },
  { id: 10, name: 'size-guide.pdf', type: 'document', dims: null, size: '240 KB', folder: 'Documents', usage: 'Used', swatch: '#EFE6C9' },
  { id: 11, name: 'brand-film.mp4', type: 'video', dims: null, duration: '0:42', size: '18.4 MB', folder: 'Brand assets', usage: 'Used', swatch: '#3A332B' },
  { id: 12, name: 'linen-shirt-flat.jpg', type: 'image', dims: '1600 × 2000', size: '610 KB', folder: 'Product photography', usage: 'Unused', swatch: '#C9C2E0' },
];

const TYPE_FILTERS = [
  { key: 'All', label: 'All', count: '1,846' },
  { key: 'image', label: 'Images', count: '1,702' },
  { key: 'video', label: 'Videos', count: '38' },
  { key: 'document', label: 'Documents', count: '106' },
];

const FOLDER_OPTIONS = ['All folders', 'Product photography', 'Hero banners', 'Brand assets', 'Documents'];
const USAGE_OPTIONS = ['All files', 'Used', 'Unused'];
const DATE_OPTIONS = ['All time', 'Last 7 days', 'Last 30 days', 'Older'];

function formatFileLabel(file) {
  if (file.type === 'document') return `${file.size}`;
  if (file.type === 'video') return `${file.duration} · ${file.size}`;
  return `${file.dims} · ${file.size}`;
}

/* =========================================================
   SMALL REUSABLE DROPDOWN
========================================================= */

function FilterDropdown({ label, value, options, isOpen, onToggle, onChange }) {
  const isActive = value !== options[0];

  return (
    <div className="ml-filter-dropdown">
      <button
        type="button"
        className={`ml-filter-button${isActive ? ' is-active' : ''}`}
        onClick={onToggle}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
      >
        <span>{isActive ? value : label}</span>
        <AdminIcon name="chevron" size={12} />
      </button>

      {isOpen && (
        <div className="ml-filter-menu" role="listbox">
          {options.map((option) => (
            <button
              key={option}
              type="button"
              role="option"
              aria-selected={value === option}
              className={value === option ? 'is-selected' : ''}
              onClick={() => onChange(option)}
            >
              {option}
              {value === option && <AdminIcon name="check" size={12} />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* =========================================================
   FILE TILE (grid view)
========================================================= */

function FileTile({ file, isSelected, onToggleSelect, isMenuOpen, onToggleMenu, onMenuAction }) {
  return (
    <div className={`ml-tile${isSelected ? ' is-selected' : ''}`}>
      <button
        type="button"
        className="ml-tile-thumb"
        style={{ background: file.swatch }}
        onClick={() => onToggleSelect(file.id)}
        aria-label={`Select ${file.name}`}
      >
        <span className="ml-tile-checkbox" aria-hidden="true">
          {isSelected && <AdminIcon name="check" size={11} />}
        </span>

        {file.type === 'image' && <AdminIcon name="document" size={20} />}

        {file.type === 'document' && (
          <span className="ml-tile-doc">
            <AdminIcon name="document" size={18} />
            <small>PDF</small>
          </span>
        )}

        {file.type === 'video' && (
          <>
            <span className="ml-tile-play">
              <AdminIcon name="plus" size={14} />
            </span>
            <span className="ml-tile-duration">{file.duration}</span>
          </>
        )}

        <span className="ml-tile-menu-anchor">
          <span
            role="button"
            tabIndex={0}
            className="ml-tile-menu-trigger"
            onClick={(event) => {
              event.stopPropagation();
              onToggleMenu(file.id);
            }}
            aria-label={`Actions for ${file.name}`}
          >
            <AdminIcon name="more" size={14} />
          </span>

          {isMenuOpen && (
            <div className="ml-tile-menu" onClick={(event) => event.stopPropagation()}>
              <button type="button" onClick={() => onMenuAction('details', file)}>
                <AdminIcon name="eye" size={13} />
                View details
              </button>
              <button type="button" onClick={() => onMenuAction('copy', file)}>
                <AdminIcon name="copy" size={13} />
                Copy URL
              </button>
              <button type="button" onClick={() => onMenuAction('download', file)}>
                <AdminIcon name="download" size={13} />
                Download
              </button>
              <div className="ml-tile-menu-divider" />
              <button type="button" className="is-danger" onClick={() => onMenuAction('delete', file)}>
                <AdminIcon name="trash" size={13} />
                Delete
              </button>
            </div>
          )}
        </span>
      </button>

      <div className="ml-tile-meta">
        <strong title={file.name}>{file.name}</strong>
        <small>{formatFileLabel(file)}</small>
      </div>
    </div>
  );
}

/* =========================================================
   PAGE
========================================================= */

export default function AdminMediaLibraryPage() {
  const [files, setFiles] = useState(INITIAL_FILES);
  const [selectedIds, setSelectedIds] = useState([1, 2, 3]);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('All');
  const [folderFilter, setFolderFilter] = useState('All folders');
  const [usageFilter, setUsageFilter] = useState('All files');
  const [dateFilter, setDateFilter] = useState('All time');
  const [openDropdown, setOpenDropdown] = useState(null);
  const [openTileMenu, setOpenTileMenu] = useState(null);
  const [viewMode, setViewMode] = useState('grid');
  const [notice, setNotice] = useState('');
  const toolbarRef = useRef(null);

  const notify = (message) => {
    setNotice(message);
    window.clearTimeout(window.__novaMediaToast);
    window.__novaMediaToast = window.setTimeout(() => setNotice(''), 2300);
  };

  useEffect(() => {
    const handleOutsideClick = (event) => {
      if (toolbarRef.current && !toolbarRef.current.contains(event.target)) {
        setOpenDropdown(null);
      }
      if (!event.target.closest('.ml-tile-menu-anchor')) {
        setOpenTileMenu(null);
      }
    };

    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  const filteredFiles = useMemo(() => {
    const query = search.trim().toLowerCase();

    return files.filter((file) => {
      const matchesSearch = !query || file.name.toLowerCase().includes(query);
      const matchesType = typeFilter === 'All' || file.type === typeFilter;
      const matchesFolder = folderFilter === 'All folders' || file.folder === folderFilter;
      const matchesUsage = usageFilter === 'All files' || file.usage === usageFilter;

      return matchesSearch && matchesType && matchesFolder && matchesUsage;
    });
  }, [files, search, typeFilter, folderFilter, usageFilter]);

  const toggleSelected = (id) => {
    setSelectedIds((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id]
    );
  };

  const toggleDropdown = (name) => {
    setOpenDropdown((current) => (current === name ? null : name));
  };

  const handleTileMenuAction = (action, file) => {
    setOpenTileMenu(null);

    switch (action) {
      case 'details':
        notify(`Viewing details for ${file.name}`);
        break;
      case 'copy':
        navigator.clipboard?.writeText(`https://cdn.novashop.luxury/media/${file.name}`);
        notify('File URL copied');
        break;
      case 'download':
        notify(`Downloading ${file.name}`);
        break;
      case 'delete':
        setFiles((current) => current.filter((item) => item.id !== file.id));
        setSelectedIds((current) => current.filter((id) => id !== file.id));
        notify(`${file.name} deleted`);
        break;
      default:
        break;
    }
  };

  const clearFilters = () => {
    setSearch('');
    setTypeFilter('All');
    setFolderFilter('All folders');
    setUsageFilter('All files');
    setDateFilter('All time');
  };

  const handleUpload = () => notify('Choose files to upload');
  const handleNewFolder = () => notify('Name your new folder');

  const bulkDownload = () => notify(`${selectedIds.length} files downloading`);
  const bulkCopyUrls = () => {
    notify('File URLs copied');
  };
  const bulkMoveToFolder = () => notify('Choose a destination folder');
  const bulkDelete = () => {
    setFiles((current) => current.filter((file) => !selectedIds.includes(file.id)));
    notify(`${selectedIds.length} files deleted`);
    setSelectedIds([]);
  };

  return (
    <div className="admin-dashboard ml-page">

      {/* PAGE HEADER — shared admin-page-* classes, same as other admin pages */}
      <section className="admin-page-heading ml-page-heading">
        <div>
          <h1 className="admin-page-title">Media Library</h1>
          <p className="admin-page-description">
            Upload and manage images and files used across your store.
          </p>
        </div>

        <div className="admin-page-actions">
          <button type="button" className="admin-action-button" onClick={handleNewFolder}>
            <AdminIcon name="categories" size={15} />
            New folder
          </button>

          <button type="button" className="admin-action-button is-primary" onClick={handleUpload}>
            <AdminIcon name="download" size={15} />
            Upload files
          </button>
        </div>
      </section>

      <div className="ml-kpi-label">LAST 30 DAYS</div>

      {/* KPI ROW — shared admin-stat-* classes */}
      <section className="admin-stat-grid ml-stat-grid">
        <article className="admin-stat-card">
          <div className="admin-stat-heading">
            <span className="admin-stat-label">Total files</span>
            <span className="admin-trend-pill">+64 this month</span>
          </div>
          <div className="admin-stat-value">1,846</div>
        </article>

        <article className="admin-stat-card">
          <div className="admin-stat-heading">
            <span className="admin-stat-label">Storage used</span>
            <span className="admin-trend-pill is-neutral">42% of 10 GB</span>
          </div>
          <div className="admin-stat-value">4.2 GB</div>
        </article>

        <article className="admin-stat-card">
          <div className="admin-stat-heading">
            <span className="admin-stat-label">Unused files</span>
            <span className="admin-trend-pill">+14 this month</span>
          </div>
          <div className="admin-stat-value">212</div>
        </article>

        <article className="admin-stat-card">
          <div className="admin-stat-heading">
            <span className="admin-stat-label">Uploaded this month</span>
            <span className="admin-trend-pill">+12%</span>
          </div>
          <div className="admin-stat-value">64</div>
        </article>
      </section>

      {/* SEARCH / FILTER TOOLBAR */}
      <section className="ml-toolbar" ref={toolbarRef}>
        <div className="ml-filter-row">
          <label className="products-search-field ml-search-field">
            <AdminIcon name="search" size={16} />
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search by file name"
              aria-label="Search by file name"
            />
          </label>

          <FilterDropdown
            label="Folder"
            value={folderFilter}
            options={FOLDER_OPTIONS}
            isOpen={openDropdown === 'folder'}
            onToggle={() => toggleDropdown('folder')}
            onChange={(value) => {
              setFolderFilter(value);
              setOpenDropdown(null);
            }}
          />

          <FilterDropdown
            label="Usage"
            value={usageFilter}
            options={USAGE_OPTIONS}
            isOpen={openDropdown === 'usage'}
            onToggle={() => toggleDropdown('usage')}
            onChange={(value) => {
              setUsageFilter(value);
              setOpenDropdown(null);
            }}
          />

          <FilterDropdown
            label="Date"
            value={dateFilter}
            options={DATE_OPTIONS}
            isOpen={openDropdown === 'date'}
            onToggle={() => toggleDropdown('date')}
            onChange={(value) => {
              setDateFilter(value);
              setOpenDropdown(null);
            }}
          />

          <div className="ml-view-toggle">
            <button
              type="button"
              className={viewMode === 'grid' ? 'is-active' : ''}
              onClick={() => setViewMode('grid')}
              aria-label="Grid view"
              aria-pressed={viewMode === 'grid'}
            >
              <AdminIcon name="dashboard" size={15} />
            </button>
            <button
              type="button"
              className={viewMode === 'list' ? 'is-active' : ''}
              onClick={() => setViewMode('list')}
              aria-label="List view"
              aria-pressed={viewMode === 'list'}
            >
              <AdminIcon name="sort" size={15} />
            </button>
          </div>
        </div>

        <div className="ml-quick-row">
          <div className="ml-quick-filters" role="group" aria-label="File type filters">
            {TYPE_FILTERS.map((filter) => (
              <button
                key={filter.key}
                type="button"
                className={`ml-quick-filter${typeFilter === filter.key ? ' is-active' : ''}`}
                onClick={() => setTypeFilter(filter.key)}
                aria-pressed={typeFilter === filter.key}
              >
                {filter.label} <span>{filter.count}</span>
              </button>
            ))}
          </div>

          {(typeFilter !== 'All' ||
            folderFilter !== 'All folders' ||
            usageFilter !== 'All files' ||
            dateFilter !== 'All time' ||
            search) && (
            <button type="button" className="ml-clear-filters" onClick={clearFilters}>
              Clear filters
            </button>
          )}
        </div>
      </section>

      {/* FILE GRID / LIST */}
      {viewMode === 'grid' ? (
        <section className="ml-grid">
          {filteredFiles.map((file) => (
            <FileTile
              key={file.id}
              file={file}
              isSelected={selectedIds.includes(file.id)}
              onToggleSelect={toggleSelected}
              isMenuOpen={openTileMenu === file.id}
              onToggleMenu={(id) => setOpenTileMenu((current) => (current === id ? null : id))}
              onMenuAction={handleTileMenuAction}
            />
          ))}

          {filteredFiles.length === 0 && (
            <div className="ml-empty-state">
              <AdminIcon name="searchSlash" size={20} />
              <strong>No files match these filters.</strong>
              <button type="button" onClick={clearFilters}>Reset filters</button>
            </div>
          )}
        </section>
      ) : (
        <section className="ml-list-card">
          <div className="ml-list-scroll">
            <table className="ml-list-table">
              <thead>
                <tr>
                  <th className="ml-list-checkbox-cell" />
                  <th>FILE</th>
                  <th>FOLDER</th>
                  <th>USAGE</th>
                  <th>SIZE</th>
                  <th className="ml-list-actions-heading">ACTIONS</th>
                </tr>
              </thead>
              <tbody>
                {filteredFiles.map((file) => (
                  <tr key={file.id}>
                    <td className="ml-list-checkbox-cell">
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(file.id)}
                        onChange={() => toggleSelected(file.id)}
                        aria-label={`Select ${file.name}`}
                      />
                    </td>
                    <td className="ml-list-name-cell">
                      <span className="ml-list-thumb" style={{ background: file.swatch }} />
                      <span>{file.name}</span>
                    </td>
                    <td>{file.folder}</td>
                    <td>
                      <span className={`ml-usage-pill${file.usage === 'Unused' ? ' is-unused' : ''}`}>
                        {file.usage}
                      </span>
                    </td>
                    <td>{formatFileLabel(file)}</td>
                    <td className="ml-list-actions-heading">
                      <button
                        type="button"
                        className="products-row-menu-button"
                        onClick={() =>
                          setOpenTileMenu((current) => (current === file.id ? null : file.id))
                        }
                      >
                        <AdminIcon name="more" size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* PAGINATION */}
      <div className="ml-pagination">
        <span>
          Showing 1–{filteredFiles.length} of {files.length < 1846 ? '1,846' : files.length}
        </span>

        <div className="ml-pagination-controls">
          <button type="button" disabled>Previous</button>
          <button type="button" className="is-active">1</button>
          <button type="button">2</button>
          <button type="button">3</button>
          <span>…</span>
          <button type="button">154</button>
          <button type="button">Next</button>
        </div>
      </div>

      {/* BULK ACTION BAR */}
      {selectedIds.length > 0 && (
        <div className="ml-bulk-bar">
          <strong>{selectedIds.length} selected</strong>

          <button type="button" onClick={bulkMoveToFolder}>
            <AdminIcon name="categories" size={14} />
            Move to folder
          </button>

          <button type="button" onClick={bulkDownload}>
            <AdminIcon name="download" size={14} />
            Download
          </button>

          <button type="button" onClick={bulkCopyUrls}>
            <AdminIcon name="copy" size={14} />
            Copy URLs
          </button>

          <button type="button" className="is-danger" onClick={bulkDelete}>
            <AdminIcon name="trash" size={14} />
            Delete
          </button>

          <button
            className="ml-bulk-clear"
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