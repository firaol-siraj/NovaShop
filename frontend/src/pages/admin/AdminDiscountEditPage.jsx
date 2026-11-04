import { useMemo, useRef, useState } from 'react';
import { AdminIcon } from '../../components/admin/AdminLayout';
import AdminRowActionMenu from '../../components/admin/AdminRowActionMenu';
import './admin-discount-edit.css';

const INITIAL_DISCOUNT = {
  format: 'code',
  name: 'Autumn Sale',
  code: 'AUTUMN20',

  type: 'percentage',
  value: '20',

  appliesTo: 'all',
  categories: ['Knitwear', 'Tailoring', 'Outerwear'],

  minimumType: 'none',
  minimumAmount: '',
  minimumQuantity: '',

  usageLimitEnabled: true,
  maxRedemptions: '500',
  onePerCustomer: true,
  newCustomersOnly: false,

  startDate: '2026-09-01',
  startTime: '00:00',

  endDateEnabled: true,
  endDate: '2026-10-31',
  endTime: '23:59',
};

const HISTORICAL_REDEMPTIONS = 142;
const DISCOUNTED_REVENUE = 28400;

function LocalIcon({ name, size = 16 }) {
  const common = {
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.8,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
  };

  const icons = {
    more: (
      <>
        <circle
          cx="5"
          cy="12"
          r="1.2"
          fill="currentColor"
          stroke="none"
        />
        <circle
          cx="12"
          cy="12"
          r="1.2"
          fill="currentColor"
          stroke="none"
        />
        <circle
          cx="19"
          cy="12"
          r="1.2"
          fill="currentColor"
          stroke="none"
        />
      </>
    ),

    sparkle: (
      <path d="m12 3 1.5 5.5L19 10l-5.5 1.5L12 17l-1.5-5.5L5 10l5.5-1.5L12 3Z" />
    ),
  };

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      aria-hidden="true"
      {...common}
    >
      {icons[name]}
    </svg>
  );
}

function Toggle({ checked, onChange, label }) {
  return (
    <button
      type="button"
      className={`discount-edit-toggle${checked ? ' is-on' : ''}`}
      onClick={onChange}
      role="switch"
      aria-checked={checked}
      aria-label={label}
    >
      <span />
    </button>
  );
}

function formatDate(date) {
  if (!date) return '';

  const value = new Date(`${date}T00:00:00`);

  return value.toLocaleDateString('en-US', {
    month: 'short',
    day: '2-digit',
    year: 'numeric',
  });
}

function formatDateRange(startDate, endDateEnabled, endDate) {
  const start = formatDate(startDate);

  if (!endDateEnabled) {
    return `${start} – No end date`;
  }

  return `${start} – ${formatDate(endDate)}`;
}

function formatMinimum(discount) {
  if (discount.minimumType === 'amount') {
    return discount.minimumAmount
      ? `Minimum purchase $${discount.minimumAmount}`
      : 'Minimum purchase amount';
  }

  if (discount.minimumType === 'quantity') {
    return discount.minimumQuantity
      ? `Minimum ${discount.minimumQuantity} items`
      : 'Minimum item quantity';
  }

  return 'No minimum requirement';
}

export default function AdminDiscountEditPage({ go }) {
  const [savedDiscount, setSavedDiscount] = useState(INITIAL_DISCOUNT);
  const [discount, setDiscount] = useState(INITIAL_DISCOUNT);

  const [detailsOpen, setDetailsOpen] = useState(false);
  const [notice, setNotice] = useState('');
  const [moreMenuOpen, setMoreMenuOpen] = useState(false);
  const moreMenuTriggerRef = useRef(null);

  const isDirty =
    JSON.stringify(discount) !== JSON.stringify(savedDiscount);

  const usageLimit = Number(discount.maxRedemptions) || 0;

  const usagePercentage =
    discount.usageLimitEnabled && usageLimit > 0
      ? Math.min(
          (HISTORICAL_REDEMPTIONS / usageLimit) * 100,
          100,
        )
      : 0;

  const usageWarning = usagePercentage >= 80;

  const summaryValue = useMemo(() => {
    if (discount.type === 'percentage') {
      return `${discount.value || 0}% off`;
    }

    if (discount.type === 'fixed') {
      return `$${discount.value || 0} off`;
    }

    return 'Free shipping';
  }, [discount.type, discount.value]);

  const summaryAppliesTo = useMemo(() => {
    if (discount.appliesTo === 'all') {
      return 'all products';
    }

    if (discount.appliesTo === 'categories') {
      return discount.categories.length
        ? discount.categories.join(', ')
        : 'selected categories';
    }

    return 'selected products';
  }, [discount.appliesTo, discount.categories]);

  const update = (field, value) => {
    setDiscount((current) => ({
      ...current,
      [field]: value,
    }));
  };

  const generateCode = () => {
    const adjectives = ['AUTUMN', 'FALL', 'STYLE', 'ATELIER'];
    const randomWord =
      adjectives[Math.floor(Math.random() * adjectives.length)];

    const randomNumber = Math.floor(10 + Math.random() * 90);

    update('code', `${randomWord}${randomNumber}`);
  };

  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(discount.code);
      setNotice('Discount code copied.');
    } catch {
      setNotice(`Discount code: ${discount.code}`);
    }

    window.setTimeout(() => setNotice(''), 1800);
  };

  const handleDiscard = () => {
    setDiscount(savedDiscount);
  };

  const handleSave = () => {
    setSavedDiscount(discount);
    setNotice('Discount changes saved successfully.');

    window.setTimeout(() => setNotice(''), 2200);
  };

  const setType = (type) => {
    update('type', type);

    if (type === 'percentage' && !discount.value) {
      update('value', '20');
    }

    if (type === 'fixed' && !discount.value) {
      update('value', '25');
    }
  };

  const handleBack = () => {
    if (go) {
      go('/admin/discounts');
    }
  };

  return (
    <div className="admin-dashboard discounts-edit-page">
      {/* =====================================================
          PAGE HEADER
      ===================================================== */}
      <section className="admin-page-heading discounts-edit-heading">
        <div className="discounts-edit-heading-copy">
          <button
            type="button"
            className="discounts-edit-back"
            onClick={handleBack}
          >
            <span aria-hidden="true">←</span>
            Discounts
          </button>

          <h1 className="admin-page-title">
            Edit discount
          </h1>

          <p className="admin-page-description">
            Update the code, value, and eligibility for{' '}
            {discount.name || 'this discount'}.
          </p>
        </div>

        <div className="admin-page-actions discounts-edit-actions">
          <button
            ref={moreMenuTriggerRef}
            type="button"
            className="admin-action-button discounts-edit-more"
            aria-label="More discount actions"
            aria-expanded={moreMenuOpen}
            onClick={() => setMoreMenuOpen((v) => !v)}
          >
            <LocalIcon name="more" size={15} />
          </button>

          <AdminRowActionMenu
            isOpen={moreMenuOpen}
            onClose={() => setMoreMenuOpen(false)}
            triggerRef={moreMenuTriggerRef}
            header={{
              title: discount.name,
              subtitle: discount.code ? `${discount.code} · ${discount.format}` : discount.format,
            }}
            items={[
              {
                id: 'orders',
                label: 'View redemptions in orders',
                icon: 'bag',
                onClick: () => {
                  if (go) go(`/admin/orders?discount=${encodeURIComponent(discount.code || discount.name)}`);
                },
              },
              {
                id: 'copy',
                label: 'Copy discount code',
                icon: 'code',
                hidden: !discount.code,
                onClick: copyCode,
              },
              {
                id: 'duplicate',
                label: 'Duplicate as new discount',
                icon: 'copy',
                onClick: () => {
                  if (go) go('/admin/discounts/add');
                },
              },
              {
                id: 'divider',
                isDivider: true,
              },
              {
                id: 'back',
                label: 'Back to all discounts',
                icon: 'chevron',
                onClick: () => {
                  if (go) go('/admin/discounts');
                },
              },
            ]}
          />

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
            onClick={handleSave}
          >
            Save changes
          </button>
        </div>
      </section>

      {/* =====================================================
          EDIT CONTENT
      ===================================================== */}
      <div className="discounts-edit-layout">
        {/* ===================================================
            LEFT FORM COLUMN
        =================================================== */}
        <main className="discounts-edit-form-column">
          {/* DISCOUNT FORMAT */}
          <section className="discount-edit-card">
            <div className="discount-edit-card-heading">
              <div>
                <h2>Discount format</h2>
              </div>
            </div>

            <div className="discount-edit-segmented">
              <button
                type="button"
                className={
                  discount.format === 'code'
                    ? 'is-selected'
                    : ''
                }
                onClick={() => update('format', 'code')}
              >
                DISCOUNT CODE
              </button>

              <button
                type="button"
                className={
                  discount.format === 'automatic'
                    ? 'is-selected'
                    : ''
                }
                onClick={() =>
                  update('format', 'automatic')
                }
              >
                AUTOMATIC DISCOUNT
              </button>
            </div>

            <div className="discount-edit-field">
              <label>DISCOUNT NAME</label>

              <input
                type="text"
                value={discount.name}
                onChange={(event) =>
                  update('name', event.target.value)
                }
              />

              <span className="discount-edit-helper">
                Only visible to your team.
              </span>
            </div>

            {discount.format === 'code' && (
              <div className="discount-edit-field discount-edit-code-field">
                <div className="discount-edit-field-topline">
                  <label>CODE</label>

                  <button
                    type="button"
                    className="discount-edit-generate"
                    onClick={generateCode}
                  >
                    ↻ Generate random
                  </button>
                </div>

                <div className="discount-edit-input-action">
                  <input
                    type="text"
                    value={discount.code}
                    onChange={(event) =>
                      update(
                        'code',
                        event.target.value.toUpperCase(),
                      )
                    }
                  />

                  <button
                    type="button"
                    onClick={copyCode}
                    aria-label="Copy discount code"
                  >
                    <AdminIcon name="copy" size={13} />
                  </button>
                </div>

                <span className="discount-edit-helper">
                  Customers enter this exact code at checkout.
                </span>
              </div>
            )}
          </section>

          {/* TYPE AND VALUE */}
          <section className="discount-edit-card">
            <div className="discount-edit-card-heading">
              <h2>Type and value</h2>
            </div>

            <div className="discount-edit-type-options">
              <button
                type="button"
                className={`discount-edit-type-option ${
                  discount.type === 'percentage'
                    ? 'is-selected'
                    : ''
                }`}
                onClick={() => setType('percentage')}
              >
                <span>Percentage</span>
                <small>Standard % off order</small>
              </button>

              <button
                type="button"
                className={`discount-edit-type-option ${
                  discount.type === 'fixed'
                    ? 'is-selected'
                    : ''
                }`}
                onClick={() => setType('fixed')}
              >
                <span>Fixed amount</span>
                <small>Direct currency deduction</small>
              </button>

              <button
                type="button"
                className={`discount-edit-type-option ${
                  discount.type === 'shipping'
                    ? 'is-selected'
                    : ''
                }`}
                onClick={() => setType('shipping')}
              >
                <span>Free shipping</span>
                <small>Standard delivery fee</small>
              </button>
            </div>

            {discount.type !== 'shipping' && (
              <div className="discount-edit-field discount-edit-value-field">
                <label>
                  {discount.type === 'percentage'
                    ? 'DISCOUNT PERCENTAGE VALUE'
                    : 'DISCOUNT FIXED AMOUNT'}
                </label>

                <div className="discount-edit-suffix-input">
                  <input
                    type="number"
                    min="0"
                    value={discount.value}
                    onChange={(event) =>
                      update('value', event.target.value)
                    }
                  />

                  <span>
                    {discount.type === 'percentage'
                      ? '%'
                      : '$'}
                  </span>
                </div>

                <span className="discount-edit-helper">
                  Applied automatically across eligible items.
                </span>
              </div>
            )}
          </section>

          {/* APPLIES TO */}
          <section className="discount-edit-card">
            <div className="discount-edit-card-heading">
              <h2>Applies to</h2>

              <p>
                Select items eligible for markdown calculations.
              </p>
            </div>

            <div className="discount-edit-radio-list">
              <button
                type="button"
                className={`discount-edit-radio-row ${
                  discount.appliesTo === 'all'
                    ? 'is-selected'
                    : ''
                }`}
                onClick={() =>
                  update('appliesTo', 'all')
                }
              >
                <span className="discount-edit-radio">
                  <span />
                </span>

                <span className="discount-edit-radio-content">
                  <strong>All products</strong>
                  <small>Universal collection scope</small>
                </span>

                <span className="discount-edit-universal">
                  UNIVERSAL
                </span>
              </button>

              <button
                type="button"
                className={`discount-edit-radio-row ${
                  discount.appliesTo === 'categories'
                    ? 'is-selected'
                    : ''
                }`}
                onClick={() =>
                  update('appliesTo', 'categories')
                }
              >
                <span className="discount-edit-radio">
                  <span />
                </span>

                <span className="discount-edit-radio-content">
                  <strong>Specific categories</strong>
                  <small>
                    {discount.categories.join(', ')}
                  </small>
                </span>

                <AdminIcon name="chevron" size={13} />
              </button>

              <button
                type="button"
                className={`discount-edit-radio-row ${
                  discount.appliesTo === 'products'
                    ? 'is-selected'
                    : ''
                }`}
                onClick={() =>
                  update('appliesTo', 'products')
                }
              >
                <span className="discount-edit-radio">
                  <span />
                </span>

                <span className="discount-edit-radio-content">
                  <strong>Specific products</strong>
                  <small>Manual SKU selection</small>
                </span>

                <AdminIcon name="chevron" size={13} />
              </button>
            </div>
          </section>

          {/* MINIMUM PURCHASE */}
          <section className="discount-edit-card">
            <div className="discount-edit-card-heading">
              <h2>Minimum purchase requirements</h2>
            </div>

            <div className="discount-edit-radio-list">
              <button
                type="button"
                className={`discount-edit-radio-row ${
                  discount.minimumType === 'none'
                    ? 'is-selected'
                    : ''
                }`}
                onClick={() =>
                  update('minimumType', 'none')
                }
              >
                <span className="discount-edit-radio">
                  <span />
                </span>

                <span className="discount-edit-radio-content">
                  <strong>No minimum requirement</strong>
                  <small>
                    Applies immediately to any cart value
                  </small>
                </span>
              </button>

              <div
                className={`discount-edit-radio-row discount-edit-radio-input-row ${
                  discount.minimumType === 'amount'
                    ? 'is-selected'
                    : ''
                }`}
              >
                <button
                  type="button"
                  className="discount-edit-radio-main"
                  onClick={() =>
                    update('minimumType', 'amount')
                  }
                >
                  <span className="discount-edit-radio">
                    <span />
                  </span>

                  <span className="discount-edit-radio-content">
                    <strong>
                      Minimum purchase amount ($)
                    </strong>
                    <small>
                      Qualifies based on subtotal
                    </small>
                  </span>
                </button>

                {discount.minimumType === 'amount' && (
                  <div className="discount-edit-inline-input">
                    <span>$</span>

                    <input
                      type="number"
                      min="0"
                      value={discount.minimumAmount}
                      placeholder="300"
                      onChange={(event) =>
                        update(
                          'minimumAmount',
                          event.target.value,
                        )
                      }
                    />
                  </div>
                )}
              </div>

              <div
                className={`discount-edit-radio-row discount-edit-radio-input-row ${
                  discount.minimumType === 'quantity'
                    ? 'is-selected'
                    : ''
                }`}
              >
                <button
                  type="button"
                  className="discount-edit-radio-main"
                  onClick={() =>
                    update('minimumType', 'quantity')
                  }
                >
                  <span className="discount-edit-radio">
                    <span />
                  </span>

                  <span className="discount-edit-radio-content">
                    <strong>
                      Minimum quantity of items
                    </strong>
                    <small>
                      Applies when item count threshold met
                    </small>
                  </span>
                </button>

                {discount.minimumType === 'quantity' && (
                  <div className="discount-edit-inline-input">
                    <input
                      type="number"
                      min="1"
                      value={discount.minimumQuantity}
                      placeholder="3"
                      onChange={(event) =>
                        update(
                          'minimumQuantity',
                          event.target.value,
                        )
                      }
                    />

                    <span>items</span>
                  </div>
                )}
              </div>
            </div>
          </section>

          {/* USAGE LIMITS */}
          <section className="discount-edit-card">
            <div className="discount-edit-card-heading is-inline">
              <h2>Usage limits</h2>

              <span className="discount-edit-meta-label">
                142 OF 500 USES SO FAR
              </span>
            </div>

            <div className="discount-edit-setting">
              <div>
                <strong>Limit total number of uses</strong>
                <small>
                  Caps total coupon redemption across whole store.
                </small>
              </div>

              <Toggle
                checked={discount.usageLimitEnabled}
                onChange={() =>
                  update(
                    'usageLimitEnabled',
                    !discount.usageLimitEnabled,
                  )
                }
                label="Limit total number of uses"
              />
            </div>

            {discount.usageLimitEnabled && (
              <div className="discount-edit-field discount-edit-compact-field">
                <label>MAX REDEMPTIONS</label>

                <input
                  type="number"
                  min={HISTORICAL_REDEMPTIONS}
                  value={discount.maxRedemptions}
                  onChange={(event) =>
                    update(
                      'maxRedemptions',
                      event.target.value,
                    )
                  }
                />
              </div>
            )}

            <div className="discount-edit-setting">
              <div>
                <strong>
                  Limit to one use per customer
                </strong>
                <small>
                  Tracks checkout email address.
                </small>
              </div>

              <Toggle
                checked={discount.onePerCustomer}
                onChange={() =>
                  update(
                    'onePerCustomer',
                    !discount.onePerCustomer,
                  )
                }
                label="Limit to one use per customer"
              />
            </div>

            <div className="discount-edit-setting">
              <div>
                <strong>
                  Limit to new customers only
                </strong>
                <small>
                  Customer has no prior recorded orders.
                </small>
              </div>

              <Toggle
                checked={discount.newCustomersOnly}
                onChange={() =>
                  update(
                    'newCustomersOnly',
                    !discount.newCustomersOnly,
                  )
                }
                label="Limit to new customers only"
              />
            </div>
          </section>

          {/* ACTIVE DATES */}
          <section className="discount-edit-card">
            <div className="discount-edit-card-heading is-inline">
              <h2>Active dates</h2>

              <span className="discount-edit-meta-label">
                TIMES USE STORE TIME ZONE (CET)
              </span>
            </div>

            <div className="discount-edit-date-grid">
              <div className="discount-edit-field">
                <label>START DATE</label>

                <div className="discount-edit-date-input">
                  <input
                    type="date"
                    value={discount.startDate}
                    onChange={(event) =>
                      update(
                        'startDate',
                        event.target.value,
                      )
                    }
                  />

                  <AdminIcon name="calendar" size={13} />
                </div>
              </div>

              <div className="discount-edit-field">
                <label>START TIME</label>

                <input
                  type="time"
                  value={discount.startTime}
                  onChange={(event) =>
                    update(
                      'startTime',
                      event.target.value,
                    )
                  }
                />
              </div>
            </div>

            <div className="discount-edit-setting discount-edit-end-toggle">
              <div>
                <strong>Set end date</strong>
              </div>

              <Toggle
                checked={discount.endDateEnabled}
                onChange={() =>
                  update(
                    'endDateEnabled',
                    !discount.endDateEnabled,
                  )
                }
                label="Set end date"
              />
            </div>

            {discount.endDateEnabled && (
              <div className="discount-edit-date-grid">
                <div className="discount-edit-field">
                  <label>END DATE</label>

                  <div className="discount-edit-date-input">
                    <input
                      type="date"
                      value={discount.endDate}
                      onChange={(event) =>
                        update(
                          'endDate',
                          event.target.value,
                        )
                      }
                    />

                    <AdminIcon
                      name="calendar"
                      size={13}
                    />
                  </div>
                </div>

                <div className="discount-edit-field">
                  <label>END TIME</label>

                  <input
                    type="time"
                    value={discount.endTime}
                    onChange={(event) =>
                      update(
                        'endTime',
                        event.target.value,
                      )
                    }
                  />
                </div>
              </div>
            )}
          </section>
        </main>

        {/* ===================================================
            RIGHT SUMMARY COLUMN
        =================================================== */}
        <aside className="discounts-edit-summary-column">
          <section className="discount-edit-summary-card">
            <div className="discount-edit-summary-title">
              <div>
                <h2>
                  {discount.name || 'Untitled discount'}
                </h2>

                {discount.format === 'code' && (
                  <span className="discount-edit-summary-code">
                    {discount.code || 'NO CODE'}
                  </span>
                )}

                {discount.format === 'automatic' && (
                  <span className="discount-edit-summary-code">
                    AUTOMATIC DISCOUNT
                  </span>
                )}
              </div>

              <span className="discount-edit-status">
                <i />
                ACTIVE
              </span>
            </div>

            <div className="discount-edit-divider" />

            <ul className="discount-edit-summary-list">
              <li>
                <span />
                <strong>
                  {summaryValue} {summaryAppliesTo}
                </strong>
              </li>

              <li>
                <span />
                <strong>
                  {formatMinimum(discount)}
                </strong>
              </li>

              <li>
                <span />
                <strong>
                  {discount.usageLimitEnabled
                    ? `Limited to ${
                        discount.maxRedemptions || '—'
                      } uses${
                        discount.onePerCustomer
                          ? ', one per customer'
                          : ''
                      }`
                    : 'Unlimited redemptions'}
                </strong>
              </li>

              <li>
                <span />
                <strong>
                  {formatDateRange(
                    discount.startDate,
                    discount.endDateEnabled,
                    discount.endDate,
                  )}
                </strong>
              </li>
            </ul>

            <div className="discount-edit-divider" />

            <div className="discount-edit-redemption">
              <div className="discount-edit-redemption-heading">
                <span>REDEMPTION PACE</span>

                <strong>
                  {HISTORICAL_REDEMPTIONS} of{' '}
                  {discount.usageLimitEnabled
                    ? discount.maxRedemptions
                    : '∞'}{' '}
                  used
                </strong>
              </div>

              {discount.usageLimitEnabled && (
                <div className="discount-edit-progress">
                  <span
                    className={
                      usageWarning ? 'is-warning' : ''
                    }
                    style={{
                      width: `${usagePercentage}%`,
                    }}
                  />
                </div>
              )}

              {!discount.usageLimitEnabled && (
                <div className="discount-edit-unlimited">
                  Unlimited redemption capacity
                </div>
              )}

              <div className="discount-edit-revenue">
                <span>Discounted revenue</span>

                <strong>
                  ${DISCOUNTED_REVENUE.toLocaleString()}
                </strong>
              </div>
            </div>
          </section>

          {/* DETAILS */}
          <section className="discount-edit-details-card">
            <button
              type="button"
              className="discount-edit-details-toggle"
              onClick={() =>
                setDetailsOpen(!detailsOpen)
              }
              aria-expanded={detailsOpen}
            >
              <span>Details</span>

              <span
                className={`discount-edit-details-chevron ${
                  detailsOpen ? 'is-open' : ''
                }`}
              >
                <AdminIcon
                  name="chevron"
                  size={13}
                />
              </span>
            </button>

            {detailsOpen && (
              <div className="discount-edit-details-content">
                <div>
                  <span>Discount ID</span>
                  <strong>DSC-0031</strong>
                </div>

                <div>
                  <span>Created</span>
                  <strong>Aug 20, 2026</strong>
                </div>

                <div>
                  <span>Last updated</span>
                  <strong>
                    Sep 29, 2026 · 14:32
                  </strong>
                </div>

                <div>
                  <span>Historical redemptions</span>
                  <strong>142</strong>
                </div>
              </div>
            )}
          </section>
        </aside>
      </div>

      {notice && (
        <div className="admin-toast" role="status">
          <span className="discount-edit-toast-dot" />
          {notice}
        </div>
      )}
    </div>
  );
}