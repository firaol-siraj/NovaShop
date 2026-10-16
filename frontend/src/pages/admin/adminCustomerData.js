export const initialCustomers = [
  { id: 'CUS-1042', initials: 'SM', name: 'Sarah Mitchell', email: 'sarah.m@example.com', city: 'New York', country: 'United States', countryCode: 'US', joinedAt: '2024-04-12', orders: 12, spent: 14820, lastOrder: '3 days ago', lastDate: 'Sep 28, 2026', status: 'Active', tags: [] },
  { id: 'CUS-1043', initials: 'JO', name: 'James Okafor', email: 'james.o@example.com', city: 'London', country: 'United Kingdom', countryCode: 'UK', joinedAt: '2023-08-03', orders: 8, spent: 9340, lastOrder: '1 week ago', lastDate: 'Sep 24, 2026', status: 'Active', tags: [] },
  { id: 'CUS-1044', initials: 'AC', name: 'Amelia Chen', email: 'amelia.chen@example.com', city: 'Singapore', country: 'Singapore', countryCode: 'SG', joinedAt: '2023-01-09', orders: 15, spent: 21150, lastOrder: 'Yesterday', lastDate: 'Sep 30, 2026', status: 'Active', tags: [] },
  { id: 'CUS-1045', initials: 'LM', name: 'Lucas Meyer', email: 'lucas.m@example.com', city: 'Berlin', country: 'Germany', countryCode: 'DE', joinedAt: '2025-02-14', orders: 3, spent: 2900, lastOrder: '2 weeks ago', lastDate: 'Sep 12, 2026', status: 'Active', tags: [] },
  { id: 'CUS-1046', initials: 'PR', name: 'Priya Raman', email: 'priya.r@example.com', city: 'Dubai', country: 'United Arab Emirates', countryCode: 'UAE', joinedAt: '2024-11-21', orders: 6, spent: 7260, lastOrder: '2 months ago', lastDate: 'Aug 02, 2026', status: 'Active', tags: [] },
  { id: 'CUS-1047', initials: 'SR', name: 'Sofia Rossi', email: 'sofia.r@example.com', city: 'Milan', country: 'Italy', countryCode: 'IT', joinedAt: '2022-05-16', orders: 9, spent: 11480, lastOrder: '12 days ago', lastDate: 'Sep 19, 2026', status: 'Active', tags: [] },
  { id: 'CUS-1048', initials: 'DK', name: 'Daniel Kim', email: 'daniel.k@example.com', city: 'Seoul', country: 'South Korea', countryCode: 'KR', joinedAt: '2026-09-18', orders: 0, spent: 0, lastOrder: '—', lastDate: 'No orders yet', status: 'Inactive', tags: [] },
  { id: 'CUS-1049', initials: 'NW', name: 'Noah Williams', email: 'noah.w@example.com', city: 'Toronto', country: 'Canada', countryCode: 'CA', joinedAt: '2025-01-28', orders: 2, spent: 1640, lastOrder: '3 months ago', lastDate: 'Jun 14, 2026', status: 'Blocked', tags: [] },
  { id: 'CUS-1050', initials: 'EV', name: 'Elena Vasquez', email: 'elena.v@example.com', city: 'New York', country: 'United States', countryCode: 'US', joinedAt: '2022-06-16', orders: 22, spent: 32870, lastOrder: '1 week ago', lastDate: 'Sep 25, 2026', status: 'Active', tags: [] },
  { id: 'CUS-1051', initials: 'OJ', name: 'Oliver James', email: 'oliver.j@example.com', city: 'Paris', country: 'France', countryCode: 'FR', joinedAt: '2026-06-14', orders: 5, spent: 4080, lastOrder: '1 month ago', lastDate: 'Sep 05, 2026', status: 'Active', tags: [] },
];

export const CUSTOMER_COUNTRIES = [
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
];

export const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const CREATED_CUSTOMERS_KEY = 'novashop-created-customers';

export function emptyAddress() {
  return { line1: '', line2: '', city: '', region: '', postal: '', country: '' };
}

export function createEmptyCustomerForm() {
  return {
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    shipping: emptyAddress(),
    billing: emptyAddress(),
    billingSameAsShipping: true,
    extraAddresses: [],
    notes: '',
    status: 'Active',
    emailMarketing: true,
    smsMarketing: false,
    tags: [],
  };
}

export function splitCustomerName(name = '') {
  const parts = String(name).trim().split(/\s+/).filter(Boolean);
  return { firstName: parts[0] || '', lastName: parts.slice(1).join(' ') };
}

export function initialsFromName(firstName, lastName) {
  return `${firstName?.[0] || ''}${lastName?.[0] || firstName?.[1] || ''}`.toUpperCase() || 'NS';
}

export function countryCodeFromName(country) {
  const codes = {
    'United States': 'US',
    'United Kingdom': 'UK',
    Canada: 'CA',
    Germany: 'DE',
    France: 'FR',
    Italy: 'IT',
    Singapore: 'SG',
    'United Arab Emirates': 'UAE',
    'South Korea': 'KR',
    Japan: 'JP',
    Australia: 'AU',
    Spain: 'ES',
    Netherlands: 'NL',
    Sweden: 'SE',
    Switzerland: 'CH',
  };
  return codes[country] || String(country || '').slice(0, 2).toUpperCase();
}

export function formatAddressLine(address = emptyAddress()) {
  return [address.line1, address.line2].filter(Boolean).join(', ');
}

export function isValidCustomerEmail(email) {
  return EMAIL_PATTERN.test(String(email || '').trim());
}

function parseStoredAddress(customer, key, fallbackLine) {
  if (customer?.[key] && typeof customer[key] === 'object') return { ...emptyAddress(), ...customer[key] };
  if (fallbackLine) return { ...emptyAddress(), line1: fallbackLine, city: customer.city || '', country: customer.country || '' };
  return emptyAddress();
}

export function customerToForm(customer) {
  if (!customer) return createEmptyCustomerForm();
  const { firstName, lastName } = splitCustomerName(customer.name);
  const shipping = parseStoredAddress(customer, 'shippingAddress', customer.address);
  if (customer.postal && !shipping.region && !shipping.postal) {
    const postalParts = String(customer.postal).split(',').pop()?.trim().split(/\s+/) || [];
    shipping.region = shipping.region || postalParts[0] || '';
    shipping.postal = shipping.postal || postalParts.slice(1).join(' ');
  }
  const billingSameAsShipping = customer.billingSameAsShipping !== false && (!customer.billingAddress || customer.billingAddress === 'Same as shipping address');
  return {
    firstName: customer.firstName || firstName,
    lastName: customer.lastName || lastName,
    email: customer.email || '',
    phone: customer.phone || '',
    shipping,
    billing: billingSameAsShipping ? emptyAddress() : parseStoredAddress(customer, 'billingAddressFields', customer.billingAddress),
    billingSameAsShipping,
    extraAddresses: Array.isArray(customer.extraAddresses) ? customer.extraAddresses.map((address) => ({ ...emptyAddress(), ...address })) : [],
    notes: customer.internalNotes || '',
    status: customer.status || 'Active',
    emailMarketing: customer.emailSubscribed !== false && customer.emailMarketing !== false,
    smsMarketing: Boolean(customer.smsMarketing),
    tags: [...(customer.tags || [])],
  };
}

export function formToCustomer(form, existing) {
  const firstName = form.firstName.trim();
  const lastName = form.lastName.trim();
  const name = [firstName, lastName].filter(Boolean).join(' ');
  const shipping = { ...emptyAddress(), ...form.shipping };
  const billing = form.billingSameAsShipping ? { ...shipping } : { ...emptyAddress(), ...form.billing };
  const joinedAt = existing?.joinedAt || '2026-10-04';
  return {
    ...existing,
    id: existing?.id || nextCustomerId(),
    initials: initialsFromName(firstName, lastName),
    name,
    firstName,
    lastName,
    email: form.email.trim(),
    phone: form.phone.trim(),
    city: shipping.city || existing?.city || '—',
    country: shipping.country || existing?.country || '—',
    countryCode: countryCodeFromName(shipping.country || existing?.country),
    joinedAt,
    orders: existing?.orders ?? 0,
    spent: existing?.spent ?? 0,
    lastOrder: existing?.lastOrder ?? '—',
    lastDate: existing?.lastDate ?? 'No orders yet',
    status: form.status,
    tags: [...form.tags],
    address: formatAddressLine(shipping) || existing?.address || '',
    postal: [shipping.region, shipping.postal].filter(Boolean).join(' '),
    billingAddress: form.billingSameAsShipping ? 'Same as shipping address' : formatAddressLine(billing) || '—',
    billingSameAsShipping: form.billingSameAsShipping,
    shippingAddress: shipping,
    billingAddressFields: billing,
    extraAddresses: form.extraAddresses.map((address) => ({ ...emptyAddress(), ...address })),
    internalNotes: form.notes.trim(),
    emailSubscribed: form.emailMarketing,
    emailMarketing: form.emailMarketing,
    smsMarketing: form.smsMarketing,
  };
}

function readJson(key, fallback) {
  try {
    const value = window.sessionStorage.getItem(key);
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
}

export function loadCreatedCustomers() {
  return readJson(CREATED_CUSTOMERS_KEY, []);
}

export function upsertCustomerRecord(customer) {
  const created = loadCreatedCustomers();
  const nextCreated = created.some((item) => item.id === customer.id)
    ? created.map((item) => (item.id === customer.id ? customer : item))
    : [customer, ...created];
  window.sessionStorage.setItem(CREATED_CUSTOMERS_KEY, JSON.stringify(nextCreated));
  window.sessionStorage.setItem(`novashop-customer-${customer.id}`, JSON.stringify(customer));
  return customer;
}

export function getStoredCustomer(customerId) {
  const stored = readJson(`novashop-customer-${customerId}`, null);
  if (stored) return stored;
  return loadCreatedCustomers().find((customer) => customer.id === customerId) || initialCustomers.find((customer) => customer.id === customerId) || null;
}

export function hydrateCustomer(customerId) {
  const stored = getStoredCustomer(customerId);
  const seeded = initialCustomers.find((item) => item.id === customerId);
  if (!stored && !seeded) return null;
  const base = stored || seeded;
  if (!seeded) return { tags: [], emailSubscribed: true, billingAddress: 'Same as shipping address', ...base };
  return {
    phone: '+1 (212) 555-0148',
    address: '148 Mercer Street, Apt 4B',
    postal: 'New York, NY 10012',
    billingAddress: 'Same as shipping address',
    tags: base.tags?.length ? base.tags : ['repeat customer', 'gift buyer'],
    emailSubscribed: true,
    ...base,
  };
}

export function loadDirectoryCustomers() {
  const created = loadCreatedCustomers();
  const seeded = initialCustomers.map((customer) => {
    const stored = readJson(`novashop-customer-${customer.id}`, null);
    return stored ? { ...customer, ...stored } : customer;
  });
  const seededIds = new Set(seeded.map((customer) => customer.id));
  return [...created.filter((customer) => !seededIds.has(customer.id)), ...seeded];
}

export function nextCustomerId() {
  const numbers = loadDirectoryCustomers().map((customer) => Number(String(customer.id).replace(/\D/g, ''))).filter(Boolean);
  return `CUS-${Math.max(1051, ...numbers) + 1}`;
}
