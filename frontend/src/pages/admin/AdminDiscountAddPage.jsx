import { useMemo, useState } from 'react';
import { AdminIcon } from '../../components/admin/AdminLayout';
import './admin-discount-add.css';

const getToday = () => {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
};

const INITIAL_DISCOUNT = {
  format: 'code',

  name: '',
  code: '',

  type: 'percentage',
  value: '0',

  appliesTo: 'all',
  categories: [],

  minimumType: 'none',
  minimumAmount: '',
  minimumQuantity: '',

  usageLimitEnabled: false,
  maxRedemptions: '',

  onePerCustomer: false,
  newCustomersOnly: false,

  startDate: getToday(),
  startTime: '00:00',

  endDateEnabled: false,
  endDate: '',
  endTime: '23:59',
};

/* =========================================================
   LOCAL CLOCK ICON
   Keeps this page independent from AdminLayout's icon list.
========================================================= */

function ClockIcon({ size = 13 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7v5l3 2" />
    </svg>
  );
}

/* =========================================================
   TOGGLE
========================================================= */

function Toggle({ checked, onChange, label }) {
  return (
    <button
      type="button"
      className={`discount-add-toggle${checked ? ' is-on' : ''}`}
      onClick={onChange}
      role="switch"
      aria-checked={checked}
      aria-label={label}
    >
      <span />
    </button>
  );
}

/* =========================================================
   DATE FORMATTER
========================================================= */

function formatDate(date) {
  if (!date) {
    return '';
  }

  const value = new Date(`${date}T00:00:00`);

  if (Number.isNaN(value.getTime())) {
    return '';
  }

  return value.toLocaleDateString('en-US', {
    month: 'short',
    day: '2-digit',
    year: 'numeric',
  });
}

/* =========================================================
   MINIMUM SUMMARY
========================================================= */

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

/* =========================================================
   PAGE
========================================================= */

export default function AdminDiscountAddPage({ go }) {
  const [discount, setDiscount] = useState(INITIAL_DISCOUNT);
  const [notice, setNotice] = useState('');

  /* =======================================================
     UPDATE FIELD
  ======================================================= */

  const update = (field, value) => {
    setDiscount((current) => ({
      ...current,
      [field]: value,
    }));
  };

  /* =======================================================
     VALIDATION
  ======================================================= */

  const isValid = useMemo(() => {
    const hasName = discount.name.trim().length > 0;

    if (discount.format === 'automatic') {
      return hasName;
    }

    return hasName && discount.code.trim().length > 0;
  }, [discount.name, discount.code, discount.format]);

  /* =======================================================
     SUMMARY VALUE
  ======================================================= */

  const summaryValue = useMemo(() => {
    if (discount.type === 'percentage') {
      return `${discount.value || 0}% off`;
    }

    if (discount.type === 'fixed') {
      return `$${discount.value || 0} off`;
    }

    return 'Free shipping';
  }, [discount.type, discount.value]);

  /* =======================================================
     SUMMARY APPLIES TO
  ======================================================= */

  const summaryAppliesTo = useMemo(() => {
    if (discount.appliesTo === 'all') {
      return 'All products';
    }

    if (discount.appliesTo === 'categories') {
      return discount.categories.length
        ? discount.categories.join(', ')
        : 'Specific categories';
    }

    return 'Specific products';
  }, [discount.appliesTo, discount.categories]);

  /* =======================================================
     GENERATE CODE
  ======================================================= */

  const generateCode = () => {
    const words = [
      'AUTUMN',
      'FALL',
      'STYLE',
      'ATELIER',
      'WELCOME',
      'NOVASHOP',
    ];

    const randomWord =
      words[Math.floor(Math.random() * words.length)];

    const randomNumber = Math.floor(10 + Math.random() * 90);

    update('code', `${randomWord}${randomNumber}`);
  };

  /* =======================================================
     BACK
  ======================================================= */

  const handleBack = () => {
    if (typeof go === 'function') {
      go('/admin/discounts');
    }
  };

  /* =======================================================
     DISCARD
  ======================================================= */

  const handleDiscard = () => {
    setDiscount({
      ...INITIAL_DISCOUNT,
      startDate: getToday(),
    });

    setNotice('');

    if (typeof go === 'function') {
      go('/admin/discounts');
    }
  };

  /* =======================================================
     SAVE
  ======================================================= */

  const handleSave = () => {
    if (!isValid) {
      setNotice(
        discount.name.trim().length === 0
          ? 'Enter a discount name before saving.'
          : 'Enter a discount code before saving.'
      );

      window.setTimeout(() => {
        setNotice('');
      }, 2400);

      return;
    }

    setNotice('Discount created successfully.');

    window.setTimeout(() => {
      setNotice('');

      if (typeof go === 'function') {
        go('/admin/discounts');
      }
    }, 900);
  };

  /* =======================================================
     DISCOUNT TYPE
  ======================================================= */

  const setType = (type) => {
    update('type', type);

    if (
      (type === 'percentage' || type === 'fixed') &&
      !discount.value
    ) {
      update('value', '0');
    }
  };

  /* =======================================================
     STATUS
  ======================================================= */

  const summaryStatus = useMemo(() => {
    if (!discount.startDate) {
      return 'ACTIVE';
    }

    const start = new Date(
      `${discount.startDate}T${discount.startTime || '00:00'}:00`
    );

    if (Number.isNaN(start.getTime())) {
      return 'ACTIVE';
    }

    return start > new Date() ? 'SCHEDULED' : 'ACTIVE';
  }, [discount.startDate, discount.startTime]);

  /* =======================================================
     RENDER
  ======================================================= */

  return (
    <div className="admin-dashboard discounts-add-page">
      {/* ===================================================
          PAGE HEADER
      =================================================== */}

      <section className="admin-page-heading discounts-add-heading">
        <div className="discounts-add-heading-copy">
          <button
            type="button"
            className="discounts-add-back"
            onClick={handleBack}
          >
            <span aria-hidden="true">←</span>
            Discounts
          </button>

          <h1 className="admin-page-title">
            Add discount
          </h1>

          <p className="admin-page-description">
            Create a discount code or an automatic discount.
          </p>
        </div>

        <div className="admin-page-actions discounts-add-actions">
          <button
            type="button"
            className="admin-action-button"
            onClick={handleDiscard}
          >
            Discard
          </button>

          <button
            type="button"
            className="admin-action-button is-primary"
            onClick={handleSave}
          >
            Save discount
          </button>
        </div>
      </section>

      {/* ===================================================
          MAIN CONTENT
      =================================================== */}

      <div className="discounts-add-layout">
        {/* =================================================
            LEFT FORM COLUMN
        ================================================= */}

        <main className="discounts-add-form-column">
          {/* =================================================
              DISCOUNT
          ================================================= */}

          <section className="discount-add-card">
            <div className="discount-add-card-heading">
              <h2>Discount</h2>
            </div>

            <div className="discount-add-segmented">
              <button
                type="button"
                className={
                  discount.format === 'code'
                    ? 'is-selected'
                    : ''
                }
                onClick={() =>
                  update('format', 'code')
                }
              >
                Discount code
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
                Automatic discount
              </button>
            </div>

            <div className="discount-add-field">
              <label htmlFor="discount-name">
                Discount name
              </label>

              <input
                id="discount-name"
                type="text"
                value={discount.name}
                placeholder="e.g. Autumn Sale"
                onChange={(event) =>
                  update('name', event.target.value)
                }
              />

              <span className="discount-add-helper">
                Only visible to your team.
              </span>
            </div>

            {discount.format === 'code' && (
              <div className="discount-add-field discount-add-code-field">
                <div className="discount-add-field-topline">
                  <label htmlFor="discount-code">
                    Code
                  </label>

                  <button
                    type="button"
                    className="discount-add-generate"
                    onClick={generateCode}
                  >
                    Generate
                  </button>
                </div>

                <div className="discount-add-code-input">
                  <input
                    id="discount-code"
                    type="text"
                    value={discount.code}
                    placeholder="E.G. AUTUMN20"
                    onChange={(event) =>
                      update(
                        'code',
                        event.target.value.toUpperCase()
                      )
                    }
                  />

                  <button
                    type="button"
                    onClick={generateCode}
                  >
                    Generate
                  </button>
                </div>

                <span className="discount-add-helper">
                  Customers enter this code at checkout.
                </span>
              </div>
            )}
          </section>

          {/* =================================================
              TYPE AND VALUE
          ================================================= */}

          <section className="discount-add-card">
            <div className="discount-add-card-heading">
              <h2>Type and value</h2>
            </div>

            <div className="discount-add-type-options">
              <button
                type="button"
                className={`discount-add-type-option ${
                  discount.type === 'percentage'
                    ? 'is-selected'
                    : ''
                }`}
                onClick={() =>
                  setType('percentage')
                }
              >
                <span className="discount-add-option-radio">
                  <i />
                </span>

                <span className="discount-add-type-copy">
                  <strong>Percentage</strong>
                  <small>Calculated on cart</small>
                </span>
              </button>

              <button
                type="button"
                className={`discount-add-type-option ${
                  discount.type === 'fixed'
                    ? 'is-selected'
                    : ''
                }`}
                onClick={() => setType('fixed')}
              >
                <span className="discount-add-option-radio">
                  <i />
                </span>

                <span className="discount-add-type-copy">
                  <strong>Fixed amount</strong>
                  <small>Subtracted at order</small>
                </span>
              </button>

              <button
                type="button"
                className={`discount-add-type-option ${
                  discount.type === 'shipping'
                    ? 'is-selected'
                    : ''
                }`}
                onClick={() =>
                  setType('shipping')
                }
              >
                <span className="discount-add-option-radio">
                  <i />
                </span>

                <span className="discount-add-type-copy">
                  <strong>Free shipping</strong>
                  <small>Universal delivery</small>
                </span>
              </button>
            </div>

            {discount.type !== 'shipping' && (
              <div className="discount-add-field discount-add-value-field">
                <label htmlFor="discount-value">
                  Discount value
                </label>

                <div className="discount-add-suffix-input">
                  <input
                    id="discount-value"
                    type="number"
                    min="0"
                    value={discount.value}
                    onChange={(event) =>
                      update(
                        'value',
                        event.target.value
                      )
                    }
                  />

                  <span>
                    {discount.type === 'percentage'
                      ? '%'
                      : '$'}
                  </span>
                </div>
              </div>
            )}
          </section>

          {/* =================================================
              APPLIES TO
          ================================================= */}

          <section className="discount-add-card">
            <div className="discount-add-card-heading">
              <h2>Applies to</h2>
            </div>

            <div className="discount-add-radio-list">
              <button
                type="button"
                className={`discount-add-radio-row ${
                  discount.appliesTo === 'all'
                    ? 'is-selected'
                    : ''
                }`}
                onClick={() =>
                  update('appliesTo', 'all')
                }
              >
                <span className="discount-add-radio">
                  <i />
                </span>

                <span className="discount-add-radio-copy">
                  <strong>All products</strong>
                  <small>
                    Universal catalogue scope
                  </small>
                </span>
              </button>

              <button
                type="button"
                className={`discount-add-radio-row ${
                  discount.appliesTo === 'categories'
                    ? 'is-selected'
                    : ''
                }`}
                onClick={() =>
                  update('appliesTo', 'categories')
                }
              >
                <span className="discount-add-radio">
                  <i />
                </span>

                <span className="discount-add-radio-copy">
                  <strong>Specific categories</strong>
                  <small>
                    Filter by curated collection
                  </small>
                </span>
              </button>

              <button
                type="button"
                className={`discount-add-radio-row ${
                  discount.appliesTo === 'products'
                    ? 'is-selected'
                    : ''
                }`}
                onClick={() =>
                  update('appliesTo', 'products')
                }
              >
                <span className="discount-add-radio">
                  <i />
                </span>

                <span className="discount-add-radio-copy">
                  <strong>Specific products</strong>
                  <small>
                    Select specific garments or accessories
                  </small>
                </span>
              </button>
            </div>
          </section>

          {/* =================================================
              MINIMUM REQUIREMENTS
          ================================================= */}

          <section className="discount-add-card">
            <div className="discount-add-card-heading">
              <h2>Minimum requirements</h2>
            </div>

            <div className="discount-add-radio-list">
              <button
                type="button"
                className={`discount-add-radio-row ${
                  discount.minimumType === 'none'
                    ? 'is-selected'
                    : ''
                }`}
                onClick={() =>
                  update('minimumType', 'none')
                }
              >
                <span className="discount-add-radio">
                  <i />
                </span>

                <span className="discount-add-radio-copy">
                  <strong>No minimum</strong>
                  <small>
                    Applies immediately to any cart value
                  </small>
                </span>
              </button>

              <div
                className={`discount-add-radio-row discount-add-input-row ${
                  discount.minimumType === 'amount'
                    ? 'is-selected'
                    : ''
                }`}
              >
                <button
                  type="button"
                  className="discount-add-radio-main"
                  onClick={() =>
                    update(
                      'minimumType',
                      'amount'
                    )
                  }
                >
                  <span className="discount-add-radio">
                    <i />
                  </span>

                  <span className="discount-add-radio-copy">
                    <strong>
                      Minimum purchase amount
                    </strong>
                    <small>
                      Threshold subtotal required before discounts
                    </small>
                  </span>
                </button>

                {discount.minimumType === 'amount' && (
                  <div className="discount-add-inline-input">
                    <span>$</span>

                    <input
                      type="number"
                      min="0"
                      value={discount.minimumAmount}
                      placeholder="300"
                      onChange={(event) =>
                        update(
                          'minimumAmount',
                          event.target.value
                        )
                      }
                    />
                  </div>
                )}
              </div>

              <div
                className={`discount-add-radio-row discount-add-input-row ${
                  discount.minimumType === 'quantity'
                    ? 'is-selected'
                    : ''
                }`}
              >
                <button
                  type="button"
                  className="discount-add-radio-main"
                  onClick={() =>
                    update(
                      'minimumType',
                      'quantity'
                    )
                  }
                >
                  <span className="discount-add-radio">
                    <i />
                  </span>

                  <span className="discount-add-radio-copy">
                    <strong>
                      Minimum quantity of items
                    </strong>
                    <small>
                      Requires minimum units in bag
                    </small>
                  </span>
                </button>

                {discount.minimumType === 'quantity' && (
                  <div className="discount-add-inline-input">
                    <input
                      type="number"
                      min="1"
                      value={discount.minimumQuantity}
                      placeholder="3"
                      onChange={(event) =>
                        update(
                          'minimumQuantity',
                          event.target.value
                        )
                      }
                    />

                    <span>items</span>
                  </div>
                )}
              </div>
            </div>
          </section>

          {/* =================================================
              USAGE LIMITS
          ================================================= */}

          <section className="discount-add-card">
            <div className="discount-add-card-heading">
              <h2>Usage limits</h2>
            </div>

            <div className="discount-add-setting">
              <div>
                <strong>
                  Limit total number of uses
                </strong>

                <small>
                  Caps total redemption volume across all shoppers
                </small>
              </div>

              <Toggle
                checked={discount.usageLimitEnabled}
                onChange={() =>
                  update(
                    'usageLimitEnabled',
                    !discount.usageLimitEnabled
                  )
                }
                label="Limit total number of uses"
              />
            </div>

            {discount.usageLimitEnabled && (
              <div className="discount-add-field discount-add-limit-field">
                <label htmlFor="maximum-redemptions">
                  Maximum redemptions
                </label>

                <input
                  id="maximum-redemptions"
                  type="number"
                  min="1"
                  value={discount.maxRedemptions}
                  placeholder="500"
                  onChange={(event) =>
                    update(
                      'maxRedemptions',
                      event.target.value
                    )
                  }
                />
              </div>
            )}

            <div className="discount-add-setting">
              <div>
                <strong>
                  Limit to one use per customer
                </strong>

                <small>
                  Tracks checkout email address
                </small>
              </div>

              <Toggle
                checked={discount.onePerCustomer}
                onChange={() =>
                  update(
                    'onePerCustomer',
                    !discount.onePerCustomer
                  )
                }
                label="Limit to one use per customer"
              />
            </div>

            <div className="discount-add-setting">
              <div>
                <strong>
                  Limit to new customers only
                </strong>

                <small>
                  Customer has no prior placed orders
                </small>
              </div>

              <Toggle
                checked={discount.newCustomersOnly}
                onChange={() =>
                  update(
                    'newCustomersOnly',
                    !discount.newCustomersOnly
                  )
                }
                label="Limit to new customers only"
              />
            </div>
          </section>

          {/* =================================================
              ACTIVE DATES
          ================================================= */}

          <section className="discount-add-card">
            <div className="discount-add-card-heading discount-add-heading-inline">
              <h2>Active dates</h2>

              <span>
                Times use store time zone (CET)
              </span>
            </div>

            <div className="discount-add-date-grid">
              <div className="discount-add-field">
                <label htmlFor="start-date">
                  Start date
                </label>

                <div className="discount-add-date-input">
                  <input
                    id="start-date"
                    type="date"
                    value={discount.startDate}
                    onChange={(event) =>
                      update(
                        'startDate',
                        event.target.value
                      )
                    }
                  />

                  <AdminIcon
                    name="calendar"
                    size={13}
                  />
                </div>
              </div>

              <div className="discount-add-field">
                <label htmlFor="start-time">
                  Start time
                </label>

                <div className="discount-add-time-input">
                  <input
                    id="start-time"
                    type="time"
                    value={discount.startTime}
                    onChange={(event) =>
                      update(
                        'startTime',
                        event.target.value
                      )
                    }
                  />

                  <ClockIcon size={13} />
                </div>
              </div>
            </div>

            <div className="discount-add-setting discount-add-end-setting">
              <div>
                <strong>Set end date</strong>

                <small>
                  Automatically deactivate discount code after date
                </small>
              </div>

              <Toggle
                checked={discount.endDateEnabled}
                onChange={() =>
                  update(
                    'endDateEnabled',
                    !discount.endDateEnabled
                  )
                }
                label="Set end date"
              />
            </div>

            {discount.endDateEnabled && (
              <div className="discount-add-date-grid">
                <div className="discount-add-field">
                  <label htmlFor="end-date">
                    End date
                  </label>

                  <div className="discount-add-date-input">
                    <input
                      id="end-date"
                      type="date"
                      value={discount.endDate}
                      onChange={(event) =>
                        update(
                          'endDate',
                          event.target.value
                        )
                      }
                    />

                    <AdminIcon
                      name="calendar"
                      size={13}
                    />
                  </div>
                </div>

                <div className="discount-add-field">
                  <label htmlFor="end-time">
                    End time
                  </label>

                  <div className="discount-add-time-input">
                    <input
                      id="end-time"
                      type="time"
                      value={discount.endTime}
                      onChange={(event) =>
                        update(
                          'endTime',
                          event.target.value
                        )
                      }
                    />

                    <ClockIcon size={13} />
                  </div>
                </div>
              </div>
            )}
          </section>
        </main>

        {/* =================================================
            SUMMARY
        ================================================= */}

        <aside className="discounts-add-summary-column">
          <section className="discount-add-summary-card">
            <div className="discount-add-summary-heading">
              <h2>Summary</h2>

              <span className="discount-add-summary-status">
                <i />
                {summaryStatus}
              </span>
            </div>

            <div className="discount-add-summary-name">
              {discount.name ? (
                discount.name
              ) : (
                <em>No name yet</em>
              )}
            </div>

            {discount.format === 'code' &&
              discount.code && (
                <div className="discount-add-summary-code">
                  {discount.code}
                </div>
              )}

            <div className="discount-add-summary-value">
              {summaryValue}
            </div>

            <ul className="discount-add-summary-list">
              <li>
                <span>✓</span>
                {summaryAppliesTo}
              </li>

              <li>
                <span>✓</span>
                {formatMinimum(discount)}
              </li>

              <li>
                <span>✓</span>

                {discount.usageLimitEnabled
                  ? `Up to ${
                      discount.maxRedemptions || '—'
                    } redemptions`
                  : 'No usage limits'}
              </li>

              <li>
                <span>✓</span>

                {discount.startDate
                  ? `Starts ${formatDate(
                      discount.startDate
                    )}`
                  : 'Start date not set'}
              </li>
            </ul>

            <div className="discount-add-summary-info">
              <span className="discount-add-info-icon">
                i
              </span>

              <p>
                Discounts are calculated at checkout and
                apply in customers&apos; native billing
                currency.
              </p>
            </div>
          </section>
        </aside>
      </div>

      {/* ===================================================
          TOAST
      =================================================== */}

      {notice && (
        <div className="admin-toast" role="status">
          <span className="discount-add-toast-dot" />
          {notice}
        </div>
      )}
    </div>
  );
}