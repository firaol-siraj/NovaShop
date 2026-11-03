import apiClient from './client';

const unwrap = (res) => {
  if (res?.data?.data !== undefined) return res.data.data;
  if (res?.data !== undefined) return res.data;
  return res;
};

export const returnApi = {
  // Customer Endpoints
  submitRequest: async ({ orderId, items, customerNote, resolution }) => {
    const res = await apiClient.post('/returns', {
      orderId,
      items,
      customerNote,
      resolution,
    });
    return unwrap(res);
  },

  getMyReturns: async () => {
    const res = await apiClient.get('/returns/my');
    return unwrap(res);
  },

  getReturnForOrder: async (orderId) => {
    const res = await apiClient.get(`/returns/order/${orderId}`);
    return unwrap(res);
  },

  // Admin Endpoints
  getAdminStats: async (periodDays = 30) => {
    const res = await apiClient.get('/admin/returns/stats', { params: { periodDays } });
    return unwrap(res);
  },

  getAdminReturns: async (params = {}) => {
    const res = await apiClient.get('/admin/returns', { params });
    return unwrap(res);
  },

  getAdminReturnById: async (id) => {
    const res = await apiClient.get(`/admin/returns/${id}`);
    return unwrap(res);
  },

  approveReturn: async (id, data = {}) => {
    const res = await apiClient.post(`/admin/returns/${id}/approve`, data);
    return unwrap(res);
  },

  rejectReturn: async (id, data = {}) => {
    const res = await apiClient.post(`/admin/returns/${id}/reject`, data);
    return unwrap(res);
  },

  receiveReturn: async (id, data = {}) => {
    const res = await apiClient.post(`/admin/returns/${id}/receive`, data);
    return unwrap(res);
  },

  processRefund: async (id, data = {}) => {
    const res = await apiClient.post(`/admin/returns/${id}/refund`, data);
    return unwrap(res);
  },

  addAdminNote: async (id, note) => {
    const res = await apiClient.post(`/admin/returns/${id}/notes`, { note });
    return unwrap(res);
  },

  bulkUpdateStatus: async (returnIds, status) => {
    const res = await apiClient.post('/admin/returns/bulk-status', { returnIds, status });
    return unwrap(res);
  },

  exportCsv: async (params = {}) => {
    const res = await apiClient.get('/admin/returns/export', {
      params,
      responseType: 'blob',
    });
    return res?.data !== undefined && (res.data instanceof Blob || typeof res.data === 'string') ? res.data : res;
  },
};

export default returnApi;
