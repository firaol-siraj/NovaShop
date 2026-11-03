import apiClient from './client';

export const addressApi = {
  getAddresses: () => apiClient.get('/addresses'),
  getAddress: (id) => apiClient.get(`/addresses/${id}`),
  createAddress: (data) => apiClient.post('/addresses', data),
  updateAddress: (id, data) => apiClient.patch(`/addresses/${id}`, data),
  deleteAddress: (id) => apiClient.delete(`/addresses/${id}`),
  setDefaultAddress: (id) => apiClient.patch(`/addresses/${id}/set-default`),
};

export default addressApi;
