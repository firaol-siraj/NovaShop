import apiClient from './client';

export const orderApi = {
  createOrder: (data) => apiClient.post('/orders', data),
  getAdminOrders: (params) => apiClient.get('/orders', { params }),
  getMyOrders: (params = {}) => apiClient.get('/orders/my', { params }),
  getMyOrder: (id) => apiClient.get(`/orders/my/${id}`),
  getOrder: (id) => apiClient.get(`/orders/${id}`),
  resendConfirmationEmail: (id) => apiClient.post(`/orders/${id}/resend-confirmation`),
  resendAdminConfirmation: (id) => apiClient.post(`/orders/${id}/resend-confirmation`, {}, { role: 'admin' }),
  initializePayment: (id, data = {}) => apiClient.post(`/orders/${id}/initialize-payment`, data),
  getPaymentStatus: (id) => apiClient.get(`/orders/${id}/payment-status`),
  verifyTransaction: (txRef) => apiClient.get(`/orders/transaction/verify/${encodeURIComponent(txRef)}`),
  updateOrderStatus: (id, status) => apiClient.put(`/orders/${id}/status`, { status }),
  markOrderPaid: (id, data) => apiClient.put(`/orders/${id}/pay`, data),
  markOrderDelivered: (id) => apiClient.put(`/orders/${id}/deliver`),
};

export default orderApi;
