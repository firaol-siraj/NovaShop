/* eslint-disable react-refresh/only-export-components, react-hooks/set-state-in-effect */
import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { authApi } from '../lib/api/authApi';
import { clearCustomerToken, setCustomerToken } from '../lib/api/tokenManager';

const AuthContext = createContext();

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
  // Always begin with unauthenticated state; never treat local cached info as proof of authentication
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const loadUser = useCallback(async () => {
    setIsLoading(true);
    try {
      // 1. Attempt customer session restoration using customer refresh cookie
      const refreshResult = await authApi.refreshToken();
      if (!refreshResult?.accessToken) {
        throw new Error('Customer refresh response did not contain an access token');
      }

      // 2. Temporarily set in-memory token to allow getMe verification call
      setCustomerToken(refreshResult.accessToken);

      // 3. Fetch authenticated user profile from server
      const res = await authApi.getMe('customer');

      // 4. Verify returned user and enforce role separation (customer only)
      if (res.success && res.data && res.data.role !== 'admin') {
        setUser(res.data);
        setIsAuthenticated(true);
        setCustomerToken(refreshResult.accessToken, res.data);
      } else {
        clearCustomerToken();
        setUser(null);
        setIsAuthenticated(false);
      }
    } catch {
      clearCustomerToken();
      setUser(null);
      setIsAuthenticated(false);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadUser();

    const handleUpdate = () => {
      void loadUser();
    };

    const handleExpired = () => {
      clearCustomerToken();
      setUser(null);
      setIsAuthenticated(false);
      setIsLoading(false);
    };

    window.addEventListener('novashop:user-updated', handleUpdate);
    window.addEventListener('novashop:auth-expired', handleExpired);
    return () => {
      window.removeEventListener('novashop:user-updated', handleUpdate);
      window.removeEventListener('novashop:auth-expired', handleExpired);
    };
  }, [loadUser]);

  const login = async (credentials) => {
    const res = await authApi.login(credentials);

    if (!res.success || !res.accessToken) {
      throw new Error('Invalid response from server');
    }

    // Role check: customer login portal cannot authenticate administrator sessions
    if (res.data?.role === 'admin') {
      clearCustomerToken();
      await authApi.logout().catch(() => {});
      throw new Error('Administrators must sign in through the administrative portal.');
    }

    setCustomerToken(res.accessToken, res.data);
    setUser(res.data);
    setIsAuthenticated(true);
    return res;
  };

  const register = async (data) => {
    const res = await authApi.register({
      name: `${data.firstName || ''} ${data.lastName || ''}`.trim() || data.name,
      email: data.email,
      password: data.password,
    });

    if (!res.success || !res.accessToken) {
      throw new Error('Invalid response from server');
    }

    setCustomerToken(res.accessToken, res.data);
    setUser(res.data);
    setIsAuthenticated(true);
    return res;
  };

  const logout = async () => {
    try {
      await authApi.logout();
    } catch (error) {
      console.warn('Customer logout server request failed:', error);
    } finally {
      clearCustomerToken();
      setUser(null);
      setIsAuthenticated(false);
      setIsLoading(false);
    }
  };

  const refreshSession = () => loadUser();

  const updateUser = useCallback((nextUser) => {
    setUser(nextUser);
    setIsAuthenticated(Boolean(nextUser));
  }, []);

  const value = {
    user,
    isAuthenticated,
    isLoading,
    login,
    register,
    logout,
    refreshSession,
    updateUser,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
