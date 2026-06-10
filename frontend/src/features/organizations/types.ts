/** Shared organization hierarchy entity shape used across org management UI. */
export interface OrganizationEntity {
  entityId: string
  entityName: string
  entityType: 'organization' | 'location' | 'department' | 'team'
  organizationType?: string
  locationType?: string
  entityLevel?: number
  hierarchyPath?: string
  fullHierarchyPath?: string
  parentEntityId?: string
  responsiblePersonId?: string
  isActive?: boolean
  description?: string
  availableCredits?: number
  freeCredits?: number
  paidCredits?: number
  address?: unknown
  children?: OrganizationEntity[]
  createdAt?: string
  updatedAt?: string
}
