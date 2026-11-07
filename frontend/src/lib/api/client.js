import axios from 'axios';
import {
  clearCustomerToken,
  getCustomerToken,
  setCustomerToken,
  clearAdminToken,
  getAdminToken,
  setAdminToken,
} from './tokenManager';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api/v1';

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
  },
});

let customerRefreshPromise = null;
let adminRefreshPromise = null;

let adminExpiredEventTimeout = null;
let customerExpiredEventTimeout = null;

const dispatchAdminAuthExpired = () => {
  if (typeof window === 'undefined') return;
  if (!adminExpiredEventTimeout) {
    window.dispatchEvent(new Event('novashop:admin-auth-expired'));
    adminExpiredEventTimeout = setTimeout(() => {
      adminExpiredEventTimeout = null;
    }, 1500);
  }
};

const dispatchCustomerAuthExpired = () => {
  if (typeof window === 'undefined') return;
  if (!customerExpiredEventTimeout) {
    window.dispatchEvent(new Event('novashop:auth-expired'));
    customerExpiredEventTimeout = setTimeout(() => {
      customerExpiredEventTimeout = null;
    }, 1500);
  }
};

export const isRequestAdminScoped = (config) => {
  // 1. Explicit request role takes absolute precedence
  const headerRole = typeof config?.headers?.get === 'function'
    ? config.headers.get('X-Auth-Role')
    : (config?.headers?.['X-Auth-Role'] || config?.headers?.['x-auth-role']);

  if (config?.role === 'admin' || headerRole === 'admin') {
    return true;
  }
  if (config?.role === 'customer' || headerRole === 'customer') {
    return false;
  }

  // 2. Normalize url path to eliminate differences between relative, root, and absolute URLs
  const rawUrl = config?.url || '';
  let path = rawUrl
    .replace(/^https?:\/\/[^/]+/, '')
    .replace(/^\/?api\/v1/, '')
    .replace(/^\/?api/, '')
    .split('?')[0];

  if (!path.startsWith('/')) {
    path = `/${path}`;
  }

  // Explicit admin-only paths
  if (
    path.startsWith('/admin') ||
    path === '/users' ||
    (path.startsWith('/users/') && !path.startsWith('/users/me')) ||
    path.startsWith('/upload') ||
    path.endsWith('/status') ||
    path.endsWith('/resend-confirmation') ||
    path.endsWith('/deliver')
  ) {
    return true;
  }

  // Explicit customer-scoped paths that should never use admin credentials
  if (
    path.startsWith('/cart') ||
    path.startsWith('/wishlist') ||
    path.startsWith('/users/me') ||
    path.startsWith('/orders/checkout') ||
    path === '/orders/my-orders' ||
    path === '/auth/login' ||
    path === '/auth/register' ||
    path === '/auth/refresh-token' ||
    path === '/auth/logout'
  ) {
    return false;
  }

  // 3. Fallback to browser URL if initiated from an admin view
  if (
    typeof window !== 'undefined' &&
    window.location.pathname.startsWith('/admin')
  ) {
    return true;
  }

  return false;
};

const NON_REFRESH_ENDPOINTS = [
  '/auth/refresh-token',
  '/auth/admin/refresh-token',
  '/auth/login',
  '/auth/admin/login',
  '/auth/logout',
  '/auth/admin/logout',
  '/auth/register',
  '/auth/forgot-password',
  '/auth/admin/forgot-password',
  '/auth/reset-password',
  '/auth/admin/reset-password',
  '/auth/admin/accept-invite',
];

const isAuthEndpoint = (url = '') => {
  let clean = url
    .replace(/^https?:\/\/[^/]+/, '')
    .replace(/^\/?api\/v1/, '')
    .replace(/^\/?api/, '')
    .split('?')[0];
  if (!clean.startsWith('/')) {
    clean = `/${clean}`;
  }
  return NON_REFRESH_ENDPOINTS.some((ep) => clean.startsWith(ep) || clean === ep);
};

apiClient.interceptors.request.use((config) => {
  const isAdmin = isRequestAdminScoped(config);
  const token = isAdmin ? getAdminToken() : getCustomerToken();
  if (token) {
    if (config.headers && typeof config.headers.set === 'function') {
      config.headers.set('Authorization', `Bearer ${token}`);
    } else {
      config.headers = config.headers || {};
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
});

apiClient.interceptors.response.use(
  (response) => response.data,
  async (error) => {
    // If request was canceled/aborted, reject immediately without auth-refresh logic
    if (axios.isCancel(error) || error?.name === 'CanceledError' || error?.code === 'ERR_CANCELED') {
      return Promise.reject(normalizeError(error));
    }

    const originalRequest = error.config;

    if (
      !originalRequest ||
      originalRequest.skipAuthRefresh ||
      error.response?.status !== 401 ||
      originalRequest._retry ||
      isAuthEndpoint(originalRequest.url)
    ) {
      return Promise.reject(normalizeError(error));
    }

    const isAdmin = isRequestAdminScoped(originalRequest);

    if (isAdmin) {
      if (!adminRefreshPromise) {
        adminRefreshPromise = apiClient
          .post('/auth/admin/refresh-token', {}, { role: 'admin' })
          .then((data) => {
            if (!data?.accessToken) {
              throw new Error('Admin refresh response did not contain an access token');
            }
            setAdminToken(data.accessToken);
            return data.accessToken;
          })
          .finally(() => {
            adminRefreshPromise = null;
          });
      }

      try {
        const newAdminToken = await adminRefreshPromise;
        originalRequest._retry = true;
        originalRequest.role = 'admin';
        if (originalRequest.headers && typeof originalRequest.headers.set === 'function') {
          originalRequest.headers.set('Authorization', `Bearer ${newAdminToken}`);
        } else {
          originalRequest.headers = originalRequest.headers || {};
          originalRequest.headers.Authorization = `Bearer ${newAdminToken}`;
        }
        return apiClient(originalRequest);
      } catch (refreshError) {
        clearAdminToken();
        dispatchAdminAuthExpired();
        const preservedError = normalizeError(error);
        preservedError.refreshError = normalizeError(refreshError);
        return Promise.reject(preservedError);
      }
    }

    // Customer refresh handling
    if (!customerRefreshPromise) {
      customerRefreshPromise = apiClient
        .post('/auth/refresh-token', {}, { role: 'customer' })
        .then((data) => {
          if (!data?.accessToken) {
            throw new Error('Customer refresh response did not contain an access token');
          }
          setCustomerToken(data.accessToken);
          return data.accessToken;
        })
        .finally(() => {
          customerRefreshPromise = null;
        });
    }

    try {
      const newCustomerToken = await customerRefreshPromise;
      originalRequest._retry = true;
      originalRequest.role = 'customer';
      if (originalRequest.headers && typeof originalRequest.headers.set === 'function') {
        originalRequest.headers.set('Authorization', `Bearer ${newCustomerToken}`);
      } else {
        originalRequest.headers = originalRequest.headers || {};
        originalRequest.headers.Authorization = `Bearer ${newCustomerToken}`;
      }
      return apiClient(originalRequest);
    } catch (refreshError) {
      clearCustomerToken();
      dispatchCustomerAuthExpired();
      const preservedError = normalizeError(error);
      preservedError.refreshError = normalizeError(refreshError);
      return Promise.reject(preservedError);
    }
  }
);

function normalizeError(error) {
  if (error && error.code && error.status !== undefined && !error.isAxiosError && !error.response && !error.request) {
    return error;
  }

  // Gracefully preserve canceled/aborted request status
  if (axios.isCancel(error) || error?.name === 'CanceledError' || error?.code === 'ERR_CANCELED') {
    return {
      message: 'Request canceled',
      status: 0,
      code: 'ERR_CANCELED',
      name: 'CanceledError',
      isCanceled: true,
    };
  }

  if (error.response) {
    return {
      message: error.response.data?.message || error.response.data?.error || 'An error occurred with the response',
      status: error.response.status,
      code: error.response.data?.code || 'UNKNOWN_ERROR',
      data: error.response.data,
      response: error.response,
    };
  }

  if (error.request) {
    return {
      message: 'No response received from the server',
      status: 0,
      code: 'NETWORK_ERROR',
    };
  }

  return {
    message: error.message || 'An unexpected error occurred',
    status: 500,
    code: 'CLIENT_ERROR',
  };
}

export default apiClient;
