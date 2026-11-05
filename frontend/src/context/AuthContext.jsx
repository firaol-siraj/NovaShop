/* eslint-disable react-refresh/only-export-components, react-hooks/set-state-in-effect */
import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { authApi } from '../lib/api/authApi';
import { clearCustomerToken, setCustomerToken } from '../lib/api/tokenManager';

const AuthContext = createContext();

export const useAuth = () => useContext(AuthContext);

const CUSTOMER_SESSION_KEY = 'nova_customer_session';

const readSavedCustomerUser = () => {
  try {
    const raw = localStorage.getItem(CUSTOMER_SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed?.user || null;
  } catch {
    return null;
  }
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(() => readSavedCustomerUser());
  const [isAuthenticated, setIsAuthenticated] = useState(() => Boolean(readSavedCustomerUser()));
  const [isLoading, setIsLoading] = useState(true);

  const loadUser = useCallback(async () => {
    setIsLoading(true);
    try {
      const refreshResult = await authApi.refreshToken();
      if (refreshResult?.accessToken) {
        setCustomerToken(refreshResult.accessToken);
      }
      const res = await authApi.getMe('customer');
      if (res.success && res.data && res.data.role !== 'admin') {
        setUser(res.data);
        setIsAuthenticated(true);
        setCustomerToken(refreshResult?.accessToken, res.data);
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

    const handleUpdate = () => loadUser();
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
      throw new Error('Invalid response');
    }

    setCustomerToken(res.accessToken, res.data);
    setUser(res.data);
    setIsAuthenticated(true);
    return res;
  };

  const register = async (data) => {
    const res = await authApi.register({
      name: `${data.firstName} ${data.lastName}`.trim(),
      email: data.email,
      password: data.password,
    });

    if (!res.success || !res.accessToken) {
      throw new Error('Invalid response');
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
      try {
        localStorage.removeItem(CUSTOMER_SESSION_KEY);
      } catch {
        // ignore
      }
      window.dispatchEvent(new Event('novashop:auth-expired'));
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
