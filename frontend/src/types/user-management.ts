export interface Role {
  roleId: string
  roleName: string
  description: string
  color: string
  icon: string
  permissions: Record<string, unknown>
}

export interface UserOrganization {
  membershipId: string
  assignmentId: string
  organizationId: string
  entityId: string
  organizationName: string
  entityName: string
  entityType: string
  membershipType: string
  membershipStatus: string
  accessLevel: string
  isPrimary: boolean
  roleName?: string
  roleId?: string
  joinedAt?: string
  invitedAt?: string
}

export interface User {
  userId: string
  email: string
  name: string
  isActive: boolean
  isTenantAdmin: boolean
  onboardingCompleted: boolean
  department?: string
  title?: string
  invitedBy?: string
  invitedAt?: string
  invitationAcceptedAt?: string
  lastLoginAt?: string
  roles?: Role[]
  organizations?: UserOrganization[]
  avatar?: string
  invitationStatus?: string
  userType?: string
  originalData?: {
    invitationToken?: string
    user?: {
      invitationToken?: string
      invitationId?: string
    }
  }
  invitationId?: string
}
