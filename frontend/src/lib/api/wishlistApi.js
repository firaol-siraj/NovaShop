import apiClient from './client';

export const wishlistApi = {
  getWishlist: () => apiClient.get('/wishlist'),
  addItem: (productId) => apiClient.post('/wishlist/items', { productId }),
  mergeGuestWishlist: (productIdsOrData) =>
    apiClient.post(
      '/wishlist/merge',
      Array.isArray(productIdsOrData)
        ? { productIds: productIdsOrData }
        : productIdsOrData
    ),
  removeItem: (productId) =>
    apiClient.delete(`/wishlist/items/${productId}`),
  clearWishlist: () => apiClient.delete('/wishlist'),
};
