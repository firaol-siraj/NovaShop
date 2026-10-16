import apiClient from './client';

export const orderApi = {
  createOrder: (data) => apiClient.post('/orders', data),
  getAdminOrders: (params) => apiClient.get('/orders', { params }),
  getMyOrders: () => apiClient.get('/orders/myorders'),
  getOrder: (id) => apiClient.get(`/orders/${id}`),
  markOrderPaid: (id, data) => apiClient.put(`/orders/${id}/pay`, data),
  markOrderDelivered: (id) => apiClient.put(`/orders/${id}/deliver`),
};
