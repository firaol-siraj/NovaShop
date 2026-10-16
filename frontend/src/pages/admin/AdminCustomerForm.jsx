import { useMemo, useState } from 'react';
import { AdminIcon } from '../../components/admin/AdminLayout';
import {
  CUSTOMER_COUNTRIES,
  createEmptyCustomerForm,
  customerToForm,
  emptyAddress,
  formToCustomer,
  isValidCustomerEmail,
} from './adminCustomerData';
import './admin-product-edit.css';
import './admin-customer-detail.css';
import './admin-customer-edit.css';

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

function AddressFields({ address, onChange, idPrefix }) {
  const update = (patch) => onChange({ ...address, ...patch });
  return (
    <div className="cf-address-fields">
      <label className="pe-field"><span>Address line 1</span><input id={`${idPrefix}-line1`} value={address.line1} onChange={(event) => update({ line1: event.target.value })} placeholder="Street address" autoComplete="address-line1" /></label>
      <label className="pe-field"><span>Address line 2 <small>Optional</small></span><input id={`${idPrefix}-line2`} value={address.line2} onChange={(event) => update({ line2: event.target.value })} placeholder="Apartment, suite, etc." autoComplete="address-line2" /></label>
      <div className="cf-address-row">
        <label className="pe-field"><span>City</span><input value={address.city} onChange={(event) => update({ city: event.target.value })} placeholder="City" autoComplete="address-level2" /></label>
        <label className="pe-field"><span>State/Province</span><input value={address.region} onChange={(event) => update({ region: event.target.value })} placeholder="State or province" autoComplete="address-level1" /></label>
      </div>
      <div className="cf-address-row">
        <label className="pe-field"><span>Postal code</span><input value={address.postal} onChange={(event) => update({ postal: event.target.value })} placeholder="Postal code" autoComplete="postal-code" /></label>
        <label className="pe-field"><span>Country</span><select value={address.country} onChange={(event) => update({ country: event.target.value })} aria-label="Country"><option value="">Select country</option>{CUSTOMER_COUNTRIES.map((country) => <option key={country}>{country}</option>)}</select></label>
      </div>
    </div>
  );
}

function isFormFilled(form) {
  const hasAddress = (address) => Object.values(address || {}).some((value) => String(value || '').trim());
  return Boolean(
    form.firstName.trim()
    || form.lastName.trim()
    || form.email.trim()
    || form.phone.trim()
    || form.notes.trim()
    || form.tags.length
    || form.extraAddresses.length
    || form.status !== 'Active'
    || form.emailMarketing !== true
    || form.smsMarketing
    || !form.billingSameAsShipping
    || hasAddress(form.shipping)
    || hasAddress(form.billing)
  );
}

export default function AdminCustomerForm({ mode = 'create', customer, onBack, onDiscard, onSave }) {
  const isCreate = mode === 'create';
  const initialForm = useMemo(() => (isCreate ? createEmptyCustomerForm() : customerToForm(customer)), [customer, isCreate]);
  const [form, setForm] = useState(initialForm);
  const [savedForm, setSavedForm] = useState(initialForm);
  const [tagInput, setTagInput] = useState('');
  const update = (patch) => setForm((current) => ({ ...current, ...patch }));
  const emailValue = form.email.trim();
  const emailInvalid = emailValue.length > 0 && !isValidCustomerEmail(emailValue);
  const canSave = Boolean(form.firstName.trim() && form.lastName.trim() && isValidCustomerEmail(emailValue));
  const dirty = isCreate ? isFormFilled(form) : JSON.stringify(form) !== JSON.stringify(savedForm);
  const statusTone = form.status === 'Blocked' ? 'is-blocked' : form.status === 'Inactive' ? 'is-inactive' : '';
  const statusHelp = form.status === 'Blocked'
    ? 'Blocked customers cannot sign in or place orders on your storefront.'
    : form.status === 'Inactive'
      ? 'Inactive storefront accounts cannot sign in until you reactivate them.'
      : 'Active customers can sign in and place orders on your storefront.';

  const addTag = () => {
    const tag = tagInput.trim();
    if (!tag || form.tags.includes(tag)) return;
    update({ tags: [...form.tags, tag] });
    setTagInput('');
  };
  const setBillingSame = (checked) => update({ billingSameAsShipping: checked, ...(checked ? { billing: emptyAddress() } : {}) });
  const save = (event) => {
    event?.preventDefault();
    if (!canSave) {
      return;
    }
    const record = formToCustomer(form, isCreate ? undefined : customer);
    onSave(record);
    setSavedForm(JSON.parse(JSON.stringify(form)));
  };
  const discard = () => {
    if (isCreate) {
      if (dirty && !window.confirm('Discard this customer profile? Unsaved storefront details will be lost.')) return;
      onDiscard();
      return;
    }
    setForm(JSON.parse(JSON.stringify(savedForm)));
  };

  return (
    <div className={`admin-dashboard cd-page cd-edit-page cf-page${isCreate ? ' is-create' : ''}`}>
      <header className="cd-page-header pe-page-header cf-page-header">
        <button className="pe-breadcrumb" type="button" onClick={onBack}><AdminIcon name="left" size={14} /> Customers</button>
        <div className="cd-edit-title-actions pe-title-actions">
          <div className="pe-title-copy">
            <h1>{isCreate ? 'Add customer' : 'Edit customer'}</h1>
            <p>{isCreate ? 'Create a new customer profile for your store.' : `Update contact details and storefront preferences for ${customer?.name || 'this customer'}.`}</p>
          </div>
          <div className="pe-actions cf-sticky-actions">
            <button className="admin-action-button pe-discard-button" type="button" disabled={!isCreate && !dirty} onClick={discard}>Discard</button>
            <button className="admin-action-button is-primary pe-save-button" type="button" disabled={isCreate ? !canSave : !canSave || !dirty} onClick={save}>{isCreate ? 'Save customer' : 'Save changes'}</button>
          </div>
        </div>
      </header>

      <form className="cd-edit-columns pe-columns cf-columns" onSubmit={save}>
        <div className="cd-main-column pe-main-column">
          <CustomerCard title="Customer information" tag="GENERAL">
            <div className="cf-name-grid">
              <label className="pe-field"><span>First name</span><input value={form.firstName} onChange={(event) => update({ firstName: event.target.value })} placeholder="e.g. Sarah" autoComplete="given-name" /></label>
              <label className="pe-field"><span>Last name</span><input value={form.lastName} onChange={(event) => update({ lastName: event.target.value })} placeholder="e.g. Mitchell" autoComplete="family-name" /></label>
            </div>
            <label className={`pe-field${emailInvalid ? ' is-invalid' : ''}`}>
              <span>Email address</span>
              <input type="email" value={form.email} onChange={(event) => update({ email: event.target.value })} placeholder="name@example.com" autoComplete="email" aria-invalid={emailInvalid} />
              <small>{emailInvalid ? 'Enter a valid email for order confirmations and storefront access.' : 'Used for order confirmations and account access.'}</small>
            </label>
            <label className="pe-field">
              <span>Phone number <small>Optional</small></span>
              <input type="tel" value={form.phone} onChange={(event) => update({ phone: event.target.value })} placeholder="+1 (555) 123-4567" autoComplete="tel" />
            </label>
          </CustomerCard>

          <CustomerCard title="Addresses" right={<button className="admin-text-link" type="button" onClick={() => update({ extraAddresses: [...form.extraAddresses, emptyAddress()] })}>Add address</button>}>
            <div className="cd-address-block">
              <span>SHIPPING ADDRESS</span>
              <AddressFields idPrefix="shipping" address={form.shipping} onChange={(shipping) => update({ shipping })} />
            </div>
            <label className="cf-same-billing">
              <input type="checkbox" checked={form.billingSameAsShipping} onChange={(event) => setBillingSame(event.target.checked)} />
              <i />
              Billing address same as shipping
            </label>
            <div className={`cf-billing-reveal${form.billingSameAsShipping ? '' : ' is-open'}`}>
              <div>
                <div className="cd-address-block billing">
                  <span>BILLING ADDRESS</span>
                  <AddressFields idPrefix="billing" address={form.billing} onChange={(billing) => update({ billing })} />
                </div>
              </div>
            </div>
            {form.extraAddresses.map((address, index) => (
              <div className="cd-address-block billing" key={`extra-${index}`}>
                <div className="cf-address-heading">
                  <span>ADDRESS {index + 2}</span>
                  <button className="admin-text-link" type="button" onClick={() => update({ extraAddresses: form.extraAddresses.filter((_, addressIndex) => addressIndex !== index) })}>Remove</button>
                </div>
                <AddressFields idPrefix={`extra-${index}`} address={address} onChange={(nextAddress) => update({ extraAddresses: form.extraAddresses.map((item, addressIndex) => (addressIndex === index ? nextAddress : item)) })} />
              </div>
            ))}
          </CustomerCard>

          <CustomerCard title="Internal Notes" subtitle="Only visible to your team." className="cd-notes-card">
            <div className="cd-note-form">
              <textarea rows="4" value={form.notes} onChange={(event) => update({ notes: event.target.value })} placeholder="Add a note about this customer…" />
            </div>
          </CustomerCard>
        </div>

        <aside className="cd-side-column pe-side-column">
          <CustomerCard title="Account status">
            <label className={`pe-status-select ${statusTone}`}>
              <i />
              <select value={form.status} onChange={(event) => update({ status: event.target.value })} aria-label="Account status">
                <option>Active</option>
                <option>Inactive</option>
                <option>Blocked</option>
              </select>
              <AdminIcon name="chevron" size={12} />
            </label>
            <p className="cf-status-help">{statusHelp}</p>
          </CustomerCard>

          <CustomerCard title="Marketing preferences">
            <label className="pe-track-row">
              <span><strong>Email marketing</strong><small>Send order updates, promotions, and product news.</small></span>
              <input type="checkbox" checked={form.emailMarketing} onChange={(event) => update({ emailMarketing: event.target.checked })} />
              <i />
            </label>
            <label className="pe-track-row">
              <span><strong>SMS marketing</strong><small>Send shipping alerts and exclusive offers by text.</small></span>
              <input type="checkbox" checked={form.smsMarketing} onChange={(event) => update({ smsMarketing: event.target.checked })} />
              <i />
            </label>
          </CustomerCard>

          <CustomerCard title="Organization" className="cd-organization-card">
            <span className="cd-field-label">Tags</span>
            <div className="cd-tags pe-tag-input">
              {form.tags.map((tag) => (
                <span className="cd-tag pe-removable-tag" key={tag}>
                  {tag}
                  <button type="button" aria-label={`Remove ${tag} tag`} onClick={() => update({ tags: form.tags.filter((item) => item !== tag) })}>×</button>
                </span>
              ))}
              <input value={tagInput} onChange={(event) => setTagInput(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); addTag(); } }} placeholder="Add tag..." />
            </div>
          </CustomerCard>
        </aside>
      </form>
    </div>
  );
}
