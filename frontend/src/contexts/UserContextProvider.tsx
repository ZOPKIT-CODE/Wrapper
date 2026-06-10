import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
  useMemo,
  ReactNode,
} from 'react'
import { useLocation } from '@tanstack/react-router'
import { useAuth } from '@/lib/auth/cognito-auth'
import { useAuthStatus, useTenant } from '@/hooks/useSharedQueries'
import { toast } from 'sonner'

export interface UserPermission {
  id: string
  name: string
  description: string
  resource: string
  level: string
}

export interface UserRole {
  roleId: string
  roleName: string
  description: string
  isSystemRole: boolean
}

export interface UserContextData {
  userId: string
  idpSub: string
  email: string
  name: string
  tenantId: string
  isTenantAdmin: boolean
  isActive: boolean
  onboardingCompleted: boolean
  needsOnboarding: boolean
}

export interface TenantData {
  tenantId: string
  companyName: string
  subdomain: string
  industry: string
  logoUrl?: string
}

interface UserContextType {
  // State
  user: UserContextData | null
  tenant: TenantData | null
  permissions: UserPermission[]
  roles: UserRole[]
  loading: boolean
  isAuthenticated: boolean

  // Actions
  refreshUserContext: () => Promise<void>
  checkPermission: (permissionName: string) => boolean
  hasRole: (roleName: string) => boolean
  logout: () => void

  // Permission refresh settings
  autoRefresh: boolean
  setAutoRefresh: (enabled: boolean) => void
  lastRefreshTime: Date | null
}

const UserContext = createContext<UserContextType | null>(null)

interface UserContextProviderProps {
  children: ReactNode
  refreshInterval?: number // in milliseconds, default 30 seconds
}

export const UserContextProvider: React.FC<UserContextProviderProps> =
  React.memo(({ children, refreshInterval = 30000 }) => {
    const { isAuthenticated, user: idpUser } = useAuth()
    const location = useLocation()
    const [user, setUser] = useState<UserContextData | null>(null)
    const [tenant, setTenant] = useState<TenantData | null>(null)
    const [permissions, setPermissions] = useState<UserPermission[]>([])
    const [roles, setRoles] = useState<UserRole[]>([])
    const [loading, setLoading] = useState(true)
    const [autoRefresh, setAutoRefresh] = useState(false)
    const [lastRefreshTime, setLastRefreshTime] = useState<Date | null>(null)

    // Fetch user context from API using shared hook
    const {
      data: authData,
      isLoading: authLoading,
      error: authError,
    } = useAuthStatus()

    // Fetch tenant data using shared hook with caching
    const tenantId = authData?.authStatus?.tenantId
    const { data: tenantData, isLoading: tenantLoading } = useTenant(tenantId)

    // Refs to avoid putting authData/tenantData/kindeUser in effect deps (prevents infinite re-renders from new object refs)
    const authDataRef = useRef(authData)
    const tenantDataRef = useRef(tenantData)
    const idpUserRef = useRef(idpUser)
    authDataRef.current = authData
    tenantDataRef.current = tenantData
    idpUserRef.current = idpUser

    // Fetch user context from API (reads latest auth/tenant/kindeUser from refs so deps stay stable)
    const fetchUserContext = useCallback(
      async (showToast = false) => {
        const authData = authDataRef.current
        const tenantData = tenantDataRef.current
        const idpUser = idpUserRef.current
        try {
          if (authData?.success && authData.authStatus) {
            const authStatus = authData.authStatus

            // Create user object from authStatus with Kinde user data
            const userName = idpUser?.givenName
              ? `${idpUser.givenName}${idpUser.familyName ? ' ' + idpUser.familyName : ''}`
              : authStatus.email || 'Unknown'

            const userData: UserContextData = {
              userId: authStatus.userId,
              idpSub: authStatus.userId,
              email: authStatus.email,
              name: userName,
              tenantId: authStatus.tenantId,
              isTenantAdmin: authStatus.isTenantAdmin || false,
              isActive: true, // Assume active if authenticated
              onboardingCompleted: authStatus.onboardingCompleted || false,
              needsOnboarding: authStatus.needsOnboarding || false,
            }

            setUser(userData)

            // Only set tenant when real tenant data has arrived. If tenantData is
            // still loading, leave tenant as null so the sidebar shows 'Zopkit'
            // instead of the misleading 'Organization' placeholder. The
            // tenantIdStable effect below will call setTenant once useTenant
            // resolves with the actual company name.
            if (tenantData) {
              setTenant({
                tenantId: tenantData.tenantId || authStatus.tenantId,
                companyName: tenantData.companyName || '',
                subdomain: tenantData.subdomain || 'unknown',
                industry: tenantData.industry || 'Business',
                logoUrl: tenantData.logoUrl || undefined,
              })
            }
            setPermissions(
              authStatus.userPermissions || authStatus.legacyPermissions || []
            )
            setRoles(authStatus.userRoles || [])
            setLastRefreshTime(new Date())

            if (showToast) {
              toast.success('Permissions refreshed successfully')
            }
          } else if (!authData?.authStatus?.isAuthenticated) {
            // User is not authenticated
            setUser(null)
            setTenant(null)
            setPermissions([])
            setRoles([])
            setLastRefreshTime(null)
          }
        } catch (error: any) {
          console.error('❌ Failed to fetch user context:', error)

          if (error.response?.status === 401) {
            // Authentication failed - clear state
            setUser(null)
            setTenant(null)
            setPermissions([])
            setRoles([])
            setLastRefreshTime(null)
          } else if (showToast) {
            toast.error('Failed to refresh permissions')
          }
        } finally {
          setLoading(false)
        }
      },
      [location.pathname]
    )

    // Manual refresh function exposed to components
    const refreshUserContext = useCallback(async () => {
      setLoading(true)
      await fetchUserContext(true)
    }, [fetchUserContext])

    // Check if user has a specific permission
    const checkPermission = useCallback(
      (permissionName: string): boolean => {
        if (!user) return false
        if (user.isTenantAdmin) return true
        return permissions.some((p) => p.name === permissionName)
      },
      [user, permissions]
    )

    // Check if user has a specific role
    const hasRole = useCallback(
      (roleName: string): boolean => {
        if (!user) return false
        return roles.some((r) => r.roleName === roleName)
      },
      [user, roles]
    )

    // Logout function
    const logout = useCallback(() => {
      setUser(null)
      setTenant(null)
      setPermissions([])
      setRoles([])
      setLastRefreshTime(null)
      setAutoRefresh(false)

      // Clear any stored tokens or session data
      localStorage.removeItem('auth_token')

      // Redirect to login or home
      window.location.href = '/login'
    }, [])

    // Re-sync user state whenever the authenticated identity meaningfully changes.
    // Using authStatus.tenantId and authStatus.isTenantAdmin as deps catches the
    // post-onboarding transition (tenantId: null → real id, isTenantAdmin: false → true)
    // without requiring a hard refresh. The previous sync-once ref guard was set on
    // first login and never cleared during onboarding, leaving user.isTenantAdmin = false
    // until the component remounted. Logout naturally triggers this because isAuthenticated
    // flips to false.
    const stableAuthTenantId = authData?.authStatus?.tenantId
    const stableIsTenantAdmin = authData?.authStatus?.isTenantAdmin
    useEffect(() => {
      if (!isAuthenticated || authLoading) return
      if (!authDataRef.current) {
        if (!authError) setLoading(false)
        return
      }
      fetchUserContext(false)
    }, [
      isAuthenticated,
      authLoading,
      authError,
      stableAuthTenantId,
      stableIsTenantAdmin,
      fetchUserContext,
    ])

    // Update tenant data when cached tenant data changes (depend on stable tenantId to avoid loop)
    const tenantIdStable = tenantData?.tenantId
    useEffect(() => {
      const tenantData = tenantDataRef.current
      if (tenantData && user) {
        setTenant({
          tenantId: tenantData.tenantId || user.tenantId,
          companyName: tenantData.companyName || '',
          subdomain: tenantData.subdomain || 'unknown',
          industry: tenantData.industry || 'Business',
          logoUrl: tenantData.logoUrl || undefined,
        })
      }
    }, [tenantIdStable, user?.tenantId])

    // Auto-refresh effect
    useEffect(() => {
      if (!autoRefresh || !user) return

      const interval = setInterval(() => {
        fetchUserContext(false)
      }, refreshInterval)

      return () => clearInterval(interval)
    }, [autoRefresh, user, refreshInterval, fetchUserContext])

    // Listen for storage events (for multi-tab synchronization)
    useEffect(() => {
      const handleStorageChange = (event: StorageEvent) => {
        if (event.key === 'user_permissions_changed') {
          fetchUserContext(false)
          // Remove the flag
          localStorage.removeItem('user_permissions_changed')
        }
      }

      window.addEventListener('storage', handleStorageChange)
      return () => window.removeEventListener('storage', handleStorageChange)
    }, [fetchUserContext])

    // Update loading state to include tenant loading
    const effectiveLoading = loading || authLoading || tenantLoading

    const value = useMemo<UserContextType>(
      () => ({
        user,
        tenant,
        permissions,
        roles,
        loading: effectiveLoading,
        isAuthenticated: !!user,
        refreshUserContext,
        checkPermission,
        hasRole,
        logout,
        autoRefresh,
        setAutoRefresh,
        lastRefreshTime,
      }),
      [
        user,
        tenant,
        permissions,
        roles,
        effectiveLoading,
        refreshUserContext,
        checkPermission,
        hasRole,
        logout,
        autoRefresh,
        lastRefreshTime,
      ]
    )

    return <UserContext.Provider value={value}>{children}</UserContext.Provider>
  })

UserContextProvider.displayName = 'UserContextProvider'

export const useUserContext = (): UserContextType => {
  const context = useContext(UserContext)
  if (!context) {
    throw new Error('useUserContext must be used within UserContextProvider')
  }
  return context
}

/**
 * Safe variant that returns null instead of throwing when the provider is missing.
 * Useful in hooks/components that may render before the provider mounts (e.g. during HMR).
 */
export const useUserContextSafe = (): UserContextType | null => {
  return useContext(UserContext)
}

// Hook for checking permissions with better TypeScript support
export const usePermissionCheck = () => {
  // Guard against context not being available (e.g. rendered outside the
  // provider, or during HMR before it mounts). useUserContextSafe returns null
  // instead of throwing, so the hook is always called unconditionally.
  const contextValue = useUserContextSafe()

  if (!contextValue) {
    return {
      hasPermission: () => false,
      hasRole: () => false,
      isAdmin: false,
      isAuthenticated: false,
    }
  }

  const { checkPermission, hasRole, user } = contextValue

  return {
    hasPermission: checkPermission,
    hasRole,
    isAdmin: user?.isTenantAdmin || false,
    isAuthenticated: !!user,
  }
}

// Component for conditional rendering based on permissions
interface PermissionGuardProps {
  permission?: string
  permissions?: string[]
  role?: string
  requireAll?: boolean
  fallback?: React.ReactNode
  children: React.ReactNode
}

export const PermissionGuard: React.FC<PermissionGuardProps> = ({
  permission,
  permissions,
  role,
  requireAll = false,
  fallback = null,
  children,
}) => {
  const { checkPermission, hasRole, user } = useUserContext()

  if (!user) return <>{fallback}</>

  if (user.isTenantAdmin) return <>{children}</>

  let hasAccess = false

  if (role) {
    hasAccess = hasRole(role)
  } else if (permission) {
    hasAccess = checkPermission(permission)
  } else if (permissions) {
    if (requireAll) {
      hasAccess = permissions.every((p) => checkPermission(p))
    } else {
      hasAccess = permissions.some((p) => checkPermission(p))
    }
  }

  return hasAccess ? <>{children}</> : <>{fallback}</>
}
