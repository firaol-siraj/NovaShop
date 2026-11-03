/* eslint-disable react-hooks/set-state-in-effect */
import { useState, useEffect, useCallback, useRef } from 'react';
import adminApi from '../lib/api/adminApi';

/**
 * Core resilient async fetcher hook for Admin Analytics.
 * Handles auto-refresh every 60 seconds, window focus revalidation,
 * error catching with 401/403 admin sign-in redirects, and manual retry.
 */
export function useAnalyticsQuery(fetcher, dependencies = [], options = {}) {
  const {
    refreshInterval = 60000, // 60 seconds
    enabled = true,
    timeoutMs = 10000, // 10s default query timeout
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

  const dataRef = useRef(data);
  useEffect(() => {
    dataRef.current = data;
  }, [data]);

  const execute = useCallback(
    async (isBackground = false) => {
      if (!enabled) return;

      if (!isBackground) {
        setIsLoading(dataRef.current === null);
      }
      setIsFetching(true);
      setIsError(false);

      let timeoutTimer = null;
      try {
        const timeoutPromise = new Promise((_, reject) => {
          timeoutTimer = setTimeout(() => {
            const err = new Error('Analytics request timed out (10s)');
            err.code = 'ETIMEDOUT';
            reject(err);
          }, timeoutMs);
        });

        const response = await Promise.race([fetcherRef.current(), timeoutPromise]);
        const payload = response?.data !== undefined ? response.data : response;
        setData(payload);
        setError(null);
        setIsError(false);
        setLastUpdated(new Date());
      } catch (err) {
        if (err?.code !== 'ERR_CANCELED' && err?.name !== 'CanceledError') {
          // Check for 401 or 403 unauthorized
          const status = err?.response?.status || err?.status;
          if (status === 401 || status === 403) {
            if (typeof window !== 'undefined' && !window.location.pathname.includes('/admin/signin')) {
              window.location.href = `/admin/signin?redirect=${encodeURIComponent(window.location.pathname + window.location.search)}`;
              return;
            }
          }
          setIsError(true);
          setError(
            err?.code === 'ETIMEDOUT'
              ? 'Request timed out. Please try again.'
              : err?.response?.data?.message || err?.message || 'Failed to fetch analytics data'
          );
        }
      } finally {
        if (timeoutTimer) clearTimeout(timeoutTimer);
        setIsLoading(false);
        setIsFetching(false);
      }
    },
    [enabled, timeoutMs]
  );

  // Execute on dependency change
  useEffect(() => {
    if (enabled) {
      void execute(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...dependencies, enabled]);

  // Auto-refresh interval (60s)
  useEffect(() => {
    if (!enabled || !refreshInterval || refreshInterval <= 0) return;

    const timer = setInterval(() => {
      if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
        void execute(true);
      }
    }, refreshInterval);

    return () => clearInterval(timer);
  }, [enabled, refreshInterval, execute]);

  // Window focus revalidation
  useEffect(() => {
    if (!enabled) return;

    const handleFocus = () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
        void execute(true);
      }
    };

    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleFocus);

    return () => {
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleFocus);
    };
  }, [enabled, execute]);

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
 * 1. Analytics Overview Hook
 */
export function useAdminAnalyticsOverview({
  from,
  to,
  interval = 'day',
  refreshInterval = 60000,
  enabled = true,
} = {}) {
  const fetcher = useCallback(
    () => adminApi.getAnalyticsOverview({ from, to, interval }),
    [from, to, interval]
  );
  return useAnalyticsQuery(fetcher, [from, to, interval], { refreshInterval, enabled });
}

/**
 * 2. Sales Analytics Hook
 */
export function useAdminSalesAnalytics({
  from,
  to,
  interval = 'day',
  refreshInterval = 60000,
  enabled = true,
} = {}) {
  const fetcher = useCallback(
    () => adminApi.getSalesAnalytics({ from, to, interval }),
    [from, to, interval]
  );
  return useAnalyticsQuery(fetcher, [from, to, interval], { refreshInterval, enabled });
}

/**
 * 3. Product Analytics Hook
 */
export function useAdminProductAnalytics({
  from,
  to,
  tab = 'Best sellers',
  refreshInterval = 60000,
  enabled = true,
} = {}) {
  const fetcher = useCallback(
    () => adminApi.getProductAnalytics({ from, to, tab }),
    [from, to, tab]
  );
  return useAnalyticsQuery(fetcher, [from, to, tab], { refreshInterval, enabled });
}

/**
 * 4. Customer Analytics Hook
 */
export function useAdminCustomerAnalytics({
  from,
  to,
  interval = 'day',
  refreshInterval = 60000,
  enabled = true,
} = {}) {
  const fetcher = useCallback(
    () => adminApi.getCustomerAnalytics({ from, to, interval }),
    [from, to, interval]
  );
  return useAnalyticsQuery(fetcher, [from, to, interval], { refreshInterval, enabled });
}

/**
 * URL Query Sync Helper for date range and granularity
 */
export function useAnalyticsUrlState(defaultRange = 'Last 30 days', defaultGranularity = 'Daily') {
  const getParams = () => {
    if (typeof window === 'undefined') {
      return { range: defaultRange, granularity: defaultGranularity };
    }
    const params = new URLSearchParams(window.location.search);
    return {
      range: params.get('range') || defaultRange,
      granularity: params.get('interval') || defaultGranularity,
    };
  };

  const [dateRange, setDateRangeState] = useState(() => getParams().range);
  const [granularity, setGranularityState] = useState(() => getParams().granularity);

  const setDateRange = useCallback((newRange) => {
    setDateRangeState(newRange);
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      params.set('range', newRange);
      const newUrl = `${window.location.pathname}?${params.toString()}`;
      window.history.replaceState({}, '', newUrl);
    }
  }, []);

  const setGranularity = useCallback((newGranularity) => {
    setGranularityState(newGranularity);
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      params.set('interval', newGranularity);
      const newUrl = `${window.location.pathname}?${params.toString()}`;
      window.history.replaceState({}, '', newUrl);
    }
  }, []);

  return {
    dateRange,
    setDateRange,
    granularity,
    setGranularity,
  };
}

/**
 * Resolves Date ISO strings from UI label ('Last 7 days', 'Last 30 days', 'Last 90 days', 'This month', 'This year')
 */
export function resolveDateRangeBounds(rangeLabel) {
  const now = new Date();
  let from;
  const to = now.toISOString();

  switch (rangeLabel) {
    case 'Last 7 days':
      from = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
      break;
    case 'Last 30 days':
      from = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
      break;
    case 'Last 90 days':
      from = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000).toISOString();
      break;
    case 'This month':
      from = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
      break;
    case 'This year':
      from = new Date(now.getFullYear(), 0, 1).toISOString();
      break;
    default:
      from = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
  }

  return { from, to };
}
