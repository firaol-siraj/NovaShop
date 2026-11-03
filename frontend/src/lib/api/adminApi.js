import apiClient from './client';

export const adminApi = {
  // ==========================================
  // DASHBOARD
  // ==========================================
  getSummary: (params = {}) =>
    apiClient.get('/admin/dashboard/summary', { params, role: 'admin' }),

  getDashboardSummary: (params = {}) =>
    apiClient.get('/admin/dashboard/summary', { params, role: 'admin' }),

  getRevenue: (params = {}) =>
    apiClient.get('/admin/dashboard/revenue', { params, role: 'admin' }),

  getTopProducts: (params = {}) =>
    apiClient.get('/admin/dashboard/top-products', { params, role: 'admin' }),

  getInventoryAlerts: (params = {}) =>
    apiClient.get('/admin/dashboard/inventory-alerts', { params, role: 'admin' }),

  getFulfillmentQueue: (params = {}) =>
    apiClient.get('/admin/dashboard/fulfillment-queue', { params, role: 'admin' }),

  dispatchOrders: (data = {}) =>
    apiClient.post('/admin/orders/dispatch', data, { role: 'admin' }),

  getOrders: (params = {}) =>
    apiClient.get('/admin/orders', { params, role: 'admin' }),

  // ==========================================
  // NOTIFICATIONS
  // ==========================================
  getNotifications: () =>
    apiClient.get('/admin/notifications', { role: 'admin' }),

  getPaginatedNotifications: (params = {}) =>
    apiClient.get('/admin/notifications/all', { params, role: 'admin' }),

  markNotificationRead: (id) =>
    apiClient.patch(`/admin/notifications/${id}/read`, {}, { role: 'admin' }),

  markAllNotificationsRead: () =>
    apiClient.patch('/admin/notifications/read-all', {}, { role: 'admin' }),

  deleteNotification: (id) =>
    apiClient.delete(`/admin/notifications/${id}`, { role: 'admin' }),

  // ==========================================
  // SEARCH & REPORTS
  // ==========================================
  globalSearch: (query) =>
    apiClient.get('/admin/search', { params: { q: query }, role: 'admin' }),

  exportReport: async (params = {}) => {
    return apiClient.get('/admin/reports/export', {
      params: { ...params, format: 'csv' },
      responseType: 'blob',
      role: 'admin',
    });
  },

  // ==========================================
  // ANALYTICS
  // ==========================================
  getAnalyticsOverview: (params = {}) =>
    apiClient.get('/admin/analytics/overview', { params, role: 'admin' }),

  getSalesAnalytics: (params = {}) =>
    apiClient.get('/admin/analytics/sales', { params, role: 'admin' }),

  getProductAnalytics: (params = {}) =>
    apiClient.get('/admin/analytics/products', { params, role: 'admin' }),

  getCustomerAnalytics: (params = {}) =>
    apiClient.get('/admin/analytics/customers', { params, role: 'admin' }),

  exportAnalyticsCsv: async (params = {}) => {
    return apiClient.get('/admin/analytics/export', {
      params,
      responseType: 'blob',
      role: 'admin',
    });
  },

  // ==========================================
  // PRODUCTS
  // ==========================================
  getProducts: (params = {}) =>
    apiClient.get('/admin/products', { params, role: 'admin' }),

  getProduct: (id) =>
    apiClient.get(`/admin/products/${id}`, { role: 'admin' }),

  createProduct: (data) =>
    apiClient.post('/admin/products', data, { role: 'admin' }),

  updateProduct: (id, data) =>
    apiClient.put(`/admin/products/${id}`, data, { role: 'admin' }),

  deleteProduct: (id) =>
    apiClient.delete(`/admin/products/${id}`, { role: 'admin' }),

  updateProductStatus: (id, status) =>
    apiClient.patch(`/admin/products/${id}/status`, { status }, { role: 'admin' }),

  bulkUpdateProductStatus: (ids, status) =>
    apiClient.post('/admin/products/bulk-status', { ids, status }, { role: 'admin' }),

  duplicateProduct: (id) =>
    apiClient.post(`/admin/products/${id}/duplicate`, {}, { role: 'admin' }),

  // ==========================================
  // CATEGORIES
  // ==========================================
  getCategories: (params = {}) =>
    apiClient.get('/admin/categories', { params, role: 'admin' }),

  createCategory: (data) =>
    apiClient.post('/admin/categories', data, { role: 'admin' }),

  updateCategory: (id, data) =>
    apiClient.put(`/admin/categories/${id}`, data, { role: 'admin' }),

  deleteCategory: (id) =>
    apiClient.delete(`/admin/categories/${id}`, { role: 'admin' }),

  reorderCategories: (order) =>
    apiClient.patch('/admin/categories/reorder', { order }, { role: 'admin' }),

  // ==========================================
  // CUSTOMERS
  // ==========================================
  getCustomers: (params = {}) =>
    apiClient.get('/admin/customers', { params, role: 'admin' }),

  getCustomer: (id) =>
    apiClient.get(`/admin/customers/${id}`, { role: 'admin' }),

  createCustomer: (data) =>
    apiClient.post('/admin/customers', data, { role: 'admin' }),

  updateCustomer: (id, data) =>
    apiClient.patch(`/admin/customers/${id}`, data, { role: 'admin' }),

  updateCustomerStatus: (id, status, reason = '') =>
    apiClient.patch(`/admin/customers/${id}/status`, { status, reason }, { role: 'admin' }),

  resendCustomerInvite: (id) =>
    apiClient.post(`/admin/customers/${id}/resend-invite`, {}, { role: 'admin' }),

  resendCustomerVerification: (id) =>
    apiClient.post(`/admin/customers/${id}/resend-verification`, {}, { role: 'admin' }),

  sendCustomerEmail: (id, data) =>
    apiClient.post(`/admin/customers/${id}/email`, data, { role: 'admin' }),

  retryCustomerEmail: (id, logId) =>
    apiClient.post(`/admin/customers/${id}/email/${logId}/retry`, {}, { role: 'admin' }),

  deleteCustomer: (id, action) =>
    apiClient.delete(`/admin/customers/${id}`, {
      params: action ? { action } : undefined,
      role: 'admin',
    }),

  // ==========================================
  // INVENTORY
  // ==========================================
  getInventory: (params = {}) =>
    apiClient.get('/admin/inventory', { params, role: 'admin' }),

  adjustStock: (data) =>
    apiClient.post('/admin/inventory/adjust', data, { role: 'admin' }),

  adjustInventoryStock: (data) =>
    apiClient.post('/admin/inventory/adjust', data, { role: 'admin' }),

  bulkRestock: (data) =>
    apiClient.post('/admin/inventory/bulk-restock', data, { role: 'admin' }),

  getVariantMovements: (variantId) =>
    apiClient.get(`/admin/inventory/movements/${variantId}`, { role: 'admin' }),

  getInventoryMovements: (params = {}) => {
    const id = typeof params === 'string' ? params : params.variantId;
    if (id) {
      return apiClient.get(`/admin/inventory/movements/${id}`, { role: 'admin' });
    }
    return apiClient.get('/admin/inventory/movements', { role: 'admin' });
  },

  updateVariantThreshold: (variantId, lowStockThreshold) =>
    apiClient.patch(`/admin/inventory/variants/${variantId}/threshold`, { lowStockThreshold }, { role: 'admin' }),

  exportInventoryCsv: () =>
    apiClient.get('/admin/inventory/export', { responseType: 'blob', role: 'admin' }),

  getInventorySettings: () =>
    apiClient.get('/admin/settings/inventory', { role: 'admin' }),

  updateInventorySettings: (data) =>
    apiClient.patch('/admin/settings/inventory', data, { role: 'admin' }),

  // ==========================================
  // REVIEWS
  // ==========================================
  getReviews: (params = {}) =>
    apiClient.get('/admin/reviews', { params, role: 'admin' }),

  getReviewStats: () =>
    apiClient.get('/admin/reviews/stats', { role: 'admin' }),

  updateReviewStatus: (id, status, rejectionReason = '') =>
    apiClient.patch(`/admin/reviews/${id}/status`, { status, rejectionReason }, { role: 'admin' }),

  replyReview: (id, text) =>
    apiClient.post(`/admin/reviews/${id}/reply`, { text }, { role: 'admin' }),

  replyToReview: (id, text) =>
    apiClient.post(`/admin/reviews/${id}/reply`, { text }, { role: 'admin' }),

  deleteReviewReply: (id) =>
    apiClient.delete(`/admin/reviews/${id}/reply`, { role: 'admin' }),

  toggleStarReview: (id) =>
    apiClient.patch(`/admin/reviews/${id}/star`, {}, { role: 'admin' }),

  deleteReview: (id) =>
    apiClient.delete(`/admin/reviews/${id}`, { role: 'admin' }),

  bulkUpdateReviews: (ids, action, rejectionReason = '') =>
    apiClient.post('/admin/reviews/bulk', { ids, action, rejectionReason }, { role: 'admin' }),

  exportReviewsCsv: (params = {}) =>
    apiClient.get('/admin/reviews/export', { params, responseType: 'blob', role: 'admin' }),

  // ==========================================
  // DISCOUNTS
  // ==========================================
  getDiscounts: (params = {}) =>
    apiClient.get('/admin/discounts', { params, role: 'admin' }),

  getDiscountStats: () =>
    apiClient.get('/admin/discounts/stats', { role: 'admin' }),

  getDiscount: (id) =>
    apiClient.get(`/admin/discounts/${id}`, { role: 'admin' }),

  getDiscountRedemptions: (id) =>
    apiClient.get(`/admin/discounts/${id}/redemptions`, { role: 'admin' }),

  createDiscount: (data) =>
    apiClient.post('/admin/discounts', data, { role: 'admin' }),

  updateDiscount: (id, data) =>
    apiClient.put(`/admin/discounts/${id}`, data, { role: 'admin' }),

  duplicateDiscount: (id) =>
    apiClient.post(`/admin/discounts/${id}/duplicate`, {}, { role: 'admin' }),

  endDiscount: (id) =>
    apiClient.patch(`/admin/discounts/${id}/end`, {}, { role: 'admin' }),

  deleteDiscount: (id) =>
    apiClient.delete(`/admin/discounts/${id}`, { role: 'admin' }),

  bulkUpdateDiscounts: (ids, action) =>
    apiClient.post('/admin/discounts/bulk', { ids, action }, { role: 'admin' }),

  exportDiscountsCsv: () =>
    apiClient.get('/admin/discounts/export', { responseType: 'blob', role: 'admin' }),

  // ==========================================
  // MEDIA LIBRARY
  // ==========================================
  getMedia: (params = {}) =>
    apiClient.get('/admin/media', { params, role: 'admin' }),

  getMediaStats: () =>
    apiClient.get('/admin/media/stats', { role: 'admin' }),

  uploadMedia: (formData) =>
    apiClient.post('/admin/media/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      role: 'admin',
    }),

  getMediaFolders: () =>
    apiClient.get('/admin/media/folders', { role: 'admin' }),

  createMediaFolder: (name, parent = null) =>
    apiClient.post('/admin/media/folders', { name, parent }, { role: 'admin' }),

  updateMediaFolder: (id, data) =>
    apiClient.put(`/admin/media/folders/${id}`, data, { role: 'admin' }),

  deleteMediaFolder: (id, moveTo = null) =>
    apiClient.delete(`/admin/media/folders/${id}`, { params: { moveTo }, role: 'admin' }),

  getMediaUsage: (id) =>
    apiClient.get(`/admin/media/${id}/usage`, { role: 'admin' }),

  updateMediaFile: (id, data) =>
    apiClient.patch(`/admin/media/${id}`, data, { role: 'admin' }),

  deleteMediaFile: (id, force = false) =>
    apiClient.delete(`/admin/media/${id}`, { params: { force }, role: 'admin' }),

  bulkMediaActions: (action, ids, folderId = null, force = false) =>
    apiClient.post('/admin/media/bulk', { action, ids, folderId, force }, { role: 'admin' }),

  recomputeMediaUsage: () =>
    apiClient.post('/admin/media/recompute-usage', {}, { role: 'admin' }),

  // ==========================================
  // HERO SLIDES
  // ==========================================
  getHeroSlides: (params = {}) =>
    apiClient.get('/admin/hero-slides', { params, role: 'admin' }),

  getHeroSlideStats: () =>
    apiClient.get('/admin/hero-slides/stats', { role: 'admin' }),

  getHeroSlide: (id) =>
    apiClient.get(`/admin/hero-slides/${id}`, { role: 'admin' }),

  createHeroSlide: (data) =>
    apiClient.post('/admin/hero-slides', data, { role: 'admin' }),

  updateHeroSlide: (id, data) =>
    apiClient.put(`/admin/hero-slides/${id}`, data, { role: 'admin' }),

  duplicateHeroSlide: (id) =>
    apiClient.post(`/admin/hero-slides/${id}/duplicate`, {}, { role: 'admin' }),

  deleteHeroSlide: (id) =>
    apiClient.delete(`/admin/hero-slides/${id}`, { role: 'admin' }),

  reorderHeroSlides: (items) =>
    apiClient.patch('/admin/hero-slides/reorder', { items }, { role: 'admin' }),

  bulkHeroSlideActions: (action, ids) =>
    apiClient.post('/admin/hero-slides/bulk', { action, ids }, { role: 'admin' }),

  getHeroPreviewToken: () =>
    apiClient.get('/admin/hero-slides/preview-token', { role: 'admin' }),

  // ==========================================
  // HOMEPAGE CONTENT
  // ==========================================
  getHomepageContent: () =>
    apiClient.get('/admin/homepage', { role: 'admin' }),

  updateHomepageDraft: (sections, clientVersion) =>
    apiClient.put('/admin/homepage/draft', { sections, clientVersion }, { role: 'admin' }),

  publishHomepage: () =>
    apiClient.post('/admin/homepage/publish', {}, { role: 'admin' }),

  discardHomepage: () =>
    apiClient.post('/admin/homepage/discard', {}, { role: 'admin' }),

  getHomepageSubscribers: (params = {}) =>
    apiClient.get('/admin/homepage/subscribers', { params, role: 'admin' }),

  // ==========================================
  // ADMIN PROFILE & SESSIONS
  // ==========================================
  getMe: () =>
    apiClient.get('/admin/me', { role: 'admin' }),

  updateMe: (data) =>
    apiClient.patch('/admin/me', data, { role: 'admin' }),

  updatePassword: (data) =>
    apiClient.patch('/admin/me/password', data, { role: 'admin' }),

  uploadAvatar: (formData) =>
    apiClient.post('/admin/me/avatar', formData, {
      role: 'admin',
      headers: { 'Content-Type': 'multipart/form-data' },
    }),

  deleteAvatar: () =>
    apiClient.delete('/admin/me/avatar', { role: 'admin' }),

  getSessions: () =>
    apiClient.get('/admin/me/sessions', { role: 'admin' }),

  revokeSession: (id) =>
    apiClient.delete(`/admin/me/sessions/${id}`, { role: 'admin' }),

  getActivity: (params = {}) =>
    apiClient.get('/admin/me/activity', { params, role: 'admin' }),
};

export default adminApi;
