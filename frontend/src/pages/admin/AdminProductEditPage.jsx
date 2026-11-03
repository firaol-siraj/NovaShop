import { useEffect, useRef, useState, useMemo } from 'react';
import { AdminIcon } from '../../components/admin/AdminLayout';
import adminApi from '../../lib/api/adminApi';
import { productApi } from '../../lib/api/productApi';
import './admin-product-edit.css';

function createInitialForm(isCreate = true) {
  return {
    name: '',
    description: '',
    price: '',
    brand: 'NovaShop',
    sku: 'NS-PRD',
    status: 'active',
    category: '',
    variants: [],
    media: [],
    stock: '0',
  };
}

function EditorCard({ title, subtitle, tag, right, children, className = '' }) {
  return (
    <section className={`pe-card ${className}`}>
      <header className="pe-card-header">
        <div>
          <h2 className="pe-card-title">{title}</h2>
          {subtitle && <p className="pe-card-subtitle">{subtitle}</p>}
        </div>
        <div className="pe-card-header-actions">
          {tag && <span className="pe-card-tag">{tag}</span>}
          {right}
        </div>
      </header>
      <div className="pe-card-body">{children}</div>
    </section>
  );
}

function VariantEditorModal({ variant, onClose, onSave }) {
  const [sku, setSku] = useState(variant.sku || '');
  const [price, setPrice] = useState(variant.price ?? '');
  const [stock, setStock] = useState(String(variant.stock ?? 0));
  const [colorName, setColorName] = useState(
    typeof variant.color === 'object' ? variant.color?.name || '' : variant.color || ''
  );
  const [colorHex, setColorHex] = useState(
    typeof variant.color === 'object' ? variant.color?.hex || '#000000' : '#000000'
  );
  const [size, setSize] = useState(variant.size || '');

  const submit = (event) => {
    event.preventDefault();
    onSave({
      ...variant,
      sku: sku.trim().toUpperCase(),
      size: size.trim().toUpperCase(),
      color: { name: colorName.trim(), hex: colorHex },
      price: price !== '' ? Number(price) : null,
      stock: Math.max(0, parseInt(stock, 10) || 0),
    });
  };

  return (
    <div
      className="pe-modal-backdrop"
      role="presentation"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <section
        className="pe-modal-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="pe-variant-title"
      >
        <header className="pe-modal-header">
          <div>
            <span className="pe-modal-eyebrow">Catalog Variant</span>
            <h2 id="pe-variant-title" className="pe-modal-title">Edit Variant</h2>
          </div>
          <button
            className="pe-modal-close"
            type="button"
            aria-label="Close"
            onClick={onClose}
          >
            <AdminIcon name="close" size={16} />
          </button>
        </header>

        <form onSubmit={submit} className="pe-modal-form">
          <div className="pe-form-row">
            <label className="pe-field">
              <span>Size</span>
              <input
                required
                value={size}
                onChange={(e) => setSize(e.target.value)}
                placeholder="e.g. S, M, L, 42"
              />
            </label>

            <label className="pe-field">
              <span>Color Name & Swatch</span>
              <div className="pe-color-input-wrap">
                <input
                  type="color"
                  value={colorHex}
                  onChange={(e) => setColorHex(e.target.value)}
                  className="pe-color-picker"
                  title="Pick color"
                />
                <input
                  required
                  value={colorName}
                  onChange={(e) => setColorName(e.target.value)}
                  placeholder="e.g. Camel, Black"
                />
              </div>
            </label>
          </div>

          <label className="pe-field">
            <span>SKU</span>
            <input
              required
              value={sku}
              onChange={(e) => setSku(e.target.value)}
              placeholder="e.g. NS-OC-CAM-S"
            />
          </label>

          <div className="pe-form-row">
            <label className="pe-field">
              <span>Price Override (Optional)</span>
              <div className="pe-input-prefix-wrap">
                <span className="pe-input-prefix">$</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  placeholder="Leave blank for base price"
                />
              </div>
            </label>

            <label className="pe-field">
              <span>Stock Quantity</span>
              <input
                required
                type="number"
                min="0"
                step="1"
                value={stock}
                onChange={(e) => setStock(e.target.value)}
              />
            </label>
          </div>

          <div className="pe-modal-footer">
            <button type="button" className="pe-action-btn is-discard" onClick={onClose}>
              Cancel
            </button>
            <button className="pe-action-btn is-primary" type="submit">
              Save Variant Changes
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}

function OptionBuilderModal({ onClose, onCreate, initialSku = 'NS-PRD', basePrice = '0' }) {
  const [options, setOptions] = useState([
    { name: 'Color', values: 'Camel, Black' },
    { name: 'Size', values: 'S, M, L' },
  ]);
  const [defaultStock, setDefaultStock] = useState('10');
  const [error, setError] = useState('');

  const updateOption = (index, key, value) =>
    setOptions((current) =>
      current.map((opt, i) => (i === index ? { ...opt, [key]: value } : opt))
    );

  const submit = (e) => {
    e.preventDefault();
    const cleaned = options
      .map((opt) => ({
        name: opt.name.trim(),
        values: [
          ...new Set(
            opt.values
              .split(',')
              .map((v) => v.trim())
              .filter(Boolean)
          ),
        ],
      }))
      .filter((opt) => opt.name && opt.values.length);

    if (!cleaned.length) {
      setError('Add an option name and at least one comma-separated value.');
      return;
    }

    const stockQty = Math.max(0, parseInt(defaultStock, 10) || 0);

    const combinations = cleaned.reduce(
      (acc, opt) => acc.flatMap((comb) => opt.values.map((v) => [...comb, { name: opt.name, value: v }])),
      [[]]
    );

    const colorsMap = {
      camel: '#B99C78',
      black: '#272624',
      ivory: '#E8E1D6',
      navy: '#343F50',
      brown: '#72513D',
      white: '#FFFFFF',
      grey: '#808080',
      gray: '#808080',
      beige: '#D2B48C',
    };

    const generatedVariants = combinations.map((comb, index) => {
      const colorOpt = comb.find((o) => o.name.toLowerCase() === 'color');
      const sizeOpt = comb.find((o) => o.name.toLowerCase() === 'size');
      const otherOpt = comb.find((o) => o !== colorOpt && o !== sizeOpt);

      const color = colorOpt?.value || otherOpt?.value || 'Default';
      const size = sizeOpt?.value || 'One size';
      const code = `${color}-${size}`
        .replace(/[^a-z0-9]+/gi, '-')
        .replace(/^-|-$/g, '')
        .toUpperCase();

      return {
        id: `v-gen-${Date.now()}-${index}`,
        color: { name: color, hex: colorsMap[color.toLowerCase()] || '#000000' },
        size,
        sku: `${initialSku.trim() || 'NS'}-${code}`,
        stock: stockQty,
        price: Number(basePrice) || 0,
      };
    });

    onCreate(generatedVariants);
  };

  return (
    <div
      className="pe-modal-backdrop"
      role="presentation"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <section
        className="pe-modal-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="pe-options-title"
      >
        <header className="pe-modal-header">
          <div>
            <span className="pe-modal-eyebrow">Product Catalog</span>
            <h2 id="pe-options-title" className="pe-modal-title">Generate Variant Matrix</h2>
          </div>
          <button className="pe-modal-close" type="button" onClick={onClose} aria-label="Close">
            <AdminIcon name="close" size={16} />
          </button>
        </header>

        <p className="pe-modal-desc">
          Specify option axes (such as Color and Size) to automatically generate combinations with starting stock.
        </p>

        <form onSubmit={submit} className="pe-modal-form">
          <div className="pe-option-builder-rows">
            {options.map((opt, i) => (
              <div className="pe-option-builder-row" key={i}>
                <label className="pe-field">
                  <span>Option name</span>
                  <input
                    value={opt.name}
                    onChange={(e) => updateOption(i, 'name', e.target.value)}
                    placeholder="e.g. Color"
                  />
                </label>
                <label className="pe-field">
                  <span>Values (comma-separated)</span>
                  <input
                    value={opt.values}
                    onChange={(e) => updateOption(i, 'values', e.target.value)}
                    placeholder="Camel, Black, Navy"
                  />
                </label>
                <button
                  type="button"
                  className="pe-option-remove-btn"
                  aria-label="Remove option"
                  disabled={options.length === 1}
                  onClick={() => setOptions((curr) => curr.filter((_, idx) => idx !== i))}
                >
                  <AdminIcon name="trash" size={14} />
                </button>
              </div>
            ))}
          </div>

          <label className="pe-field">
            <span>Initial Stock Per Variant</span>
            <input
              type="number"
              min="0"
              step="1"
              value={defaultStock}
              onChange={(e) => setDefaultStock(e.target.value)}
            />
          </label>

          {error && <p className="pe-form-error">{error}</p>}

          <div className="pe-modal-footer between">
            <button
              className="pe-add-option-row"
              type="button"
              onClick={() => setOptions((curr) => [...curr, { name: '', values: '' }])}
            >
              <AdminIcon name="plus" size={13} /> Add Option Axis
            </button>
            <button className="pe-action-btn is-primary" type="submit">
              Generate Variants
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}

export default function AdminProductEditPage({ go, mode = 'create', productId }) {
  const isCreate = mode === 'create';
  const [categories, setCategories] = useState([]);
  const [form, setForm] = useState(() => createInitialForm(isCreate));
  const [notice, setNotice] = useState('');
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loadingInitial, setLoadingInitial] = useState(!isCreate);
  const [optionBuilderOpen, setOptionBuilderOpen] = useState(false);
  const [editingVariant, setEditingVariant] = useState(null);
  const fileInputRef = useRef(null);
  const initialSnapshotRef = useRef(null);

  const notify = (msg) => {
    setNotice(msg);
    window.setTimeout(() => setNotice(''), 3500);
  };

  // Set document title
  useEffect(() => {
    document.title = isCreate
      ? 'Add Product | NovaShop Admin'
      : `${form.name ? form.name + ' - Edit' : 'Edit Product'} | NovaShop Admin`;
  }, [isCreate, form.name]);

  // Load Categories
  useEffect(() => {
    adminApi
      .getCategories()
      .then((res) => {
        if (Array.isArray(res.data)) {
          setCategories(res.data);
          if (isCreate && res.data.length > 0 && !form.category) {
            setForm((curr) => ({ ...curr, category: res.data[0]._id }));
          }
        }
      })
      .catch(() => {});
  }, [isCreate]);

  // Load existing Product on Edit Mode
  useEffect(() => {
    if (!isCreate && productId) {
      setLoadingInitial(true);
      adminApi
        .getProduct(productId)
        .then((res) => {
          const prod = res.data;
          if (prod) {
            const primaryImg = prod.image || (prod.images && prod.images[0]) || '';
            const mediaList = (prod.images || [primaryImg]).filter(Boolean).map((src, i) => ({
              id: `existing-img-${i}`,
              src,
            }));

            const variantList = (prod.variants || []).map((v) => ({
              _id: v._id,
              id: v._id,
              sku: v.sku,
              size: v.size,
              color: v.color,
              stock: v.stock,
              price: v.price != null ? v.price : prod.price,
            }));

            const initialLoaded = {
              name: prod.name || '',
              description: prod.description || '',
              price: String(prod.price ?? ''),
              brand: prod.brand || 'NovaShop',
              sku: variantList[0]?.sku || prod.slug || 'NS-PRD',
              status: prod.status || 'active',
              category: prod.category?._id || prod.category || '',
              variants: variantList,
              media: mediaList,
              stock: String(prod.countInStock || 0),
            };

            setForm(initialLoaded);
            initialSnapshotRef.current = JSON.stringify(initialLoaded);
          }
        })
        .catch((err) => {
          notify(err.response?.data?.message || err.message || 'Failed to load product');
        })
        .finally(() => {
          setLoadingInitial(false);
        });
    } else if (isCreate) {
      initialSnapshotRef.current = JSON.stringify(createInitialForm(true));
    }
  }, [isCreate, productId]);

  // Derived dirty state
  const isDirty = useMemo(() => {
    if (!initialSnapshotRef.current) return false;
    return JSON.stringify(form) !== initialSnapshotRef.current;
  }, [form]);

  const totalCalculatedStock = useMemo(() => {
    if (form.variants.length > 0) {
      return form.variants.reduce((sum, v) => sum + (Math.max(0, parseInt(v.stock, 10)) || 0), 0);
    }
    return Math.max(0, parseInt(form.stock, 10) || 0);
  }, [form.variants, form.stock]);

  // Media Upload
  const handleUploadFiles = async (fileList) => {
    const files = [...fileList];
    if (!files.length) return;

    if (form.media.length + files.length > 6) {
      notify('You can upload a maximum of 6 images per product.');
      return;
    }

    setUploading(true);
    const uploaded = [];
    try {
      for (const file of files) {
        if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
          notify('Only JPG, PNG, and WebP images are allowed.');
          continue;
        }
        if (file.size > 5 * 1024 * 1024) {
          notify('Image size must be 5MB or less.');
          continue;
        }

        const res = await productApi.uploadImage(file);
        if (res.image) {
          uploaded.push({
            id: res.publicId || `img-${Date.now()}-${file.name}`,
            src: res.image,
            publicId: res.publicId,
          });
        }
      }

      setForm((curr) => ({
        ...curr,
        media: [...curr.media, ...uploaded],
      }));
      notify('Image(s) uploaded successfully.');
    } catch (err) {
      notify(err.message || 'Image upload failed.');
    } finally {
      setUploading(false);
    }
  };

  const removeMedia = (mediaId) => {
    setForm((curr) => ({
      ...curr,
      media: curr.media.filter((m) => m.id !== mediaId),
    }));
  };

  // Add individual variant
  const addSingleVariant = () => {
    const newV = {
      id: `var-new-${Date.now()}`,
      sku: `${form.sku || 'NS'}-NEW-${form.variants.length + 1}`,
      size: 'M',
      color: { name: 'Black', hex: '#000000' },
      stock: 10,
      price: Number(form.price) || 0,
    };
    setForm((curr) => ({
      ...curr,
      variants: [...curr.variants, newV],
    }));
  };

  // Remove variant
  const removeVariant = (vId) => {
    if (form.variants.length <= 1) {
      notify('A product must have at least one variant.');
      return;
    }
    setForm((curr) => ({
      ...curr,
      variants: curr.variants.filter((v) => (v._id || v.id) !== vId),
    }));
  };

  // Save Product (Create or Edit)
  const handleSubmit = async (e, overrideStatus) => {
    if (e) e.preventDefault();

    if (!form.name.trim()) {
      notify('Product name is required.');
      return;
    }
    if (!form.description.trim()) {
      notify('Product description is required.');
      return;
    }
    if (form.price === '' || Number(form.price) < 0) {
      notify('Valid base price is required.');
      return;
    }
    if (!form.category) {
      notify('Please select a category.');
      return;
    }
    if (!form.media.length) {
      notify('Please upload at least one product image.');
      return;
    }
    if (!form.variants.length) {
      notify('At least one variant with stock is required.');
      return;
    }

    const invalidStockVariant = form.variants.find((v) => Number(v.stock) < 0 || isNaN(Number(v.stock)));
    if (invalidStockVariant) {
      notify(`Variant ${invalidStockVariant.sku} has invalid stock quantity.`);
      return;
    }

    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        description: form.description.trim(),
        price: Number(form.price),
        brand: form.brand.trim() || 'NovaShop',
        category: form.category,
        status: overrideStatus || form.status,
        image: form.media[0]?.src || '',
        images: form.media.map((m) => m.src),
        variants: form.variants.map((v) => ({
          _id: v._id,
          sku: v.sku.trim().toUpperCase(),
          size: v.size.trim().toUpperCase(),
          color: typeof v.color === 'string' ? { name: v.color, hex: '#000000' } : v.color,
          stock: Math.max(0, parseInt(v.stock, 10) || 0),
          price: v.price != null && Number(v.price) >= 0 ? Number(v.price) : Number(form.price),
        })),
      };

      if (isCreate) {
        const res = await adminApi.createProduct(payload);
        notify('Product created successfully!');
        window.setTimeout(() => go(`/admin/products/${res.data?._id || ''}`), 600);
      } else {
        await adminApi.updateProduct(productId, payload);
        notify('Product updated successfully!');
        window.setTimeout(() => go(`/admin/products/${productId}`), 600);
      }
    } catch (err) {
      notify(err.response?.data?.message || err.message || 'Failed to save product.');
    } finally {
      setSaving(false);
    }
  };

  const getStockStatus = (stock) => {
    const qty = Number(stock) || 0;
    if (qty <= 0) return { label: 'Out of stock', className: 'is-out' };
    if (qty <= 5) return { label: 'Low stock', className: 'is-low' };
    return { label: 'In stock', className: 'is-in' };
  };

  if (loadingInitial) {
    return (
      <div className="pe-loading-skeleton-wrap">
        <div className="pe-skeleton-box header" />
        <div className="pe-skeleton-grid">
          <div className="pe-skeleton-box main" />
          <div className="pe-skeleton-box side" />
        </div>
      </div>
    );
  }

  return (
    <div className="pe-page">
      {/* 1. Sticky Action Bar */}
      <header className="pe-page-header">
        <div className="pe-header-main">
          <div className="pe-breadcrumb-row">
            <button className="pe-breadcrumb-btn" type="button" onClick={() => go('/admin/products')}>
              <AdminIcon name="chevron" size={13} style={{ transform: 'rotate(90deg)' }} />
              <span>Products</span>
            </button>
            {isDirty && (
              <span className="pe-unsaved-indicator">
                <span className="pe-pulse-dot" /> Unsaved changes
              </span>
            )}
          </div>

          <div className="pe-title-row">
            <h1 className="pe-page-title">{isCreate ? 'Add Product' : (form.name || 'Edit Product')}</h1>
            {!isCreate && (
              <span className={`pe-status-pill is-${form.status}`}>
                <span className="pe-status-dot" />
                <span>{form.status}</span>
              </span>
            )}
          </div>
        </div>

        <div className="pe-actions">
          <button
            className="pe-action-btn is-discard"
            type="button"
            onClick={() => go('/admin/products')}
          >
            Discard
          </button>
          <button
            className="pe-action-btn is-secondary"
            type="button"
            disabled={saving || uploading}
            onClick={(e) => handleSubmit(e, 'draft')}
          >
            Save as Draft
          </button>
          <button
            className="pe-action-btn is-primary"
            type="button"
            disabled={saving || uploading}
            onClick={(e) => handleSubmit(e, 'active')}
          >
            {saving ? 'Saving...' : isCreate ? 'Publish Product' : 'Save Changes'}
          </button>
        </div>
      </header>

      {/* 2. Desktop Two-Column Layout */}
      <div className="pe-grid-layout">
        {/* Main Column */}
        <div className="pe-main-col">
          {/* Card 1: Product Information */}
          <EditorCard
            title="Product Information"
            subtitle="Core item naming, merchandising details, and descriptions for storefront shoppers."
          >
            <div className="pe-fields-stack">
              <label className="pe-field">
                <span>Product Name</span>
                <input
                  required
                  value={form.name}
                  onChange={(e) => setForm((c) => ({ ...c, name: e.target.value }))}
                  placeholder="e.g. Cashmere Overcoat"
                />
              </label>

              <label className="pe-field">
                <div className="pe-field-label-row">
                  <span>Description</span>
                  <span className="pe-char-count">{form.description.length} characters</span>
                </div>
                <textarea
                  required
                  rows="4"
                  value={form.description}
                  onChange={(e) => setForm((c) => ({ ...c, description: e.target.value }))}
                  placeholder="Comprehensive description of the item, tailoring, fabrics, and fit..."
                />
              </label>
            </div>
          </EditorCard>

          {/* Card 2: Product Images */}
          <EditorCard
            title="Product Images"
            subtitle="Upload high-resolution photography. The first image is highlighted as primary."
            tag={`${form.media.length} / 6`}
            right={
              <button
                type="button"
                className="pe-card-link-btn"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading || form.media.length >= 6}
              >
                + Upload photos
              </button>
            }
          >
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              style={{ display: 'none' }}
              onChange={(e) => {
                if (e.target.files) handleUploadFiles(e.target.files);
                e.target.value = '';
              }}
            />

            <div className="pe-gallery-grid">
              {form.media.map((item, idx) => (
                <div key={item.id || idx} className="pe-image-tile">
                  <img src={item.src} alt="" className="pe-image-photo" />
                  <div className="pe-image-overlay">
                    <button
                      type="button"
                      onClick={() => removeMedia(item.id)}
                      className="pe-image-delete-btn"
                      title="Remove photo"
                      aria-label="Remove photo"
                    >
                      <AdminIcon name="trash" size={14} />
                    </button>
                  </div>
                  {idx === 0 && (
                    <span className="pe-primary-badge">
                      <AdminIcon name="check" size={10} /> Primary
                    </span>
                  )}
                </div>
              ))}

              {uploading && (
                <div className="pe-image-tile is-uploading">
                  <div className="pe-skeleton-pulse" />
                  <span>Uploading...</span>
                </div>
              )}

              {form.media.length < 6 && (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  className="pe-dropzone-tile"
                >
                  <div className="pe-dropzone-icon">
                    <AdminIcon name="plus" size={18} />
                  </div>
                  <strong className="pe-dropzone-text">Add photo</strong>
                  <span className="pe-dropzone-hint">PNG, JPG, WEBP</span>
                </button>
              )}
            </div>
          </EditorCard>

          {/* Card 3: Variants & Inventory Matrix */}
          <EditorCard
            title="Variants & Inventory Matrix"
            subtitle="Configure sizing, color swatches, stock availability, and per-variant SKU overrides."
            tag={`${form.variants.length} variant${form.variants.length === 1 ? '' : 's'}`}
            right={
              <div className="pe-variants-actions">
                <button
                  type="button"
                  className="pe-action-btn is-secondary is-sm"
                  onClick={() => setOptionBuilderOpen(true)}
                >
                  <AdminIcon name="sliders" size={13} /> Matrix Generator
                </button>
                <button
                  type="button"
                  className="pe-action-btn is-primary is-sm"
                  onClick={addSingleVariant}
                >
                  <AdminIcon name="plus" size={13} /> Add Variant
                </button>
              </div>
            }
          >
            {/* Total Stock Summary Strip */}
            <div className="pe-stock-strip">
              <span className="pe-stock-strip-label">Total derived inventory stock across all variants:</span>
              <span className="pe-stock-strip-value">{totalCalculatedStock} units</span>
            </div>

            {form.variants.length === 0 ? (
              <div className="pe-variants-empty">
                <div className="pe-variants-empty-icon">
                  <AdminIcon name="inventory" size={26} />
                </div>
                <h3>No variants defined yet</h3>
                <p>Add individual variants or generate a full combinatorial matrix across sizes and colors.</p>
                <div className="pe-variants-empty-actions">
                  <button
                    type="button"
                    className="pe-action-btn is-secondary"
                    onClick={() => setOptionBuilderOpen(true)}
                  >
                    <AdminIcon name="sliders" size={13} /> Open Matrix Generator
                  </button>
                  <button
                    type="button"
                    className="pe-action-btn is-primary"
                    onClick={addSingleVariant}
                  >
                    <AdminIcon name="plus" size={13} /> Add Single Variant
                  </button>
                </div>
              </div>
            ) : (
              <div className="pe-table-responsive">
                <table className="pe-table">
                  <thead>
                    <tr>
                      <th>SKU</th>
                      <th>Size</th>
                      <th>Color</th>
                      <th>Price</th>
                      <th>Stock Qty</th>
                      <th>Status</th>
                      <th className="text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {form.variants.map((v) => {
                      const colorName = typeof v.color === 'object' ? v.color?.name : v.color || 'Default';
                      const colorHex = typeof v.color === 'object' ? v.color?.hex : '#000000';
                      const status = getStockStatus(v.stock);

                      return (
                        <tr key={v._id || v.id}>
                          <td className="font-mono">{v.sku}</td>
                          <td>
                            <span className="pe-chip">{v.size}</span>
                          </td>
                          <td>
                            <span className="pe-chip color">
                              <span
                                className="pe-color-dot"
                                style={{ backgroundColor: colorHex }}
                                aria-hidden="true"
                              />
                              <span>{colorName}</span>
                            </span>
                          </td>
                          <td>
                            ${Number(v.price != null ? v.price : form.price || 0).toFixed(2)}
                          </td>
                          <td className="font-bold">{v.stock}</td>
                          <td>
                            <span className={`pe-stock-pill ${status.className}`}>
                              <span className="pe-stock-pill-dot" />
                              {status.label}
                            </span>
                          </td>
                          <td className="text-right">
                            <div className="pe-row-actions">
                              <button
                                type="button"
                                className="pe-icon-btn"
                                onClick={() => setEditingVariant(v)}
                                title="Edit variant"
                                aria-label={`Edit variant ${v.sku}`}
                              >
                                <AdminIcon name="pencil" size={14} />
                              </button>
                              <button
                                type="button"
                                className="pe-icon-btn is-danger"
                                onClick={() => removeVariant(v._id || v.id)}
                                title="Remove variant"
                                aria-label={`Remove variant ${v.sku}`}
                              >
                                <AdminIcon name="trash" size={14} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </EditorCard>
        </div>

        {/* Side Column (Sticky on Desktop) */}
        <aside className="pe-side-col">
          {/* Card 1: Status */}
          <EditorCard
            title="Product Status"
            subtitle="Controls visibility across the storefront and search catalog."
          >
            <div className="pe-field">
              <div className="pe-select-status-wrap">
                <span className={`pe-select-dot is-${form.status}`} />
                <select
                  value={form.status}
                  onChange={(e) => setForm((c) => ({ ...c, status: e.target.value }))}
                  className="pe-select-with-dot"
                >
                  <option value="active">Active (Visible in Storefront)</option>
                  <option value="draft">Draft (Staff Only)</option>
                  <option value="archived">Archived (Unpublished)</option>
                </select>
              </div>
              <p className="pe-field-hint">
                {form.status === 'active' && 'Item is public and available for customer purchases.'}
                {form.status === 'draft' && 'Hidden from customer browsing and checkout.'}
                {form.status === 'archived' && 'Archived from catalog and search indices.'}
              </p>
            </div>
          </EditorCard>

          {/* Card 2: Pricing & Organization */}
          <EditorCard
            title="Pricing & Organization"
            subtitle="Standard baseline price and category grouping."
          >
            <div className="pe-fields-stack">
              <label className="pe-field">
                <span>Base Price</span>
                <div className="pe-input-prefix-wrap">
                  <span className="pe-input-prefix">$</span>
                  <input
                    required
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.price}
                    onChange={(e) => setForm((c) => ({ ...c, price: e.target.value }))}
                    placeholder="0.00"
                  />
                  <span className="pe-input-suffix">USD</span>
                </div>
              </label>

              <label className="pe-field">
                <span>Category</span>
                <select
                  required
                  value={form.category}
                  onChange={(e) => setForm((c) => ({ ...c, category: e.target.value }))}
                >
                  <option value="">Select Category</option>
                  {categories.map((cat) => (
                    <option key={cat._id} value={cat._id}>
                      {cat.name}
                    </option>
                  ))}
                </select>
              </label>

              <label className="pe-field">
                <span>Brand</span>
                <input
                  value={form.brand}
                  onChange={(e) => setForm((c) => ({ ...c, brand: e.target.value }))}
                  placeholder="NovaShop"
                />
              </label>
            </div>
          </EditorCard>
        </aside>
      </div>

      {/* 3. Sticky Mobile Bottom Save Bar (< 768px) */}
      <div className="pe-mobile-save-bar" aria-label="Mobile Save Controls">
        <button
          className="pe-action-btn is-discard"
          type="button"
          onClick={() => go('/admin/products')}
        >
          Discard
        </button>
        <button
          className="pe-action-btn is-secondary"
          type="button"
          disabled={saving || uploading}
          onClick={(e) => handleSubmit(e, 'draft')}
        >
          Draft
        </button>
        <button
          className="pe-action-btn is-primary"
          type="button"
          disabled={saving || uploading}
          onClick={(e) => handleSubmit(e, 'active')}
        >
          {saving ? 'Saving...' : isCreate ? 'Publish' : 'Save'}
        </button>
      </div>

      {/* Modals */}
      {editingVariant && (
        <VariantEditorModal
          variant={editingVariant}
          onClose={() => setEditingVariant(null)}
          onSave={(updatedV) => {
            setForm((curr) => ({
              ...curr,
              variants: curr.variants.map((v) =>
                (v._id || v.id) === (updatedV._id || updatedV.id) ? updatedV : v
              ),
            }));
            setEditingVariant(null);
            notify(`Updated variant ${updatedV.sku}`);
          }}
        />
      )}

      {optionBuilderOpen && (
        <OptionBuilderModal
          initialSku={form.sku}
          basePrice={form.price}
          onClose={() => setOptionBuilderOpen(false)}
          onCreate={(generated) => {
            setForm((curr) => ({
              ...curr,
              variants: generated,
            }));
            setOptionBuilderOpen(false);
            notify(`Generated ${generated.length} variant combinations.`);
          }}
        />
      )}

      {/* Floating Feedback Toast */}
      {notice && (
        <div className="pe-toast" role="status">
          <AdminIcon name="check" size={15} />
          <span>{notice}</span>
        </div>
      )}
    </div>
  );
}
