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

export const AdminAuthProvider = ({ children }) => {
  // Always begin with unauthenticated state; never treat local cached info as proof of authentication
  const [adminUser, setAdminUser] = useState(null);
  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const loadAdmin = useCallback(async () => {
    setIsLoading(true);
    try {
      // 1. Attempt admin session restoration strictly using admin refresh cookie
      const refreshResult = await authApi.adminRefreshToken();
      if (!refreshResult?.accessToken) {
        throw new Error('Admin refresh response did not contain an access token');
      }

      // 2. Temporarily set in-memory token to allow getMe verification call
      setAdminToken(refreshResult.accessToken);

      // 3. Fetch authenticated admin profile from server
      const res = await authApi.getMe('admin');

      // 4. Verify returned user and enforce admin role strictly
      if (res.success && res.data && res.data.role === 'admin') {
        setAdminUser(res.data);
        setIsAdminAuthenticated(true);
        setAdminToken(refreshResult.accessToken, res.data);
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

    const handleUpdate = () => {
      void loadAdmin();
    };

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
