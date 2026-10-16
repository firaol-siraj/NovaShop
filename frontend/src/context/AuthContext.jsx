/* eslint-disable react-refresh/only-export-components, react-hooks/set-state-in-effect */
import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { authApi } from '../lib/api/authApi';
import { clearAccessToken, setAccessToken } from '../lib/api/tokenManager';

const AuthContext = createContext();

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const loadUser = useCallback(async () => {
    setIsLoading(true);
    try {
      const refreshResult = await authApi.refreshToken();
      if (refreshResult?.accessToken) {
        setAccessToken(refreshResult.accessToken);
      }
      const res = await authApi.getMe();
      if (res.success && res.data) {
        setUser(res.data);
        setIsAuthenticated(true);
      } else {
        setUser(null);
        setIsAuthenticated(false);
      }
    } catch {
      clearAccessToken();
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

  const login = async (credentials, isAdmin = false) => {
    const res = isAdmin
      ? await authApi.adminLogin(credentials)
      : await authApi.login(credentials);

    if (!res.success || !res.accessToken) {
      throw new Error('Invalid response');
    }

    setAccessToken(res.accessToken);
    let authenticatedUser = res.data;
    if (isAdmin) {
      try {
        const profile = await authApi.getMe();
        authenticatedUser = profile.data;
        if (authenticatedUser?.role !== 'admin') {
          throw new Error('Admin access is required.');
        }
      } catch (error) {
        clearAccessToken();
        await authApi.logout().catch(() => {});
        throw error;
      }
    }
    setUser(authenticatedUser);
    setIsAuthenticated(true);
    window.dispatchEvent(new Event('novashop:user-updated'));
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

    setAccessToken(res.accessToken);
    setUser(res.data);
    setIsAuthenticated(true);
    window.dispatchEvent(new Event('novashop:user-updated'));
    return res;
  };

  const logout = async () => {
    try {
      await authApi.logout();
    } catch (error) {
      console.warn('Logout server request failed:', error);
    } finally {
      clearAccessToken();
      setUser(null);
      setIsAuthenticated(false);
      window.dispatchEvent(new Event('novashop:user-updated'));
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
