import { useState, useEffect, useCallback } from 'react';
import adminApi from '../lib/api/adminApi';

/**
 * Hook for managing paginated admin products with debounced search and filters.
 */
export function useAdminProducts(initialParams = {}) {
  const [products, setProducts] = useState([]);
  const [pagination, setPagination] = useState({ total: 0, page: 1, limit: 10, totalPages: 1 });
  const [stats, setStats] = useState({ totalProducts: 0, activeProducts: 0, lowStockProducts: 0, outOfStockProducts: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [params, setParams] = useState(initialParams);

  const fetchProducts = useCallback(async (currentParams = params) => {
    setLoading(true);
    setError('');
    try {
      const res = await adminApi.getProducts(currentParams);
      if (res.data) {
        setProducts(res.data);
        if (res.pagination) setPagination(res.pagination);
        if (res.stats) setStats(res.stats);
      }
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Failed to load products');
    } finally {
      setLoading(false);
    }
  }, [params]);

  useEffect(() => {
    fetchProducts(params);
  }, [fetchProducts, params]);

  return {
    products,
    pagination,
    stats,
    loading,
    error,
    params,
    setParams,
    refetch: () => fetchProducts(params),
  };
}

/**
 * Hook for managing admin categories with real product counts.
 */
export function useAdminCategories() {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchCategories = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await adminApi.getCategories();
      if (Array.isArray(res.data)) {
        setCategories(res.data);
      }
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Failed to load categories');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  return {
    categories,
    loading,
    error,
    refetch: fetchCategories,
  };
}

/**
 * Hook for managing paginated customer directory.
 */
export function useAdminCustomers(initialParams = {}) {
  const [customers, setCustomers] = useState([]);
  const [pagination, setPagination] = useState({ total: 0, page: 1, limit: 10, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [params, setParams] = useState(initialParams);

  const fetchCustomers = useCallback(async (currentParams = params) => {
    setLoading(true);
    setError('');
    try {
      const res = await adminApi.getCustomers(currentParams);
      if (res.data) {
        setCustomers(res.data);
        if (res.pagination) setPagination(res.pagination);
      }
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Failed to load customers');
    } finally {
      setLoading(false);
    }
  }, [params]);

  useEffect(() => {
    fetchCustomers(params);
  }, [fetchCustomers, params]);

  return {
    customers,
    pagination,
    loading,
    error,
    params,
    setParams,
    refetch: () => fetchCustomers(params),
  };
}

/**
 * Hook for managing variant-level inventory and low-stock engine.
 */
export function useAdminInventory(initialParams = {}) {
  const [variants, setVariants] = useState([]);
  const [pagination, setPagination] = useState({ total: 0, page: 1, limit: 10, totalPages: 1 });
  const [stats, setStats] = useState({
    totalUnits: 0,
    totalValue: 0,
    lowStockCount: 0,
    criticalCount: 0,
    outOfStockCount: 0,
    globalThreshold: 5,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [params, setParams] = useState(initialParams);

  const fetchInventory = useCallback(async (currentParams = params) => {
    setLoading(true);
    setError('');
    try {
      const res = await adminApi.getInventory(currentParams);
      if (res.data) {
        setVariants(res.data);
        if (res.pagination) setPagination(res.pagination);
        if (res.stats) setStats(res.stats);
      }
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Failed to load inventory');
    } finally {
      setLoading(false);
    }
  }, [params]);

  useEffect(() => {
    fetchInventory(params);
  }, [fetchInventory, params]);

  return {
    variants,
    pagination,
    stats,
    loading,
    error,
    params,
    setParams,
    refetch: () => fetchInventory(params),
  };
}
