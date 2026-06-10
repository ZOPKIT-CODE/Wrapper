import React from 'react'
import axios from 'axios'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/lib/auth/cognito-auth'
import { api, subscriptionAPI } from '@/lib/api'
import { useLocation } from '@tanstack/react-router'

// Query keys for consistent caching
export const queryKeys = {
  authStatus: ['authStatus'] as const,
  creditStatus: ['creditStatus'] as const,
  onboardingStatus: ['onboardingStatus'] as const,
  userContext: ['userContext'] as const,
  entityScope: ['entityScope'] as const,
  tenant: ['tenant'] as const,
  tenantApps: (tenantId: string) => ['tenantApps', tenantId] as const,
  applicationAllocations: (entityId?: string) =>
    ['applicationAllocations', entityId].filter(Boolean),
  notifications: ['notifications'] as const,
  unreadCount: ['unreadCount'] as const,
  users: (entityId?: string | null) => ['users', entityId].filter(Boolean),
  entities: (tenantId?: string) => ['entities', tenantId].filter(Boolean),
  roles: (filters?: { search?: string; type?: string }) =>
    ['roles', filters] as const,
  subscriptionCurrent: ['subscription', 'current'] as const,
} as const

// Shared auth status hook to prevent duplicate API calls
export function useAuthStatus() {
  const { isAuthenticated, user } = useAuth()

  return useQuery({
    queryKey: queryKeys.authStatus,
    queryFn: async () => {
      const response = await api.get('/admin/auth-status')
      return response.data
    },
    enabled: !!isAuthenticated && !!user,
    staleTime: 2 * 60 * 1000, // 2 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
    retry: (failureCount, error) => {
      // Don't retry auth errors, but retry network errors
      if (axios.isAxiosError(error) && error.response?.status === 401)
        return false
      return failureCount < 2
    },
  })
}

// Shared entity scope hook with caching
export function useEntityScope() {
  const { isAuthenticated, user } = useAuth()
  const location = useLocation()
  const { data: authData } = useAuthStatus()

  const isOnboardingPage =
    location.pathname === '/onboarding' ||
    location.pathname.startsWith('/onboarding/')
  const isTenantAdmin = authData?.authStatus?.isTenantAdmin === true

  return useQuery({
    queryKey: queryKeys.entityScope,
    queryFn: async () => {
      const response = await api.get('/admin/entity-scope')

      if (response.data.success) {
        return response.data.scope
      }

      throw new Error('Failed to fetch entity scope')
    },
    // Entity scope is an admin-only API; avoid unnecessary 401s for regular users.
    enabled: !!isAuthenticated && !!user && !isOnboardingPage && isTenantAdmin,
    staleTime: 5 * 60 * 1000, // 5 minutes - entity scope doesn't change often
    gcTime: 15 * 60 * 1000, // 15 minutes cache
    retry: (failureCount, error) => {
      if (axios.isAxiosError(error) && error.response?.status === 401)
        return false
      return failureCount < 2
    },
    // Return default scope if disabled
    placeholderData: {
      scope: 'none' as const,
      entityIds: [],
      isUnrestricted: false,
    },
  })
}

// Shared tenant hook with caching
export function useTenant(tenantId?: string) {
  const { isAuthenticated, user } = useAuth()
  const location = useLocation()
  const { data: authData } = useAuthStatus()

  const isOnboardingPage =
    location.pathname === '/onboarding' ||
    location.pathname.startsWith('/onboarding/')
  const effectiveTenantId = tenantId || authData?.authStatus?.tenantId

  return useQuery({
    queryKey: [...queryKeys.tenant, effectiveTenantId],
    queryFn: async () => {
      if (!effectiveTenantId) {
        throw new Error('Tenant ID is required')
      }

      const response = await api.get('/admin/tenant', {
        headers: {
          'X-Tenant-ID': effectiveTenantId,
        },
      })

      if (response.data?.success && response.data?.data) {
        return response.data.data
      }

      throw new Error('Failed to fetch tenant details')
    },
    enabled:
      !!isAuthenticated && !!user && !!effectiveTenantId && !isOnboardingPage,
    staleTime: 5 * 60 * 1000, // 5 minutes - tenant data doesn't change often
    gcTime: 15 * 60 * 1000, // 15 minutes cache
    retry: (failureCount, error) => {
      const status = axios.isAxiosError(error)
        ? error.response?.status
        : undefined
      if (status === 401 || status === 404) return false
      return failureCount < 2
    },
  })
}

// Shared tenant applications hook with caching
// Uses /api/applications which works for all authenticated users (including invited users).
// The admin tenant-apps endpoint requires platform permission and blocks invited users.
export function useTenantApplications(tenantId?: string) {
  const { isAuthenticated, user } = useAuth()
  const { data: authData } = useAuthStatus()

  const effectiveTenantId = tenantId || authData?.authStatus?.tenantId

  return useQuery({
    queryKey: queryKeys.tenantApps(effectiveTenantId || ''),
    queryFn: async () => {
      if (!effectiveTenantId) {
        throw new Error('Tenant ID is required')
      }

      // /api/applications returns tenant's enabled apps for any authenticated user
      const response = await api.get('/applications')

      if (response.data?.success) {
        // /api/applications returns { success, data: [...] }; tenant-apps returns { success, data: { applications: [...] } }
        const apps =
          response.data.data?.applications ??
          response.data.data ??
          response.data.applications ??
          []
        return Array.isArray(apps) ? apps : []
      }

      throw new Error('Failed to fetch tenant applications')
    },
    enabled: !!isAuthenticated && !!user && !!effectiveTenantId,
    staleTime: 3 * 60 * 1000, // 3 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes cache
    retry: (failureCount, error) => {
      if (axios.isAxiosError(error) && error.response?.status === 401)
        return false
      return failureCount < 2
    },
    // Return empty array as placeholder
    placeholderData: [],
  })
}

// Shared application allocations hook with caching
export function useApplicationAllocations(entityId?: string) {
  const { isAuthenticated, user } = useAuth()

  return useQuery({
    queryKey: queryKeys.applicationAllocations(entityId),
    queryFn: async () => {
      if (entityId) {
        const response = await api.get(
          `/admin/credits/entity/${entityId}/application-allocations`
        )

        if (response.data?.success) {
          const allocations = response.data.data?.allocations || []
          return allocations
        }
      } else {
        const response = await api.get('/admin/credits/application-allocations')

        if (response.data?.success) {
          const allocations = response.data.data?.allocations || []
          return allocations
        }
      }

      throw new Error('Failed to fetch application allocations')
    },
    enabled: !!isAuthenticated && !!user,
    staleTime: 2 * 60 * 1000, // 2 minutes
    gcTime: 5 * 60 * 1000, // 5 minutes cache
    retry: (failureCount, error) => {
      if (axios.isAxiosError(error) && error.response?.status === 401)
        return false
      return failureCount < 2
    },
    placeholderData: [],
  })
}

// Shared notifications hook with caching and optimized polling.
// Multiple components can call this — TanStack Query deduplicates by queryKey.
// IMPORTANT: the default options object is stable (module-level constant) so all
// callers that pass no options share the exact same query key and cache entry.
const DEFAULT_NOTIFICATION_OPTIONS = {} as const

export function useNotifications(
  options: {
    limit?: number
    offset?: number
    includeRead?: boolean
    includeDismissed?: boolean
    type?: string
    priority?: string
  } = DEFAULT_NOTIFICATION_OPTIONS
) {
  const { isAuthenticated, user } = useAuth()

  // Stable key: only include non-default options to avoid different {} refs
  const hasCustomOptions =
    options !== DEFAULT_NOTIFICATION_OPTIONS && Object.keys(options).length > 0
  const queryKey = hasCustomOptions
    ? [...queryKeys.notifications, options]
    : queryKeys.notifications

  return useQuery({
    queryKey,
    queryFn: async () => {
      const params = new URLSearchParams()

      if (options.limit) params.append('limit', options.limit.toString())
      if (options.offset) params.append('offset', options.offset.toString())
      if (options.includeRead !== undefined)
        params.append('includeRead', options.includeRead.toString())
      if (options.includeDismissed !== undefined)
        params.append('includeDismissed', options.includeDismissed.toString())
      if (options.type) params.append('type', options.type)
      if (options.priority) params.append('priority', options.priority)

      const response = await api.get(`/notifications?${params.toString()}`)

      if (response.data.success) {
        return response.data.data || []
      }

      throw new Error('Failed to fetch notifications')
    },
    enabled: !!isAuthenticated && !!user,
    staleTime: 30_000,
    gcTime: 5 * 60 * 1000,
    refetchInterval: 60_000, // poll every 60s so expiry warnings appear promptly
    refetchOnWindowFocus: true, // re-fetch when user returns to the tab
    retry: (failureCount, error) => {
      if (axios.isAxiosError(error) && error.response?.status === 401)
        return false
      return failureCount < 2
    },
    placeholderData: [],
  })
}

// Derive unread count from the notifications cache — no separate API call.
// Eliminates the /api/notifications/unread-count endpoint entirely.
export function useUnreadCount() {
  const { data: notifications = [] } = useNotifications()
  const count = (notifications as Array<{ isRead?: boolean }>).filter(
    (n) => !n.isRead
  ).length
  return { data: count }
}

// Shared credit status hook
export function useCreditStatusQuery(enabled: boolean = true) {
  const { isAuthenticated, user } = useAuth()

  return useQuery({
    queryKey: [...queryKeys.creditStatus, user?.id],
    queryFn: async () => {
      const response = await api.get('/credits/current')
      return response.data
    },
    enabled: enabled && !!isAuthenticated && !!user,
    staleTime: 5 * 60 * 1000, // raised from 1min — credit balance doesn't change on every page visit
    gcTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
    retry: (failureCount, error) => {
      if (axios.isAxiosError(error) && error.response?.status === 401)
        return false
      return failureCount < 2
    },
  })
}

// Shared credit usage summary hook
export function useCreditUsageSummary(params?: {
  period?: 'day' | 'week' | 'month' | 'year'
  startDate?: string
  endDate?: string
}) {
  const { isAuthenticated, user } = useAuth()

  return useQuery({
    queryKey: ['credit', 'usage-summary', params],
    queryFn: async () => {
      const response = await api.get('/credits/usage-summary', { params })
      return response.data
    },
    enabled: !!isAuthenticated && !!user,
    staleTime: 2 * 60 * 1000, // 2 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
    retry: (failureCount, error) => {
      if (axios.isAxiosError(error) && error.response?.status === 401)
        return false
      return failureCount < 2
    },
  })
}

// Shared credit statistics hook
export function useCreditStats() {
  const { isAuthenticated, user } = useAuth()

  return useQuery({
    queryKey: ['credit', 'stats'],
    queryFn: async () => {
      const response = await api.get('/credits/stats')
      return response.data
    },
    enabled: !!isAuthenticated && !!user,
    staleTime: 2 * 60 * 1000, // 2 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
    retry: (failureCount, error) => {
      if (axios.isAxiosError(error) && error.response?.status === 401)
        return false
      return failureCount < 2
    },
  })
}

// Shared credit transaction history hook
export function useCreditTransactionHistory(params?: {
  page?: number
  limit?: number
  type?: string
  startDate?: string
  endDate?: string
}) {
  const { isAuthenticated, user } = useAuth()

  return useQuery({
    queryKey: ['credit', 'transactions', params],
    queryFn: async () => {
      const response = await api.get('/credits/transactions', { params })
      return response.data
    },
    enabled: !!isAuthenticated && !!user,
    staleTime: 1 * 60 * 1000, // 1 minute
    gcTime: 5 * 60 * 1000, // 5 minutes
    retry: (failureCount, error) => {
      if (axios.isAxiosError(error) && error.response?.status === 401)
        return false
      return failureCount < 2
    },
  })
}

// Shared subscription current hook with caching
export function useSubscriptionCurrent() {
  const { isAuthenticated, user } = useAuth()

  return useQuery({
    queryKey: queryKeys.subscriptionCurrent,
    queryFn: async () => {
      try {
        const response = await subscriptionAPI.getCurrent()
        return response.data.data
      } catch (error) {
        console.error(
          '❌ useSubscriptionCurrent: Error fetching subscription:',
          error
        )
        if (axios.isAxiosError(error) && error.response?.status === 404) {
          return {
            plan: 'free',
            status: 'active',
            currentPeriodEnd: null,
            trialEnd: null,
            amount: 0,
            currency: 'USD',
          }
        }
        throw error
      }
    },
    enabled: !!isAuthenticated && !!user,
    staleTime: 2 * 60 * 1000, // 2 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes cache
    retry: 1,
  })
}

// Shared users hook with caching
export function useUsers(entityId?: string | null) {
  const { isAuthenticated, user } = useAuth()

  return useQuery({
    queryKey: queryKeys.users(entityId),
    queryFn: async () => {
      const params = entityId ? { entityId } : {}
      const response = await api.get('/tenants/current/users', { params })

      if (response.data.success) {
        const users = response.data.data || []
        return users
      }

      throw new Error('Failed to fetch users')
    },
    enabled: !!isAuthenticated && !!user,
    staleTime: 2 * 60 * 1000, // 2 minutes
    gcTime: 5 * 60 * 1000, // 5 minutes cache
    retry: (failureCount, error) => {
      if (axios.isAxiosError(error) && error.response?.status === 401)
        return false
      return failureCount < 2
    },
    placeholderData: [],
  })
}

// Minimal shape of a role item used for client-side filtering below.
interface RoleListItem {
  roleName?: string
  description?: string
  isSystemRole?: boolean
}

// Shared roles hook with caching
export function useRoles(filters?: {
  search?: string
  type?: 'all' | 'custom' | 'system'
}) {
  const { isAuthenticated, user } = useAuth()

  return useQuery({
    queryKey: queryKeys.roles(filters),
    queryFn: async () => {
      // Try the new all roles endpoint first, fallback to paginated endpoint
      try {
        const response = await api.get('/admin/roles/all')

        if (response.data.success) {
          let rolesData = response.data.data || []

          // Apply filters client-side if needed
          if (filters?.search) {
            const searchLower = filters.search.toLowerCase()
            rolesData = rolesData.filter(
              (role: RoleListItem) =>
                role.roleName?.toLowerCase().includes(searchLower) ||
                role.description?.toLowerCase().includes(searchLower)
            )
          }

          if (filters?.type === 'system') {
            rolesData = rolesData.filter(
              (role: RoleListItem) => role.isSystemRole === true
            )
          } else if (filters?.type === 'custom') {
            rolesData = rolesData.filter(
              (role: RoleListItem) => role.isSystemRole === false
            )
          }

          return rolesData
        }
      } catch (error) {
        console.warn(
          '⚠️ Failed to fetch from /admin/roles/all, trying fallback:',
          error instanceof Error ? error.message : error
        )
      }

      // Fallback to paginated endpoint
      const response = await api.get('/permissions/roles', {
        params: {
          search: filters?.search,
          type: filters?.type !== 'all' ? filters?.type : undefined,
          page: 1,
          limit: 100, // Max allowed by API
        },
      })

      if (response.data.success) {
        const rolesData = response.data.data?.data || response.data.data || []
        return rolesData
      }

      throw new Error('Failed to fetch roles')
    },
    enabled: !!isAuthenticated && !!user,
    staleTime: 5 * 60 * 1000, // 5 minutes - roles don't change often
    gcTime: 15 * 60 * 1000, // 15 minutes cache
    retry: (failureCount, error) => {
      if (axios.isAxiosError(error) && error.response?.status === 401)
        return false
      return failureCount < 2
    },
  })
}

// Shared onboarding status hook
export function useOnboardingStatus() {
  const { isAuthenticated, user } = useAuth()

  return useQuery({
    queryKey: queryKeys.onboardingStatus,
    queryFn: async () => {
      // Build query params with user info as fallback for token validation failures
      const params = new URLSearchParams()
      if (user?.id) {
        params.append('idpSub', user.id)
      }
      if (user?.email) {
        params.append('email', user.email)
      }

      const queryString = params.toString()
      const url = `/onboarding/status${queryString ? `?${queryString}` : ''}`

      const response = await api.get(url)
      return response.data
    },
    enabled: !!isAuthenticated && !!user,
    staleTime: 2 * 60 * 1000, // 2 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
    retry: (failureCount, error) => {
      if (axios.isAxiosError(error) && error.response?.status === 401)
        return false
      return failureCount < 2
    },
  })
}

// Hook to invalidate all cached queries (useful for manual refresh)
export function useInvalidateQueries() {
  const queryClient = useQueryClient()

  return {
    invalidateAuthStatus: () =>
      queryClient.invalidateQueries({ queryKey: queryKeys.authStatus }),
    invalidateCreditStatus: () =>
      queryClient.invalidateQueries({ queryKey: queryKeys.creditStatus }),
    invalidateOnboardingStatus: () =>
      queryClient.invalidateQueries({ queryKey: queryKeys.onboardingStatus }),
    invalidateEntityScope: () =>
      queryClient.invalidateQueries({ queryKey: queryKeys.entityScope }),
    invalidateTenant: (tenantId?: string) =>
      queryClient.invalidateQueries({
        queryKey: [...queryKeys.tenant, tenantId],
      }),
    invalidateTenantApps: (tenantId: string) =>
      queryClient.invalidateQueries({
        queryKey: queryKeys.tenantApps(tenantId),
      }),
    invalidateApplicationAllocations: (entityId?: string) =>
      queryClient.invalidateQueries({
        queryKey: queryKeys.applicationAllocations(entityId),
      }),
    invalidateNotifications: () =>
      queryClient.invalidateQueries({ queryKey: queryKeys.notifications }),
    invalidateUnreadCount: () =>
      queryClient.invalidateQueries({ queryKey: queryKeys.unreadCount }),
    invalidateUsers: () =>
      queryClient.invalidateQueries({ queryKey: ['users'] }),
    invalidateEntities: (tenantId?: string) =>
      queryClient.invalidateQueries({
        queryKey: queryKeys.entities(tenantId || ''),
      }),
    invalidateRoles: () => {
      queryClient.invalidateQueries({ queryKey: ['roles'] })
      // Also invalidate user management queries so useAvailableRoles reflects new roles immediately
      queryClient.invalidateQueries({ queryKey: ['users'] })
    },
    invalidateAll: () => queryClient.invalidateQueries(),
    prefetchAuthStatus: () =>
      queryClient.prefetchQuery({
        queryKey: queryKeys.authStatus,
        queryFn: async () => {
          const response = await api.get('/admin/auth-status')
          return response.data
        },
        staleTime: 2 * 60 * 1000,
      }),
  }
}

// Hook for debounced API calls
export function useDebounceCallback<T extends (...args: never[]) => unknown>(
  callback: T,
  delay: number
): T {
  const [debounceTimer, setDebounceTimer] = React.useState<NodeJS.Timeout>()

  return React.useCallback(
    ((...args) => {
      if (debounceTimer) {
        clearTimeout(debounceTimer)
      }

      const newTimer = setTimeout(() => {
        callback(...args)
      }, delay)

      setDebounceTimer(newTimer)
    }) as T,
    [callback, delay, debounceTimer]
  )
}
