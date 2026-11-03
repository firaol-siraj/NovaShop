import { useState, useEffect, useMemo, useRef } from 'react';
import { AdminIcon } from '../../components/admin/AdminLayout';
import { useAdminAuth } from '../../context/AdminAuthContext';
import adminApi from '../../lib/api/adminApi';
import { formatDate } from '../../lib/formatters';
import '../../components/admin/admin-dashboard.css';
import './admin-profile.css';

export default function AdminProfilePage({ go }) {
  const { user: authUser, setUser: setAuthUser } = useAdminAuth();
  const [activeTab, setActiveTab] = useState('overview'); // 'overview' | 'security' | 'notifications' | 'activity' | 'permissions'
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);
  const [toast, setToast] = useState(null); // { message: string, type: 'success' | 'error' }

  // Admin user data from GET /api/admin/me
  const [adminData, setAdminData] = useState(null);

  // Form states for Personal Info
  const [personalForm, setPersonalForm] = useState({
    firstName: '',
    lastName: '',
    displayName: '',
    phone: '',
    jobTitle: '',
    bio: '',
    language: 'en',
    timezone: 'Africa/Addis_Ababa',
    email: '',
    currentPassword: '', // only needed if email changed
  });
  const [initialPersonalForm, setInitialPersonalForm] = useState(null);

  // Form states for Security / Password
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);
  const [passwordError, setPasswordError] = useState(null);

  // Sessions state
  const [sessions, setSessions] = useState([]);
  const [isLoadingSessions, setIsLoadingSessions] = useState(false);

  // Notifications preferences form
  const [notifPrefs, setNotifPrefs] = useState({
    orders: { email: true, inApp: true },
    returns: { email: true, inApp: false },
    inventory: { email: true, inApp: true },
    customerAccounts: { email: false, inApp: true },
    paymentDisputes: { email: true, inApp: true },
  });
  const [initialNotifPrefs, setInitialNotifPrefs] = useState(null);

  // Activity audit state
  const [activityLogs, setActivityLogs] = useState([]);
  const [activityPage, setActivityPage] = useState(1);
  const [activityTotalPages, setActivityTotalPages] = useState(1);
  const [isLoadingActivity, setIsLoadingActivity] = useState(false);

  // Avatar upload ref
  const fileInputRef = useRef(null);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);

  // Set document title
  useEffect(() => {
    document.title = 'Administrator Profile | NovaShop';
  }, []);

  // Fetch admin profile
  const fetchProfile = async () => {
    try {
      setIsLoading(true);
      setErrorMessage(null);
      const res = await adminApi.getMe();
      const user = res.data?.data || res.data;
      if (user) {
        setAdminData(user);

        const formValues = {
          firstName: user.firstName || '',
          lastName: user.lastName || '',
          displayName: user.displayName || user.name || '',
          phone: user.phone || '',
          jobTitle: user.jobTitle || '',
          bio: user.bio || '',
          language: user.settings?.language || 'en',
          timezone: user.settings?.timezone || 'Africa/Addis_Ababa',
          email: user.email || '',
          currentPassword: '',
        };
        setPersonalForm(formValues);
        setInitialPersonalForm(formValues);

        const loadedNotifs = user.settings?.notifications || {
          orders: { email: true, inApp: true },
          returns: { email: true, inApp: false },
          inventory: { email: true, inApp: true },
          customerAccounts: { email: false, inApp: true },
          paymentDisputes: { email: true, inApp: true },
        };
        setNotifPrefs(loadedNotifs);
        setInitialNotifPrefs(loadedNotifs);
      }
    } catch (err) {
      console.error('Failed to load admin profile:', err);
      setErrorMessage(err.response?.data?.message || 'Failed to load administrator profile. Please verify your connection.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchProfile();
  }, []);

  // Load sessions when switching to security tab
  useEffect(() => {
    if (activeTab === 'security') {
      loadSessions();
    } else if (activeTab === 'activity') {
      loadActivity(1);
    }
  }, [activeTab]);

  const loadSessions = async () => {
    try {
      setIsLoadingSessions(true);
      const res = await adminApi.getSessions();
      setSessions(res.data?.data || res.data || []);
    } catch (err) {
      console.error('Failed to load active sessions:', err);
    } finally {
      setIsLoadingSessions(false);
    }
  };

  const loadActivity = async (page = 1) => {
    try {
      setIsLoadingActivity(true);
      const res = await adminApi.getActivity({ page, limit: 10 });
      const data = res.data?.data || res.data || {};
      setActivityLogs(data.logs || []);
      setActivityPage(data.pagination?.page || 1);
      setActivityTotalPages(data.pagination?.pages || 1);
    } catch (err) {
      console.error('Failed to load activity logs:', err);
    } finally {
      setIsLoadingActivity(false);
    }
  };

  // Compute dirty states
  const isPersonalDirty = useMemo(() => {
    if (!initialPersonalForm) return false;
    return (
      personalForm.firstName !== initialPersonalForm.firstName ||
      personalForm.lastName !== initialPersonalForm.lastName ||
      personalForm.displayName !== initialPersonalForm.displayName ||
      personalForm.phone !== initialPersonalForm.phone ||
      personalForm.jobTitle !== initialPersonalForm.jobTitle ||
      personalForm.bio !== initialPersonalForm.bio ||
      personalForm.language !== initialPersonalForm.language ||
      personalForm.timezone !== initialPersonalForm.timezone ||
      personalForm.email !== initialPersonalForm.email
    );
  }, [personalForm, initialPersonalForm]);

  const isNotifDirty = useMemo(() => {
    if (!initialNotifPrefs) return false;
    return JSON.stringify(notifPrefs) !== JSON.stringify(initialNotifPrefs);
  }, [notifPrefs, initialNotifPrefs]);

  // Toast auto-clear
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(timer);
  }, [toast]);

  // Handle Personal Info Save
  const handleSavePersonal = async () => {
    try {
      setIsSaving(true);
      const payload = {
        firstName: personalForm.firstName,
        lastName: personalForm.lastName,
        displayName: personalForm.displayName,
        phone: personalForm.phone,
        jobTitle: personalForm.jobTitle,
        bio: personalForm.bio,
        language: personalForm.language,
        timezone: personalForm.timezone,
      };

      if (personalForm.email && personalForm.email !== initialPersonalForm.email) {
        if (!personalForm.currentPassword) {
          alert('Current password is required to change your email address.');
          setIsSaving(false);
          return;
        }
        payload.email = personalForm.email;
        payload.currentPassword = personalForm.currentPassword;
      }

      const res = await adminApi.updateMe(payload);
      const updatedUser = res.data?.data || res.data;
      setAdminData(updatedUser);

      // Also sync user in context if present
      if (setAuthUser) {
        setAuthUser((prev) => ({ ...prev, ...updatedUser }));
      }

      const newInitials = {
        firstName: updatedUser.firstName || '',
        lastName: updatedUser.lastName || '',
        displayName: updatedUser.displayName || updatedUser.name || '',
        phone: updatedUser.phone || '',
        jobTitle: updatedUser.jobTitle || '',
        bio: updatedUser.bio || '',
        language: updatedUser.settings?.language || 'en',
        timezone: updatedUser.settings?.timezone || 'Africa/Addis_Ababa',
        email: updatedUser.email || '',
        currentPassword: '',
      };
      setPersonalForm(newInitials);
      setInitialPersonalForm(newInitials);

      setToast({ message: 'Profile details saved successfully.', type: 'success' });
    } catch (err) {
      console.error('Failed to update personal info:', err);
      alert(err.response?.data?.message || 'Failed to update profile. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDiscardPersonal = () => {
    if (initialPersonalForm) {
      setPersonalForm({ ...initialPersonalForm });
    }
  };

  // Handle Notifications Save
  const handleSaveNotifications = async () => {
    try {
      setIsSaving(true);
      const res = await adminApi.updateMe({
        notifications: notifPrefs,
      });
      const updatedUser = res.data?.data || res.data;
      setAdminData(updatedUser);
      setInitialNotifPrefs(notifPrefs);
      setToast({ message: 'Notification preferences updated.', type: 'success' });
    } catch (err) {
      console.error('Failed to update notification preferences:', err);
      alert(err.response?.data?.message || 'Failed to update preferences.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDiscardNotifications = () => {
    if (initialNotifPrefs) {
      setNotifPrefs(JSON.parse(JSON.stringify(initialNotifPrefs)));
    }
  };

  // Handle Password Update
  const handleUpdatePassword = async (e) => {
    e.preventDefault();
    setPasswordError(null);

    if (!passwordForm.currentPassword || !passwordForm.newPassword) {
      setPasswordError('Please provide both current and new password.');
      return;
    }
    if (passwordForm.newPassword.length < 6) {
      setPasswordError('New password must be at least 6 characters.');
      return;
    }
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setPasswordError('New passwords do not match.');
      return;
    }

    try {
      setIsUpdatingPassword(true);
      await adminApi.updatePassword(passwordForm);
      setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
      setToast({ message: 'Password updated. Other sessions revoked.', type: 'success' });
      loadSessions();
    } catch (err) {
      console.error('Password update failed:', err);
      setPasswordError(err.response?.data?.message || 'Failed to update password.');
    } finally {
      setIsUpdatingPassword(false);
    }
  };

  // Calculate Password Strength (0 to 4)
  const passwordStrength = useMemo(() => {
    const pwd = passwordForm.newPassword;
    if (!pwd) return 0;
    let score = 0;
    if (pwd.length >= 6) score++;
    if (pwd.length >= 10) score++;
    if (/[A-Z]/.test(pwd) && /[a-z]/.test(pwd)) score++;
    if (/[0-9]/.test(pwd) && /[^A-Za-z0-9]/.test(pwd)) score++;
    return score;
  }, [passwordForm.newPassword]);

  const strengthLabels = ['Too weak', 'Weak', 'Fair', 'Strong', 'Very strong'];
  const strengthColors = ['#D9534F', '#F0AD4E', '#5BC0DE', '#5CB85C', '#2E7D32'];

  // Handle Avatar Upload
  const handleAvatarFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert('Please select a valid image file (JPEG, PNG, WEBP).');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      alert('Avatar image file size must be less than 5MB.');
      return;
    }

    try {
      setIsUploadingAvatar(true);
      const formData = new FormData();
      formData.append('avatar', file);

      const res = await adminApi.uploadAvatar(formData);
      const newAvatarUrl = res.data?.avatarUrl;
      setAdminData((prev) => ({ ...prev, avatar: newAvatarUrl }));
      if (setAuthUser) {
        setAuthUser((prev) => ({ ...prev, avatar: newAvatarUrl }));
      }
      setToast({ message: 'Avatar image updated successfully.', type: 'success' });
    } catch (err) {
      console.error('Avatar upload failed:', err);
      alert(err.response?.data?.message || 'Failed to upload avatar image.');
    } finally {
      setIsUploadingAvatar(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleRemoveAvatar = async () => {
    if (!window.confirm('Are you sure you want to remove your profile avatar?')) return;
    try {
      setIsUploadingAvatar(true);
      await adminApi.deleteAvatar();
      setAdminData((prev) => ({ ...prev, avatar: null }));
      if (setAuthUser) {
        setAuthUser((prev) => ({ ...prev, avatar: null }));
      }
      setToast({ message: 'Avatar removed.', type: 'success' });
    } catch (err) {
      console.error('Failed to remove avatar:', err);
      alert(err.response?.data?.message || 'Failed to remove avatar.');
    } finally {
      setIsUploadingAvatar(false);
    }
  };

  // Revoke session
  const handleRevokeSession = async (sessionId) => {
    try {
      await adminApi.revokeSession(sessionId);
      setSessions((prev) => prev.filter((s) => s.id !== sessionId));
      setToast({ message: 'Session revoked.', type: 'success' });
    } catch (err) {
      console.error('Failed to revoke session:', err);
      alert('Failed to revoke session.');
    }
  };

  const handleSignOutOtherSessions = async () => {
    if (!window.confirm('Sign out all other active devices and sessions?')) return;
    try {
      await adminApi.revokeSession('all');
      setSessions((prev) => prev.filter((s) => s.isCurrent));
      setToast({ message: 'All other sessions have been signed out.', type: 'success' });
    } catch (err) {
      console.error('Failed to sign out other sessions:', err);
      alert('Failed to sign out other sessions.');
    }
  };

  // Fallback initials
  const initials = useMemo(() => {
    if (!adminData) return 'A';
    const first = adminData.firstName || adminData.name?.split(' ')[0] || '';
    const last = adminData.lastName || adminData.name?.split(' ')[1] || '';
    return ((first[0] || '') + (last[0] || '')).toUpperCase() || 'AD';
  }, [adminData]);

  if (isLoading) {
    return (
      <div className="admin-profile-container">
        <div className="admin-profile-skeleton-header" />
        <div className="admin-profile-skeleton-body">
          <div className="admin-profile-skeleton-sidebar" />
          <div className="admin-profile-skeleton-content" />
        </div>
      </div>
    );
  }

  if (errorMessage) {
    return (
      <div className="admin-profile-error-card">
        <AdminIcon name="warning" size={32} />
        <h2>Failed to load profile</h2>
        <p>{errorMessage}</p>
        <button type="button" className="admin-profile-save-btn" onClick={fetchProfile}>
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="admin-profile-container">
      {/* Toast Notification */}
      {toast && (
        <div className={`admin-profile-toast ${toast.type}`}>
          <AdminIcon name="check" size={16} />
          <span>{toast.message}</span>
          <button type="button" onClick={() => setToast(null)}><AdminIcon name="x" size={14} /></button>
        </div>
      )}

      {/* Top Header Card */}
      <section className="admin-profile-header-card">
        <div className="admin-profile-avatar-wrap">
          <div className="admin-profile-avatar-large">
            {adminData?.avatar ? (
              <img src={adminData.avatar} alt={adminData.displayName || adminData.name} />
            ) : (
              <span className="admin-profile-avatar-initials">{initials}</span>
            )}
            {isUploadingAvatar && <div className="admin-profile-avatar-overlay">Uploading...</div>}
          </div>

          <div className="admin-profile-avatar-actions">
            <input
              type="file"
              ref={fileInputRef}
              accept="image/jpeg,image/png,image/webp"
              style={{ display: 'none' }}
              onChange={handleAvatarFileChange}
            />
            <button
              type="button"
              className="admin-profile-avatar-btn"
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploadingAvatar}
            >
              <AdminIcon name="pencil" size={13} /> Change photo
            </button>
            {adminData?.avatar && (
              <button
                type="button"
                className="admin-profile-avatar-btn is-danger"
                onClick={handleRemoveAvatar}
                disabled={isUploadingAvatar}
              >
                <AdminIcon name="trash" size={13} /> Remove
              </button>
            )}
          </div>
        </div>

        <div className="admin-profile-header-info">
          <div className="admin-profile-name-row">
            <h1 className="admin-profile-page-title">{adminData?.displayName || adminData?.name}</h1>
            <span className="admin-profile-role-badge">{adminData?.roleLabel || 'Administrator'}</span>
            <span className="admin-profile-status-badge is-active">Active</span>
          </div>

          <div className="admin-profile-meta-row">
            <span>
              <strong>Email:</strong> {adminData?.email}
            </span>
            <i>•</i>
            <span>
              <strong>Job title:</strong> {adminData?.jobTitle || 'Administrator'}
            </span>
            <i>•</i>
            <span>
              <strong>Member since:</strong> {adminData?.createdAt ? formatDate(adminData.createdAt) : '2024'}
            </span>
          </div>

          <div className="admin-profile-device-summary">
            <AdminIcon name="lock" size={13} />
            <span>
              Last active on <strong>{adminData?.lastLoginDevice || 'Desktop (Chrome)'}</strong> from IP {adminData?.lastLoginIp || '197.156.103.xxx'}
            </span>
          </div>
        </div>
      </section>

      {/* Main Two-Column Layout */}
      <div className="admin-profile-layout">
        {/* Left Navigation Sidebar */}
        <aside className="admin-profile-sidebar" aria-label="Profile navigation">
          <div className="admin-profile-nav-card">
            <button
              type="button"
              className={`admin-profile-nav-item ${activeTab === 'overview' ? 'is-active' : ''}`}
              onClick={() => setActiveTab('overview')}
            >
              <AdminIcon name="user" size={16} />
              <span>Personal info</span>
            </button>

            <button
              type="button"
              className={`admin-profile-nav-item ${activeTab === 'security' ? 'is-active' : ''}`}
              onClick={() => setActiveTab('security')}
            >
              <AdminIcon name="lock" size={16} />
              <span>Security & sessions</span>
            </button>

            <button
              type="button"
              className={`admin-profile-nav-item ${activeTab === 'notifications' ? 'is-active' : ''}`}
              onClick={() => setActiveTab('notifications')}
            >
              <AdminIcon name="receipt" size={16} />
              <span>Notification preferences</span>
            </button>

            <button
              type="button"
              className={`admin-profile-nav-item ${activeTab === 'activity' ? 'is-active' : ''}`}
              onClick={() => setActiveTab('activity')}
            >
              <AdminIcon name="dashboard" size={16} />
              <span>Audit activity</span>
            </button>

            <button
              type="button"
              className={`admin-profile-nav-item ${activeTab === 'permissions' ? 'is-active' : ''}`}
              onClick={() => setActiveTab('permissions')}
            >
              <AdminIcon name="code" size={16} />
              <span>Role permissions</span>
            </button>
          </div>
        </aside>

        {/* Right Content Column */}
        <main className="admin-profile-content">
          {/* ==================================================== */}
          {/* TAB 1: PERSONAL INFORMATION */}
          {/* ==================================================== */}
          {activeTab === 'overview' && (
            <div className="admin-profile-section-card">
              <div className="admin-profile-card-header">
                <div>
                  <h2 className="admin-profile-section-title">Personal Information</h2>
                  <p className="admin-profile-section-desc">Manage your public display name, contact phone, and regional preferences.</p>
                </div>
                <div className="admin-profile-actions-bar">
                  <button
                    type="button"
                    className="admin-profile-discard-btn"
                    onClick={handleDiscardPersonal}
                    disabled={!isPersonalDirty || isSaving}
                  >
                    Discard
                  </button>
                  <button
                    type="button"
                    className="admin-profile-save-btn"
                    onClick={handleSavePersonal}
                    disabled={!isPersonalDirty || isSaving}
                  >
                    {isSaving ? 'Saving...' : 'Save changes'}
                  </button>
                </div>
              </div>

              <div className="admin-profile-form-grid">
                <div className="admin-profile-form-group">
                  <label htmlFor="pf-firstname">First name</label>
                  <input
                    id="pf-firstname"
                    type="text"
                    value={personalForm.firstName}
                    onChange={(e) => setPersonalForm({ ...personalForm, firstName: e.target.value })}
                    placeholder="e.g. Firaol"
                  />
                </div>

                <div className="admin-profile-form-group">
                  <label htmlFor="pf-lastname">Last name</label>
                  <input
                    id="pf-lastname"
                    type="text"
                    value={personalForm.lastName}
                    onChange={(e) => setPersonalForm({ ...personalForm, lastName: e.target.value })}
                    placeholder="e.g. Siraj"
                  />
                </div>

                <div className="admin-profile-form-group">
                  <label htmlFor="pf-displayname">Display name</label>
                  <input
                    id="pf-displayname"
                    type="text"
                    value={personalForm.displayName}
                    onChange={(e) => setPersonalForm({ ...personalForm, displayName: e.target.value })}
                    placeholder="Public display name in navbar & activity"
                  />
                </div>

                <div className="admin-profile-form-group">
                  <label htmlFor="pf-jobtitle">Job title / Designation</label>
                  <input
                    id="pf-jobtitle"
                    type="text"
                    value={personalForm.jobTitle}
                    onChange={(e) => setPersonalForm({ ...personalForm, jobTitle: e.target.value })}
                    placeholder="e.g. Store Owner / Lead Administrator"
                  />
                </div>

                <div className="admin-profile-form-group">
                  <label htmlFor="pf-phone">Phone number (+251 default)</label>
                  <input
                    id="pf-phone"
                    type="tel"
                    value={personalForm.phone}
                    onChange={(e) => setPersonalForm({ ...personalForm, phone: e.target.value })}
                    placeholder="+251 9XX XXX XXX"
                  />
                </div>

                <div className="admin-profile-form-group">
                  <label htmlFor="pf-language">Language preference</label>
                  <select
                    id="pf-language"
                    value={personalForm.language}
                    onChange={(e) => setPersonalForm({ ...personalForm, language: e.target.value })}
                  >
                    <option value="en">English (US)</option>
                    <option value="am">Amharic (አማርኛ)</option>
                    <option value="om">Afaan Oromoo</option>
                  </select>
                </div>

                <div className="admin-profile-form-group">
                  <label htmlFor="pf-timezone">Time zone</label>
                  <select
                    id="pf-timezone"
                    value={personalForm.timezone}
                    onChange={(e) => setPersonalForm({ ...personalForm, timezone: e.target.value })}
                  >
                    <option value="Africa/Addis_Ababa">Africa/Addis_Ababa (EAT +03:00)</option>
                    <option value="UTC">UTC (+00:00)</option>
                    <option value="America/New_York">America/New_York (EST/EDT)</option>
                    <option value="Europe/London">Europe/London (GMT/BST)</option>
                  </select>
                </div>

                <div className="admin-profile-form-group is-full">
                  <label htmlFor="pf-bio">Bio / Staff notes (optional)</label>
                  <textarea
                    id="pf-bio"
                    rows={3}
                    value={personalForm.bio}
                    onChange={(e) => setPersonalForm({ ...personalForm, bio: e.target.value })}
                    placeholder="Brief background or notes visible to store managers..."
                  />
                </div>

                <div className="admin-profile-form-group is-full admin-profile-email-box">
                  <div className="admin-profile-email-header">
                    <div>
                      <strong>Account Email Address</strong>
                      <p>Changing your email requires your current password and sends security notices.</p>
                    </div>
                  </div>
                  <div className="admin-profile-email-inputs">
                    <input
                      type="email"
                      value={personalForm.email}
                      onChange={(e) => setPersonalForm({ ...personalForm, email: e.target.value })}
                      placeholder="admin@example.com"
                    />
                    {personalForm.email !== initialPersonalForm?.email && (
                      <input
                        type="password"
                        value={personalForm.currentPassword}
                        onChange={(e) => setPersonalForm({ ...personalForm, currentPassword: e.target.value })}
                        placeholder="Current password required"
                      />
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ==================================================== */}
          {/* TAB 2: SECURITY & SESSIONS */}
          {/* ==================================================== */}
          {activeTab === 'security' && (
            <div className="admin-profile-security-wrap">
              {/* Change Password Card */}
              <div className="admin-profile-section-card">
                <div className="admin-profile-card-header">
                  <div>
                    <h2 className="admin-profile-section-title">Change Password</h2>
                    <p className="admin-profile-section-desc">Ensure your account uses a secure password. Changing will revoke other active sessions.</p>
                  </div>
                </div>

                {passwordError && (
                  <div className="admin-profile-alert-danger">
                    <AdminIcon name="warning" size={14} />
                    <span>{passwordError}</span>
                  </div>
                )}

                <form onSubmit={handleUpdatePassword} className="admin-profile-password-form">
                  <div className="admin-profile-form-group">
                    <label htmlFor="sec-current">Current password</label>
                    <input
                      id="sec-current"
                      type="password"
                      value={passwordForm.currentPassword}
                      onChange={(e) => setPasswordForm({ ...passwordForm, currentPassword: e.target.value })}
                      placeholder="Enter current password"
                    />
                  </div>

                  <div className="admin-profile-form-group">
                    <label htmlFor="sec-new">New password (minimum 6 characters)</label>
                    <input
                      id="sec-new"
                      type="password"
                      value={passwordForm.newPassword}
                      onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
                      placeholder="Enter new strong password"
                    />
                    {passwordForm.newPassword && (
                      <div className="admin-profile-strength-meter">
                        <div className="admin-profile-strength-bars">
                          {[1, 2, 3, 4].map((level) => (
                            <div
                              key={level}
                              className="admin-profile-strength-bar"
                              style={{
                                backgroundColor: level <= passwordStrength ? strengthColors[passwordStrength] : '#E5E7EB',
                              }}
                            />
                          ))}
                        </div>
                        <span style={{ color: strengthColors[passwordStrength] }}>
                          {strengthLabels[passwordStrength]}
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="admin-profile-form-group">
                    <label htmlFor="sec-confirm">Confirm new password</label>
                    <input
                      id="sec-confirm"
                      type="password"
                      value={passwordForm.confirmPassword}
                      onChange={(e) => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })}
                      placeholder="Re-type new password"
                    />
                  </div>

                  <div className="admin-profile-password-actions">
                    <button
                      type="submit"
                      className="admin-profile-save-btn"
                      disabled={isUpdatingPassword || !passwordForm.currentPassword || !passwordForm.newPassword}
                    >
                      {isUpdatingPassword ? 'Updating...' : 'Update password'}
                    </button>
                  </div>
                </form>
              </div>

              {/* Active Sessions Card */}
              <div className="admin-profile-section-card">
                <div className="admin-profile-card-header">
                  <div>
                    <h2 className="admin-profile-section-title">Active Devices & Sessions</h2>
                    <p className="admin-profile-section-desc">Manage devices currently logged in to your NovaShop administrator account.</p>
                  </div>
                  {sessions.length > 1 && (
                    <button
                      type="button"
                      className="admin-profile-signout-all-btn"
                      onClick={handleSignOutOtherSessions}
                    >
                      Sign out other sessions
                    </button>
                  )}
                </div>

                {isLoadingSessions ? (
                  <div className="admin-profile-loading-state">Loading active sessions...</div>
                ) : sessions.length === 0 ? (
                  <div className="admin-profile-empty-state">No other active sessions recorded.</div>
                ) : (
                  <div className="admin-profile-sessions-list">
                    {sessions.map((s) => (
                      <div key={s.id} className={`admin-profile-session-item ${s.isCurrent ? 'is-current' : ''}`}>
                        <div className="admin-profile-session-icon">
                          <AdminIcon name="lock" size={18} />
                        </div>
                        <div className="admin-profile-session-info">
                          <div className="admin-profile-session-title">
                            <strong>{s.device || 'Desktop Browser'}</strong>
                            {s.isCurrent && <span className="admin-profile-current-pill">Current Session</span>}
                          </div>
                          <div className="admin-profile-session-meta">
                            <span>{s.browser}</span>
                            <i>•</i>
                            <span>IP {s.ip}</span>
                            <i>•</i>
                            <span>Last active: {formatDate(s.lastActive)}</span>
                          </div>
                        </div>
                        {!s.isCurrent && (
                          <button
                            type="button"
                            className="admin-profile-revoke-btn"
                            onClick={() => handleRevokeSession(s.id)}
                          >
                            Revoke
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Two-Factor Authentication Status Card */}
              <div className="admin-profile-section-card admin-profile-totp-card">
                <div className="admin-profile-card-header">
                  <div>
                    <h2 className="admin-profile-section-title">Two-Factor Authentication (2FA)</h2>
                    <p className="admin-profile-section-desc">Protect your administrator access using TOTP authenticator apps (Google Authenticator, 1Password).</p>
                  </div>
                  <span className="admin-profile-badge-planned">Scheduled for Next Release</span>
                </div>
                <div className="admin-profile-totp-info">
                  <p>
                    Hardware security keys (WebAuthn) and TOTP authenticator codes will be enabled in the upcoming NovaShop security release. Your account is currently safeguarded by encrypted token rotation, IP tracking, and automatic session revocation upon password updates.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* ==================================================== */}
          {/* TAB 3: NOTIFICATION PREFERENCES */}
          {/* ==================================================== */}
          {activeTab === 'notifications' && (
            <div className="admin-profile-section-card">
              <div className="admin-profile-card-header">
                <div>
                  <h2 className="admin-profile-section-title">Personal Notification Preferences</h2>
                  <p className="admin-profile-section-desc">Customize how you receive real-time admin alerts for key store operations.</p>
                </div>
                <div className="admin-profile-actions-bar">
                  <button
                    type="button"
                    className="admin-profile-discard-btn"
                    onClick={handleDiscardNotifications}
                    disabled={!isNotifDirty || isSaving}
                  >
                    Discard
                  </button>
                  <button
                    type="button"
                    className="admin-profile-save-btn"
                    onClick={handleSaveNotifications}
                    disabled={!isNotifDirty || isSaving}
                  >
                    {isSaving ? 'Saving...' : 'Save preferences'}
                  </button>
                </div>
              </div>

              <div className="admin-profile-precedence-notice">
                <AdminIcon name="receipt" size={16} />
                <p>
                  <strong>Precedence Rule:</strong> Store-wide alert triggers are configured globally in{' '}
                  <span
                    style={{ textDecoration: 'underline', cursor: 'pointer' }}
                    onClick={() => go && go('/admin/settings/notifications')}
                  >
                    Settings &gt; Notifications
                  </span>
                  . Your personal preferences below control your individual channels (Email and In-App bell dropdown) without overriding other staff members.
                </p>
              </div>

              <div className="admin-profile-notif-table">
                <div className="admin-profile-notif-row header">
                  <div className="notif-event-col">Event Trigger</div>
                  <div className="notif-toggle-col">Email</div>
                  <div className="notif-toggle-col">In-App Bell</div>
                </div>

                {/* Orders */}
                <div className="admin-profile-notif-row">
                  <div className="notif-event-col">
                    <strong>New Paid Orders</strong>
                    <p>Alerts when an order payment is successfully verified and ready for fulfillment.</p>
                  </div>
                  <div className="notif-toggle-col">
                    <input
                      type="checkbox"
                      checked={notifPrefs.orders?.email ?? true}
                      onChange={(e) =>
                        setNotifPrefs({
                          ...notifPrefs,
                          orders: { ...notifPrefs.orders, email: e.target.checked },
                        })
                      }
                    />
                  </div>
                  <div className="notif-toggle-col">
                    <input
                      type="checkbox"
                      checked={notifPrefs.orders?.inApp ?? true}
                      onChange={(e) =>
                        setNotifPrefs({
                          ...notifPrefs,
                          orders: { ...notifPrefs.orders, inApp: e.target.checked },
                        })
                      }
                    />
                  </div>
                </div>

                {/* Returns */}
                <div className="admin-profile-notif-row">
                  <div className="notif-event-col">
                    <strong>Return & Refund Requests</strong>
                    <p>Alerts when a customer submits an RMA return request requiring staff review.</p>
                  </div>
                  <div className="notif-toggle-col">
                    <input
                      type="checkbox"
                      checked={notifPrefs.returns?.email ?? true}
                      onChange={(e) =>
                        setNotifPrefs({
                          ...notifPrefs,
                          returns: { ...notifPrefs.returns, email: e.target.checked },
                        })
                      }
                    />
                  </div>
                  <div className="notif-toggle-col">
                    <input
                      type="checkbox"
                      checked={notifPrefs.returns?.inApp ?? false}
                      onChange={(e) =>
                        setNotifPrefs({
                          ...notifPrefs,
                          returns: { ...notifPrefs.returns, inApp: e.target.checked },
                        })
                      }
                    />
                  </div>
                </div>

                {/* Inventory */}
                <div className="admin-profile-notif-row">
                  <div className="notif-event-col">
                    <strong>Inventory & Low Stock Alerts</strong>
                    <p>Triggered when product variants reach or drop below their reorder threshold.</p>
                  </div>
                  <div className="notif-toggle-col">
                    <input
                      type="checkbox"
                      checked={notifPrefs.inventory?.email ?? true}
                      onChange={(e) =>
                        setNotifPrefs({
                          ...notifPrefs,
                          inventory: { ...notifPrefs.inventory, email: e.target.checked },
                        })
                      }
                    />
                  </div>
                  <div className="notif-toggle-col">
                    <input
                      type="checkbox"
                      checked={notifPrefs.inventory?.inApp ?? true}
                      onChange={(e) =>
                        setNotifPrefs({
                          ...notifPrefs,
                          inventory: { ...notifPrefs.inventory, inApp: e.target.checked },
                        })
                      }
                    />
                  </div>
                </div>

                {/* Customer Accounts */}
                <div className="admin-profile-notif-row">
                  <div className="notif-event-col">
                    <strong>New Customer Registrations</strong>
                    <p>Notifies when a new customer registers a storefront account.</p>
                  </div>
                  <div className="notif-toggle-col">
                    <input
                      type="checkbox"
                      checked={notifPrefs.customerAccounts?.email ?? false}
                      onChange={(e) =>
                        setNotifPrefs({
                          ...notifPrefs,
                          customerAccounts: { ...notifPrefs.customerAccounts, email: e.target.checked },
                        })
                      }
                    />
                  </div>
                  <div className="notif-toggle-col">
                    <input
                      type="checkbox"
                      checked={notifPrefs.customerAccounts?.inApp ?? true}
                      onChange={(e) =>
                        setNotifPrefs({
                          ...notifPrefs,
                          customerAccounts: { ...notifPrefs.customerAccounts, inApp: e.target.checked },
                        })
                      }
                    />
                  </div>
                </div>

                {/* Payment Failures */}
                <div className="admin-profile-notif-row">
                  <div className="notif-event-col">
                    <strong>Payment Failures & Gateway Errors</strong>
                    <p>Immediate alert when an online checkout payment encounters an error.</p>
                  </div>
                  <div className="notif-toggle-col">
                    <input
                      type="checkbox"
                      checked={notifPrefs.paymentDisputes?.email ?? true}
                      onChange={(e) =>
                        setNotifPrefs({
                          ...notifPrefs,
                          paymentDisputes: { ...notifPrefs.paymentDisputes, email: e.target.checked },
                        })
                      }
                    />
                  </div>
                  <div className="notif-toggle-col">
                    <input
                      type="checkbox"
                      checked={notifPrefs.paymentDisputes?.inApp ?? true}
                      onChange={(e) =>
                        setNotifPrefs({
                          ...notifPrefs,
                          paymentDisputes: { ...notifPrefs.paymentDisputes, inApp: e.target.checked },
                        })
                      }
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ==================================================== */}
          {/* TAB 4: AUDIT ACTIVITY */}
          {/* ==================================================== */}
          {activeTab === 'activity' && (
            <div className="admin-profile-section-card">
              <div className="admin-profile-card-header">
                <div>
                  <h2 className="admin-profile-section-title">Recent Admin Activity</h2>
                  <p className="admin-profile-section-desc">Audit trail of configuration updates and administrative actions performed by your account.</p>
                </div>
                <button
                  type="button"
                  className="admin-profile-refresh-btn"
                  onClick={() => loadActivity(activityPage)}
                  disabled={isLoadingActivity}
                >
                  Refresh
                </button>
              </div>

              {isLoadingActivity ? (
                <div className="admin-profile-loading-state">Loading activity audit log...</div>
              ) : activityLogs.length === 0 ? (
                <div className="admin-profile-empty-state">No recent activity recorded for this account.</div>
              ) : (
                <div className="admin-profile-activity-list">
                  {activityLogs.map((log) => (
                    <div key={log.id} className="admin-profile-activity-item">
                      <div className="admin-profile-activity-left">
                        <span className="admin-profile-activity-badge">{log.section || 'General'}</span>
                        <div className="admin-profile-activity-text">
                          <strong>{log.action?.replace(/_/g, ' ')}</strong>
                          <span className="admin-profile-activity-sub">IP: {log.ipAddress || 'Internal'}</span>
                        </div>
                      </div>
                      <div className="admin-profile-activity-right">
                        <span className="admin-profile-activity-time">{formatDate(log.createdAt)}</span>
                      </div>
                    </div>
                  ))}

                  {activityTotalPages > 1 && (
                    <div className="admin-profile-pagination">
                      <button
                        type="button"
                        disabled={activityPage <= 1}
                        onClick={() => loadActivity(activityPage - 1)}
                      >
                        Previous
                      </button>
                      <span>
                        Page {activityPage} of {activityTotalPages}
                      </span>
                      <button
                        type="button"
                        disabled={activityPage >= activityTotalPages}
                        onClick={() => loadActivity(activityPage + 1)}
                      >
                        Next
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ==================================================== */}
          {/* TAB 5: ROLE PERMISSIONS */}
          {/* ==================================================== */}
          {activeTab === 'permissions' && (
            <div className="admin-profile-section-card">
              <div className="admin-profile-card-header">
                <div>
                  <h2 className="admin-profile-section-title">Assigned Role & Permissions</h2>
                  <p className="admin-profile-section-desc">Summary of module permissions granted to your {adminData?.roleLabel || 'Administrator'} account.</p>
                </div>
                <span className="admin-profile-role-badge">{adminData?.roleLabel || 'Administrator'}</span>
              </div>

              <div className="admin-profile-permissions-notice">
                <AdminIcon name="lock" size={16} />
                <span>
                  Permissions are managed globally by the store owner and cannot be altered from your personal profile.
                </span>
              </div>

              <div className="admin-profile-permissions-grid">
                <div className="admin-profile-perm-card">
                  <div className="admin-profile-perm-header">
                    <strong>Dashboard & Analytics</strong>
                    <span className="admin-profile-perm-status is-allowed">Allowed</span>
                  </div>
                  <p>View net revenue, sales velocity charts, KPIs, and export financial summaries.</p>
                </div>

                <div className="admin-profile-perm-card">
                  <div className="admin-profile-perm-header">
                    <strong>Catalog & Products</strong>
                    <span className="admin-profile-perm-status is-allowed">Allowed</span>
                  </div>
                  <p>Create products, edit descriptions, adjust variant inventory, and organize categories.</p>
                </div>

                <div className="admin-profile-perm-card">
                  <div className="admin-profile-perm-header">
                    <strong>Orders & Fulfillment</strong>
                    <span className="admin-profile-perm-status is-allowed">Allowed</span>
                  </div>
                  <p>Inspect customer orders, dispatch packages, print packing slips, and process returns.</p>
                </div>

                <div className="admin-profile-perm-card">
                  <div className="admin-profile-perm-header">
                    <strong>Customer Support</strong>
                    <span className="admin-profile-perm-status is-allowed">Allowed</span>
                  </div>
                  <p>Manage support tickets, converse with customers, resolve issues, and add internal notes.</p>
                </div>

                <div className="admin-profile-perm-card">
                  <div className="admin-profile-perm-header">
                    <strong>Discounts & Marketing</strong>
                    <span className="admin-profile-perm-status is-allowed">Allowed</span>
                  </div>
                  <p>Create coupon codes, promotional campaigns, and configure automatic cart discounts.</p>
                </div>

                <div className="admin-profile-perm-card">
                  <div className="admin-profile-perm-header">
                    <strong>Store Settings & Team</strong>
                    <span
                      className={`admin-profile-perm-status ${
                        adminData?.adminRole === 'owner' || adminData?.adminRole === 'admin' ? 'is-allowed' : 'is-restricted'
                      }`}
                    >
                      {adminData?.adminRole === 'owner' || adminData?.adminRole === 'admin' ? 'Allowed' : 'Restricted'}
                    </span>
                  </div>
                  <p>Modify legal business settings, manage team invites, and configure payment gateways.</p>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
