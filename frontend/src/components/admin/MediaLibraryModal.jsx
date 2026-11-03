import { useState, useEffect } from 'react';
import adminApi from '../../lib/api/adminApi';
import { AdminIcon } from './AdminLayout';

export default function MediaLibraryModal({ isOpen, onClose, onSelect, initialKind = 'image' }) {
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedFile, setSelectedFile] = useState(null);
  const [search, setSearch] = useState('');
  const [kind, setKind] = useState(initialKind);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (!isOpen) return;

    let cancelled = false;
    setLoading(true);

    adminApi
      .getMedia({ limit: 48, kind: kind === 'All' ? undefined : kind, search: search.trim() || undefined })
      .then((res) => {
        if (!cancelled && res?.data?.files) {
          setFiles(res.data.files);
        }
      })
      .catch((err) => {
        console.error('Failed to load media in modal:', err);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [isOpen, kind, search]);

  if (!isOpen) return null;

  const handleUpload = async (e) => {
    const uploadedFiles = e.target.files;
    if (!uploadedFiles || uploadedFiles.length === 0) return;

    setUploading(true);
    const formData = new FormData();
    for (let i = 0; i < uploadedFiles.length; i++) {
      formData.append('files', uploadedFiles[i]);
    }

    try {
      const res = await adminApi.uploadMedia(formData);
      if (res?.data?.uploaded?.length > 0) {
        // Refresh list
        const refreshRes = await adminApi.getMedia({ limit: 48, kind: kind === 'All' ? undefined : kind });
        setFiles(refreshRes?.data?.files || []);
        setSelectedFile(res.data.uploaded[0]);
      }
    } catch (err) {
      alert(err.response?.data?.message || err.message || 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const handleConfirm = () => {
    if (selectedFile) {
      onSelect(selectedFile);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
      <div className="relative w-full max-w-4xl bg-[#FAF8F5] border border-[#DDD6CC] rounded-xl shadow-2xl flex flex-col max-h-[85vh] overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-[#EAE4DC] flex items-center justify-between bg-white">
          <div>
            <h3 className="text-sm font-semibold text-[#1A1A1A]">Media Library</h3>
            <p className="text-xs text-[#8A847C]">Select an existing file or upload a new one.</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-[#8A847C] hover:text-[#1A1A1A] p-1 rounded-md"
          >
            <AdminIcon name="close" size={16} />
          </button>
        </div>

        {/* Toolbar */}
        <div className="px-6 py-3 border-b border-[#EAE4DC] bg-[#FAF8F5] flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 flex-1 max-w-md">
            <input
              type="search"
              placeholder="Search file name…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full px-3 py-1.5 text-xs bg-white border border-[#DDD6CC] rounded-md focus:outline-none focus:border-[#1A1A1A]"
            />
          </div>

          <div className="flex items-center gap-2">
            <label className="admin-action-button is-primary cursor-pointer text-xs">
              <AdminIcon name="plus" size={14} />
              <span>{uploading ? 'Uploading…' : 'Upload file'}</span>
              <input
                type="file"
                multiple
                accept="image/*,video/*,application/pdf"
                className="hidden"
                disabled={uploading}
                onChange={handleUpload}
              />
            </label>
          </div>
        </div>

        {/* Content Grid */}
        <div className="flex-1 p-6 overflow-y-auto">
          {loading ? (
            <div className="p-12 text-center text-xs text-[#8A847C]">Loading files…</div>
          ) : files.length === 0 ? (
            <div className="p-12 text-center text-xs text-[#8A847C]">No files found.</div>
          ) : (
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-3">
              {files.map((file) => {
                const isSelected = selectedFile?.id === file.id || selectedFile?.url === file.url;
                return (
                  <button
                    key={file.id}
                    type="button"
                    onClick={() => setSelectedFile(file)}
                    className={`group relative flex flex-col text-left border rounded-lg overflow-hidden transition ${
                      isSelected
                        ? 'border-[#1A1A1A] ring-2 ring-[#1A1A1A]'
                        : 'border-[#DDD6CC] hover:border-[#8A847C]'
                    } bg-white`}
                  >
                    <div className="aspect-square bg-[#F3F0EB] flex items-center justify-center overflow-hidden">
                      {file.type === 'image' && file.thumbnailUrl ? (
                        <img
                          src={file.thumbnailUrl}
                          alt={file.name}
                          className="w-full h-full object-cover"
                          loading="lazy"
                        />
                      ) : (
                        <AdminIcon name="document" size={24} className="text-[#8A847C]" />
                      )}
                    </div>
                    <div className="p-1.5">
                      <p className="text-[11px] font-medium text-[#1A1A1A] truncate" title={file.name}>
                        {file.name}
                      </p>
                      <p className="text-[10px] text-[#8A847C]">{file.size}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-[#EAE4DC] bg-white flex items-center justify-between">
          <div className="text-xs text-[#8A847C] truncate max-w-sm">
            {selectedFile ? `Selected: ${selectedFile.name}` : 'No file selected'}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="admin-action-button text-xs"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={!selectedFile}
              onClick={handleConfirm}
              className="admin-action-button is-primary text-xs disabled:opacity-50"
            >
              Choose File
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
