// Strictly in-memory token cache for separate customer and administrator sessions.
// Access tokens are NEVER stored in localStorage or sessionStorage.

let customerAccessToken = null;
let adminAccessToken = null;

const CUSTOMER_PROFILE_KEY = 'nova_customer_profile';
const ADMIN_PROFILE_KEY = 'nova_admin_profile';

const LEGACY_STORAGE_KEYS = [
  'nova_customer_session',
  'nova_admin_session',
  'token',
  'adminToken',
  'accessToken',
  'adminAccessToken',
  'refreshToken',
  'user',
  'userInfo',
  'auth',
  'authToken',
  'admin_auth',
  'customer_auth',
];

// Helper to remove any sensitive token properties from profile caches
const sanitizeProfile = (profile) => {
  if (!profile || typeof profile !== 'object') return null;
  const safe = { ...profile };
  delete safe.accessToken;
  delete safe.token;
  delete safe.refreshToken;
  delete safe.adminRefreshToken;
  delete safe.adminToken;
  return safe;
};

// Purge any legacy session items that may contain persisted access tokens
export const purgeLegacyTokens = () => {
  try {
    if (typeof window !== 'undefined') {
      if (window.localStorage) {
        LEGACY_STORAGE_KEYS.forEach((key) => {
          try {
            localStorage.removeItem(key);
          } catch {
            // Ignore
          }
        });
      }
      if (window.sessionStorage) {
        LEGACY_STORAGE_KEYS.forEach((key) => {
          try {
            sessionStorage.removeItem(key);
          } catch {
            // Ignore
          }
        });
      }
    }
  } catch {
    // Ignore storage access errors
  }
};

// Immediate purge on module initialization
purgeLegacyTokens();

// Non-authoritative cached profiles (for UI hydration only, never proof of auth)
export const getCachedCustomerProfile = () => {
  try {
    const raw = localStorage.getItem(CUSTOMER_PROFILE_KEY);
    return raw ? sanitizeProfile(JSON.parse(raw)) : null;
  } catch {
    return null;
  }
};

export const getCachedAdminProfile = () => {
  try {
    const raw = localStorage.getItem(ADMIN_PROFILE_KEY);
    return raw ? sanitizeProfile(JSON.parse(raw)) : null;
  } catch {
    return null;
  }
};

// Customer token methods (In-memory only)
export const setCustomerToken = (token, user = null) => {
  customerAccessToken = token || null;
  try {
    if (user) {
      localStorage.setItem(CUSTOMER_PROFILE_KEY, JSON.stringify(sanitizeProfile(user)));
    } else if (!token) {
      localStorage.removeItem(CUSTOMER_PROFILE_KEY);
    }
  } catch {
    // Ignore storage quota / access errors
  }
};

export const getCustomerToken = () => customerAccessToken;

export const clearCustomerToken = () => {
  customerAccessToken = null;
  try {
    localStorage.removeItem(CUSTOMER_PROFILE_KEY);
    purgeLegacyTokens();
  } catch {
    // Ignore
  }
};

// Admin token methods (In-memory only)
export const setAdminToken = (token, user = null) => {
  adminAccessToken = token || null;
  try {
    if (user) {
      localStorage.setItem(ADMIN_PROFILE_KEY, JSON.stringify(sanitizeProfile(user)));
    } else if (!token) {
      localStorage.removeItem(ADMIN_PROFILE_KEY);
    }
  } catch {
    // Ignore storage quota / access errors
  }
};

export const getAdminToken = () => adminAccessToken;

export const clearAdminToken = () => {
  adminAccessToken = null;
  try {
    localStorage.removeItem(ADMIN_PROFILE_KEY);
    purgeLegacyTokens();
  } catch {
    // Ignore
  }
};

// Role-aware fallback accessors
export const setAccessToken = (token, role = 'customer') => {
  if (role === 'admin') {
    setAdminToken(token);
  } else {
    setCustomerToken(token);
  }
};

export const getAccessToken = (role = 'customer') => {
  if (role === 'admin') return adminAccessToken;
  return customerAccessToken;
};

export const clearAccessToken = (role = 'customer') => {
  if (role === 'all') {
    clearCustomerToken();
    clearAdminToken();
  } else if (role === 'admin') {
    clearAdminToken();
  } else {
    clearCustomerToken();
  }
};
