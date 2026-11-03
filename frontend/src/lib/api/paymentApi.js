import apiClient from './client';

export const paymentApi = {
  getMyPayments: () => apiClient.get('/payments/my'),
};

export default paymentApi;
