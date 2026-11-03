import { useMemo, useState, useEffect } from 'react';
import { AdminIcon } from '../../components/admin/AdminLayout';
import './admin-product-edit.css';
import './admin-customer-detail.css';
import './admin-customer-edit.css';

export const CUSTOMER_COUNTRIES = [
  'Ethiopia',
  'United States',
  'United Kingdom',
  'Canada',
  'Germany',
  'France',
  'Italy',
  'Singapore',
  'United Arab Emirates',
  'South Korea',
  'Japan',
  'Australia',
  'Spain',
  'Netherlands',
  'Sweden',
  'Switzerland',
  'Kenya',
  'Uganda',
  'Rwanda',
  'South Africa',
];

export const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Phone validator: validates Ethiopian formats (+251 9..., 09..., 07...) or standard E.164
export function isValidPhone(phone) {
  if (!phone || typeof phone !== 'string') return true; // Optional field
  const trimmed = phone.trim();
  if (!trimmed) return true;
  const cleaned = trimmed.replace(/[\s\-()]/g, '');
  // Ethiopian local: 09... or 07... (10 digits)
  if (/^0[79]\d{8}$/.test(cleaned)) return true;
  // Ethiopian international: +251 9... or +251 7...
  if (/^\+251[79]\d{8}$/.test(cleaned)) return true;
  // Generic international: +... (7-15 digits)
  if (/^\+[1-9]\d{7,14}$/.test(cleaned)) return true;
  return false;
}

export function createEmptyCustomerForm() {
  return {
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    country: 'Ethiopia',
    street: '',
    street2: '',
    city: 'Addis Ababa',
    state: 'Addis Ababa',
    postalCode: '1000',
    internalNotes: '',
    marketingConsent: false,
    status: 'active',
    version: 0,
  };
}

export function customerToForm(customer) {
  if (!customer) return createEmptyCustomerForm();

  // Find default address or first address
  const defaultAddr = customer.addresses?.find((a) => a.isDefault) || customer.addresses?.[0] || customer.address || {};

  return {
    id: customer._id || customer.id,
    firstName: customer.firstName || (customer.name || '').split(' ')[0] || '',
    lastName: customer.lastName || (customer.name || '').split(' ').slice(1).join(' ') || '',
    email: customer.email || '',
    phone: customer.phone || '',
    country: defaultAddr.country || customer.country || 'Ethiopia',
    street: defaultAddr.street || '',
    street2: defaultAddr.street2 || '',
    city: defaultAddr.city || 'Addis Ababa',
    state: defaultAddr.state || 'Addis Ababa',
    postalCode: defaultAddr.postalCode || '1000',
    internalNotes: customer.internalNotes || '',
    marketingConsent: Boolean(customer.marketingConsent),
    status: customer.status || 'active',
    version: customer.__v ?? 0,
  };
}

export function formToPayload(form) {
  return {
    firstName: form.firstName.trim(),
    lastName: form.lastName.trim(),
    email: form.email.trim().toLowerCase(),
    phone: form.phone.trim(),
    country: form.country.trim() || 'Ethiopia',
    street: form.street.trim(),
    street2: form.street2.trim(),
    city: form.city.trim(),
    state: form.state.trim(),
    postalCode: form.postalCode.trim(),
    internalNotes: form.internalNotes.trim(),
    marketingConsent: Boolean(form.marketingConsent),
    status: form.status.toLowerCase(),
    version: form.version,
  };
}

function CustomerCard({ title, subtitle, tag, right, children, className = '' }) {
  return (
    <section className={`admin-card cd-card pe-card ${className}`}>
      <header className="cd-card-heading pe-card-heading">
        <div>
          <h2>{title}</h2>
          {subtitle && <p>{subtitle}</p>}
        </div>
        {right || (tag && <span className="pe-card-tag">{tag}</span>)}
      </header>
      {children}
    </section>
  );
}

export default function AdminCustomerForm({
  mode = 'create',
  customer,
  onBack,
  onDiscard,
  onSave,
  isSaving = false,
  serverErrors = {},
}) {
  const isCreate = mode === 'create';
  const initialForm = useMemo(
    () => (isCreate ? createEmptyCustomerForm() : customerToForm(customer)),
    [customer, isCreate]
  );

  const [form, setForm] = useState(initialForm);
  const [fieldErrors, setFieldErrors] = useState({});

  useEffect(() => {
    setForm(isCreate ? createEmptyCustomerForm() : customerToForm(customer));
  }, [customer, isCreate]);

  // Sync server errors
  useEffect(() => {
    if (serverErrors && Object.keys(serverErrors).length > 0) {
      setFieldErrors(serverErrors);
    }
  }, [serverErrors]);

  const update = (patch) => {
    setForm((current) => ({ ...current, ...patch }));
    // Clear field error on edit
    const keys = Object.keys(patch);
    if (keys.some((k) => fieldErrors[k])) {
      setFieldErrors((prev) => {
        const next = { ...prev };
        keys.forEach((k) => delete next[k]);
        return next;
      });
    }
  };

  const validateForm = () => {
    const errors = {};
    if (!form.firstName.trim()) {
      errors.firstName = 'First name is required.';
    }

    const email = form.email.trim();
    if (!email) {
      errors.email = 'Email address is required.';
    } else if (!EMAIL_PATTERN.test(email)) {
      errors.email = 'Please enter a valid email address.';
    }

    if (form.phone.trim() && !isValidPhone(form.phone.trim())) {
      errors.phone = 'Invalid phone format. Please use +251 9... / 09... or valid international format.';
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!validateForm()) return;
    const payload = formToPayload(form);
    onSave(payload);
  };

  const statusTone =
    form.status === 'blocked' || form.status === 'deactivated'
      ? 'is-blocked'
      : form.status === 'inactive'
      ? 'is-inactive'
      : '';

  const statusHelp =
    form.status === 'blocked' || form.status === 'deactivated'
      ? 'Blocked customers cannot sign in or place orders on your storefront.'
      : form.status === 'inactive'
      ? 'Inactive storefront accounts cannot sign in until reactivated.'
      : form.status === 'invited'
      ? 'Invited customers receive a signed link to set their password.'
      : 'Active customers can sign in and place orders on your storefront.';

  return (
    <div className={`admin-dashboard cd-page cd-edit-page cf-page${isCreate ? ' is-create' : ''}`}>
      <header className="cd-page-header pe-page-header cf-page-header">
        <button className="pe-breadcrumb" type="button" onClick={onBack}>
          <AdminIcon name="left" size={14} /> Customers
        </button>
        <div className="cd-edit-title-actions pe-title-actions">
          <div className="pe-title-copy">
            <h1>{isCreate ? 'Add Customer' : 'Edit Customer'}</h1>
            <p>
              {isCreate
                ? 'Create a new customer profile. An invitation with a set-password link will be dispatched.'
                : `Update contact details and account preferences for ${customer?.name || 'this customer'}.`}
            </p>
          </div>
          <div className="pe-actions cf-sticky-actions">
            <button
              className="admin-action-button pe-discard-button"
              type="button"
              disabled={isSaving}
              onClick={onDiscard}
            >
              Discard
            </button>
            <button
              className="admin-action-button is-primary pe-save-button"
              type="button"
              disabled={isSaving}
              onClick={handleSubmit}
            >
              {isSaving ? 'Saving…' : isCreate ? 'Save Customer' : 'Save Changes'}
            </button>
          </div>
        </div>
      </header>

      <form className="cd-edit-columns pe-columns cf-columns" onSubmit={handleSubmit}>
        {/* Main Column */}
        <div className="cd-main-column pe-main-column space-y-6">
          {/* General Information */}
          <CustomerCard title="Customer Information" tag="REQUIRED">
            <div className="cf-name-grid">
              <label className="pe-field">
                <span>
                  First name <strong style={{ color: 'var(--color-danger)' }}>*</strong>
                </span>
                <input
                  type="text"
                  required
                  value={form.firstName}
                  onChange={(e) => update({ firstName: e.target.value })}
                  placeholder="e.g. Sarah"
                  autoComplete="given-name"
                />
                {fieldErrors.firstName && (
                  <small style={{ color: 'var(--color-danger)', fontWeight: 600 }}>
                    {fieldErrors.firstName}
                  </small>
                )}
              </label>

              <label className="pe-field">
                <span>Last name</span>
                <input
                  type="text"
                  value={form.lastName}
                  onChange={(e) => update({ lastName: e.target.value })}
                  placeholder="e.g. Mitchell"
                  autoComplete="family-name"
                />
                {fieldErrors.lastName && (
                  <small style={{ color: 'var(--color-danger)', fontWeight: 600 }}>
                    {fieldErrors.lastName}
                  </small>
                )}
              </label>
            </div>

            <label className={`pe-field ${fieldErrors.email ? 'is-invalid' : ''}`}>
              <span>
                Email address <strong style={{ color: 'var(--color-danger)' }}>*</strong>
              </span>
              <input
                type="email"
                required
                value={form.email}
                onChange={(e) => update({ email: e.target.value.toLowerCase() })}
                placeholder="name@example.com"
                autoComplete="email"
                disabled={!isCreate} // Email unique & immutable on edit
              />
              {fieldErrors.email ? (
                <small style={{ color: 'var(--color-danger)', fontWeight: 600 }}>
                  {fieldErrors.email}
                </small>
              ) : (
                <small>
                  {isCreate
                    ? 'An invitation email with a single-use set-password link will be sent to this address.'
                    : 'Customer account login and order confirmation email address.'}
                </small>
              )}
            </label>

            <label className={`pe-field ${fieldErrors.phone ? 'is-invalid' : ''}`}>
              <span>
                Phone number <small>Optional (+251 default)</small>
              </span>
              <input
                type="tel"
                value={form.phone}
                onChange={(e) => update({ phone: e.target.value })}
                placeholder="+251 911 234 567 or 0911234567"
                autoComplete="tel"
              />
              {fieldErrors.phone ? (
                <small style={{ color: 'var(--color-danger)', fontWeight: 600 }}>
                  {fieldErrors.phone}
                </small>
              ) : (
                <small>Format: +251 9... / 09... for Ethiopian numbers or standard international format.</small>
              )}
            </label>
          </CustomerCard>

          {/* Primary Address */}
          <CustomerCard title="Address (Optional)" subtitle="Default shipping destination for orders">
            <div className="cf-address-fields">
              <label className="pe-field">
                <span>Street address</span>
                <input
                  type="text"
                  value={form.street}
                  onChange={(e) => update({ street: e.target.value })}
                  placeholder="e.g. Bole Road, House 102"
                />
              </label>

              <label className="pe-field">
                <span>
                  Apartment, suite, unit <small>Optional</small>
                </span>
                <input
                  type="text"
                  value={form.street2}
                  onChange={(e) => update({ street2: e.target.value })}
                  placeholder="e.g. Suite 4B"
                />
              </label>

              <div className="cf-address-row">
                <label className="pe-field">
                  <span>City</span>
                  <input
                    type="text"
                    value={form.city}
                    onChange={(e) => update({ city: e.target.value })}
                    placeholder="City"
                  />
                </label>

                <label className="pe-field">
                  <span>State / Province</span>
                  <input
                    type="text"
                    value={form.state}
                    onChange={(e) => update({ state: e.target.value })}
                    placeholder="State or Region"
                  />
                </label>
              </div>

              <div className="cf-address-row">
                <label className="pe-field">
                  <span>Postal code</span>
                  <input
                    type="text"
                    value={form.postalCode}
                    onChange={(e) => update({ postalCode: e.target.value })}
                    placeholder="Postal code"
                  />
                </label>

                <label className="pe-field">
                  <span>Country</span>
                  <select
                    value={form.country}
                    onChange={(e) => update({ country: e.target.value })}
                    aria-label="Country"
                  >
                    {CUSTOMER_COUNTRIES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            </div>
          </CustomerCard>

          {/* Internal Notes */}
          <CustomerCard
            title="Internal Notes"
            subtitle="Admin-only private records. Never shown or sent to the customer."
            className="cd-notes-card"
          >
            <div className="cd-note-form">
              <textarea
                rows={4}
                value={form.internalNotes}
                onChange={(e) => update({ internalNotes: e.target.value })}
                placeholder="Add private operational notes, preferences, or customer service logs…"
              />
            </div>
          </CustomerCard>
        </div>

        {/* Side Column */}
        <aside className="cd-side-column pe-side-column space-y-6">
          {/* Account Status */}
          <CustomerCard title="Account Status">
            <label className={`pe-status-select ${statusTone}`}>
              <i />
              <select
                value={form.status}
                onChange={(e) => update({ status: e.target.value })}
                aria-label="Account status"
              >
                <option value="active">Active</option>
                <option value="invited">Invited</option>
                <option value="inactive">Inactive</option>
                <option value="blocked">Blocked</option>
              </select>
              <AdminIcon name="chevron" size={12} />
            </label>
            <p className="cf-status-help">{statusHelp}</p>
          </CustomerCard>

          {/* Marketing Consent */}
          <CustomerCard title="Marketing Preferences">
            <label className="pe-track-row" style={{ alignItems: 'flex-start' }}>
              <div>
                <strong style={{ display: 'block', fontSize: '12px', color: 'var(--text-primary)' }}>
                  Email Marketing Consent
                </strong>
                <small style={{ display: 'block', fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                  Customer has explicitly opted-in to receive promotional campaigns and newsletters (default off).
                </small>
              </div>
              <input
                type="checkbox"
                checked={form.marketingConsent}
                onChange={(e) => update({ marketingConsent: e.target.checked })}
              />
              <i />
            </label>
          </CustomerCard>

          {/* Security & Password policy notice */}
          <CustomerCard title="Password & Security">
            <div style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
              <p style={{ margin: 0 }}>
                For security and compliance, admins cannot type or assign customer passwords directly.
              </p>
              <p style={{ margin: '8px 0 0', color: 'var(--text-muted)', fontSize: '11px' }}>
                NovaShop automatically issues a signed, 7-day single-use activation link so the customer can securely set their password.
              </p>
            </div>
          </CustomerCard>
        </aside>
      </form>
    </div>
  );
}
