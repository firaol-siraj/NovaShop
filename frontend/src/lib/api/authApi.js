import apiClient from './client';

export const authApi = {
  login: (credentials) => apiClient.post('/auth/login', credentials, { role: 'customer' }),
  adminLogin: (credentials) => apiClient.post('/auth/admin/login', credentials, { role: 'admin' }),
  register: (data) => apiClient.post('/auth/register', data, { role: 'customer' }),
  getMe: (role = 'customer') => apiClient.get('/auth/me', { role }),
  logout: () => apiClient.post('/auth/logout', {}, { role: 'customer' }),
  adminLogout: () => apiClient.post('/auth/admin/logout', {}, { role: 'admin' }),
  refreshToken: () => apiClient.post('/auth/refresh-token', {}, { role: 'customer' }),
  adminRefreshToken: () => apiClient.post('/auth/admin/refresh-token', {}, { role: 'admin' }),
  forgotPassword: (data) => apiClient.post('/auth/forgot-password', data),
  validateResetToken: (token) => apiClient.get('/auth/reset-password/validate', { params: { token } }),
  resetPassword: (arg1, arg2) => {
    if (typeof arg1 === 'string' && arg2) {
      return apiClient.post('/auth/reset-password', { token: arg1, ...arg2 });
    }
    return apiClient.post('/auth/reset-password', arg1);
  },
  adminForgotPassword: (data) => apiClient.post('/auth/admin/forgot-password', data),
  validateAdminResetToken: (token) => apiClient.get('/auth/admin/reset-password/validate', { params: { token } }),
  adminResetPassword: (data) => apiClient.post('/auth/admin/reset-password', data),
  verifyEmail: (token) => apiClient.get(`/auth/verify-email/${encodeURIComponent(token)}`),
};
