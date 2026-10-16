import { useEffect, useRef, useState } from 'react';
import { AdminIcon } from '../../components/admin/AdminLayout';
import { useCategories } from '../../context/CategoryContext';
import { productApi } from '../../lib/api/productApi';
import './admin-product-edit.css';

const originalVariants = [
  { id: 'camel-s', color: 'Camel', size: 'S', sku: 'NS-OC-0142-CAM-S', stock: 14, price: '1450.00', shade: '#B99C78' },
  { id: 'camel-m', color: 'Camel', size: 'M', sku: 'NS-OC-0142-CAM-M', stock: 18, price: '1450.00', shade: '#B99C78' },
  { id: 'camel-l', color: 'Camel', size: 'L', sku: 'NS-OC-0142-CAM-L', stock: 12, price: '1450.00', shade: '#B99C78' },
  { id: 'black-s', color: 'Black', size: 'S', sku: 'NS-OC-0142-BLK-S', stock: 16, price: '1450.00', shade: '#272624' },
  { id: 'black-m', color: 'Black', size: 'M', sku: 'NS-OC-0142-BLK-M', stock: 22, price: '1450.00', shade: '#272624' },
  { id: 'black-l', color: 'Black', size: 'L', stock: 2, price: '1450.00', shade: '#272624' },
];

const originalMedia = [
  'https://images.unsplash.com/photo-1591047139829-d91aecb6caea?auto=format&fit=crop&w=420&q=80',
  'https://images.unsplash.com/photo-1539533018447-63fcce2678e3?auto=format&fit=crop&w=420&q=80',
  'https://images.unsplash.com/photo-1548126032-079a0fb0099d?auto=format&fit=crop&w=420&q=80',
  'https://images.unsplash.com/photo-1591369822096-ffd140ec948f?auto=format&fit=crop&w=420&q=80',
  'https://images.unsplash.com/photo-1551488831-00ddcb6c6bd3?auto=format&fit=crop&w=420&q=80',
];

function createInitialForm(isCreate = false) {
  return {
    name: isCreate ? '' : 'Cashmere Overcoat',
    description: isCreate ? '' : 'Double-faced cashmere overcoat with a notch lapel and concealed button closure. Fully lined.',
    price: isCreate ? '' : '1450.00',
    compareAt: isCreate ? '' : '1650.00',
    cost: isCreate ? '' : '620.00',
    sku: isCreate ? '' : 'NS-OC-0142',
    lowStock: '10',
    trackQuantity: !isCreate,
    status: isCreate ? 'Draft' : 'Active',
    category: '',
    collections: isCreate ? [] : ['Autumn Winter', 'Best Sellers'],
    tags: isCreate ? [] : ['cashmere', 'coat'],
    variants: isCreate ? [] : originalVariants.map((variant) => ({ ...variant })),
    options: isCreate ? [] : [{ name: 'Color', values: ['Camel', 'Black'] }, { name: 'Size', values: ['S', 'M', 'L'] }],
    media: isCreate ? [] : originalMedia.map((src, index) => ({ id: `media-${index}`, src })),
    stock: '0',
    handle: isCreate ? '' : 'cashmere-overcoat',
    metaTitle: isCreate ? '' : 'Cashmere Overcoat | NovaShop',
    metaDescription: isCreate ? '' : 'A double-faced cashmere overcoat with a refined tailored fit.',
    notes: isCreate ? '' : 'Autumn Winter campaign hero garment.',
    barcode: '',
  };
}

function EditorCard({ title, tag, right, children, className = '' }) {
  return <section className={`admin-card pe-card ${className}`}><header className="pe-card-heading"><h2>{title}</h2>{right || (tag && <span className="pe-card-tag">{tag}</span>)}</header>{children}</section>;
}

function ProductTagField({ label, tags, onRemove, onAdd, placeholder = 'Add tag…' }) {
  const [value, setValue] = useState('');
  const submit = (event) => {
    if (event.key !== 'Enter') return;
    event.preventDefault();
    const next = value.trim();
    if (next) onAdd(next);
    setValue('');
  };
  return <label className="pe-field pe-tag-field"><span>{label}</span><div className="pe-tag-input">{tags.map((tag) => <span className="pe-removable-tag" key={tag}>{tag}<button type="button" aria-label={`Remove ${tag}`} onClick={() => onRemove(tag)}>×</button></span>)}<input value={value} onChange={(event) => setValue(event.target.value)} onKeyDown={submit} placeholder={placeholder} /></div></label>;
}

function VariantEditor({ variant, mode, onClose, onSave }) {
  const [price, setPrice] = useState(variant.price);
  const [stock, setStock] = useState(String(variant.stock));
  const submit = (event) => {
    event.preventDefault();
    onSave({ ...variant, price, stock: Number(stock) });
  };
  return <div className="admin-modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}><section className="admin-order-modal pe-variant-modal" role="dialog" aria-modal="true" aria-labelledby="pe-variant-title"><header className="admin-modal-heading"><div><span className="admin-modal-eyebrow">Catalog variant</span><h2 id="pe-variant-title">{mode === 'stock' ? 'Adjust stock' : 'Edit variant'}</h2></div><button className="admin-icon-button" type="button" aria-label="Close variant editor" onClick={onClose}><AdminIcon name="close" /></button></header><p>{variant.color} / {variant.size} · {variant.sku}</p><form onSubmit={submit}>{mode !== 'stock' && <label>Price<input type="number" min="0" step="0.01" value={price} onChange={(event) => setPrice(event.target.value)} /></label>}<label>Inventory quantity<input type="number" min="0" step="1" value={stock} onChange={(event) => setStock(event.target.value)} /></label><button className="admin-action-button is-primary" type="submit">Save variant</button></form></section></div>;
}

function OptionBuilder({ onClose, onCreate }) {
  const [options, setOptions] = useState([{ name: 'Color', values: 'Camel, Black' }, { name: 'Size', values: 'S, M, L' }]);
  const [error, setError] = useState('');
  const updateOption = (index, key, value) => setOptions((current) => current.map((option, optionIndex) => optionIndex === index ? { ...option, [key]: value } : option));
  const submit = (event) => {
    event.preventDefault();
    const cleaned = options.map((option) => ({ name: option.name.trim(), values: [...new Set(option.values.split(',').map((value) => value.trim()).filter(Boolean))] })).filter((option) => option.name && option.values.length);
    if (!cleaned.length) {
      setError('Add an option name and at least one value.');
      return;
    }
    onCreate(cleaned);
  };
  return <div className="admin-modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}><section className="admin-order-modal pe-option-modal" role="dialog" aria-modal="true" aria-labelledby="pe-options-title"><header className="admin-modal-heading"><div><span className="admin-modal-eyebrow">Product catalog</span><h2 id="pe-options-title">Add variant options</h2></div><button className="admin-icon-button" type="button" aria-label="Close options builder" onClick={onClose}><AdminIcon name="close" /></button></header><p>Use options such as color and size to build your sellable variants.</p><form onSubmit={submit}><div className="pe-option-builder-rows">{options.map((option, index) => <div className="pe-option-builder-row" key={index}><label>Option name<input value={option.name} onChange={(event) => updateOption(index, 'name', event.target.value)} placeholder="e.g. Color" /></label><label>Values<input value={option.values} onChange={(event) => updateOption(index, 'values', event.target.value)} placeholder="Separate values with commas" /></label><button type="button" aria-label={`Remove option ${index + 1}`} disabled={options.length === 1} onClick={() => setOptions((current) => current.filter((_, optionIndex) => optionIndex !== index))}>×</button></div>)}</div>{error && <span className="pe-option-error" role="alert">{error}</span>}<button className="pe-add-option-row" type="button" onClick={() => setOptions((current) => [...current, { name: '', values: '' }])}><AdminIcon name="plus" size={13} /> Add another option</button><button className="admin-action-button is-primary" type="submit">Generate variants</button></form></section></div>;
}

function buildVariants(options, sku, price) {
  const combinations = options.reduce((current, option) => current.flatMap((combination) => option.values.map((value) => [...combination, { name: option.name, value }])), [[]]);
  const colors = { camel: '#B99C78', black: '#272624', ivory: '#E8E1D6', navy: '#343F50', brown: '#72513D', white: '#F2EFEA' };
  return combinations.map((combination, index) => {
    const colorOption = combination.find((option) => option.name.toLowerCase() === 'color');
    const sizeOption = combination.find((option) => option.name.toLowerCase() === 'size');
    const otherOption = combination.find((option) => option !== colorOption && option !== sizeOption);
    const color = colorOption?.value || otherOption?.value || 'Default';
    const size = sizeOption?.value || 'One size';
    const code = `${color}-${size}`.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toUpperCase();
    return { id: `variant-${Date.now()}-${index}`, color, size, sku: `${sku || 'NEW'}-${code}`, stock: 0, price: price || '0.00', shade: colors[color.toLowerCase()] || '#B8AA98' };
  });
}

export default function AdminProductEditPage({ go, mode = 'edit' }) {
  const isCreate = mode === 'create';
  const { categories, loading: categoriesLoading, error: categoriesError, refreshCategories } = useCategories();
  const [form, setForm] = useState(() => createInitialForm(isCreate));
  const [savedForm, setSavedForm] = useState(() => createInitialForm(isCreate));
  const [notice, setNotice] = useState('');
  const [identifiersOpen, setIdentifiersOpen] = useState(false);
  const [seoOpen, setSeoOpen] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [optionBuilderOpen, setOptionBuilderOpen] = useState(false);
  const [seoPreviewOpen, setSeoPreviewOpen] = useState(false);
  const [variantMenu, setVariantMenu] = useState(null);
  const [variantEditor, setVariantEditor] = useState(null);
  const [draggingMedia, setDraggingMedia] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [createdProductId, setCreatedProductId] = useState('');
  const uploadRef = useRef(null);
  const descriptionRef = useRef(null);
  const mediaRef = useRef(form.media);
  const pendingImageIdsRef = useRef(new Set());
  const mountedRef = useRef(false);
  const [collectionInput, setCollectionInput] = useState('');
  const isDirty = JSON.stringify(form) !== JSON.stringify(savedForm);
  const isProductValid = isCreate
    ? Boolean(form.name.trim() && form.description.trim() && form.price !== '' && categories.some((category) => category._id === form.category) && form.media.length && !uploading && !saving && !createdProductId)
    : Boolean(form.name.trim());
  const totalStock = form.variants.length ? form.variants.reduce((total, variant) => total + Number(variant.stock || 0), 0) : Number(form.stock || 0);
  const editedVariant = variantEditor && form.variants.find((variant) => variant.id === variantEditor.id);

  useEffect(() => {
    if (descriptionRef.current && descriptionRef.current.innerText !== form.description) descriptionRef.current.innerText = form.description;
  }, [form.description]);

  useEffect(() => {
    mediaRef.current = form.media;
  }, [form.media]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      mediaRef.current.forEach((asset) => {
        if (asset.src.startsWith('blob:')) URL.revokeObjectURL(asset.src);
      });
      if (!isCreate) return;
      const publicIds = new Set([
        ...mediaRef.current.map((asset) => asset.publicId).filter(Boolean),
        ...pendingImageIdsRef.current,
      ]);
      void Promise.allSettled([...publicIds].map((publicId) => productApi.deleteImage(publicId)));
    };
  }, [isCreate]);

  const notify = (message) => {
    setNotice(message);
    window.setTimeout(() => setNotice(''), 2400);
  };
  const updateForm = (patch) => setForm((current) => {
    return { ...current, ...patch };
  });
  const saveChanges = async (event, statusOverride) => {
    event?.preventDefault();
    const nextForm = statusOverride ? { ...form, status: statusOverride } : form;
    if (isCreate) {
      const primaryImage = nextForm.media[0];
      if (!primaryImage?.publicId || nextForm.media.some((asset) => !asset.publicId)) {
        notify('Upload product images before saving.');
        return;
      }
      setSaving(true);
      try {
        const createdProduct = await productApi.createProduct({
          name: nextForm.name.trim(),
          price: Number(nextForm.price),
          description: nextForm.description.trim(),
          image: primaryImage.src,
          images: nextForm.media.map((asset) => asset.src),
          imagePublicIds: nextForm.media.map((asset) => asset.publicId),
          category: nextForm.category,
          status: (statusOverride || nextForm.status).toLowerCase(),
          countInStock: Number(nextForm.stock) || 0,
          variants: nextForm.variants.map((variant) => ({
            sku: variant.sku,
            size: variant.size.replace(/\s+/g, '_').toUpperCase(),
            color: { name: variant.color, hex: variant.shade },
            stock: Number(variant.stock) || 0,
            price: Number(variant.price) || 0,
          })),
        });
        mediaRef.current = [];
        pendingImageIdsRef.current.clear();
        setForm(nextForm);
        setSavedForm(JSON.parse(JSON.stringify(nextForm)));
        setCreatedProductId(createdProduct.data?._id || nextForm.name);
        notify(`${nextForm.status} product saved to the catalog.`);
      } catch (error) {
        notify(error.message || 'Unable to save the product. Your uploaded images are still available to retry.');
      } finally {
        setSaving(false);
      }
      return;
    }
    setForm(nextForm);
    setSavedForm(JSON.parse(JSON.stringify(nextForm)));
    notify(isCreate ? `${statusOverride || 'Draft'} product saved.` : 'Product changes saved.');
  };
  const discardChanges = async () => {
    const stagedIds = isCreate ? form.media.map((asset) => asset.publicId).filter(Boolean) : [];
    form.media.forEach((asset) => {
      if (asset.src.startsWith('blob:')) URL.revokeObjectURL(asset.src);
    });
    const results = await Promise.allSettled(stagedIds.map((publicId) => productApi.deleteImage(publicId)));
    results.forEach((result, index) => {
      if (result.status === 'fulfilled') pendingImageIdsRef.current.delete(stagedIds[index]);
    });
    if (results.some((result) => result.status === 'rejected')) {
      notify('Some staged images could not be removed from Cloudinary.');
    }
    setForm(JSON.parse(JSON.stringify(savedForm)));
    setMenuOpen(false);
  };
  const addCollection = (event) => {
    if (event.key !== 'Enter') return;
    event.preventDefault();
    const value = collectionInput.trim();
    if (value && !form.collections.includes(value)) updateForm({ collections: [...form.collections, value] });
    setCollectionInput('');
  };
  const addTag = (tag) => {
    if (!form.tags.includes(tag)) updateForm({ tags: [...form.tags, tag] });
  };
  const updateVariant = (nextVariant) => {
    updateForm({ variants: form.variants.map((variant) => variant.id === nextVariant.id ? nextVariant : variant) });
    setVariantEditor(null);
  };
  const addMediaFiles = async (fileList) => {
    const files = [...fileList];
    const remainingSlots = 6 - form.media.length;
    if (files.length > remainingSlots) {
      notify(`Only ${remainingSlots} more image${remainingSlots === 1 ? '' : 's'} can be added.`);
      return;
    }
    if (files.some((file) => !['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 5 * 1024 * 1024)) {
      notify('Choose JPG, PNG, or WebP images up to 5 MB.');
      return;
    }
    if (!files.length) return;

    if (!isCreate) {
      updateForm({
        media: [...form.media, ...files.map((file) => ({
          id: `preview-${Date.now()}-${file.name}`,
          src: URL.createObjectURL(file),
        }))],
      });
      return;
    }

    setUploading(true);
    const uploadedAssets = [];
    try {
      for (const file of files) {
        const response = await productApi.uploadImage(file);
        if (!response.image || !response.publicId) throw new Error('Image upload returned incomplete data.');
        const asset = { id: response.publicId, publicId: response.publicId, src: response.image };
        if (!mountedRef.current) {
          await productApi.deleteImage(response.publicId).catch(() => {});
          return;
        }
        pendingImageIdsRef.current.add(response.publicId);
        uploadedAssets.push(asset);
      }
      updateForm({ media: [...form.media, ...uploadedAssets] });
    } catch (error) {
      const cleanupResults = await Promise.allSettled(uploadedAssets.map((asset) => productApi.deleteImage(asset.publicId)));
      cleanupResults.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          pendingImageIdsRef.current.delete(uploadedAssets[index].publicId);
        }
      });
      notify(error.message || 'Unable to upload images. No product was created.');
    } finally {
      setUploading(false);
    }
  };
  const addMedia = (event) => {
    addMediaFiles(event.target.files);
    event.target.value = '';
  };
  const removeMedia = async (asset) => {
    if (asset.publicId) {
      try {
        await productApi.deleteImage(asset.publicId);
      } catch (error) {
        notify(error.message || 'Unable to remove the uploaded image.');
        return;
      }
      pendingImageIdsRef.current.delete(asset.publicId);
    }
    if (asset.src.startsWith('blob:')) URL.revokeObjectURL(asset.src);
    updateForm({ media: form.media.filter((item) => item.id !== asset.id) });
  };
  const createVariants = (options) => {
    updateForm({ options, variants: buildVariants(options, form.sku, form.price) });
    setOptionBuilderOpen(false);
  };
  const reorderMedia = (sourceIndex, targetIndex) => {
    if (!Number.isInteger(sourceIndex) || sourceIndex < 0 || sourceIndex >= form.media.length || sourceIndex === targetIndex) return;
    setForm((current) => {
      const nextMedia = [...current.media];
      const [moved] = nextMedia.splice(sourceIndex, 1);
      nextMedia.splice(targetIndex, 0, moved);
      return { ...current, media: nextMedia };
    });
    setDraggingMedia(null);
  };

  return (
    <div className={`admin-dashboard pe-page${isCreate ? ' is-create' : ''}`}>
      <header className="pe-page-header">
        <div className="pe-header-context"><button className="pe-breadcrumb" type="button" onClick={() => go('/admin/products')}><AdminIcon name="left" size={14} /> Products</button>{!isCreate && <span className="pe-record-id">ID: PRD-CSHM-88402 / Pristine State</span>}</div>
        <div className="pe-title-actions"><div className="pe-title-copy"><h1>{isCreate ? 'Add product' : 'Edit product'}</h1><p>{isCreate ? 'Create a new product for your catalog.' : 'Update details, pricing, and inventory for Cashmere Overcoat.'}</p></div><div className="pe-actions">{isCreate ? <><button className="admin-action-button pe-discard-button" type="button" disabled={!isDirty || uploading || saving} onClick={discardChanges}>{saving ? 'Saving…' : 'Save as Draft'}</button><button className="admin-action-button is-primary pe-save-button" type="button" disabled={!isProductValid} onClick={(event) => saveChanges(event, 'Active')}>{createdProductId ? 'Product saved' : saving ? 'Saving…' : 'Publish Product'}</button></> : <><div className="pe-overflow-wrap"><button className="admin-action-button pe-overflow-button" type="button" aria-label="More product actions" aria-expanded={menuOpen} onClick={() => setMenuOpen((open) => !open)}><AdminIcon name="more" size={17} /></button>{menuOpen && <div className="pe-overflow-menu"><button type="button" onClick={() => { setMenuOpen(false); notify('Product preview opened.'); }}>Preview storefront</button><button type="button" onClick={() => { setMenuOpen(false); notify('Product link copied.'); }}>Copy product link</button></div>}</div><button className="admin-action-button pe-discard-button" type="button" disabled={!isDirty} onClick={discardChanges}>Discard</button><button className="admin-action-button is-primary pe-save-button" type="button" disabled={!isDirty} onClick={saveChanges}>Save changes</button></>}</div></div>
      </header>

      <form className="pe-columns" onSubmit={saveChanges}>
        <div className="pe-main-column">
          <EditorCard title="Product information" tag={isCreate ? 'CORE DETAILS' : 'GENERAL'}>
            <label className="pe-field"><span>Product name</span><input value={form.name} onChange={(event) => updateForm({ name: event.target.value })} placeholder={isCreate ? 'e.g. Cashmere Overcoat' : undefined} /></label>
            <div className="pe-field"><span>Description</span><div className="pe-rich-editor"><div className="pe-rich-toolbar"><button type="button" aria-label="Bold" title="Bold" onMouseDown={(event) => event.preventDefault()} onClick={() => document.execCommand('bold')}><strong>B</strong></button><button type="button" aria-label="Italic" title="Italic" onMouseDown={(event) => event.preventDefault()} onClick={() => document.execCommand('italic')}><em>I</em></button><button type="button" aria-label="Bullet list" title="Bullet list" onMouseDown={(event) => event.preventDefault()} onClick={() => document.execCommand('insertUnorderedList')}>•≡</button><button type="button" aria-label="Insert link" title="Insert link" onMouseDown={(event) => event.preventDefault()} onClick={() => { const link = window.prompt('Enter storefront link'); if (link) document.execCommand('createLink', false, link); }}>↗</button><span>MARKDOWN</span></div><div className={`pe-rich-area${isCreate && !form.description ? ' is-empty' : ''}`} ref={descriptionRef} contentEditable suppressContentEditableWarning role="textbox" aria-label="Product description" data-placeholder="Describe the material, fit, and care." onInput={(event) => updateForm({ description: event.currentTarget.innerText })}>{form.description}</div></div></div>
          </EditorCard>

          <EditorCard title="Media" tag={isCreate ? undefined : `${form.media.length} OF 6 SLOTS`} right={isCreate && <span className="pe-media-helper">Add product imagery in 4:5 portrait ratio.</span>} className="pe-media-card">
            {isCreate && form.media.length === 0 ? (
              <div
                className="pe-media-dropzone"
                onDragOver={(event) => event.preventDefault()}
                onDrop={(event) => {
                  event.preventDefault();
                  addMediaFiles(event.dataTransfer.files);
                }}
                aria-busy={uploading}
              >
                <svg viewBox="0 0 36 36" aria-hidden="true"><path d="M10 25h17a6 6 0 0 0 .4-12 9.5 9.5 0 0 0-18.2 2.2A5 5 0 0 0 10 25Z" /><path d="M18.5 23V12m0 0-4 4m4-4 4 4" /></svg>
                <strong>Drag images here or <button type="button" disabled={uploading} onClick={() => uploadRef.current?.click()}>browse</button></strong>
                <span>{uploading ? 'Uploading images…' : 'JPG, PNG or WebP, up to 5 MB each. The first image is the main image.'}</span>
                <button type="button" className="admin-action-button pe-browse-button" disabled={uploading} onClick={() => uploadRef.current?.click()}>BROWSE FILES</button>
                <input ref={uploadRef} className="pe-file-input" type="file" accept="image/jpeg,image/png,image/webp" multiple disabled={uploading} onChange={addMedia} />
              </div>
            ) : (
              <>
                <p className="pe-card-description">{uploading ? 'Uploading images…' : 'Drag to reorder. The first image is the main image.'}</p>
                <div className="pe-media-scroll" onDragOver={(event) => event.preventDefault()} onDrop={(event) => { if (event.dataTransfer.files.length) { event.preventDefault(); addMediaFiles(event.dataTransfer.files); } }}>
                  <div className="pe-media-row">
                    {form.media.map((asset, index) => (
                      <div className={`pe-media-item${draggingMedia === index ? ' is-dragging' : ''}`} key={asset.id} draggable onDragStart={(event) => { event.dataTransfer.effectAllowed = 'move'; event.dataTransfer.setData('text/plain', String(index)); setDraggingMedia(index); }} onDragOver={(event) => { event.preventDefault(); event.dataTransfer.dropEffect = 'move'; }} onDrop={(event) => { event.preventDefault(); reorderMedia(Number(event.dataTransfer.getData('text/plain')), index); }} onDragEnd={() => setDraggingMedia(null)}>
                        <img src={asset.src} alt={`Product image ${index + 1}`} />
                        {index === 0 && <span className="pe-main-badge">MAIN</span>}
                        <button type="button" className="pe-remove-media" aria-label={`Remove image ${index + 1}`} disabled={uploading || saving} onClick={() => removeMedia(asset)}>×</button>
                      </div>
                    ))}
                    {form.media.length < 6 && <button className="pe-add-image" type="button" disabled={uploading} onClick={() => uploadRef.current?.click()}><span>↑</span><strong>Add image</strong></button>}
                    <input ref={uploadRef} className="pe-file-input" type="file" accept="image/jpeg,image/png,image/webp" multiple disabled={uploading} onChange={addMedia} />
                  </div>
                </div>
              </>
            )}
          </EditorCard>

          <EditorCard title="Pricing" tag="USD ($)" className="pe-pricing-card">
            <div className="pe-price-grid"><label className="pe-field"><span>Price</span><div className="pe-currency-input"><span>$</span><input type="number" min="0" step="0.01" value={form.price} placeholder={isCreate ? '0.00' : undefined} onChange={(event) => updateForm({ price: event.target.value })} /></div></label><label className="pe-field"><span>Compare-at price</span><div className="pe-currency-input"><span>$</span><input type="number" min="0" step="0.01" value={form.compareAt} placeholder={isCreate ? '0.00' : undefined} onChange={(event) => updateForm({ compareAt: event.target.value })} /></div></label><label className="pe-field"><span>Cost per item</span><div className="pe-currency-input"><span>$</span><input type="number" min="0" step="0.01" value={form.cost} placeholder={isCreate ? '0.00' : undefined} onChange={(event) => updateForm({ cost: event.target.value })} /></div><small>Customers won't see this.</small></label></div>
          </EditorCard>

          <EditorCard title="Inventory" tag={isCreate ? 'STOCK MANAGEMENT' : 'WAREHOUSE 01'} className="pe-inventory-card">
            <div className="pe-inventory-fields"><label className="pe-field"><span>SKU</span><input value={form.sku} onChange={(event) => updateForm({ sku: event.target.value })} placeholder={isCreate ? 'e.g. NS-OC-0142' : undefined} /></label><label className="pe-field"><span>Low stock alert at</span><input type="number" min="0" value={form.lowStock} onChange={(event) => updateForm({ lowStock: event.target.value })} /></label></div>
            <label className="pe-track-row"><span><strong>Track quantity</strong><small>{isCreate ? 'Monitor warehouse inbound and outbound counts' : 'Turn on inventory depletion on orders'}</small></span><input type="checkbox" checked={form.trackQuantity} onChange={(event) => updateForm({ trackQuantity: event.target.checked })} /><i /></label>
            {isCreate ? <label className="pe-field pe-total-stock-field"><span>Total in stock</span><input type="number" min="0" step="1" value={form.stock} onChange={(event) => updateForm({ stock: event.target.value })} /><small>Direct inventory allocation (prior to variant definitions).</small></label> : <div className="pe-stock-summary"><div><span>TOTAL IN STOCK</span><strong>{totalStock}</strong></div><small>Calculated from variants.</small></div>}
            <button className="pe-accordion-trigger" type="button" aria-expanded={identifiersOpen} onClick={() => setIdentifiersOpen((open) => !open)}><span>More identifiers</span><span>{identifiersOpen ? '⌃' : '⌄'}</span></button>
            {identifiersOpen && <div className="pe-extra-fields"><label className="pe-field"><span>Barcode / UPC</span><input value={form.barcode} onChange={(event) => updateForm({ barcode: event.target.value })} placeholder="Enter barcode" /></label></div>}
          </EditorCard>

          <EditorCard title="Variants" className="pe-variants-card">
            {(!isCreate || form.variants.length > 0) && <button className="admin-text-link pe-edit-options" type="button" onClick={() => isCreate ? setOptionBuilderOpen(true) : notify('Variant options editor opened.')}><AdminIcon name="filter" size={14} /> {isCreate ? 'Edit options' : 'Edit options'}</button>}
            {isCreate && form.variants.length === 0 ? <div className="pe-empty-variants"><AdminIcon name="categories" size={21} /><strong>No variants yet</strong><span>Add options like size or color to create variants.</span><button className="admin-action-button" type="button" onClick={() => setOptionBuilderOpen(true)}>ADD OPTIONS</button></div> : <><div className="pe-option-tags">{form.options.map((option) => <span key={option.name}>{option.name}: {option.values.join(' · ')}</span>)}</div>
            <div className="pe-table-scroll"><table className="pe-variants-table"><thead><tr><th>VARIANT</th><th>PRICE</th><th>INVENTORY</th><th>ACTIONS</th></tr></thead><tbody>{form.variants.map((variant) => <tr key={variant.id} className={variant.id === 'black-m' ? 'is-highlighted' : ''}><td><div className="pe-variant-name"><i style={{ background: variant.shade }} /><strong>{variant.color} / {variant.size}</strong></div></td><td><span className="pe-price-pill">${Number(variant.price).toLocaleString('en-US', { minimumFractionDigits: 2 })}</span></td><td>{variant.stock <= Number(form.lowStock) ? <span className="pe-low-stock"><i />{variant.stock} left</span> : variant.stock}</td><td><div className="pe-row-menu-wrap"><button className="products-row-menu-button" type="button" aria-label={`Variant actions ${variant.color} ${variant.size}`} aria-expanded={variantMenu === variant.id} onClick={() => setVariantMenu((current) => current === variant.id ? null : variant.id)}><AdminIcon name="more" size={16} /></button>{variantMenu === variant.id && <div className="products-row-menu"><button type="button" onClick={() => { setVariantEditor({ id: variant.id, mode: 'edit' }); setVariantMenu(null); }}>Edit variant</button><button type="button" onClick={() => { setVariantEditor({ id: variant.id, mode: 'stock' }); setVariantMenu(null); }}>Adjust stock</button><button type="button" className="is-danger" onClick={() => { updateForm({ variants: form.variants.filter((item) => item.id !== variant.id) }); setVariantMenu(null); }}>Delete variant</button></div>}</div></td></tr>)}</tbody></table></div>
            </>}
          </EditorCard>

          <EditorCard title="Search listing" tag={isCreate ? undefined : 'SEO'} right={isCreate && <button className="pe-seo-preview-link" type="button" disabled={!form.name.trim() && !form.description.trim()} onClick={() => setSeoPreviewOpen(true)}>SEO PREVIEW</button>} className="pe-accordion-card">
            <button className="pe-accordion-trigger pe-seo-trigger" type="button" aria-expanded={seoOpen} onClick={() => setSeoOpen((open) => !open)}><span>How this product appears in search results.</span><AdminIcon name="chevron" size={14} /></button>
            {seoOpen && <div className="pe-seo-fields"><label className="pe-field"><span>Meta title</span><input value={form.metaTitle} onChange={(event) => updateForm({ metaTitle: event.target.value })} /></label><label className="pe-field"><span>Meta description</span><textarea rows="3" value={form.metaDescription} onChange={(event) => updateForm({ metaDescription: event.target.value })} /></label><label className="pe-field"><span>URL handle</span><input value={form.handle} onChange={(event) => updateForm({ handle: event.target.value })} /></label></div>}
          </EditorCard>
        </div>

        <aside className="pe-side-column">
          <EditorCard title="Status" className="pe-status-card"><label className={`pe-status-select${form.status === 'Draft' ? ' is-draft' : ''}`}><i /> <select value={form.status} onChange={(event) => updateForm({ status: event.target.value })}><option>Draft</option><option>Active</option></select><AdminIcon name="chevron" size={12} /></label><p>{form.status === 'Draft' ? 'Draft products are hidden from your store and storefront listings.' : 'Active products are visible in your store.'}</p></EditorCard>
          <EditorCard title="Organization" className="pe-organization-card">
            <label className="pe-field"><span>Category</span><select value={form.category} disabled={categoriesLoading || Boolean(categoriesError) || categories.length === 0} onChange={(event) => updateForm({ category: event.target.value })}><option value="">{categoriesLoading ? 'Loading categories…' : categoriesError ? 'Categories unavailable' : categories.length ? 'Select category' : 'No categories available'}</option>{categories.map((category) => <option key={category._id} value={category._id}>{category.name}</option>)}</select>{categoriesError && <span className="pe-field-error" role="alert">{categoriesError} <button type="button" className="admin-text-link" onClick={() => refreshCategories()}>Retry</button></span>}{!categoriesLoading && !categoriesError && categories.length === 0 && <span className="pe-field-hint">Create a category before adding products. <button type="button" className="admin-text-link" onClick={() => go('/admin/categories')}>Manage categories</button></span>}</label>
            <label className="pe-field pe-tag-field"><span>Collection</span><div className="pe-tag-input">{form.collections.map((collection) => <span className="pe-removable-tag" key={collection}>{collection}<button type="button" aria-label={`Remove ${collection}`} onClick={() => updateForm({ collections: form.collections.filter((item) => item !== collection) })}>×</button></span>)}{isCreate && <AdminIcon name="search" size={14} />}<input value={collectionInput} onChange={(event) => setCollectionInput(event.target.value)} onKeyDown={addCollection} placeholder={isCreate ? 'Add to collection' : 'Add collection…'} /></div>{isCreate && collectionInput && <div className="pe-collection-suggestions">{['Autumn Winter', 'Best Sellers', 'Core Collection', 'New Arrivals'].filter((collection) => collection.toLowerCase().includes(collectionInput.toLowerCase()) && !form.collections.includes(collection)).map((collection) => <button type="button" key={collection} onClick={() => { updateForm({ collections: [...form.collections, collection] }); setCollectionInput(''); }}>{collection}</button>)}</div>}</label>
            <ProductTagField label="Tags" tags={form.tags} onRemove={(tag) => updateForm({ tags: form.tags.filter((item) => item !== tag) })} onAdd={addTag} placeholder={isCreate ? 'Add tag...' : 'Add tag…'} />
          </EditorCard>
          <EditorCard title="Details" tag="METADATA" className="pe-accordion-card pe-details-card"><button className="pe-accordion-trigger pe-details-trigger" type="button" aria-expanded={detailsOpen} onClick={() => setDetailsOpen((open) => !open)}><span>Product metadata and internal notes.</span><AdminIcon name="chevron" size={14} /></button>{detailsOpen && <div className="pe-seo-fields"><div className="pe-metadata-row"><span>Created</span><strong>Oct 12, 2026</strong></div><div className="pe-metadata-row"><span>Last updated</span><strong>Oct 22, 2026</strong></div><label className="pe-field"><span>Internal notes</span><textarea rows="3" value={form.notes} onChange={(event) => updateForm({ notes: event.target.value })} /></label><div className="pe-metadata-row"><span>Catalog ID</span><strong>PRD-CSHM-88402</strong></div></div>}</EditorCard>
        </aside>
      </form>

      {editedVariant && <VariantEditor key={editedVariant.id} variant={editedVariant} mode={variantEditor.mode} onClose={() => setVariantEditor(null)} onSave={updateVariant} />}
      {optionBuilderOpen && <OptionBuilder onClose={() => setOptionBuilderOpen(false)} onCreate={createVariants} />}
      {seoPreviewOpen && <div className="admin-modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && setSeoPreviewOpen(false)}><section className="admin-order-modal pe-seo-preview-modal" role="dialog" aria-modal="true" aria-labelledby="pe-seo-preview-title"><header className="admin-modal-heading"><div><span className="admin-modal-eyebrow">Search listing</span><h2 id="pe-seo-preview-title">SEO preview</h2></div><button className="admin-icon-button" type="button" aria-label="Close SEO preview" onClick={() => setSeoPreviewOpen(false)}><AdminIcon name="close" /></button></header><div className="pe-seo-preview"><strong>{form.metaTitle || form.name || 'Product name'} | NovaShop</strong><span>novashop.com/products/{form.handle || 'product-handle'}</span><p>{form.metaDescription || form.description || 'Product description preview will appear here.'}</p></div></section></div>}
      {notice && <div className="admin-toast" role="status">{notice}</div>}
    </div>
  );
}