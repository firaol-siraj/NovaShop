import apiClient from './client.js';

export const reviewApi = {
  createReview: (data) => apiClient.post('/reviews', data),
  checkUserReviewEligibility: (productId) =>
    apiClient.get(`/reviews/check-eligibility/${productId}`),
  getProductReviews: (productId, params = {}) =>
    apiClient.get(`/products/${productId}/reviews`, { params }),
};

export default reviewApi;
