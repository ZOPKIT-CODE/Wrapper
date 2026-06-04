import { useMemo } from 'react';
import { useUserContextSafe } from '@/contexts/UserContextProvider';
import { useAuthStatus } from '@/hooks/useSharedQueries';
import axios from 'axios';

export function useOrganizationAuth() {
  const ctx = useUserContextSafe();
  const user = ctx?.user ?? null;
  const tenant = ctx?.tenant ?? null;
  const isAuthenticated = ctx?.isAuthenticated ?? false;
  const contextLoading = ctx?.loading ?? true;
  const { data: authData, isLoading: authLoading } = useAuthStatus();

  // Create user context from shared auth data
  const userContext = useMemo(() => {
    if (!user || !authData?.authStatus) return null;

    return {
      userId: user.idpSub || user.userId,
      internalUserId: authData.authStatus.userId,
      tenantId: authData.authStatus.tenantId || user.tenantId || tenant?.tenantId,
      roles: authData.authStatus.userRoles || [],
      permissions: authData.authStatus.userPermissions || authData.authStatus.legacyPermissions || []
    };
  }, [user, authData, tenant]);

  // Get the current tenant ID - use the one from user context first
  const tenantId = userContext?.tenantId || user?.tenantId || tenant?.tenantId;

  // If no tenant ID is available, this is an error condition
  if (!tenantId) {
    console.error('❌ CRITICAL: No tenant ID available in useOrganizationAuth!');
    console.error('Auth data:', authData);
    console.error('User data:', user);
    console.error('Tenant data:', tenant);
  }

  // Enhanced request function with proper headers using axios instead of fetch
  const makeRequest = async (endpoint: string, options: RequestInit = {}) => {
    const baseURL = import.meta.env.VITE_API_URL || '';

    // Ensure endpoint starts with /
    const normalizedEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;

    const defaultHeaders = {
      'X-Tenant-ID': tenantId,
      ...(userContext?.userId && { 'X-User-ID': userContext.userId }),
      ...(userContext?.internalUserId && { 'X-Internal-User-ID': userContext.internalUserId }),
    };

    const fullURL = `${baseURL}${normalizedEndpoint}`;

    // Use axios for better CORS handling and consistency
    const response = await axios(fullURL, {
      headers: {
        ...defaultHeaders,
        ...options.headers,
      },
      withCredentials: true,
    });

    return response.data;
  };

  // Permission checking function
  const hasPermission = (permission: string): boolean => {
    if (!userContext?.permissions) return false;
    if (user?.isTenantAdmin) return true; // Admin has all permissions
    return userContext.permissions.includes(permission);
  };

  return {
    userContext,
    tenantId,
    isAuthenticated,
    loading: contextLoading || authLoading,
    makeRequest,
    isAdmin: user?.isTenantAdmin || false,
    hasPermission
  };
}

export default useOrganizationAuth;