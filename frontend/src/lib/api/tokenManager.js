// Per-role in-memory token cache backed by separate storage keys
const CUSTOMER_STORAGE_KEY = 'nova_customer_session';
const ADMIN_STORAGE_KEY = 'nova_admin_session';

const readSavedToken = (key) => {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed?.accessToken || parsed?.token || null;
  } catch {
    return null;
  }
};

let customerAccessToken = readSavedToken(CUSTOMER_STORAGE_KEY);
let adminAccessToken = readSavedToken(ADMIN_STORAGE_KEY);

// Customer token methods
export const setCustomerToken = (token, user = null) => {
  customerAccessToken = token || null;
  try {
    if (token) {
      localStorage.setItem(CUSTOMER_STORAGE_KEY, JSON.stringify({ token, user }));
    } else {
      localStorage.removeItem(CUSTOMER_STORAGE_KEY);
    }
  } catch {
    // ignore storage errors
  }
};

export const getCustomerToken = () => customerAccessToken;

export const clearCustomerToken = () => {
  customerAccessToken = null;
  try {
    localStorage.removeItem(CUSTOMER_STORAGE_KEY);
  } catch {
    // ignore
  }
};

// Admin token methods
export const setAdminToken = (token, user = null) => {
  adminAccessToken = token || null;
  try {
    if (token) {
      localStorage.setItem(ADMIN_STORAGE_KEY, JSON.stringify({ token, user }));
    } else {
      localStorage.removeItem(ADMIN_STORAGE_KEY);
    }
  } catch {
    // ignore
  }
};

export const getAdminToken = () => adminAccessToken;

export const clearAdminToken = () => {
  adminAccessToken = null;
  try {
    localStorage.removeItem(ADMIN_STORAGE_KEY);
  } catch {
    // ignore
  }
};

// Legacy / Context-aware fallback accessors
export const setAccessToken = (token) => {
  setCustomerToken(token);
};

export const getAccessToken = (role = 'customer') => {
  if (role === 'admin') return adminAccessToken;
  return customerAccessToken;
};

export const clearAccessToken = () => {
  clearCustomerToken();
};
