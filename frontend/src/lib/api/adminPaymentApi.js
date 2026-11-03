import apiClient from './client';

const unwrap = (res) => {
  if (res?.data?.data !== undefined) return res.data.data;
  if (res?.data !== undefined) return res.data;
  return res;
};

export const adminPaymentApi = {
  getStats: async (periodDays = 30) => {
    const res = await apiClient.get('/admin/payments/stats', { params: { periodDays } });
    return unwrap(res);
  },

  getTransactions: async (params = {}) => {
    const res = await apiClient.get('/admin/payments/transactions', { params });
    return unwrap(res);
  },

  getPayouts: async (params = {}) => {
    const res = await apiClient.get('/admin/payments/payouts', { params });
    return unwrap(res);
  },

  getPayoutDetail: async (id) => {
    const res = await apiClient.get(`/admin/payments/payouts/${id}`);
    return unwrap(res);
  },

  recordPayout: async (data) => {
    const res = await apiClient.post('/admin/payments/payouts', data);
    return unwrap(res);
  },

  getMethods: async () => {
    const res = await apiClient.get('/admin/payments/methods');
    return unwrap(res);
  },

  reverifyTransaction: async (txRef) => {
    const res = await apiClient.post('/admin/payments/reverify', { txRef });
    return unwrap(res);
  },

  resendReceipt: async (txRef, email) => {
    const res = await apiClient.post('/admin/payments/resend-receipt', { txRef, email });
    return unwrap(res);
  },

  exportCsv: async (params = {}) => {
    const res = await apiClient.get('/admin/payments/export', {
      params,
      responseType: 'blob',
    });
    return res?.data !== undefined && (res.data instanceof Blob || typeof res.data === 'string') ? res.data : res;
  },

  getPaymentDetail: async (id) => {
    const res = await apiClient.get(`/admin/payments/${id}`);
    return unwrap(res);
  },

  getSettings: async () => {
    const res = await apiClient.get('/admin/payments/settings');
    return unwrap(res);
  },

  updateSettings: async (data) => {
    const res = await apiClient.put('/admin/payments/settings', data);
    return unwrap(res);
  },
};

export default adminPaymentApi;
