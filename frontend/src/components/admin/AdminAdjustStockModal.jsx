import { useState, useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { AdminIcon } from './AdminLayout';

const QUICK_REASONS = [
  'Received shipment',
  'Damaged',
  'Returned',
  'Audit correction',
  'Other',
];

/**
 * Adjust Stock Modal
 * Features:
 * - Searchable product / variant picker when item is null or opened from header
 * - Segmented control for "+/- Delta" vs "Set Exact"
 * - Live preview with color hints (green = increase, red = decrease, warning = at/below reorder)
 * - Required reason with quick-select chips
 * - Full client & server validation (integer, non-zero delta, non-negative result)
 * - Accessible in dark and light modes with WCAG AA compliance
 */
export default function AdminAdjustStockModal({
  item,
  catalog = [],
  globalThreshold = 5,
  isOpen,
  onClose,
  onSave,
}) {
  const [selectedVariantId, setSelectedVariantId] = useState('');
  const [mode, setMode] = useState('delta'); // 'delta' | 'set'
  const [quantity, setQuantity] = useState(1);
  const [selectedReasonChip, setSelectedReasonChip] = useState('Received shipment');
  const [reasonText, setReasonText] = useState('Received shipment');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [catalogSearch, setCatalogSearch] = useState('');

  // Flatten catalog into selectable variants
  const allVariants = useMemo(() => {
    const list = [];
    catalog.forEach((prod) => {
      if (prod.variants && prod.variants.length > 0) {
        prod.variants.forEach((v) => {
          list.push({
            id: v.variantId || v.id,
            productId: prod.id,
            productName: prod.name,
            variantName: v.name,
            sku: v.sku || prod.sku,
            stock: Number(v.stock ?? prod.stock ?? 0),
            reorder: Number(v.reorder ?? prod.reorder ?? globalThreshold),
            image: prod.image,
          });
        });
      } else {
        list.push({
          id: prod.variantId || prod.id,
          productId: prod.id,
          productName: prod.name,
          variantName: 'Standard',
          sku: prod.sku,
          stock: Number(prod.stock ?? 0),
          reorder: Number(prod.reorder ?? globalThreshold),
          image: prod.image,
        });
      }
    });
    return list;
  }, [catalog, globalThreshold]);

  // Initial selection when opened
  useEffect(() => {
    if (!isOpen) return;

    if (item) {
      const vId =
        item.variantId ||
        (item.variants && item.variants[0]?.variantId) ||
        item.id;
      setSelectedVariantId(String(vId));
    } else if (allVariants.length > 0) {
      setSelectedVariantId(String(allVariants[0].id));
    }

    setMode('delta');
    setQuantity(1);
    setSelectedReasonChip('Received shipment');
    setReasonText('Received shipment');
    setError('');
  }, [isOpen, item, allVariants]);

  if (!isOpen) return null;

  // Currently active variant being adjusted
  const activeVariant = allVariants.find(
    (v) => String(v.id) === String(selectedVariantId)
  ) || (item ? {
    id: item.variantId || item.id,
    productName: item.name,
    variantName: item.rowType === 'variant' ? item.name : 'Standard',
    sku: item.sku || 'N/A',
    stock: Number(item.stock ?? 0),
    reorder: Number(item.reorder ?? globalThreshold),
    image: item.image,
  } : null);

  const currentStock = activeVariant ? Number(activeVariant.stock) : 0;
  const numQuantity = Number(quantity);

  // Calculate projected new stock
  let projectedStock = currentStock;
  let stockDelta = 0;

  if (mode === 'delta') {
    stockDelta = isNaN(numQuantity) ? 0 : Math.round(numQuantity);
    projectedStock = currentStock + stockDelta;
  } else {
    projectedStock = isNaN(numQuantity) ? currentStock : Math.max(0, Math.round(numQuantity));
    stockDelta = projectedStock - currentStock;
  }

  const isBelowReorder = projectedStock <= (activeVariant?.reorder ?? globalThreshold);

  const handleChipClick = (chip) => {
    setSelectedReasonChip(chip);
    if (chip === 'Other') {
      setReasonText('');
    } else {
      setReasonText(chip);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!activeVariant || !activeVariant.id) {
      setError('Please select a product variant to adjust.');
      return;
    }

    if (!reasonText.trim()) {
      setError('Please provide a reason for this stock adjustment.');
      return;
    }

    if (mode === 'delta' && (!numQuantity || numQuantity === 0)) {
      setError('Quantity delta cannot be zero. Enter a positive number to add or negative to remove.');
      return;
    }

    if (projectedStock < 0) {
      setError(`Stock cannot be reduced below zero. Current stock is ${currentStock}, adjustment would result in ${projectedStock}.`);
      return;
    }

    setSubmitting(true);
    setError('');

    try {
      await onSave({
        variantId: activeVariant.id,
        mode,
        value: numQuantity,
        reason: reasonText.trim(),
      });
      onClose();
    } catch (err) {
      setError(err?.response?.data?.message || err?.message || 'Failed to save stock adjustment.');
    } finally {
      setSubmitting(false);
    }
  };

  const filteredPickerVariants = allVariants.filter((v) =>
    `${v.productName} ${v.sku} ${v.variantName}`.toLowerCase().includes(catalogSearch.toLowerCase())
  );

  return createPortal(
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 99999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--bg-overlay, rgba(20, 18, 16, 0.75))',
        backdropFilter: 'blur(3px)',
        padding: '16px',
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="adj-modal-title"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '520px',
          background: 'var(--bg-surface)',
          border: '1px solid var(--border-default)',
          borderRadius: '12px',
          boxShadow: 'var(--shadow-xl)',
          color: 'var(--text-primary)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          animation: 'modalSlideUp 150ms cubic-bezier(0.16, 1, 0.3, 1)',
        }}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '16px 20px',
            borderBottom: '1px solid var(--border-subtle)',
          }}
        >
          <div>
            <span
              style={{
                fontSize: '11px',
                fontWeight: 600,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                color: 'var(--color-accent, #D4A662)',
              }}
            >
              Inventory Control
            </span>
            <h2
              id="adj-modal-title"
              style={{
                margin: '2px 0 0',
                fontSize: '18px',
                fontFamily: 'var(--font-serif)',
                fontWeight: 600,
                color: 'var(--text-primary)',
              }}
            >
              Adjust Stock Level
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '32px',
              height: '32px',
              border: 0,
              background: 'transparent',
              color: 'var(--text-muted)',
              borderRadius: '6px',
              cursor: 'pointer',
            }}
          >
            <AdminIcon name="close" size={16} />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Product / Variant Selection (searchable if no fixed item) */}
          {!item && allVariants.length > 1 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)' }}>
                Select Product / Variant
              </label>
              <input
                type="text"
                placeholder="Search catalog by name or SKU…"
                value={catalogSearch}
                onChange={(e) => setCatalogSearch(e.target.value)}
                style={{
                  height: '36px',
                  padding: '0 10px',
                  borderRadius: '6px',
                  border: '1px solid var(--border-default)',
                  background: 'var(--bg-input)',
                  color: 'var(--text-primary)',
                  fontSize: '13px',
                }}
              />
              <select
                value={selectedVariantId}
                onChange={(e) => setSelectedVariantId(e.target.value)}
                style={{
                  height: '38px',
                  padding: '0 10px',
                  borderRadius: '6px',
                  border: '1px solid var(--border-default)',
                  background: 'var(--bg-input)',
                  color: 'var(--text-primary)',
                  fontSize: '13px',
                  cursor: 'pointer',
                }}
              >
                {filteredPickerVariants.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.productName} ({v.variantName}) — SKU: {v.sku} (On hand: {v.stock})
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Active Product Details Card */}
          {activeVariant && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                padding: '12px 14px',
                background: 'var(--bg-surface-raised)',
                border: '1px solid var(--border-subtle)',
                borderRadius: '8px',
              }}
            >
              {activeVariant.image ? (
                <img
                  src={activeVariant.image}
                  alt=""
                  style={{
                    width: '44px',
                    height: '44px',
                    borderRadius: '6px',
                    objectFit: 'cover',
                    background: 'var(--bg-surface-sunken)',
                    border: '1px solid var(--border-subtle)',
                  }}
                />
              ) : (
                <div
                  style={{
                    width: '44px',
                    height: '44px',
                    borderRadius: '6px',
                    background: 'var(--bg-surface-sunken)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'var(--text-muted)',
                  }}
                >
                  <AdminIcon name="box" size={20} />
                </div>
              )}

              <div style={{ flex: 1, minWidth: 0 }}>
                <strong
                  style={{
                    display: 'block',
                    fontSize: '14px',
                    fontWeight: 600,
                    color: 'var(--text-primary)',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {activeVariant.productName}
                </strong>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    marginTop: '4px',
                    flexWrap: 'wrap',
                  }}
                >
                  <span
                    style={{
                      fontFamily: 'ui-monospace, SFMono-Regular, monospace',
                      fontSize: '11px',
                      padding: '2px 6px',
                      borderRadius: '4px',
                      background: 'var(--bg-surface-sunken)',
                      color: 'var(--text-secondary)',
                      border: '1px solid var(--border-subtle)',
                    }}
                  >
                    SKU: {activeVariant.sku}
                  </span>
                  <span
                    style={{
                      fontSize: '12px',
                      fontWeight: 600,
                      color: 'var(--text-secondary)',
                    }}
                  >
                    Current on hand: <span style={{ color: 'var(--text-primary)' }}>{currentStock}</span>
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Adjustment Mode (Custom Segmented Control) */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)' }}>
              Adjustment Mode
            </span>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                padding: '3px',
                background: 'var(--bg-surface-sunken)',
                borderRadius: '8px',
                border: '1px solid var(--border-subtle)',
                gap: '4px',
              }}
            >
              <button
                type="button"
                onClick={() => setMode('delta')}
                style={{
                  height: '34px',
                  border: 0,
                  borderRadius: '6px',
                  background: mode === 'delta' ? 'var(--bg-surface)' : 'transparent',
                  color: mode === 'delta' ? 'var(--text-primary)' : 'var(--text-muted)',
                  fontWeight: mode === 'delta' ? 600 : 500,
                  fontSize: '12px',
                  cursor: 'pointer',
                  boxShadow: mode === 'delta' ? 'var(--shadow-sm)' : 'none',
                  transition: 'all 120ms ease',
                }}
              >
                Add or Remove Quantity (+ / -)
              </button>
              <button
                type="button"
                onClick={() => {
                  setMode('set');
                  setQuantity(currentStock);
                }}
                style={{
                  height: '34px',
                  border: 0,
                  borderRadius: '6px',
                  background: mode === 'set' ? 'var(--bg-surface)' : 'transparent',
                  color: mode === 'set' ? 'var(--text-primary)' : 'var(--text-muted)',
                  fontWeight: mode === 'set' ? 600 : 500,
                  fontSize: '12px',
                  cursor: 'pointer',
                  boxShadow: mode === 'set' ? 'var(--shadow-sm)' : 'none',
                  transition: 'all 120ms ease',
                }}
              >
                Set Exact Quantity
              </button>
            </div>
          </div>

          {/* Quantity Input & Live Preview */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', alignItems: 'flex-start' }}>
            <label style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)' }}>
              {mode === 'delta' ? 'Quantity Delta (+ / -)' : 'New Total Quantity'}
              <input
                type="number"
                step="1"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                required
                placeholder={mode === 'delta' ? 'e.g. +10 or -5' : 'e.g. 50'}
                style={{
                  height: '40px',
                  padding: '0 12px',
                  borderRadius: '8px',
                  border: '1px solid var(--border-default)',
                  background: 'var(--bg-input)',
                  color: 'var(--text-primary)',
                  fontFamily: 'ui-monospace, SFMono-Regular, monospace',
                  fontSize: '15px',
                  fontWeight: 600,
                }}
              />
            </label>

            {/* Live Result Preview Box */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)' }}>
                Result Preview
              </span>
              <div
                style={{
                  height: '40px',
                  padding: '0 12px',
                  borderRadius: '8px',
                  background: 'var(--bg-surface-raised)',
                  border: '1px solid var(--border-default)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '14px', fontWeight: 600 }}>
                  <span style={{ color: 'var(--text-secondary)' }}>{currentStock}</span>
                  <span style={{ color: 'var(--text-muted)' }}>→</span>
                  <span
                    style={{
                      color:
                        projectedStock < 0
                          ? 'var(--color-danger)'
                          : stockDelta > 0
                          ? 'var(--color-success)'
                          : stockDelta < 0
                          ? 'var(--color-danger)'
                          : 'var(--text-primary)',
                    }}
                  >
                    {projectedStock} units
                  </span>
                </div>

                {isBelowReorder && projectedStock >= 0 && (
                  <span
                    style={{
                      fontSize: '10px',
                      padding: '2px 6px',
                      borderRadius: '4px',
                      background: 'var(--color-warning-soft)',
                      color: 'var(--color-warning)',
                      fontWeight: 700,
                    }}
                  >
                    Low
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Reason Section (Quick chips + text) */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)' }}>
              Reason for Adjustment <span style={{ color: 'var(--color-danger)' }}>*</span>
            </label>

            {/* Quick Chips */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
              {QUICK_REASONS.map((chip) => {
                const isSelected = selectedReasonChip === chip;
                return (
                  <button
                    key={chip}
                    type="button"
                    onClick={() => handleChipClick(chip)}
                    style={{
                      padding: '4px 10px',
                      borderRadius: '99px',
                      fontSize: '11px',
                      fontWeight: isSelected ? 600 : 500,
                      border: isSelected ? '1px solid var(--color-accent, #D4A662)' : '1px solid var(--border-default)',
                      background: isSelected ? 'var(--bg-surface-sunken)' : 'var(--bg-surface)',
                      color: isSelected ? 'var(--color-accent, #D4A662)' : 'var(--text-secondary)',
                      cursor: 'pointer',
                      transition: 'all 120ms ease',
                    }}
                  >
                    {chip}
                  </button>
                );
              })}
            </div>

            <input
              type="text"
              required
              value={reasonText}
              onChange={(e) => setReasonText(e.target.value)}
              placeholder="e.g. Received shipment PO-401, damaged stock, audit count"
              style={{
                height: '40px',
                padding: '0 12px',
                borderRadius: '8px',
                border: '1px solid var(--border-default)',
                background: 'var(--bg-input)',
                color: 'var(--text-primary)',
                fontSize: '13px',
              }}
            />
          </div>

          {/* Inline Error Message */}
          {error && (
            <div
              style={{
                padding: '10px 12px',
                borderRadius: '6px',
                background: 'var(--color-danger-soft)',
                border: '1px solid var(--color-danger)',
                color: 'var(--color-danger)',
                fontSize: '12px',
                fontWeight: 500,
              }}
            >
              {error}
            </div>
          )}

          {/* Footer Actions */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'flex-end',
              gap: '10px',
              paddingTop: '8px',
              borderTop: '1px solid var(--border-subtle)',
              marginTop: '4px',
            }}
          >
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              style={{
                height: '38px',
                padding: '0 16px',
                borderRadius: '8px',
                border: '1px solid var(--border-default)',
                background: 'transparent',
                color: 'var(--text-primary)',
                fontFamily: 'var(--font-sans)',
                fontSize: '13px',
                fontWeight: 500,
                cursor: 'pointer',
                transition: 'background 120ms ease',
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                height: '38px',
                padding: '0 20px',
                borderRadius: '8px',
                border: 'none',
                background: 'var(--color-primary, #1B1816)',
                color: 'var(--color-sand, #F9F6F0)',
                fontFamily: 'var(--font-sans)',
                fontSize: '13px',
                fontWeight: 600,
                cursor: submitting ? 'not-allowed' : 'pointer',
                opacity: submitting ? 0.7 : 1,
                boxShadow: 'var(--shadow-sm)',
              }}
            >
              {submitting && (
                <span
                  style={{
                    display: 'inline-block',
                    width: '14px',
                    height: '14px',
                    border: '2px solid rgba(255,255,255,0.3)',
                    borderTopColor: '#fff',
                    borderRadius: '50%',
                    animation: 'spin 0.6s linear infinite',
                  }}
                />
              )}
              {submitting ? 'Saving Adjustment…' : 'Save Adjustment'}
            </button>
          </div>
        </form>
      </div>

      <style>{`
        @keyframes modalSlideUp {
          from { opacity: 0; transform: scale(0.97) translateY(8px); }
          to { opacity: 1; transform: scale(1) translateY(0); }
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>,
    document.body
  );
}
