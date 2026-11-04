import { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { AdminIcon } from './AdminLayout';
import './admin-create-discount-modal.css';

function generateRandomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let result = '';
  for (let i = 0; i < 8; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

export default function AdminCreateDiscountModal({
  discountToEdit = null,
  categories = [],
  products = [],
  isOpen,
  onClose,
  onSave,
}) {
  const isEditing = Boolean(discountToEdit);

  // Form State
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [method, setMethod] = useState('code'); // 'code' | 'automatic'
  const [type, setType] = useState('percentage'); // 'percentage' | 'fixed_amount' | 'free_shipping'
  const [value, setValue] = useState(10);
  const [appliesTo, setAppliesTo] = useState('all_products');
  const [selectedCategoryIds, setSelectedCategoryIds] = useState([]);
  const [selectedProductIds, setSelectedProductIds] = useState([]);
  const [minimumSpend, setMinimumSpend] = useState('');
  const [usageLimit, setUsageLimit] = useState('');
  const [perCustomerLimit, setPerCustomerLimit] = useState('');
  const [firstOrderOnly, setFirstOrderOnly] = useState(false);
  const [startsAt, setStartsAt] = useState(new Date().toISOString().slice(0, 10));
  const [hasEndDate, setHasEndDate] = useState(false);
  const [endsAt, setEndsAt] = useState('');

  // UI State
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [showExitConfirm, setShowExitConfirm] = useState(false);

  // Initialize or reset form
  useEffect(() => {
    if (!isOpen) {
      setShowExitConfirm(false);
      return;
    }

    if (discountToEdit) {
      setName(discountToEdit.name || '');
      setCode(discountToEdit.code || '');
      setMethod(discountToEdit.method || 'code');
      setType(discountToEdit.rawType || discountToEdit.type?.toLowerCase() || 'percentage');
      setValue(discountToEdit.value ?? 10);
      setAppliesTo(discountToEdit.rawAppliesTo || 'all_products');
      setSelectedCategoryIds(
        discountToEdit.targetCategories
          ? discountToEdit.targetCategories.map((c) => (typeof c === 'object' ? c._id || c.id : c))
          : []
      );
      setSelectedProductIds(
        discountToEdit.targetProducts
          ? discountToEdit.targetProducts.map((p) => (typeof p === 'object' ? p._id || p.id : p))
          : []
      );
      setMinimumSpend(discountToEdit.minimumSpend ? String(discountToEdit.minimumSpend) : '');
      setUsageLimit(discountToEdit.limit || discountToEdit.usageLimit ? String(discountToEdit.limit || discountToEdit.usageLimit) : '');
      setPerCustomerLimit(discountToEdit.perCustomerLimit ? String(discountToEdit.perCustomerLimit) : '');
      setFirstOrderOnly(Boolean(discountToEdit.firstOrderOnly));
      setStartsAt(
        discountToEdit.startsAt
          ? new Date(discountToEdit.startsAt).toISOString().slice(0, 10)
          : new Date().toISOString().slice(0, 10)
      );
      if (discountToEdit.endsAt) {
        setHasEndDate(true);
        setEndsAt(new Date(discountToEdit.endsAt).toISOString().slice(0, 10));
      } else {
        setHasEndDate(false);
        setEndsAt('');
      }
    } else {
      setName('');
      setCode(generateRandomCode());
      setMethod('code');
      setType('percentage');
      setValue(10);
      setAppliesTo('all_products');
      setSelectedCategoryIds([]);
      setSelectedProductIds([]);
      setMinimumSpend('');
      setUsageLimit('');
      setPerCustomerLimit('');
      setFirstOrderOnly(false);
      setStartsAt(new Date().toISOString().slice(0, 10));
      setHasEndDate(false);
      setEndsAt('');
    }

    setError('');
    setIsDirty(false);
  }, [isOpen, discountToEdit]);

  if (!isOpen) return null;

  const handleCopyCode = () => {
    if (!code) return;
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleGenerateCode = () => {
    setCode(generateRandomCode());
    setIsDirty(true);
  };

  const handleAttemptClose = () => {
    if (isDirty) {
      setShowExitConfirm(true);
    } else {
      onClose();
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Discount name is required.');
      return;
    }

    const cleanCode = code.trim().toUpperCase();
    if (!cleanCode) {
      setError('Discount code is required.');
      return;
    }

    if (!/^[A-Z0-9_-]+$/.test(cleanCode)) {
      setError('Discount code can only contain uppercase letters, numbers, hyphens and underscores.');
      return;
    }

    if (type !== 'free_shipping') {
      const numVal = Number(value);
      if (isNaN(numVal) || numVal <= 0) {
        setError('Discount value must be greater than zero.');
        return;
      }
      if (type === 'percentage' && numVal > 100) {
        setError('Percentage discount cannot exceed 100%.');
        return;
      }
    }

    if (hasEndDate && endsAt) {
      if (new Date(endsAt).getTime() < new Date(startsAt).getTime()) {
        setError('End date cannot be earlier than start date.');
        return;
      }
    }

    setSubmitting(true);
    setError('');

    try {
      const payload = {
        name: name.trim(),
        code: cleanCode,
        method,
        type,
        value: type === 'free_shipping' ? 0 : Number(value),
        appliesTo,
        targetCategories: appliesTo === 'specific_categories' ? selectedCategoryIds : [],
        targetProducts: appliesTo === 'specific_products' ? selectedProductIds : [],
        minimumSpend: minimumSpend ? Number(minimumSpend) : null,
        usageLimit: usageLimit ? Number(usageLimit) : null,
        perCustomerLimit: perCustomerLimit ? Number(perCustomerLimit) : null,
        firstOrderOnly,
        startsAt: new Date(startsAt).toISOString(),
        endsAt: hasEndDate && endsAt ? new Date(endsAt).toISOString() : null,
      };

      await onSave(payload, discountToEdit);
      setIsDirty(false);
      onClose();
    } catch (err) {
      setError(err?.response?.data?.message || err?.message || 'Failed to save discount.');
    } finally {
      setSubmitting(false);
    }
  };

  return createPortal(
    <div
      className="create-discount-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="discount-modal-title"
      onMouseDown={(e) => e.target === e.currentTarget && handleAttemptClose()}
    >
      <div className="create-discount-dialog">
        {/* Sticky Header */}
        <div className="create-discount-header">
          <div className="create-discount-header-copy">
            <span className="create-discount-header-category">
              Promotions & Marketing
            </span>
            <h2 id="discount-modal-title" className="create-discount-header-title">
              {isEditing ? `Edit Discount: ${discountToEdit.name}` : 'Create New Discount'}
            </h2>
          </div>
          <button
            type="button"
            onClick={handleAttemptClose}
            aria-label="Close"
            className="create-discount-close-btn"
          >
            <AdminIcon name="close" size={16} />
          </button>
        </div>

        {/* Scrollable Form Body: 2 Columns on Desktop, 1 Column on Tablet/Mobile */}
        <div className="create-discount-body">
          <form id="discount-create-form" className="create-discount-form-layout" onSubmit={handleSubmit}>
            {/* LEFT COLUMN: Form Inputs */}
            <div className="create-discount-form-col">
              {/* Section 1: Basics */}
              <div className="create-discount-section">
                <h3 className="create-discount-section-title">
                  1. Basics
                </h3>

                <label className="create-discount-field">
                  <span>
                    Discount Title <span className="create-discount-field-required">*</span>
                  </span>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => {
                      setName(e.target.value);
                      setIsDirty(true);
                    }}
                    placeholder="e.g. Summer VIP Sale, Welcome 10% Off"
                    className="create-discount-input"
                  />
                </label>

                <div className="create-discount-field">
                  <span>
                    Discount Code <span className="create-discount-field-required">*</span>
                  </span>
                  <div className="create-discount-code-row">
                    <input
                      type="text"
                      required
                      value={code}
                      onChange={(e) => {
                        setCode(e.target.value.toUpperCase().replace(/\s+/g, ''));
                        setIsDirty(true);
                      }}
                      placeholder="e.g. SUMMER25"
                      className="create-discount-input create-discount-code-input"
                    />
                    <div className="create-discount-code-buttons">
                      <button
                        type="button"
                        onClick={handleGenerateCode}
                        className="create-discount-code-btn"
                      >
                        Generate
                      </button>
                      <button
                        type="button"
                        onClick={handleCopyCode}
                        className="create-discount-code-btn"
                      >
                        {copied ? 'Copied!' : 'Copy'}
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Section 2: Method & Type */}
              <div className="create-discount-section">
                <h3 className="create-discount-section-title">
                  2. Method & Type
                </h3>

                <div className="create-discount-grid-2">
                  <label className="create-discount-field">
                    Method
                    <select
                      value={method}
                      onChange={(e) => {
                        setMethod(e.target.value);
                        setIsDirty(true);
                      }}
                      className="create-discount-select"
                    >
                      <option value="code">Code (Customer enters at checkout)</option>
                      <option value="automatic">Automatic (Applied automatically)</option>
                    </select>
                  </label>

                  <label className="create-discount-field">
                    Discount Type
                    <select
                      value={type}
                      onChange={(e) => {
                        setType(e.target.value);
                        setIsDirty(true);
                      }}
                      className="create-discount-select"
                    >
                      <option value="percentage">Percentage (%)</option>
                      <option value="fixed_amount">Fixed Amount ($)</option>
                      <option value="free_shipping">Free Shipping</option>
                    </select>
                  </label>
                </div>

                {type !== 'free_shipping' && (
                  <label className="create-discount-field">
                    <span>
                      Discount Value {type === 'percentage' ? '(%)' : '($)'} <span className="create-discount-field-required">*</span>
                    </span>
                    <input
                      type="number"
                      step={type === 'percentage' ? '1' : '0.01'}
                      min="1"
                      max={type === 'percentage' ? '100' : undefined}
                      required
                      value={value}
                      onChange={(e) => {
                        setValue(e.target.value);
                        setIsDirty(true);
                      }}
                      className="create-discount-input"
                      style={{
                        fontFamily: 'ui-monospace, monospace',
                        fontWeight: 600,
                      }}
                    />
                  </label>
                )}
              </div>

              {/* Section 3: Applies To */}
              <div className="create-discount-section">
                <h3 className="create-discount-section-title">
                  3. Applies To
                </h3>

                <div className="create-discount-radio-group">
                  <label className="create-discount-radio-label">
                    <input
                      type="radio"
                      name="appliesTo"
                      value="all_products"
                      checked={appliesTo === 'all_products'}
                      onChange={() => {
                        setAppliesTo('all_products');
                        setIsDirty(true);
                      }}
                    />
                    All products across store
                  </label>
                  <label className="create-discount-radio-label">
                    <input
                      type="radio"
                      name="appliesTo"
                      value="specific_categories"
                      checked={appliesTo === 'specific_categories'}
                      onChange={() => {
                        setAppliesTo('specific_categories');
                        setIsDirty(true);
                      }}
                    />
                    Specific categories
                  </label>
                  <label className="create-discount-radio-label">
                    <input
                      type="radio"
                      name="appliesTo"
                      value="specific_products"
                      checked={appliesTo === 'specific_products'}
                      onChange={() => {
                        setAppliesTo('specific_products');
                        setIsDirty(true);
                      }}
                    />
                    Specific products
                  </label>
                </div>

                {appliesTo === 'specific_categories' && categories.length > 0 && (
                  <div className="create-discount-chips-wrap">
                    {categories.map((cat) => {
                      const id = String(cat.id || cat._id);
                      const isSelected = selectedCategoryIds.includes(id);
                      return (
                        <button
                          key={id}
                          type="button"
                          onClick={() => {
                            setSelectedCategoryIds((prev) =>
                              isSelected ? prev.filter((x) => x !== id) : [...prev, id]
                            );
                            setIsDirty(true);
                          }}
                          className="create-discount-chip-btn"
                          style={{
                            border: isSelected ? '1px solid var(--color-accent, #D4A662)' : '1px solid var(--border-default)',
                            background: isSelected ? 'var(--bg-surface-sunken)' : 'var(--bg-surface)',
                            color: isSelected ? 'var(--color-accent, #D4A662)' : 'var(--text-secondary)',
                          }}
                        >
                          {cat.name}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Section 4: Requirements & Limits */}
              <div className="create-discount-section">
                <h3 className="create-discount-section-title">
                  4. Requirements & Limits
                </h3>

                <div className="create-discount-grid-2">
                  <label className="create-discount-field">
                    Minimum Spend ($)
                    <input
                      type="number"
                      min="0"
                      step="1"
                      placeholder="No minimum"
                      value={minimumSpend}
                      onChange={(e) => {
                        setMinimumSpend(e.target.value);
                        setIsDirty(true);
                      }}
                      className="create-discount-input"
                    />
                  </label>

                  <label className="create-discount-field">
                    Total Usage Limit
                    <input
                      type="number"
                      min="1"
                      step="1"
                      placeholder="Unlimited"
                      value={usageLimit}
                      onChange={(e) => {
                        setUsageLimit(e.target.value);
                        setIsDirty(true);
                      }}
                      className="create-discount-input"
                    />
                  </label>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '12px' }}>
                  <label className="create-discount-field">
                    Per Customer Usage Limit
                    <input
                      type="number"
                      min="1"
                      step="1"
                      placeholder="e.g. 1 use per customer"
                      value={perCustomerLimit}
                      onChange={(e) => {
                        setPerCustomerLimit(e.target.value);
                        setIsDirty(true);
                      }}
                      className="create-discount-input"
                    />
                  </label>
                </div>

                {/* First-time customer toggle with HIGH CONTRAST */}
                <label className="create-discount-checkbox-label" style={{ marginTop: '4px' }}>
                  <input
                    type="checkbox"
                    checked={firstOrderOnly}
                    onChange={(e) => {
                      setFirstOrderOnly(e.target.checked);
                      setIsDirty(true);
                    }}
                    style={{ width: '16px', height: '16px', accentColor: 'var(--color-primary, #1B1816)' }}
                  />
                  <span>Apply to first-time customer orders only</span>
                </label>
              </div>

              {/* Section 5: Active Dates */}
              <div className="create-discount-section" style={{ borderBottom: 'none', paddingBottom: 0 }}>
                <h3 className="create-discount-section-title">
                  5. Active Dates
                </h3>

                <div className="create-discount-grid-2">
                  <label className="create-discount-field">
                    Starts At
                    <input
                      type="date"
                      required
                      value={startsAt}
                      onChange={(e) => {
                        setStartsAt(e.target.value);
                        setIsDirty(true);
                      }}
                      className="create-discount-input"
                      style={{ colorScheme: 'dark light' }}
                    />
                  </label>

                  {hasEndDate && (
                    <label className="create-discount-field">
                      Ends At
                      <input
                        type="date"
                        required={hasEndDate}
                        value={endsAt}
                        onChange={(e) => {
                          setEndsAt(e.target.value);
                          setIsDirty(true);
                        }}
                        className="create-discount-input"
                        style={{ colorScheme: 'dark light' }}
                      />
                    </label>
                  )}
                </div>

                <label className="create-discount-checkbox-label">
                  <input
                    type="checkbox"
                    checked={hasEndDate}
                    onChange={(e) => {
                      setHasEndDate(e.target.checked);
                      if (!e.target.checked) setEndsAt('');
                      setIsDirty(true);
                    }}
                    style={{ width: '16px', height: '16px', accentColor: 'var(--color-primary, #1B1816)' }}
                  />
                  <span>Set an expiration end date</span>
                </label>
              </div>

              {/* Inline Error */}
              {error && (
                <div className="create-discount-error-banner">
                  {error}
                </div>
              )}
            </div>

            {/* RIGHT COLUMN: Live Interactive Preview Card */}
            <div className="create-discount-preview-col">
              <span className="create-discount-preview-title">
                Live Customer Preview
              </span>

              <div className="create-discount-preview-card">
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span
                    style={{
                      fontFamily: 'ui-monospace, monospace',
                      fontSize: '15px',
                      fontWeight: 700,
                      padding: '4px 8px',
                      borderRadius: '6px',
                      background: 'var(--bg-surface-sunken)',
                      border: '1px dashed var(--color-accent, #D4A662)',
                      color: 'var(--color-accent, #D4A662)',
                    }}
                  >
                    {code || 'CODE'}
                  </span>
                  <span
                    style={{
                      fontSize: '11px',
                      padding: '2px 8px',
                      borderRadius: '99px',
                      fontWeight: 600,
                      background: 'var(--color-success-soft)',
                      color: 'var(--color-success)',
                    }}
                  >
                    {method === 'automatic' ? 'Auto-apply' : 'Active'}
                  </span>
                </div>

                <div>
                  <strong style={{ display: 'block', fontSize: '15px', color: 'var(--text-primary)' }}>
                    {name || 'Discount Name'}
                  </strong>
                  <span style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '2px', display: 'block' }}>
                    {type === 'free_shipping'
                      ? 'Free Shipping on qualified orders'
                      : type === 'percentage'
                      ? `${value || 0}% off order items`
                      : `$${value || 0} off entire order`}
                  </span>
                </div>

                <div className="create-discount-preview-meta">
                  <div>
                    Applies to:{' '}
                    <strong style={{ color: 'var(--text-primary)' }}>
                      {appliesTo === 'all_products'
                        ? 'All products'
                        : appliesTo === 'specific_categories'
                        ? `${selectedCategoryIds.length} categories`
                        : `${selectedProductIds.length} products`}
                    </strong>
                  </div>

                  <div>
                    Minimum spend:{' '}
                    <strong style={{ color: 'var(--text-primary)' }}>
                      {minimumSpend ? `$${minimumSpend}` : 'None'}
                    </strong>
                  </div>

                  {firstOrderOnly && (
                    <div style={{ color: 'var(--color-accent, #D4A662)', fontWeight: 600 }}>
                      ★ First-time customer orders only
                    </div>
                  )}

                  <div>
                    Validity:{' '}
                    <strong style={{ color: 'var(--text-primary)' }}>
                      {startsAt} {endsAt ? `→ ${endsAt}` : '(No end date)'}
                    </strong>
                  </div>
                </div>
              </div>

              {/* Informational Hint */}
              <p className="create-discount-preview-hint">
                Customers entering this code at checkout will have the discount applied immediately against eligible cart items and taxes.
              </p>
            </div>
          </form>
        </div>

        {/* Sticky Footer */}
        <div className="create-discount-footer">
          <div className="create-discount-footer-status">
            {isDirty && '● Unsaved changes'}
          </div>

          <div className="create-discount-footer-actions">
            <button
              type="button"
              onClick={handleAttemptClose}
              disabled={submitting}
              className="create-discount-btn-cancel"
            >
              Cancel
            </button>
            <button
              type="submit"
              form="discount-create-form"
              disabled={submitting}
              className="create-discount-btn-submit"
              style={{
                cursor: submitting ? 'not-allowed' : 'pointer',
                opacity: submitting ? 0.7 : 1,
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
              {submitting ? 'Saving Discount…' : isEditing ? 'Save Changes' : 'Create Discount'}
            </button>
          </div>
        </div>
      </div>

      {/* Unsaved Changes Confirmation Dialog */}
      {showExitConfirm && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 100000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'rgba(0,0,0,0.5)',
          }}
        >
          <div
            style={{
              width: '100%',
              maxWidth: '380px',
              padding: '20px',
              background: 'var(--bg-surface)',
              borderRadius: '10px',
              border: '1px solid var(--border-default)',
              boxShadow: 'var(--shadow-xl)',
            }}
          >
            <h3 style={{ margin: '0 0 8px', fontSize: '16px', color: 'var(--text-primary)' }}>
              Discard unsaved changes?
            </h3>
            <p style={{ margin: '0 0 16px', fontSize: '13px', color: 'var(--text-secondary)' }}>
              You have made modifications to this discount. Are you sure you want to exit without saving?
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              <button
                type="button"
                onClick={() => setShowExitConfirm(false)}
                style={{
                  height: '32px',
                  padding: '0 12px',
                  borderRadius: '6px',
                  border: '1px solid var(--border-default)',
                  background: 'transparent',
                  color: 'var(--text-primary)',
                  fontSize: '12px',
                  cursor: 'pointer',
                }}
              >
                Keep Editing
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowExitConfirm(false);
                  setIsDirty(false);
                  onClose();
                }}
                style={{
                  height: '32px',
                  padding: '0 14px',
                  borderRadius: '6px',
                  border: 'none',
                  background: 'var(--color-danger)',
                  color: '#fff',
                  fontSize: '12px',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Discard & Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>,
    document.body
  );
}
