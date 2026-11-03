import apiClient from './client.js';

export const discountApi = {
  validateDiscount: (payload) => apiClient.post('/discounts/validate', payload),
};

export default discountApi;
