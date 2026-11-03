import apiClient from './client';

const unwrap = (res) => {
  if (res?.data?.data !== undefined) return res.data.data;
  if (res?.data !== undefined) return res.data;
  return res;
};

export const shippingApi = {
  // Public / Checkout Quote
  getQuote: async ({ country, region, cartTotalUSD, weightKg = 1 }) => {
    const res = await apiClient.post('/shipping/quote', {
      country,
      region,
      cartTotalUSD,
      weightKg,
    });
    return unwrap(res);
  },

  // Admin Endpoints
  getAdminStats: async () => {
    const res = await apiClient.get('/admin/shipping/stats');
    return unwrap(res);
  },

  getStats: async () => {
    const res = await apiClient.get('/admin/shipping/stats');
    return unwrap(res);
  },

  getZoneById: async (id) => {
    const res = await apiClient.get(`/admin/shipping/zones/${id}`);
    return unwrap(res);
  },

  createZone: async (data) => {
    const res = await apiClient.post('/admin/shipping/zones', data);
    return unwrap(res);
  },

  updateZone: async (id, data) => {
    const res = await apiClient.put(`/admin/shipping/zones/${id}`, data);
    return unwrap(res);
  },

  deleteZone: async (id) => {
    const res = await apiClient.delete(`/admin/shipping/zones/${id}`);
    return unwrap(res);
  },

  getMethodById: async (id) => {
    const res = await apiClient.get(`/admin/shipping/methods/${id}`);
    return unwrap(res);
  },

  createMethod: async (data) => {
    const res = await apiClient.post('/admin/shipping/methods', data);
    return unwrap(res);
  },

  updateMethod: async (id, data) => {
    const res = await apiClient.put(`/admin/shipping/methods/${id}`, data);
    return unwrap(res);
  },

  deleteMethod: async (id) => {
    const res = await apiClient.delete(`/admin/shipping/methods/${id}`);
    return unwrap(res);
  },

  createRate: async (data) => {
    const res = await apiClient.post('/admin/shipping/rates', data);
    return unwrap(res);
  },

  updateRate: async (id, data) => {
    const res = await apiClient.put(`/admin/shipping/rates/${id}`, data);
    return unwrap(res);
  },

  deleteRate: async (id) => {
    const res = await apiClient.delete(`/admin/shipping/rates/${id}`);
    return unwrap(res);
  },

  updateDeliveryTimes: async (zoneId, data) => {
    const res = await apiClient.put(`/admin/shipping/delivery-times/${zoneId}`, data);
    return unwrap(res);
  },

  getSettings: async () => {
    const res = await apiClient.get('/admin/shipping/settings');
    return unwrap(res);
  },

  updateSettings: async (data) => {
    const res = await apiClient.put('/admin/shipping/settings', data);
    return unwrap(res);
  },
};

export default shippingApi;
