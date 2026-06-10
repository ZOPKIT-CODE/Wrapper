export interface User {
  id: string
  email: string
  firstName: string
  lastName: string
  role: string
  tenantId: string
  lastActiveAt: string
  createdAt: string
}

export interface UnifiedUser {
  id: string
  email: string
  firstName: string
  lastName: string
  role: string
  isActive: boolean
  invitationStatus: 'active' | 'pending' | 'inactive'
  invitedAt: string
  expiresAt: string | null
  lastActiveAt: string | null
  invitationId: string | null
  status: string
  userType: 'active' | 'invited'
  originalData?: Record<string, unknown>
}

export interface ApiResponse<T> {
  success: boolean
  data: T
  message?: string
}

export interface Tenant {
  id: string
  name: string
  domain: string
  status: 'active' | 'suspended' | 'pending'
  plan: string
  createdAt: string
  settings: Record<string, unknown>
}

export interface Subscription {
  id: string
  tenantId: string
  planId: string
  status: string
  currentPeriodStart: string
  currentPeriodEnd: string
  amount: number
  currency: string
}

export interface UsageMetrics {
  users: number
  bandwidth: number
}

export interface Plan {
  id: string
  name: string
  price: number
  currency: string
  features: Record<string, unknown>
  limits: Record<string, number>
}

export interface Permission {
  id: string
  name: string
  description: string
  category: string
  resource: string
  action: string
}

export interface Role {
  roleId: string
  roleName: string
  name?: string
  description?: string
  color?: string
  permissions: string[] | Record<string, unknown>
  restrictions?: {
    ipWhitelist?: string[]
    timeRestrictions?: {
      allowedHours?: number[]
      allowedDays?: number[]
      timezone?: string
    }
    dataAccess?: {
      ownDataOnly?: boolean
      departmentOnly?: boolean
      allowedApps?: string[]
    }
    planType?: string
    maxUsers?: number
    maxRoles?: number
  }
  isSystemRole: boolean
  isDefault: boolean
  priority: number
  createdBy: string
  createdAt: string
  updatedAt: string
  userCount?: number
  icon?: string
  category?: string
  inheritance?: {
    parentRoles: string[]
    inheritanceMode: 'additive' | 'restrictive'
    priority: number
  }
  metadata?: {
    icon?: string
    category?: string
    tags?: string[]
    level?: string
    department?: string
    isTemplate?: boolean
  }
}

export interface RoleTemplate {
  templateId: string
  templateName: string
  displayName: string
  description?: string
  category?: string
  permissions: string[]
  restrictions?: Record<string, unknown>
  targetTools: string[]
  isActive: boolean
  sortOrder: number
}

export interface RoleAssignment {
  assignmentId: string
  userId: string
  roleId: string
  roleName: string
  assignedBy: string
  assignedAt: string
  isTemporary: boolean
  expiresAt?: string
  isActive: boolean
  user?: {
    id: string
    name: string
    email: string
  }
}

export interface AuditLogEntry {
  logId: string
  tenantId: string
  userId?: string
  action: string
  resourceType: string
  resourceId?: string
  oldValues?: unknown
  newValues?: unknown
  details?: unknown
  ipAddress?: string
  userAgent?: string
  createdAt: string
  user?: {
    name: string
    email: string
  }
}
