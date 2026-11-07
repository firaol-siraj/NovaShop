import { useEffect, useMemo, useRef, useState } from 'react';
import { AdminIcon } from '../../components/admin/AdminLayout';
import AdminRowActionMenu from '../../components/admin/AdminRowActionMenu';
import adminApi from '../../lib/api/adminApi';
import './admin-medialibrary.css';

function formatFileLabel(file) {
  if (file.type === 'document') return `${file.size}`;
  if (file.type === 'video') return `${file.duration || ''} · ${file.size}`;
  return `${file.dims || ''} · ${file.size}`;
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
        style={{ background: file.swatch || '#F3F0EB' }}
        onClick={() => onToggleSelect(file.id)}
        aria-label={`Select ${file.name}`}
      >
        <span className="ml-tile-checkbox" aria-hidden="true">
          {isSelected && <AdminIcon name="check" size={11} />}
        </span>

        {file.type === 'image' && (
          file.thumbnailUrl || file.url ? (
            <img
              src={file.thumbnailUrl || file.url}
              alt={file.altText || file.name}
              className="w-full h-full object-cover"
              loading="lazy"
            />
          ) : (
            <AdminIcon name="document" size={20} />
          )
        )}

        {file.type === 'document' && (
          <span className="ml-tile-doc">
            <AdminIcon name="document" size={18} />
            <small>PDF</small>
          </span>
        )}

        {file.type === 'video' && (
          <>
            <video
              src={file.url}
              preload="metadata"
              muted
              playsInline
              className="w-full h-full object-cover"
            />
            <span className="ml-tile-duration">{file.duration || 'Video'}</span>
          </>
        )}

        <span className="ml-tile-menu-anchor" onClick={(event) => event.stopPropagation()}>
          <AdminRowActionMenu
            item={file}
            title={file.name}
            subtitle={formatFileLabel(file)}
            items={[
              {
                label: 'View details',
                icon: 'eye',
                onClick: () => onMenuAction('details', file),
              },
              {
                label: 'Copy URL',
                icon: 'copy',
                onClick: () => onMenuAction('copy', file),
              },
              {
                label: 'Download',
                icon: 'download',
                onClick: () => onMenuAction('download', file),
              },
              {
                divider: true,
              },
              {
                label: 'Delete',
                icon: 'trash',
                danger: true,
                onClick: () => onMenuAction('delete', file),
              },
            ]}
          />
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
  const [files, setFiles] = useState([]);
  const [totalFilesCount, setTotalFilesCount] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);

  const [stats, setStats] = useState({
    totalFiles: 0,
    totalFilesTrend: '-',
    storageUsedFormatted: '-',
    quotaLabel: '-',
    unusedFiles: 0,
    unusedFilesTrend: '-',
    uploadedThisMonth: 0,
    uploadedThisMonthTrend: '-',
    tabCounts: { All: 0, image: 0, video: 0, document: 0 },
  });

  const [selectedIds, setSelectedIds] = useState([]);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('All');
  const [folderFilter, setFolderFilter] = useState('All folders');
  const [folderOptions, setFolderOptions] = useState(['All folders']);
  const [usageFilter, setUsageFilter] = useState('All files');
  const [sortFilter, setSortFilter] = useState('Newest first');
  const [dateFilter, setDateFilter] = useState('All time');
  const [openDropdown, setOpenDropdown] = useState(null);
  const [openTileMenu, setOpenTileMenu] = useState(null);
  const [viewMode, setViewMode] = useState('grid');
  const [notice, setNotice] = useState('');
  const [uploading, setUploading] = useState(false);
  const [activeDetailsFile, setActiveDetailsFile] = useState(null);
  const [usageDetails, setUsageDetails] = useState(null);
  const [loadingUsage, setLoadingUsage] = useState(false);

  const toolbarRef = useRef(null);
  const fileInputRef = useRef(null);

  const notify = (message) => {
    setNotice(message);
    window.clearTimeout(window.__novaMediaToast);
    window.__novaMediaToast = window.setTimeout(() => setNotice(''), 2500);
  };

  const refreshFolders = () => {
    adminApi.getMediaFolders().then((res) => {
      if (Array.isArray(res?.data)) {
        const names = ['All folders', ...res.data.map((f) => f.name)];
        setFolderOptions(names);
      }
    }).catch(() => {});
  };

  // Close menus on outside click
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

  // Fetch folders and KPI stats once
  useEffect(() => {
    adminApi.getMediaStats().then((res) => {
      if (res?.data) setStats(res.data);
    }).catch(() => {});

    refreshFolders();
  }, []);

  // Fetch paginated files on filter or page change
  const fetchFiles = () => {
    setLoading(true);

    let dateFrom = undefined;
    const now = new Date();
    if (dateFilter === 'Last 7 days') {
      dateFrom = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
    } else if (dateFilter === 'Last 30 days') {
      dateFrom = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
    }

    const sortParam =
      sortFilter === 'Oldest first'
        ? 'oldest'
        : sortFilter === 'Name A–Z'
        ? 'name_asc'
        : sortFilter === 'Size (largest)'
        ? 'size_desc'
        : 'newest';

    adminApi
      .getMedia({
        page,
        limit: 24,
        search: search.trim() || undefined,
        kind: typeFilter === 'All' ? undefined : typeFilter,
        folder: folderFilter === 'All folders' ? undefined : folderFilter,
        usage: usageFilter === 'All files' ? undefined : usageFilter,
        sort: sortParam,
        dateFrom,
      })
      .then((res) => {
        if (res?.data) {
          setFiles(res.data.files || []);
          setTotalFilesCount(res.data.total || 0);
          setTotalPages(res.data.pages || 1);
          if (res.data.tabCounts) {
            setStats((prev) => ({ ...prev, tabCounts: res.data.tabCounts }));
          }
        }
      })
      .catch((err) => {
        notify(err.response?.data?.message || err.message || 'Failed to load media.');
      })
      .finally(() => {
        setLoading(false);
      });
  };

  useEffect(() => {
    fetchFiles();
  }, [page, search, typeFilter, folderFilter, usageFilter, dateFilter, sortFilter]);

  const toggleSelected = (id) => {
    setSelectedIds((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id]
    );
  };

  const toggleDropdown = (name) => {
    setOpenDropdown((current) => (current === name ? null : name));
  };

  const handleTileMenuAction = async (action, file) => {
    setOpenTileMenu(null);

    switch (action) {
      case 'details': {
        setActiveDetailsFile(file);
        setLoadingUsage(true);
        try {
          const res = await adminApi.getMediaUsage(file.id);
          setUsageDetails(res?.data || null);
        } catch {
          setUsageDetails(null);
        } finally {
          setLoadingUsage(false);
        }
        break;
      }
      case 'copy': {
        const fullUrl = file.url.startsWith('http') ? file.url : `${window.location.origin}${file.url}`;
        navigator.clipboard?.writeText(fullUrl);
        notify('File URL copied to clipboard');
        break;
      }
      case 'download': {
        const link = document.createElement('a');
        link.href = file.url;
        link.download = file.name;
        link.target = '_blank';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        notify(`Downloading ${file.name}`);
        break;
      }
      case 'delete': {
        if (file.usage === 'Used') {
          const confirmDelete = window.confirm(
            `Warning: "${file.name}" is currently in use across the store. Deleting it may break images on product or category pages.\n\nAre you sure you want to delete it?`
          );
          if (!confirmDelete) return;
        }
        try {
          await adminApi.deleteMediaFile(file.id, true);
          notify(`${file.name} deleted`);
          fetchFiles();
          adminApi.getMediaStats().then((res) => res?.data && setStats(res.data));
        } catch (err) {
          notify(err.message || err.data?.message || err.response?.data?.message || 'Failed to delete file.');
        }
        break;
      }
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
    setSortFilter('Newest first');
    setPage(1);
  };

  // Upload handler
  const handleFileUpload = async (event) => {
    const uploadFiles = event.target.files;
    if (!uploadFiles || uploadFiles.length === 0) return;

    for (let i = 0; i < uploadFiles.length; i++) {
      if (uploadFiles[i].size > 50 * 1024 * 1024) {
        alert(`File "${uploadFiles[i].name}" exceeds 50MB limit.`);
        return;
      }
    }

    setUploading(true);
    const formData = new FormData();
    for (let i = 0; i < uploadFiles.length; i++) {
      formData.append('files', uploadFiles[i]);
    }
    if (folderFilter !== 'All folders') {
      formData.append('folder', folderFilter);
    }

    try {
      const res = await adminApi.uploadMedia(formData);
      const count = res?.data?.uploaded?.length || 0;
      notify(`Successfully uploaded ${count} file(s)${folderFilter !== 'All folders' ? ` into ${folderFilter}` : ''}.`);
      fetchFiles();
      adminApi.getMediaStats().then((s) => s?.data && setStats(s.data));
    } catch (err) {
      notify(err.response?.data?.message || err.message || 'Upload failed.');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // Drag and drop onto grid
  const handleDrop = async (e) => {
    e.preventDefault();
    const droppedFiles = e.dataTransfer.files;
    if (!droppedFiles || droppedFiles.length === 0) return;

    for (let i = 0; i < droppedFiles.length; i++) {
      if (droppedFiles[i].size > 50 * 1024 * 1024) {
        alert(`File "${droppedFiles[i].name}" exceeds 50MB limit.`);
        return;
      }
    }

    setUploading(true);
    const formData = new FormData();
    for (let i = 0; i < droppedFiles.length; i++) {
      formData.append('files', droppedFiles[i]);
    }
    if (folderFilter !== 'All folders') {
      formData.append('folder', folderFilter);
    }

    try {
      const res = await adminApi.uploadMedia(formData);
      const count = res?.data?.uploaded?.length || 0;
      notify(`Successfully uploaded ${count} file(s)${folderFilter !== 'All folders' ? ` into ${folderFilter}` : ''}.`);
      fetchFiles();
      adminApi.getMediaStats().then((s) => s?.data && setStats(s.data));
    } catch (err) {
      notify(err.response?.data?.message || err.message || 'Upload failed.');
    } finally {
      setUploading(false);
    }
  };

  const handleNewFolder = async () => {
    const rawName = window.prompt('Enter new folder name:');
    if (!rawName || !rawName.trim()) return;

    const trimmed = rawName.trim();
    if (folderOptions.some((f) => f.toLowerCase() === trimmed.toLowerCase())) {
      notify(`A folder named "${trimmed}" already exists.`);
      return;
    }

    try {
      await adminApi.createMediaFolder(trimmed);
      notify(`Folder "${trimmed}" created.`);
      setFolderFilter(trimmed);
      setPage(1);
      refreshFolders();
      fetchFiles();
    } catch (err) {
      notify(err.message || err.data?.message || err.response?.data?.message || 'Failed to create folder.');
    }
  };

  const handleRenameFolder = async () => {
    if (folderFilter === 'All folders') {
      alert('Select a specific folder to rename.');
      return;
    }
    const newName = window.prompt(`Enter new name for folder "${folderFilter}":`, folderFilter);
    if (!newName || !newName.trim() || newName.trim() === folderFilter) return;

    try {
      await adminApi.updateMediaFolder(folderFilter, { name: newName.trim() });
      notify(`Folder renamed to "${newName.trim()}".`);
      setFolderFilter(newName.trim());
      refreshFolders();
      fetchFiles();
    } catch (err) {
      notify(err.response?.data?.message || err.message || 'Failed to rename folder.');
    }
  };

  const handleDeleteFolder = async () => {
    if (folderFilter === 'All folders') {
      alert('Cannot delete "All folders". Select a specific folder to delete.');
      return;
    }
    const confirm = window.confirm(`Delete folder "${folderFilter}"? Contained files will be preserved and moved to root.`);
    if (!confirm) return;

    try {
      await adminApi.deleteMediaFolder(folderFilter, { moveTo: 'root' });
      notify(`Folder "${folderFilter}" deleted.`);
      setFolderFilter('All folders');
      refreshFolders();
      fetchFiles();
      adminApi.getMediaStats().then((res) => res?.data && setStats(res.data));
    } catch (err) {
      notify(err.response?.data?.message || err.message || 'Failed to delete folder.');
    }
  };

  const bulkDownload = () => {
    const selectedFiles = files.filter((f) => selectedIds.includes(f.id));
    selectedFiles.forEach((file) => {
      const link = document.createElement('a');
      link.href = file.url;
      link.download = file.name;
      link.target = '_blank';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    });
    notify(`${selectedIds.length} files downloading`);
  };

  const bulkCopyUrls = () => {
    const selectedFiles = files.filter((f) => selectedIds.includes(f.id));
    const urls = selectedFiles.map((f) => f.url.startsWith('http') ? f.url : `${window.location.origin}${f.url}`).join('\n');
    navigator.clipboard?.writeText(urls);
    notify('File URLs copied to clipboard');
  };

  const bulkMoveToFolder = async () => {
    const available = folderOptions.filter((f) => f !== 'All folders');
    const targetFolder = window.prompt(
      `Move ${selectedIds.length} file(s) to folder name:\n(Available: ${available.join(', ')})`
    );
    if (!targetFolder || !targetFolder.trim()) return;

    try {
      await adminApi.bulkMediaActions('move', selectedIds, targetFolder.trim());
      notify(`${selectedIds.length} files moved.`);
      fetchFiles();
      setSelectedIds([]);
      const res = await adminApi.getMediaFolders();
      if (Array.isArray(res?.data)) {
        const names = ['All folders', ...new Set(res.data.map((f) => f.name))];
        setFolderOptions(names);
      }
    } catch (err) {
      notify(err.message || err.data?.message || err.response?.data?.message || 'Move failed.');
    }
  };

  const bulkDelete = async () => {
    const confirmDelete = window.confirm(`Are you sure you want to delete ${selectedIds.length} selected files?`);
    if (!confirmDelete) return;

    try {
      const res = await adminApi.bulkMediaActions('delete', selectedIds, null, true);
      notify(res?.message || `${selectedIds.length} files deleted.`);
      setSelectedIds([]);
      fetchFiles();
      adminApi.getMediaStats().then((s) => s?.data && setStats(s.data));
    } catch (err) {
      notify(err.message || err.data?.message || err.response?.data?.message || 'Bulk delete failed.');
    }
  };

  const tabFilters = [
    { key: 'All', label: 'All', count: (stats.tabCounts?.All || totalFilesCount).toLocaleString() },
    { key: 'image', label: 'Images', count: (stats.tabCounts?.image || 0).toLocaleString() },
    { key: 'video', label: 'Videos', count: (stats.tabCounts?.video || 0).toLocaleString() },
    { key: 'document', label: 'Documents', count: (stats.tabCounts?.document || 0).toLocaleString() },
  ];

  return (
    <div
      className="admin-dashboard ml-page"
      onDragOver={(e) => e.preventDefault()}
      onDrop={handleDrop}
    >
      <input
        type="file"
        ref={fileInputRef}
        multiple
        accept="image/*,video/*,application/pdf"
        className="hidden"
        style={{ display: 'none' }}
        onChange={handleFileUpload}
      />

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

          <button
            type="button"
            className="admin-action-button is-primary"
            disabled={uploading}
            onClick={() => fileInputRef.current?.click()}
          >
            <AdminIcon name="download" size={15} />
            {uploading ? 'Uploading…' : 'Upload files'}
          </button>
        </div>
      </section>

      <div className="ml-kpi-label">LAST 30 DAYS</div>

      {/* KPI ROW — shared admin-stat-* classes */}
      <section className="admin-stat-grid ml-stat-grid">
        <article className="admin-stat-card">
          <div className="admin-stat-heading">
            <span className="admin-stat-label">Total files</span>
            <span className="admin-trend-pill">{stats.totalFilesTrend}</span>
          </div>
          <div className="admin-stat-value">{stats.totalFiles.toLocaleString()}</div>
        </article>

        <article className="admin-stat-card">
          <div className="admin-stat-heading">
            <span className="admin-stat-label">Storage used</span>
            <span className="admin-trend-pill is-neutral">{stats.quotaLabel}</span>
          </div>
          <div className="admin-stat-value">{stats.storageUsedFormatted}</div>
        </article>

        <article className="admin-stat-card">
          <div className="admin-stat-heading">
            <span className="admin-stat-label">Unused files</span>
            <span className="admin-trend-pill">{stats.unusedFilesTrend}</span>
          </div>
          <div className="admin-stat-value">{stats.unusedFiles.toLocaleString()}</div>
        </article>

        <article className="admin-stat-card">
          <div className="admin-stat-heading">
            <span className="admin-stat-label">Uploaded this month</span>
            <span className="admin-trend-pill">{stats.uploadedThisMonthTrend}</span>
          </div>
          <div className="admin-stat-value">{stats.uploadedThisMonth.toLocaleString()}</div>
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
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
              placeholder="Search by file name"
              aria-label="Search by file name"
            />
          </label>

          <FilterDropdown
            label="Folder"
            value={folderFilter}
            options={folderOptions}
            isOpen={openDropdown === 'folder'}
            onToggle={() => toggleDropdown('folder')}
            onChange={(value) => {
              setFolderFilter(value);
              setOpenDropdown(null);
              setPage(1);
            }}
          />

          {folderFilter !== 'All folders' && (
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                className="admin-action-button text-xs py-1 px-2.5"
                onClick={handleRenameFolder}
                title="Rename selected folder"
              >
                <AdminIcon name="edit" size={12} />
                Rename
              </button>
              <button
                type="button"
                className="admin-action-button text-xs py-1 px-2.5 text-red-500 hover:text-red-600"
                onClick={handleDeleteFolder}
                title="Delete selected folder"
              >
                <AdminIcon name="trash" size={12} />
                Delete
              </button>
            </div>
          )}

          <FilterDropdown
            label="Usage"
            value={usageFilter}
            options={['All files', 'Used', 'Unused']}
            isOpen={openDropdown === 'usage'}
            onToggle={() => toggleDropdown('usage')}
            onChange={(value) => {
              setUsageFilter(value);
              setOpenDropdown(null);
              setPage(1);
            }}
          />

          <FilterDropdown
            label="Sort"
            value={sortFilter}
            options={['Newest first', 'Oldest first', 'Name A–Z', 'Size (largest)']}
            isOpen={openDropdown === 'sort'}
            onToggle={() => toggleDropdown('sort')}
            onChange={(value) => {
              setSortFilter(value);
              setOpenDropdown(null);
              setPage(1);
            }}
          />

          <FilterDropdown
            label="Date"
            value={dateFilter}
            options={['All time', 'Last 7 days', 'Last 30 days']}
            isOpen={openDropdown === 'date'}
            onToggle={() => toggleDropdown('date')}
            onChange={(value) => {
              setDateFilter(value);
              setOpenDropdown(null);
              setPage(1);
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
            {tabFilters.map((filter) => (
              <button
                key={filter.key}
                type="button"
                className={`ml-quick-filter${typeFilter === filter.key ? ' is-active' : ''}`}
                onClick={() => {
                  setTypeFilter(filter.key);
                  setPage(1);
                }}
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
            sortFilter !== 'Newest first' ||
            search) && (
            <button type="button" className="ml-clear-filters" onClick={clearFilters}>
              Clear filters
            </button>
          )}
        </div>
      </section>

      {/* FILE GRID / LIST */}
      {loading ? (
        <div className="p-16 text-center text-xs text-[#8A847C]">Loading files…</div>
      ) : viewMode === 'grid' ? (
        <section className="ml-grid">
          {files.map((file) => (
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

          {files.length === 0 && (
            <div className="ml-empty-state">
              <AdminIcon name="searchSlash" size={20} />
              <strong>
                No files match these filters
                {folderFilter !== 'All folders' ? ` in "${folderFilter}"` : ''}
                {typeFilter !== 'All' ? ` (${typeFilter}s)` : ''}
                {usageFilter !== 'All files' ? ` (${usageFilter})` : ''}
                {search ? ` matching "${search}"` : ''}.
              </strong>
              <button type="button" onClick={clearFilters}>Reset all filters</button>
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
                {files.map((file) => (
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
                      <span className="ml-list-thumb" style={{ background: file.swatch || '#F3F0EB' }}>
                        {file.type === 'image' && (file.thumbnailUrl || file.url) && (
                          <img
                            src={file.thumbnailUrl || file.url}
                            alt={file.altText || file.name}
                            className="w-full h-full object-cover rounded"
                            loading="lazy"
                          />
                        )}
                      </span>
                      <span>{file.name}</span>
                    </td>
                    <td>{file.folder}</td>
                    <td>
                      <span className={`ml-usage-pill${file.usage === 'Unused' ? ' is-unused' : ''}`}>
                        {file.usage}
                      </span>
                    </td>
                    <td>{formatFileLabel(file)}</td>
                    <td className="ml-list-actions-heading" onClick={(event) => event.stopPropagation()}>
                      <AdminRowActionMenu
                        item={file}
                        title={file.name}
                        subtitle={formatFileLabel(file)}
                        items={[
                          {
                            label: 'View details',
                            icon: 'eye',
                            onClick: () => handleTileMenuAction('details', file),
                          },
                          {
                            label: 'Copy URL',
                            icon: 'copy',
                            onClick: () => handleTileMenuAction('copy', file),
                          },
                          {
                            label: 'Download',
                            icon: 'download',
                            onClick: () => handleTileMenuAction('download', file),
                          },
                          {
                            divider: true,
                          },
                          {
                            label: 'Delete',
                            icon: 'trash',
                            danger: true,
                            onClick: () => handleTileMenuAction('delete', file),
                          },
                        ]}
                      />
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
          Showing {files.length > 0 ? (page - 1) * 24 + 1 : 0}–{Math.min(page * 24, totalFilesCount)} of {totalFilesCount.toLocaleString()}
        </span>

        <div className="ml-pagination-controls">
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            Previous
          </button>
          {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => i + 1).map((pageNum) => (
            <button
              key={pageNum}
              type="button"
              className={page === pageNum ? 'is-active' : ''}
              onClick={() => setPage(pageNum)}
            >
              {pageNum}
            </button>
          ))}
          {totalPages > 5 && <span>…</span>}
          <button
            type="button"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
          >
            Next
          </button>
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

      {/* FILE DETAILS MODAL WITH USAGE TRACKING */}
      {activeDetailsFile && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
          <div className="relative w-full max-w-xl bg-white border border-[#DDD6CC] rounded-xl shadow-2xl p-6 overflow-hidden">
            <div className="flex items-center justify-between pb-3 border-b border-[#EAE4DC]">
              <h3 className="text-sm font-semibold text-[#1A1A1A]">File Details</h3>
              <button
                type="button"
                onClick={() => setActiveDetailsFile(null)}
                className="text-[#8A847C] hover:text-[#1A1A1A]"
              >
                <AdminIcon name="close" size={16} />
              </button>
            </div>

            <div className="py-4 space-y-4 max-h-[65vh] overflow-y-auto">
              {activeDetailsFile.type === 'video' && (
                <div className="w-full rounded-lg bg-black overflow-hidden flex items-center justify-center p-2 mb-2">
                  <video
                    src={activeDetailsFile.url}
                    controls
                    className="max-h-56 max-w-full rounded"
                  />
                </div>
              )}

              <div className="flex items-center gap-4">
                <div className="w-20 h-20 rounded-lg bg-[#F3F0EB] overflow-hidden flex-shrink-0 flex items-center justify-center border border-[#DDD6CC]">
                  {activeDetailsFile.type === 'image' && (activeDetailsFile.thumbnailUrl || activeDetailsFile.url) ? (
                    <img
                      src={activeDetailsFile.thumbnailUrl || activeDetailsFile.url}
                      alt={activeDetailsFile.name}
                      className="w-full h-full object-cover"
                    />
                  ) : activeDetailsFile.type === 'video' ? (
                    <video
                      src={activeDetailsFile.url}
                      className="w-full h-full object-cover"
                      muted
                    />
                  ) : (
                    <AdminIcon name="document" size={24} className="text-[#8A847C]" />
                  )}
                </div>
                <div className="overflow-hidden">
                  <h4 className="text-xs font-semibold text-[#1A1A1A] truncate" title={activeDetailsFile.name}>
                    {activeDetailsFile.name}
                  </h4>
                  <p className="text-[11px] text-[#8A847C] mt-0.5">
                    {formatFileLabel(activeDetailsFile)} · {activeDetailsFile.folder}
                  </p>
                  <p className="text-[10px] text-[#8A847C] mt-1 break-all">
                    {activeDetailsFile.url}
                  </p>
                </div>
              </div>

              {/* Usage tracking section */}
              <div className="border-t border-[#EAE4DC] pt-3">
                <h5 className="text-xs font-semibold text-[#1A1A1A] mb-1.5 flex items-center justify-between">
                  <span>Store References (Usage)</span>
                  <span className={`text-[10px] px-2 py-0.5 rounded font-medium ${usageDetails?.inUse ? 'bg-[#EBF3ED] text-[#2D6A4F]' : 'bg-[#F3F0EB] text-[#7B746C]'}`}>
                    {usageDetails?.inUse ? `${usageDetails.totalUsages} location(s)` : 'Unused'}
                  </span>
                </h5>

                {loadingUsage ? (
                  <p className="text-xs text-[#8A847C]">Checking store references…</p>
                ) : usageDetails?.usages?.length > 0 ? (
                  <div className="space-y-1.5 mt-2">
                    {usageDetails.usages.map((u, i) => (
                      <div
                        key={i}
                        className="text-xs flex items-center justify-between p-2 rounded bg-[#FAF8F5] border border-[#EAE4DC]"
                      >
                        <div>
                          <strong className="text-[#1A1A1A]">{u.name}</strong>
                          <span className="text-[10px] text-[#8A847C] ml-2">({u.typeLabel})</span>
                        </div>
                        {u.link && (
                          <a
                            href={u.link}
                            className="text-[11px] text-[#766247] hover:underline"
                            target="_blank"
                            rel="noreferrer"
                          >
                            View
                          </a>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-[#8A847C]">
                    This file is not currently referenced by any products, categories, hero slides, or homepage sections.
                  </p>
                )}
              </div>
            </div>

            <div className="pt-3 border-t border-[#EAE4DC] flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  const fullUrl = activeDetailsFile.url.startsWith('http') ? activeDetailsFile.url : `${window.location.origin}${activeDetailsFile.url}`;
                  navigator.clipboard?.writeText(fullUrl);
                  notify('File URL copied');
                }}
                className="admin-action-button text-xs"
              >
                Copy URL
              </button>
              <button
                type="button"
                onClick={() => setActiveDetailsFile(null)}
                className="admin-action-button is-primary text-xs"
              >
                Done
              </button>
            </div>
          </div>
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
