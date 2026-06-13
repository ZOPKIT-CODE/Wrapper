export interface UserContext {
  userId: string;
  idpSub: string;
  internalUserId: string | null;
  tenantId: string | null;
  idpOrgId?: string;
  email: string;
  name: string;
  isAuthenticated: boolean;
  needsOnboarding: boolean;
  onboardingCompleted: boolean;
  isActive: boolean;
  isAdmin: boolean;
  isTenantAdmin: boolean;
  /** Tenant-scoped super admin: holds a role with isSystemRole=true within `tenantId`. NEVER a cross-tenant signal. */
  isSuperAdmin: boolean;
  /** Internal platform operator (Cognito platform-admin group / bootstrap allowlist). Cross-tenant plane. */
  isPlatformAdmin: boolean;
  /** Delegated platform operator with a valid, non-expired row in platform_staff. Cross-tenant plane. */
  isPlatformStaff: boolean;
  permissions?: UserPermissions;
}

export interface LegacyUser {
  id: string;
  userId: string;
  internalUserId: string | null;
  tenantId: string | null;
  email: string;
  name: string;
  isAuthenticated: boolean;
  isAdmin: boolean;
  isTenantAdmin: boolean;
  sessionId?: string;
}

export interface UserPermissions {
  modules: Record<string, Record<string, string[]>> | '*';
  roles: UserRole[];
  isSuperAdmin?: boolean;
}

export interface UserRole {
  roleId: string;
  roleName: string;
  priority: number;
  isSuperAdmin?: boolean;
}

export interface OnboardingStatus {
  needsOnboarding: boolean;
  reason: string;
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginationParams {
  page?: number;
  limit?: number;
  offset?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface PaginatedResponse<T = unknown> {
  success: boolean;
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface RequestAnalysis {
  requiresBypass: boolean;
  reason?: string;
}

export interface HealthCheckResult {
  status: 'healthy' | 'unhealthy' | 'error' | 'not_initialized';
  app_connection?: string;
  system_connection?: string;
  read_connection?: string;
  read_replica?: boolean;
  message?: string;
  error?: string;
  timestamp?: string;
}
