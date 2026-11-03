/* eslint-disable react-refresh/only-export-components, react-hooks/set-state-in-effect */
import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { authApi } from '../lib/api/authApi';
import { clearAdminToken, setAdminToken } from '../lib/api/tokenManager';

const AdminAuthContext = createContext();

export const useAdminAuth = () => {
  const context = useContext(AdminAuthContext);
  if (!context) {
    throw new Error('useAdminAuth must be used within an AdminAuthProvider');
  }
  return context;
};

const ADMIN_SESSION_KEY = 'nova_admin_session';

const readSavedAdminUser = () => {
  try {
    const raw = localStorage.getItem(ADMIN_SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed?.user || null;
  } catch {
    return null;
  }
};

export const AdminAuthProvider = ({ children }) => {
  const [adminUser, setAdminUser] = useState(() => readSavedAdminUser());
  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState(() => Boolean(readSavedAdminUser()));
  const [isLoading, setIsLoading] = useState(true);

  const loadAdmin = useCallback(async () => {
    setIsLoading(true);
    try {
      const refreshResult = await authApi.adminRefreshToken();
      if (refreshResult?.accessToken) {
        setAdminToken(refreshResult.accessToken);
      }
      const res = await authApi.getMe('admin');
      if (res.success && res.data && res.data.role === 'admin') {
        setAdminUser(res.data);
        setIsAdminAuthenticated(true);
        setAdminToken(refreshResult?.accessToken, res.data);
      } else {
        clearAdminToken();
        setAdminUser(null);
        setIsAdminAuthenticated(false);
      }
    } catch {
      clearAdminToken();
      setAdminUser(null);
      setIsAdminAuthenticated(false);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadAdmin();

    const handleUpdate = () => loadAdmin();
    const handleExpired = () => {
      clearAdminToken();
      setAdminUser(null);
      setIsAdminAuthenticated(false);
      setIsLoading(false);
    };

    window.addEventListener('novashop:admin-updated', handleUpdate);
    window.addEventListener('novashop:admin-auth-expired', handleExpired);
    return () => {
      window.removeEventListener('novashop:admin-updated', handleUpdate);
      window.removeEventListener('novashop:admin-auth-expired', handleExpired);
    };
  }, [loadAdmin]);

  const login = async (credentials) => {
    const res = await authApi.adminLogin(credentials);

    if (!res.success || !res.accessToken) {
      throw new Error('Invalid response from server');
    }

    if (res.data?.role !== 'admin') {
      clearAdminToken();
      await authApi.adminLogout().catch(() => {});
      throw new Error('Admin privileges are required to access this portal.');
    }

    setAdminToken(res.accessToken, res.data);
    setAdminUser(res.data);
    setIsAdminAuthenticated(true);
    window.dispatchEvent(new Event('novashop:admin-updated'));
    return res;
  };

  const logout = async () => {
    try {
      await authApi.adminLogout();
    } catch (error) {
      console.warn('Admin logout server request failed:', error);
    } finally {
      clearAdminToken();
      setAdminUser(null);
      setIsAdminAuthenticated(false);
      setIsLoading(false);
      try {
        localStorage.removeItem(ADMIN_SESSION_KEY);
      } catch {
        // ignore
      }
      window.dispatchEvent(new Event('novashop:admin-auth-expired'));
    }
  };

  const refreshSession = () => loadAdmin();

  const value = {
    adminUser,
    user: adminUser,
    isAdminAuthenticated,
    isAuthenticated: isAdminAuthenticated,
    isLoading,
    login,
    logout,
    refreshSession,
  };

  return <AdminAuthContext.Provider value={value}>{children}</AdminAuthContext.Provider>;
};
