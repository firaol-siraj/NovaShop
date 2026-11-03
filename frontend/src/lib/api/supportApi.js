import apiClient from './client';

const unwrap = (res) => {
  if (res?.data?.data !== undefined) return res.data.data;
  if (res?.data !== undefined) return res.data;
  return res;
};

export const supportApi = {
  // Admin endpoints
  getStats: async () => {
    const res = await apiClient.get('/admin/support/stats');
    return unwrap(res);
  },

  getConversations: async (params = {}) => {
    const res = await apiClient.get('/admin/support/conversations', { params });
    // Returns { items, counts, total, page, limit } or data
    if (res?.counts !== undefined && res?.data !== undefined) {
      return res;
    }
    if (res?.data?.counts !== undefined) {
      return res.data;
    }
    return unwrap(res);
  },

  getConversationById: async (id) => {
    const res = await apiClient.get(`/admin/support/conversations/${id}`);
    return unwrap(res);
  },

  sendReply: async (id, { content, attachments }) => {
    const res = await apiClient.post(`/admin/support/conversations/${id}/reply`, {
      content,
      attachments,
    });
    return unwrap(res);
  },

  saveInternalNote: async (id, { content }) => {
    const res = await apiClient.post(`/admin/support/conversations/${id}/note`, {
      content,
    });
    return unwrap(res);
  },

  updateStatus: async (id, status) => {
    const res = await apiClient.patch(`/admin/support/conversations/${id}/status`, {
      status,
    });
    return unwrap(res);
  },

  assignConversation: async (id, assignedTo) => {
    const res = await apiClient.patch(`/admin/support/conversations/${id}/assign`, {
      assignedTo,
    });
    return unwrap(res);
  },

  markUnread: async (id, unread = true) => {
    const res = await apiClient.patch(`/admin/support/conversations/${id}/unread`, {
      unread,
    });
    return unwrap(res);
  },

  exportCsv: async () => {
    const res = await apiClient.get('/admin/support/export', {
      responseType: 'blob',
    });
    return res?.data !== undefined && (res.data instanceof Blob || typeof res.data === 'string') ? res.data : res;
  },

  // Storefront endpoints
  submitContactForm: async ({ name, email, order, message, topic }) => {
    const res = await apiClient.post('/support/contact', {
      name,
      email,
      order,
      message,
      topic,
    });
    return unwrap(res);
  },

  getMyTickets: async () => {
    const res = await apiClient.get('/support/my-tickets');
    return unwrap(res);
  },
};

export default supportApi;
