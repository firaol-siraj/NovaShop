import { authApi } from './api/authApi';
import { productApi } from './api/productApi';
import { orderApi } from './api/orderApi';
import apiClient from './api/client';
import {
  clearAccessToken,
  setAccessToken,
  setCustomerToken,
  clearCustomerToken,
  setAdminToken,
  clearAdminToken,
} from './api/tokenManager';
import { normalizeCatalog } from './catalog';

export const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api/v1';

export async function getCatalog(params = { pageSize: 100 }) {
  try {
    const payload = await productApi.getProducts(params);
    return normalizeCatalog(payload.data || []);
  } catch (error) {
    throw new Error('Unable to load the NovaShop catalog.', { cause: error });
  }
}

export async function signIn(credentials, { admin = false, rememberMe = false } = {}) {
  const dataToSubmit = { ...credentials, rememberMe };
  try {
    const result = admin
      ? await authApi.adminLogin(dataToSubmit)
      : await authApi.login(dataToSubmit);
    if (result.accessToken) {
      if (admin) {
        setAdminToken(result.accessToken, result.data);
      } else {
        setCustomerToken(result.accessToken, result.data);
      }
    }
    return result;
  } catch (error) {
    // Preserve expected backward compatibility error throw
    throw new Error('Request failed', { cause: error });
  }
}

export async function signUp(credentials) {
  try {
    const result = await authApi.register(credentials);
    if (result.accessToken) setCustomerToken(result.accessToken, result.data);
    return result;
  } catch (error) {
    throw new Error('Request failed', { cause: error });
  }
}

export async function getCurrentUser() {
  try {
    return await authApi.getMe();
  } catch (error) {
    throw new Error('Request failed', { cause: error });
  }
}

export async function requestPasswordReset(email) {
  try {
    return await authApi.forgotPassword({ email });
  } catch (error) {
    throw new Error('Request failed', { cause: error });
  }
}

export async function resetPassword(token, password) {
  try {
    return await authApi.resetPassword(token, { password });
  } catch (error) {
    throw new Error('Request failed', { cause: error });
  }
}

export async function signOut(role = 'customer') {
  try {
    if (role === 'admin') {
      await authApi.adminLogout();
    } else {
      await authApi.logout();
    }
  } catch {
    // The client token is cleared regardless of the server response.
  } finally {
    if (role === 'admin') {
      clearAdminToken();
    } else {
      clearCustomerToken();
    }
  }
}

export function submitOrder(order) {
  return orderApi.createOrder(order);
}

// Ensure backward compatibility export
export { apiClient, setAccessToken, clearAccessToken };
