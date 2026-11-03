import apiClient from './client';

export const settingsApi = {
  // Public Store Settings
  getPublicSettings: () =>
    apiClient.get('/settings/public'),

  // Full Countries & Subdivisions List
  getCountries: () =>
    apiClient.get('/settings/countries'),

  // Admin Settings Operations
  getAdminSettings: () =>
    apiClient.get('/admin/settings', { role: 'admin' }),

  updateAdminSettings: (section, data, version) =>
    apiClient.patch(`/admin/settings/${section}`, { ...data, version }, { role: 'admin' }),

  // Team & Members Management
  getTeamMembers: () =>
    apiClient.get('/admin/settings/team/members', { role: 'admin' }),

  inviteMember: (data) =>
    apiClient.post('/admin/settings/team/invite', data, { role: 'admin' }),

  resendInvite: (id) =>
    apiClient.post(`/admin/settings/team/invites/${id}/resend`, {}, { role: 'admin' }),

  revokeInvite: (id) =>
    apiClient.delete(`/admin/settings/team/invites/${id}`, { role: 'admin' }),

  updateMemberRole: (id, role) =>
    apiClient.patch(`/admin/settings/team/members/${id}/role`, { role }, { role: 'admin' }),

  updateMemberStatus: (id, status) =>
    apiClient.patch(`/admin/settings/team/members/${id}/status`, { status }, { role: 'admin' }),

  deleteMember: (id) =>
    apiClient.delete(`/admin/settings/team/members/${id}`, { role: 'admin' }),

  getPermissionsMatrix: () =>
    apiClient.get('/admin/settings/team/permissions', { role: 'admin' }),

  // Notification Preferences
  getNotificationPreferences: () =>
    apiClient.get('/admin/settings/notifications/preferences', { role: 'admin' }),

  updateNotificationPreferences: (data) =>
    apiClient.patch('/admin/settings/notifications/preferences', data, { role: 'admin' }),

  sendTestNotification: () =>
    apiClient.post('/admin/settings/notifications/test-email', {}, { role: 'admin' }),

  // Public Invite Acceptance
  acceptInvite: (token, password) =>
    apiClient.post('/auth/admin/accept-invite', { token, password }),
};

export default settingsApi;
