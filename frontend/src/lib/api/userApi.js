import apiClient from './client';

export const userApi = {
  // Customer-facing endpoints (Authenticated user)
  getMe: () => apiClient.get('/users/me'),
  updateProfile: (data) => apiClient.patch('/users/me', data),
  updatePassword: (data) => apiClient.patch('/users/me/password', data),
  getOverview: () => apiClient.get('/users/me/overview'),
  getSettings: () => apiClient.get('/users/me/settings'),
  updateSettings: (data) => apiClient.patch('/users/me/settings', data),
  deleteAccount: (data = {}) => apiClient.delete('/users/me', { data }),

  // Admin user management endpoints
  getUsers: (params) => apiClient.get('/users', { params }),
  getUser: (id) => apiClient.get(`/users/${id}`),
  updateUser: (id, data) => apiClient.put(`/users/${id}`, data),
  deleteUser: (id) => apiClient.delete(`/users/${id}`),
};

export default userApi;
