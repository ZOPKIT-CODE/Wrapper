import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useRef } from 'react';
import { cache } from '../lib/cache';

interface UseOptimizedQueryOptions<T> {
  queryKey: (string | number | object)[];
  queryFn: () => Promise<T>;
  cacheTime?: number; // Cache duration in milliseconds
  staleTime?: number; // When data becomes stale
  refetchOnMount?: boolean;
  refetchOnWindowFocus?: boolean;
  enabled?: boolean;
  onSuccess?: (data: T) => void;
  onError?: (error: any) => void;
}

// Enhanced error handling for trial expiry scenarios
const handleTrialAwareError = (error: any, onError?: (error: any) => void) => {
  // Check if this is a trial expiry error (200 status with subscriptionExpired flag)
  if (error?.response?.status === 200 && (error.response.data as any)?.subscriptionExpired) {
    const responseData = error.response.data
    if (responseData?.code === 'TRIAL_EXPIRED' || responseData?.code === 'SUBSCRIPTION_EXPIRED') {
      // Don't call onError for trial expiry - let the banner handle it
      return
    }
  }
  
  // For other errors, call the original onError handler
  if (onError) {
    onError(error)
  }
}

export function useOptimizedQuery<T>(options: UseOptimizedQueryOptions<T>) {
  const queryClient = useQueryClient();
  const lastFetchTime = useRef<number>(0);
  const {
    queryKey,
    queryFn,
    cacheTime = 5 * 60 * 1000, // 5 minutes default
    staleTime = 2 * 60 * 1000, // 2 minutes default
    refetchOnMount = false,
    refetchOnWindowFocus = false,
    enabled = true,
    onSuccess,
    onError
  } = options;

  // Create cache key from query key
  const cacheKey = queryKey.join('_');

  // Enhanced query function with local cache
  const enhancedQueryFn = useCallback(async () => {
    const now = Date.now();
    
    // Check if we just fetched this data recently (prevent duplicate calls)
    if (now - lastFetchTime.current < 1000) { // 1 second throttle
      const cachedData = cache.get<T>(cacheKey);
      if (cachedData) {
        return cachedData;
      }
    }

    // Check local cache first
    const cachedData = cache.get<T>(cacheKey);
    if (cachedData && (now - cache.getTimestamp(cacheKey)!) < staleTime) {
      return cachedData;
    }

    lastFetchTime.current = now;
    
    try {
      const data = await queryFn();
      
      // Cache the fresh data
      cache.set(cacheKey, data, cacheTime);
      
      onSuccess?.(data);
      
      return data;
    } catch (error) {
      console.error(`❌ Query failed for ${cacheKey}:`, error);
      handleTrialAwareError(error, onError);
      throw error;
    }
  }, [queryKey, queryFn, cacheKey, cacheTime, staleTime, onSuccess, onError]);

  // React Query with optimized settings
  const queryResult = useQuery({
    queryKey,
    queryFn: enhancedQueryFn,
    staleTime,
    refetchOnMount,
    refetchOnWindowFocus,
    enabled,
    retry: (failureCount, error: any) => {
      // Don't retry on 4xx errors except 429 (rate limit)
      if (error?.response?.status >= 400 && error?.response?.status < 500 && error?.response?.status !== 429) {
        return false;
      }
      return failureCount < 2;
    },
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
  });

  // Smart invalidation function
  const invalidate = useCallback(() => {
    cache.invalidate(cacheKey);
    queryClient.invalidateQueries({ queryKey });
  }, [cacheKey, queryKey, queryClient]);

  // Force refetch function
  const refetch = useCallback(async () => {
    cache.invalidate(cacheKey);
    lastFetchTime.current = 0; // Reset throttle
    return queryResult.refetch();
  }, [cacheKey, queryResult]);

  // Prefetch function for related data
  const prefetch = useCallback((prefetchQueryKey: string[], prefetchQueryFn: () => Promise<any>) => {
    const prefetchCacheKey = prefetchQueryKey.join('_');
    if (!cache.get(prefetchCacheKey)) {
      queryClient.prefetchQuery({
        queryKey: prefetchQueryKey,
        queryFn: prefetchQueryFn,
        staleTime: staleTime,
      });
    }
  }, [queryClient, staleTime]);

  return {
    ...queryResult,
    invalidate,
    refetch,
    prefetch,
    isCached: !!cache.get(cacheKey),
    cacheAge: cache.getTimestamp(cacheKey) ? Date.now() - cache.getTimestamp(cacheKey)! : null,
  };
}

// Hook for batch operations to minimize API calls
// TODO: We can use useQueries
export function useBatchedQueries<T>(
  queries: Array<{
    queryKey: (string | number | object)[];
    queryFn: () => Promise<T>;
    enabled?: boolean;
  }>
) {
  const queryClient = useQueryClient();

  const results = queries.map(query =>
    useOptimizedQuery({
      ...query,
      staleTime: 5 * 60 * 1000, // 5 minutes for batch queries
      cacheTime: 10 * 60 * 1000, // 10 minutes cache
    })
  );

  const invalidateAll = useCallback(() => {
    queries.forEach(query => {
      const cacheKey = query.queryKey.join('_');
      cache.invalidate(cacheKey);
      queryClient.invalidateQueries({ queryKey: query.queryKey });
    });
  }, [queries, queryClient]);

  const refetchAll = useCallback(async () => {
    return Promise.all(results.map(result => result.refetch()));
  }, [results]);

  return {
    results,
    invalidateAll,
    refetchAll,
    isLoading: results.some(r => r.isLoading),
    isError: results.some(r => r.isError),
    errors: results.filter(r => r.error).map(r => r.error),
  };
} 