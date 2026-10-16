import apiClient from './client';

export const cartApi = {
  getCart: () => apiClient.get('/cart'),
  addItem: (data) => apiClient.post('/cart/items', data),
  updateItem: (itemId, data) => apiClient.patch(`/cart/items/${itemId}`, data),
  removeItem: (itemId) => apiClient.delete(`/cart/items/${itemId}`),
  clearCart: () => apiClient.delete('/cart'),
  mergeGuestCart: (itemsOrData) =>
    apiClient.post(
      '/cart/merge',
      Array.isArray(itemsOrData) ? { items: itemsOrData } : itemsOrData
    ),
};

