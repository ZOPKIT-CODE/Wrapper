// Shared entity type for the organizations feature.
// Consolidated here so the dialog/tree/sheet components all refer to one `Entity`
// definition instead of several structurally-incompatible local copies.

export interface Entity {
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
  reservedCredits?: number
  totalCredits?: number
  freeCredits?: number
  paidCredits?: number
  address?: any
  children?: Entity[]
  createdAt?: string
  updatedAt?: string
  [key: string]: any
}
