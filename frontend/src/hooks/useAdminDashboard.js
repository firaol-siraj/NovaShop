/* eslint-disable react-hooks/set-state-in-effect */
import { useState, useEffect, useCallback, useRef } from 'react';
import adminApi from '../lib/api/adminApi';

/**
 * Core resilient async fetcher hook for admin queries.
 * Provides caching, background revalidation, auto-refresh, manual refetch,
 * request cancellation, and error handling.
 */
function useAdminQuery(fetcher, dependencies = [], options = {}) {
  const {
    refreshInterval = 45000, // 45 seconds auto-refresh
    enabled = true,
  } = options;

  const [data, setData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isFetching, setIsFetching] = useState(false);
  const [isError, setIsError] = useState(false);
  const [error, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);

  const fetcherRef = useRef(fetcher);
  useEffect(() => {
    fetcherRef.current = fetcher;
  }, [fetcher]);

  const execute = useCallback(async (isBackground = false) => {
    if (!enabled) return;

    if (!isBackground) {
      setIsLoading((prev) => (data === null ? true : prev));
    }
    setIsFetching(true);
    setIsError(false);

    try {
      const response = await fetcherRef.current();
      const payload = response?.data !== undefined ? response.data : response;
      setData(payload);
      setError(null);
      setIsError(false);
      setLastUpdated(new Date());
    } catch (err) {
      if (err?.code !== 'ERR_CANCELED' && err?.name !== 'CanceledError') {
        setIsError(true);
        setError(err?.message || 'Failed to fetch admin data');
      }
    } finally {
      setIsLoading(false);
      setIsFetching(false);
    }
  }, [enabled, data]);

  // Execute on dependency change
  useEffect(() => {
    if (enabled) {
      void execute(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...dependencies, enabled]);

  // Auto-refresh interval
  useEffect(() => {
    if (!enabled || !refreshInterval || refreshInterval <= 0) return;

    const timer = setInterval(() => {
      if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
        void execute(true);
      }
    }, refreshInterval);

    return () => clearInterval(timer);
  }, [enabled, refreshInterval, execute]);

  const refetch = useCallback(() => execute(false), [execute]);

  return {
    data,
    isLoading,
    isFetching,
    isError,
    error,
    refetch,
    lastUpdated,
  };
}

/**
 * 1. KPI Cards Summary Hook
 */
export function useAdminSummary({ from, to, refreshInterval = 45000, enabled = true } = {}) {
  const fetcher = useCallback(() => adminApi.getSummary({ from, to }), [from, to]);
  return useAdminQuery(fetcher, [from, to], { refreshInterval, enabled });
}

/**
 * 2. Revenue Velocity Chart Hook
 */
export function useAdminRevenue({ from, to, interval = 'day', refreshInterval = 45000, enabled = true } = {}) {
  const fetcher = useCallback(() => adminApi.getRevenue({ from, to, interval }), [from, to, interval]);
  return useAdminQuery(fetcher, [from, to, interval], { refreshInterval, enabled });
}

/**
 * 3. Top Products Hook
 */
export function useAdminTopProducts({ from, to, limit = 4, refreshInterval = 45000, enabled = true } = {}) {
  const fetcher = useCallback(() => adminApi.getTopProducts({ from, to, limit }), [from, to, limit]);
  return useAdminQuery(fetcher, [from, to, limit], { refreshInterval, enabled });
}

/**
 * 4. Inventory Alerts Hook
 */
export function useAdminInventoryAlerts({ threshold, limit = 20, refreshInterval = 45000, enabled = true } = {}) {
  const fetcher = useCallback(() => adminApi.getInventoryAlerts({ threshold, limit }), [threshold, limit]);
  return useAdminQuery(fetcher, [threshold, limit], { refreshInterval, enabled });
}

/**
 * 5. Fulfillment Queue Hook
 */
export function useAdminFulfillmentQueue({ refreshInterval = 45000, enabled = true } = {}) {
  const fetcher = useCallback(() => adminApi.getFulfillmentQueue(), []);
  return useAdminQuery(fetcher, [], { refreshInterval, enabled });
}

/**
 * 6. Recent Orders Table Hook (Server-side Pagination & Filter)
 */
export function useAdminOrders({
  page = 1,
  limit = 6,
  search = '',
  status = 'All Statuses',
  from,
  to,
  refreshInterval = 45000,
  enabled = true,
} = {}) {
  const fetcher = useCallback(
    () =>
      adminApi.getOrders({
        page,
        limit,
        search,
        status: status === 'All Statuses' ? undefined : status,
        from,
        to,
      }),
    [page, limit, search, status, from, to]
  );
  return useAdminQuery(fetcher, [page, limit, search, status, from, to], { refreshInterval, enabled });
}

/**
 * 7. Admin Notifications Hook
 */
export function useAdminNotifications({ refreshInterval = 30000, enabled = true } = {}) {
  const fetcher = useCallback(() => adminApi.getNotifications(), []);
  return useAdminQuery(fetcher, [], { refreshInterval, enabled });
}
