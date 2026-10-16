import axios from 'axios';
import { clearAccessToken, getAccessToken, setAccessToken } from './tokenManager';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api/v1';

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

let refreshPromise = null;

apiClient.interceptors.request.use((config) => {
  const token = getAccessToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

apiClient.interceptors.response.use(
  (response) => response.data,
  async (error) => {
    const originalRequest = error.config;

    if (
      !originalRequest ||
      error.response?.status !== 401 ||
      originalRequest._retry ||
      originalRequest.url === '/auth/refresh-token' ||
      originalRequest.url === '/auth/logout' ||
      originalRequest.url === '/auth/login' ||
      originalRequest.url === '/auth/admin/login'
    ) {
      return Promise.reject(normalizeError(error));
    }

    if (!refreshPromise) {
      refreshPromise = apiClient.post('/auth/refresh-token', {})
        .then((data) => {
          if (!data?.accessToken) {
            throw new Error('Refresh response did not contain an access token');
          }
          setAccessToken(data.accessToken);
          return data.accessToken;
        })
        .finally(() => {
          refreshPromise = null;
        });
    }

    try {
      const accessToken = await refreshPromise;
      originalRequest._retry = true;
      originalRequest.headers.Authorization = `Bearer ${accessToken}`;
      return apiClient(originalRequest);
    } catch (refreshError) {
      clearAccessToken();
      window.dispatchEvent(new Event('novashop:auth-expired'));
      return Promise.reject(normalizeError(refreshError));
    }
  }
);

function normalizeError(error) {
  if (error.response) {
    return {
      message: error.response.data?.message || 'An error occurred with the response',
      status: error.response.status,
      code: error.response.data?.code || 'UNKNOWN_ERROR',
      data: error.response.data,
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
    message: error.message,
    status: 0,
    code: 'REQUEST_SETUP_ERROR',
  };
}

export default apiClient;
