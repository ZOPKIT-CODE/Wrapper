import { useCallback, useMemo } from 'react'
import { api } from '@/lib/api'
import { useOptimizedQuery, useBatchedQueries } from './useOptimizedQuery'
import { cache, cacheHelpers, CACHE_KEYS } from '@/lib/cache'
import { toast } from 'sonner'
import { useTrialStatus } from './useTrialStatus'
import { useOrganizationAuth } from './useOrganizationAuth'
import { useTenantApplications } from './useSharedQueries'

export interface DashboardMetrics {
  totalUsers: number
  revenue: number
  growth: number
  activeUsers: number
  newUsers: number
  systemHealth: 'good' | 'warning' | 'critical'
}

export interface Application {
  appId: string
  appCode: string
  appName: string
  description?: string
  icon?: string
  status?: 'active' | 'inactive'
  userCount?: number
  // Tenant-specific fields from organization_applications table
  isEnabled?: boolean
  subscriptionTier?: string
  enabledModules?: string[]
  modules?: any[]
  customPermissions?: Record<string, string[]>
  availableModules?: any[]
  enabledModulesPermissions?: Record<string, string[]>
  maxUsers?: number
  createdAt?: string
}

export interface DashboardUser {
  userId: string
  email: string
  name: string
  role: string
  status: 'active' | 'invited' | 'suspended'
  lastActiveAt: string
  createdAt: string
}

export interface PaymentStats {
  totalRevenue: number
  monthlyRevenue: number
  subscriptions: {
    active: number
    trial: number
    expired: number
  }
  growth: {
    revenue: number
    users: number
  }
}

// Hook for comprehensive dashboard data management
export function useDashboardData() {
  const { isExpired: isTrialExpired, expiredData } = useTrialStatus()
  const {
    tenantId,
    isAuthenticated,
    loading: authLoading,
  } = useOrganizationAuth()

  // Debug logging

  // Check if we're in trial expiry state - if so, provide graceful degradation
  const isTrialExpiredWithData = useMemo(() => {
    return (
      isTrialExpired ||
      expiredData?.expired ||
      localStorage.getItem('trialExpired')
    )
  }, [isTrialExpired, expiredData])

  // Use shared hook with caching for tenant applications
  const { data: cachedApplications = [], isLoading: applicationsLoading } =
    useTenantApplications(tenantId)

  // Dashboard queries with trial-aware error handling
  // Note: Applications are fetched via useTenantApplications hook above, not in batched queries
  const dashboardQueries = useBatchedQueries([
    {
      queryKey: [CACHE_KEYS.USERS],
      queryFn: async () => {
        if (isTrialExpiredWithData) {
          return []
        }

        const response = await api.get('/admin/users')
        const data = response.data?.data

        // Ensure we always return an array
        if (Array.isArray(data)) {
          return data
        } else if (data && typeof data === 'object') {
          // If it's an object with success property, check for nested data
          if (data.success && Array.isArray(data.data)) {
            return data.data
          }
          // If it's an object, return empty array
          console.warn('Users API returned non-array data:', data)
          return []
        } else {
          console.warn('Users API returned unexpected data type:', typeof data)
          return []
        }
      },
      enabled: true,
    },
    {
      queryKey: ['payment_stats'],
      queryFn: async () => {
        if (isTrialExpiredWithData) {
          return {
            totalRevenue: 0,
            monthlyRevenue: 0,
            subscriptions: { active: 0, trial: 0, expired: 1 },
            growth: { revenue: 0, users: 0 },
          }
        }

        const response = await api.get('/payments/analytics')
        return (
          response.data.data || {
            totalRevenue: 0,
            monthlyRevenue: 0,
            subscriptions: { active: 0, trial: 0, expired: 0 },
            growth: { revenue: 0, users: 0 },
          }
        )
      },
      enabled: true,
    },
  ])

  // Extract data with defaults and type safety
  // Applications come from shared hook useTenantApplications (no batched query needed)
  const applications = useMemo(() => {
    return cachedApplications || []
  }, [cachedApplications])

  // After removing APPLICATIONS query, indices shift: users is now [0], paymentStats is [1]
  const users = Array.isArray(dashboardQueries.results[0]?.data)
    ? dashboardQueries.results[0].data
    : []
  const paymentStats = dashboardQueries.results[1]?.data || {
    totalRevenue: 0,
    monthlyRevenue: 0,
    subscriptions: { active: 0, trial: 0, expired: 0 },
    growth: { revenue: 0, users: 0 },
  }

  // Calculate metrics from available data
  const metrics = useMemo(() => {
    // Ensure users is an array before filtering
    const safeUsers = Array.isArray(users) ? users : []
    const safeApplications = Array.isArray(applications) ? applications : []

    const activeUsers = safeUsers.filter(
      (user) => user.status === 'active'
    ).length
    const newUsers = safeUsers.filter((user) => {
      try {
        const createdAt = new Date(user.createdAt)
        const weekAgo = new Date()
        weekAgo.setDate(weekAgo.getDate() - 7)
        return createdAt > weekAgo
      } catch (error) {
        console.warn('Invalid createdAt date for user:', user)
        return false
      }
    }).length

    return {
      totalUsers: safeUsers.length,
      revenue: paymentStats.totalRevenue || 0,
      growth: paymentStats.growth?.revenue || 0,
      activeUsers,
      newUsers,
      systemHealth: safeApplications.some((app) => app.status === 'inactive')
        ? 'warning'
        : 'good',
    }
  }, [users, applications, paymentStats])

  // Smart refresh function - only refreshes stale data
  const refreshDashboard = useCallback(async () => {
    // Don't refresh if trial is expired - instead suggest upgrade
    if (isTrialExpiredWithData) {
      toast.error('Please upgrade your plan to access dashboard features', {
        duration: 4000,
        icon: '⚠️',
      })
      return
    }

    try {
      // Invalidate dashboard-related cache
      cacheHelpers.invalidateDashboard()

      // Refetch all queries
      await dashboardQueries.refetchAll()

      toast.success('Dashboard refreshed successfully')
    } catch (error) {
      console.error('❌ Failed to refresh dashboard:', error)
      toast.error('Failed to refresh dashboard')
    }
  }, [
    dashboardQueries,
    isTrialExpiredWithData,
    tenantId,
    isAuthenticated,
    authLoading,
  ])

  // Force refresh function - clears all cache and refetches
  const forceRefresh = useCallback(async () => {
    if (isTrialExpiredWithData) {
      toast.error('Please upgrade your plan to access dashboard features', {
        duration: 4000,
        icon: '⚠️',
      })
      return
    }

    try {
      // Clear all cache
      cacheHelpers.clearAll()

      // Refetch all queries
      await dashboardQueries.refetchAll()

      toast.success('Dashboard data refreshed')
    } catch (error) {
      console.error('❌ Failed to force refresh dashboard:', error)
      toast.error('Failed to refresh dashboard data')
    }
  }, [dashboardQueries, isTrialExpiredWithData])

  // Selective invalidation functions
  const invalidateUsers = useCallback(() => {
    if (isTrialExpiredWithData) return
    cacheHelpers.invalidateUsers()
    dashboardQueries.results[1]?.refetch()
  }, [dashboardQueries, isTrialExpiredWithData])

  const invalidateApplications = useCallback(() => {
    if (isTrialExpiredWithData) return
    // Invalidate applications cache with tenant-specific key
    cache.invalidatePattern('applications')
    cache.invalidate(CACHE_KEYS.APPLICATIONS)
    dashboardQueries.results[0]?.refetch()
  }, [dashboardQueries, isTrialExpiredWithData])

  // Override error state for trial expiry
  const isError = dashboardQueries.isError && !isTrialExpiredWithData
  const isLoading = dashboardQueries.isLoading && !isTrialExpiredWithData

  return {
    // Data
    applications,
    users,
    paymentStats,
    metrics,

    // Loading states - don't show loading/error for trial expiry
    isLoading,
    isError,
    errors: dashboardQueries.errors,
    isTrialExpired: isTrialExpiredWithData,

    // Actions
    refreshDashboard,
    forceRefresh,
    invalidateUsers,
    invalidateApplications,

    // Individual loading states for granular UI updates
    applicationsLoading:
      ((applicationsLoading || dashboardQueries.results[0]?.isLoading) &&
        !isTrialExpiredWithData) ||
      false,
    usersLoading:
      (dashboardQueries.results[1]?.isLoading && !isTrialExpiredWithData) ||
      false,
    metricsLoading:
      (dashboardQueries.results[2]?.isLoading && !isTrialExpiredWithData) ||
      false,

    // Cache information
    isCached: dashboardQueries.results.some((r) => r.isCached),
    cacheAge: Math.min(
      ...dashboardQueries.results
        .map((r) => r.cacheAge || 0)
        .filter((age) => age > 0)
    ),
  }
}

// Hook for role-specific data with optimized caching
export function useRoleData(filters?: {
  search?: string
  type?: 'all' | 'custom' | 'system'
  page?: number
  pageSize?: number
}) {
  const { search = '', type = 'all', page = 1, pageSize = 20 } = filters || {}

  return useOptimizedQuery({
    queryKey: ['roles', search, type, page, pageSize],
    queryFn: async () => {
      const response = await api.get('/roles', {
        params: {
          search: search || undefined,
          type: type !== 'all' ? type : undefined,
          page,
          limit: pageSize,
        },
      })

      if (!response.data.success) {
        throw new Error(response.data.message || 'Failed to load roles')
      }

      return response.data.data
    },
    cacheTime: 5 * 60 * 1000, // 5 minutes
    staleTime: 2 * 60 * 1000, // 2 minutes
    onError: (error) => {
      console.error('❌ Failed to load roles:', error)
      toast.error('Failed to load roles')
    },
  })
}

// Hook for user management data
export function useUserData(filters?: {
  search?: string
  status?: string
  page?: number
  pageSize?: number
}) {
  const { search = '', status = 'all', page = 1, pageSize = 20 } = filters || {}

  const { isExpired: isTrialExpired, expiredData } = useTrialStatus()
  const isTrialExpiredWithData =
    isTrialExpired ||
    expiredData?.expired ||
    localStorage.getItem('trialExpired')

  return useOptimizedQuery({
    queryKey: ['users', search, status, page, pageSize],
    queryFn: async () => {
      // If trial is expired, return empty data instead of making API call
      if (isTrialExpiredWithData) {
        return []
      }

      const response = await api.get('/admin/users', {
        params: {
          search: search || undefined,
          status: status !== 'all' ? status : undefined,
          page,
          limit: pageSize,
        },
      })

      if (!response.data.success) {
        throw new Error(response.data.message || 'Failed to load users')
      }

      const data = response.data.data
      // Ensure we always return an array
      return Array.isArray(data) ? data : []
    },
    cacheTime: 3 * 60 * 1000, // 3 minutes for user data
    staleTime: 1 * 60 * 1000, // 1 minute stale time
    onError: (error) => {
      // Don't show error toasts for trial expiry
      if (
        error?.response?.status === 200 &&
        (error.response.data as any)?.subscriptionExpired
      ) {
        return
      }

      // Only show error toasts if not in trial expiry state
      if (!isTrialExpiredWithData) {
        console.error('❌ Failed to load users:', error)
        toast.error('Failed to load users')
      }
    },
  })
}
