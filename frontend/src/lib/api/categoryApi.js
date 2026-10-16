import apiClient from './client';

const notifyCategoryChange = () => {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event('novashop:categories-changed'));
  }
  if (typeof BroadcastChannel !== 'undefined') {
    const channel = new BroadcastChannel('novashop-categories');
    channel.postMessage('refresh');
    channel.close();
  }
};

export const categoryApi = {
  getCategories: () => apiClient.get('/categories'),
  getCategory: (id) => apiClient.get(`/categories/${id}`),
  createCategory: async (data) => {
    const result = await apiClient.post('/categories', data);
    notifyCategoryChange();
    return result;
  },
  updateCategory: async (id, data) => {
    const result = await apiClient.put(`/categories/${id}`, data);
    notifyCategoryChange();
    return result;
  },
  deleteCategory: async (id) => {
    const result = await apiClient.delete(`/categories/${id}`);
    notifyCategoryChange();
    return result;
  },
};
