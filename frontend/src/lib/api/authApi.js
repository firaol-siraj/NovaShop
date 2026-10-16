import apiClient from './client';

export const authApi = {
  login: (credentials) => apiClient.post('/auth/login', credentials),
  adminLogin: (credentials) => apiClient.post('/auth/admin/login', credentials),
  register: (data) => apiClient.post('/auth/register', data),
  getMe: () => apiClient.get('/auth/me'),
  logout: () => apiClient.post('/auth/logout'),
  refreshToken: () => apiClient.post('/auth/refresh-token'),
  forgotPassword: (data) => apiClient.post('/auth/forgot-password', data),
  resetPassword: (token, data) => apiClient.put(`/auth/reset-password/${encodeURIComponent(token)}`, data),
  verifyEmail: (token) => apiClient.get(`/auth/verify-email/${encodeURIComponent(token)}`),
};
