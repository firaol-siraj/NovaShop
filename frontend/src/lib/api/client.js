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

export const isRequestAdminScoped = (config) => {
  if (config?.role === 'admin' || config?.headers?.['X-Auth-Role'] === 'admin') {
    return true;
  }
  const url = config?.url || '';
  if (
    url.includes('/admin') ||
    url.endsWith('/status') ||
    url.endsWith('/resend-confirmation') ||
    url.endsWith('/deliver') ||
    url === '/users'
  ) {
    return true;
  }
  if (
    typeof window !== 'undefined' &&
    window.location.pathname.startsWith('/admin') &&
    !url.includes('/cart') &&
    !url.includes('/wishlist') &&
    !url.includes('/users/me')
  ) {
    return true;
  }
  return false;
};

apiClient.interceptors.request.use((config) => {
  const isAdmin = isRequestAdminScoped(config);
  const token = isAdmin ? getAdminToken() : getCustomerToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

apiClient.interceptors.response.use(
  (response) => response.data,
  async (error) => {
    // If request was canceled/aborted, reject immediately without auth-refresh logic
    if (axios.isCancel(error) || error.name === 'CanceledError' || error.code === 'ERR_CANCELED') {
      return Promise.reject(normalizeError(error));
    }

    const originalRequest = error.config;

    if (
      !originalRequest ||
      error.response?.status !== 401 ||
      originalRequest._retry ||
      originalRequest.url === '/auth/refresh-token' ||
      originalRequest.url === '/auth/admin/refresh-token' ||
      originalRequest.url === '/auth/logout' ||
      originalRequest.url === '/auth/admin/logout' ||
      originalRequest.url === '/auth/login' ||
      originalRequest.url === '/auth/admin/login'
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
        originalRequest.headers.Authorization = `Bearer ${newAdminToken}`;
        return apiClient(originalRequest);
      } catch (refreshError) {
        clearAdminToken();
        window.dispatchEvent(new Event('novashop:admin-auth-expired'));
        return Promise.reject(normalizeError(refreshError));
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
      originalRequest.headers.Authorization = `Bearer ${newCustomerToken}`;
      return apiClient(originalRequest);
    } catch (refreshError) {
      clearCustomerToken();
      window.dispatchEvent(new Event('novashop:auth-expired'));
      return Promise.reject(normalizeError(refreshError));
    }
  }
);

function normalizeError(error) {
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
      message: error.response.data?.message || 'An error occurred with the response',
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
