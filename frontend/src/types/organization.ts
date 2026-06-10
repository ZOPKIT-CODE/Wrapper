export interface EntityAddress {
  street?: string
  city?: string
  state?: string
  zipCode?: string
  country?: string
}

export interface EntityCapacity {
  maxOccupancy?: number
  currentOccupancy?: number
  utilizationPercentage?: number
  resources?: Record<string, unknown>
}

export interface Employee {
  userId: string
  email: string
  name: string
  isActive: boolean
  isTenantAdmin: boolean
  onboardingCompleted: boolean
  department?: string
  title?: string
}

export interface Application {
  appId: string
  appCode: string
  appName: string
  description: string
  icon: string
  baseUrl: string
  isEnabled: boolean
  subscriptionTier: string
  enabledModules: string[]
  maxUsers: number
}

export interface Organization {
  entityId: string
  entityName: string
  entityType: 'organization' | 'location' | 'department' | 'team'
  entityLevel: number
  hierarchyPath: string
  description?: string
  isActive: boolean
  createdAt: string
  updatedAt: string
  parentEntityId?: string
  responsiblePersonId?: string
  children?: Organization[]
  organizationType?: string
  locationType?: string
  address?: EntityAddress
  availableCredits?: number
  reservedCredits?: number
}

export interface Location {
  entityId: string
  entityName: string
  entityType: 'location'
  entityLevel: number
  hierarchyPath: string
  fullHierarchyPath?: string
  description?: string
  address?: EntityAddress
  city?: string
  state?: string
  country?: string
  isActive?: boolean
  createdAt?: string
  updatedAt?: string
  parentEntityId?: string
  responsiblePersonId?: string
  locationType?: string
  capacity?: EntityCapacity
  children?: Location[]
  availableCredits?: number
  reservedCredits?: number
}

export interface OrganizationHierarchy {
  success: boolean
  hierarchy: Organization[]
  totalOrganizations: number
  message: string
}

export interface LocationAnalytics {
  success: boolean
  analytics: {
    locationId: string
    locationName: string
    capacity?: EntityCapacity
    utilizationPercentage?: number
    lastUpdated?: string
  }
  message: string
}

// Enhanced interfaces for better functionality
export interface BulkActionResult {
  success: boolean
  message: string
  updatedCount?: number
  failedCount?: number
  errors?: string[]
}

export interface QuickAction {
  id: string
  label: string
  icon: React.ReactNode
  action: () => void
  variant?: 'default' | 'destructive' | 'outline' | 'secondary'
  disabled?: boolean
}

export interface ViewMode {
  id: 'tree' | 'grid' | 'list' | 'compact'
  label: string
  icon: React.ReactNode
  description: string
}

export interface FilterOptions {
  type: 'all' | 'organization' | 'location' | 'department' | 'team'
  status: 'all' | 'active' | 'inactive'
  level: 'all' | number[]
  dateRange: 'all' | 'today' | 'week' | 'month' | 'year'
  searchQuery: string
}
