import apiClient from './client';

const unwrap = (res) => {
  if (res?.data?.data !== undefined) return res.data.data;
  if (res?.data !== undefined) return res.data;
  return res;
};

export const helpApi = {
  getFaqs: async (params = {}) => {
    const res = await apiClient.get('/help/faqs', { params });
    return unwrap(res);
  },

  getSettings: async () => {
    const res = await apiClient.get('/help/settings');
    return unwrap(res);
  },
};

export default helpApi;
