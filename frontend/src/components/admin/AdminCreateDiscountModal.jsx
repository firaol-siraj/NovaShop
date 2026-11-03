import { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { AdminIcon } from './AdminLayout';

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
      aria-labelledby="discount-modal-title"
      onMouseDown={(e) => e.target === e.currentTarget && handleAttemptClose()}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '860px',
          maxHeight: '90vh',
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
        {/* Sticky Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '16px 24px',
            borderBottom: '1px solid var(--border-subtle)',
            background: 'var(--bg-surface)',
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
              Promotions & Marketing
            </span>
            <h2
              id="discount-modal-title"
              style={{
                margin: '2px 0 0',
                fontSize: '20px',
                fontFamily: 'var(--font-serif)',
                fontWeight: 600,
                color: 'var(--text-primary)',
              }}
            >
              {isEditing ? `Edit Discount: ${discountToEdit.name}` : 'Create New Discount'}
            </h2>
          </div>
          <button
            type="button"
            onClick={handleAttemptClose}
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

        {/* Scrollable Form Body: 2 Columns on Desktop */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '24px' }}>
          <form id="discount-create-form" onSubmit={handleSubmit} style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.35fr) minmax(260px, 0.85fr)', gap: '24px' }}>
            {/* LEFT COLUMN: Form Inputs */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {/* Section 1: Basics */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', paddingBottom: '16px', borderBottom: '1px solid var(--border-subtle)' }}>
                <h3 style={{ margin: 0, fontSize: '13px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-primary)' }}>
                  1. Basics
                </h3>

                <label style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)' }}>
                  Discount Title <span style={{ color: 'var(--color-danger)' }}>*</span>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => {
                      setName(e.target.value);
                      setIsDirty(true);
                    }}
                    placeholder="e.g. Summer VIP Sale, Welcome 10% Off"
                    style={{
                      height: '38px',
                      padding: '0 12px',
                      borderRadius: '8px',
                      border: '1px solid var(--border-default)',
                      background: 'var(--bg-input)',
                      color: 'var(--text-primary)',
                      fontSize: '13px',
                    }}
                  />
                </label>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)' }}>
                    Discount Code <span style={{ color: 'var(--color-danger)' }}>*</span>
                  </label>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <input
                      type="text"
                      required
                      value={code}
                      onChange={(e) => {
                        setCode(e.target.value.toUpperCase().replace(/\s+/g, ''));
                        setIsDirty(true);
                      }}
                      placeholder="e.g. SUMMER25"
                      style={{
                        flex: 1,
                        height: '38px',
                        padding: '0 12px',
                        borderRadius: '8px',
                        border: '1px solid var(--border-default)',
                        background: 'var(--bg-input)',
                        color: 'var(--text-primary)',
                        fontFamily: 'ui-monospace, monospace',
                        fontWeight: 700,
                        fontSize: '14px',
                        textTransform: 'uppercase',
                      }}
                    />
                    <button
                      type="button"
                      onClick={handleGenerateCode}
                      style={{
                        height: '38px',
                        padding: '0 12px',
                        borderRadius: '8px',
                        border: '1px solid var(--border-default)',
                        background: 'var(--bg-surface-raised)',
                        color: 'var(--text-primary)',
                        fontSize: '12px',
                        fontWeight: 600,
                        cursor: 'pointer',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      Generate
                    </button>
                    <button
                      type="button"
                      onClick={handleCopyCode}
                      style={{
                        height: '38px',
                        padding: '0 12px',
                        borderRadius: '8px',
                        border: '1px solid var(--border-default)',
                        background: 'var(--bg-surface-raised)',
                        color: 'var(--text-primary)',
                        fontSize: '12px',
                        fontWeight: 600,
                        cursor: 'pointer',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {copied ? 'Copied!' : 'Copy'}
                    </button>
                  </div>
                </div>
              </div>

              {/* Section 2: Method & Type */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', paddingBottom: '16px', borderBottom: '1px solid var(--border-subtle)' }}>
                <h3 style={{ margin: 0, fontSize: '13px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-primary)' }}>
                  2. Method & Type
                </h3>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <label style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)' }}>
                    Method
                    <select
                      value={method}
                      onChange={(e) => {
                        setMethod(e.target.value);
                        setIsDirty(true);
                      }}
                      style={{
                        height: '38px',
                        padding: '0 10px',
                        borderRadius: '8px',
                        border: '1px solid var(--border-default)',
                        background: 'var(--bg-input)',
                        color: 'var(--text-primary)',
                        fontSize: '13px',
                      }}
                    >
                      <option value="code">Code (Customer enters at checkout)</option>
                      <option value="automatic">Automatic (Applied automatically)</option>
                    </select>
                  </label>

                  <label style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)' }}>
                    Discount Type
                    <select
                      value={type}
                      onChange={(e) => {
                        setType(e.target.value);
                        setIsDirty(true);
                      }}
                      style={{
                        height: '38px',
                        padding: '0 10px',
                        borderRadius: '8px',
                        border: '1px solid var(--border-default)',
                        background: 'var(--bg-input)',
                        color: 'var(--text-primary)',
                        fontSize: '13px',
                      }}
                    >
                      <option value="percentage">Percentage (%)</option>
                      <option value="fixed_amount">Fixed Amount ($)</option>
                      <option value="free_shipping">Free Shipping</option>
                    </select>
                  </label>
                </div>

                {type !== 'free_shipping' && (
                  <label style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)' }}>
                    Discount Value {type === 'percentage' ? '(%)' : '($)'} <span style={{ color: 'var(--color-danger)' }}>*</span>
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
                      style={{
                        height: '38px',
                        padding: '0 12px',
                        borderRadius: '8px',
                        border: '1px solid var(--border-default)',
                        background: 'var(--bg-input)',
                        color: 'var(--text-primary)',
                        fontFamily: 'ui-monospace, monospace',
                        fontWeight: 600,
                        fontSize: '14px',
                      }}
                    />
                  </label>
                )}
              </div>

              {/* Section 3: Applies To */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', paddingBottom: '16px', borderBottom: '1px solid var(--border-subtle)' }}>
                <h3 style={{ margin: 0, fontSize: '13px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-primary)' }}>
                  3. Applies To
                </h3>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: 'var(--text-primary)', cursor: 'pointer' }}>
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
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: 'var(--text-primary)', cursor: 'pointer' }}>
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
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: 'var(--text-primary)', cursor: 'pointer' }}>
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
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '6px' }}>
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
                          style={{
                            padding: '4px 10px',
                            borderRadius: '99px',
                            fontSize: '12px',
                            border: isSelected ? '1px solid var(--color-accent, #D4A662)' : '1px solid var(--border-default)',
                            background: isSelected ? 'var(--bg-surface-sunken)' : 'var(--bg-surface)',
                            color: isSelected ? 'var(--color-accent, #D4A662)' : 'var(--text-secondary)',
                            cursor: 'pointer',
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
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', paddingBottom: '16px', borderBottom: '1px solid var(--border-subtle)' }}>
                <h3 style={{ margin: 0, fontSize: '13px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-primary)' }}>
                  4. Requirements & Limits
                </h3>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <label style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)' }}>
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
                      style={{
                        height: '38px',
                        padding: '0 12px',
                        borderRadius: '8px',
                        border: '1px solid var(--border-default)',
                        background: 'var(--bg-input)',
                        color: 'var(--text-primary)',
                        fontSize: '13px',
                      }}
                    />
                  </label>

                  <label style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)' }}>
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
                      style={{
                        height: '38px',
                        padding: '0 12px',
                        borderRadius: '8px',
                        border: '1px solid var(--border-default)',
                        background: 'var(--bg-input)',
                        color: 'var(--text-primary)',
                        fontSize: '13px',
                      }}
                    />
                  </label>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '12px' }}>
                  <label style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)' }}>
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
                      style={{
                        height: '38px',
                        padding: '0 12px',
                        borderRadius: '8px',
                        border: '1px solid var(--border-default)',
                        background: 'var(--bg-input)',
                        color: 'var(--text-primary)',
                        fontSize: '13px',
                      }}
                    />
                  </label>
                </div>

                {/* First-time customer toggle with HIGH CONTRAST */}
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', fontWeight: 500, color: 'var(--text-primary)', cursor: 'pointer', marginTop: '4px' }}>
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
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <h3 style={{ margin: 0, fontSize: '13px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-primary)' }}>
                  5. Active Dates
                </h3>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <label style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)' }}>
                    Starts At
                    <input
                      type="date"
                      required
                      value={startsAt}
                      onChange={(e) => {
                        setStartsAt(e.target.value);
                        setIsDirty(true);
                      }}
                      style={{
                        height: '38px',
                        padding: '0 10px',
                        borderRadius: '8px',
                        border: '1px solid var(--border-default)',
                        background: 'var(--bg-input)',
                        color: 'var(--text-primary)',
                        colorScheme: 'dark light',
                        fontSize: '13px',
                      }}
                    />
                  </label>

                  {hasEndDate && (
                    <label style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)' }}>
                      Ends At
                      <input
                        type="date"
                        required={hasEndDate}
                        value={endsAt}
                        onChange={(e) => {
                          setEndsAt(e.target.value);
                          setIsDirty(true);
                        }}
                        style={{
                          height: '38px',
                          padding: '0 10px',
                          borderRadius: '8px',
                          border: '1px solid var(--border-default)',
                          background: 'var(--bg-input)',
                          color: 'var(--text-primary)',
                          colorScheme: 'dark light',
                          fontSize: '13px',
                        }}
                      />
                    </label>
                  )}
                </div>

                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: 'var(--text-primary)', cursor: 'pointer' }}>
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
                <div
                  style={{
                    padding: '10px 14px',
                    borderRadius: '8px',
                    background: 'var(--color-danger-soft)',
                    border: '1px solid var(--color-danger)',
                    color: 'var(--color-danger)',
                    fontSize: '13px',
                  }}
                >
                  {error}
                </div>
              )}
            </div>

            {/* RIGHT COLUMN: Live Interactive Preview Card */}
            <div style={{ position: 'sticky', top: 0, display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <span style={{ fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-secondary)' }}>
                Live Customer Preview
              </span>

              <div
                style={{
                  padding: '18px',
                  borderRadius: '12px',
                  background: 'var(--bg-surface-raised)',
                  border: '1px solid var(--border-default)',
                  boxShadow: 'var(--shadow-md)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px',
                }}
              >
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

                <div
                  style={{
                    padding: '10px 12px',
                    borderRadius: '6px',
                    background: 'var(--bg-surface)',
                    border: '1px solid var(--border-subtle)',
                    fontSize: '12px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '4px',
                    color: 'var(--text-muted)',
                  }}
                >
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
              <p style={{ margin: 0, fontSize: '11px', color: 'var(--text-muted)', lineHeight: 1.4 }}>
                Customers entering this code at checkout will have the discount applied immediately against eligible cart items and taxes.
              </p>
            </div>
          </form>
        </div>

        {/* Sticky Footer */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '14px 24px',
            borderTop: '1px solid var(--border-subtle)',
            background: 'var(--bg-surface)',
          }}
        >
          <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
            {isDirty && '● Unsaved changes'}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <button
              type="button"
              onClick={handleAttemptClose}
              disabled={submitting}
              style={{
                height: '38px',
                padding: '0 18px',
                borderRadius: '8px',
                border: '1px solid var(--border-default)',
                background: 'transparent',
                color: 'var(--text-primary)',
                fontFamily: 'var(--font-sans)',
                fontSize: '13px',
                fontWeight: 500,
                cursor: 'pointer',
                transition: 'all 120ms ease',
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              form="discount-create-form"
              disabled={submitting}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                height: '38px',
                padding: '0 22px',
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
