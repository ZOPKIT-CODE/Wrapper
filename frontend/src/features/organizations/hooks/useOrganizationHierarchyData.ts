import { useState, useEffect, useCallback } from 'react'
import { toast } from 'sonner'

interface Organization {
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
  availableCredits?: number
  reservedCredits?: number
  totalCredits?: number
}

interface Location {
  entityId: string
  entityName: string
  entityType: 'location'
  entityLevel: number
  hierarchyPath: string
  parentEntityId?: string
  locationType?: string
  availableCredits?: number
  address?: unknown
}

interface OrganizationHierarchy {
  success: boolean
  hierarchy: Organization[]
  totalOrganizations: number
  message: string
}

// A loosely-typed hierarchy node. Server payloads carry the Organization fields
// plus arbitrary extras, and these helpers mutate credit fields in place, so we
// model it as the known fields plus an index signature for the dynamic rest.
interface HierarchyEntity {
  entityId: string
  entityName?: string
  entityType?: string
  entityLevel?: number
  parentEntityId?: string
  availableCredits?: number | string | null
  reservedCredits?: number | string | null
  totalCredits?: number
  children?: HierarchyEntity[]
  [key: string]: unknown
}

// ---------------------------------------------------------------------------
// Credit helpers (pure functions — no state)
// ---------------------------------------------------------------------------

function parseCredit(val: unknown): number {
  if (typeof val === 'number') return val
  if (typeof val === 'string') return parseFloat(val) || 0
  return 0
}

function normalizeEntityCredits(entity: HierarchyEntity): void {
  if (
    entity.entityType === 'organization' ||
    entity.entityType === 'location'
  ) {
    entity.availableCredits =
      entity.availableCredits != null ? parseCredit(entity.availableCredits) : 0
    entity.reservedCredits =
      entity.reservedCredits != null ? parseCredit(entity.reservedCredits) : 0
    entity.totalCredits =
      typeof entity.totalCredits === 'number'
        ? entity.totalCredits
        : entity.availableCredits + entity.reservedCredits
  }
  entity.children?.forEach((child) => normalizeEntityCredits(child))
}

function sortChildrenByType(entities: HierarchyEntity[]): void {
  entities.forEach((entity) => {
    if (entity.children?.length) {
      entity.children.sort((a, b) => {
        if (a.entityType !== b.entityType) {
          if (a.entityType === 'organization') return -1
          if (b.entityType === 'organization') return 1
        }
        return (a.entityName || '').localeCompare(b.entityName || '')
      })
      sortChildrenByType(entity.children)
    }
  })
}

function buildTreeFromFlat(flatArray: HierarchyEntity[]): HierarchyEntity[] {
  const entityMap = new Map<string, HierarchyEntity>()
  const rootEntities: HierarchyEntity[] = []
  flatArray.forEach((entity) => {
    const node: HierarchyEntity = { ...entity, children: [] }
    normalizeEntityCredits(node)
    entityMap.set(entity.entityId, node)
  })
  flatArray.forEach((entity) => {
    const node = entityMap.get(entity.entityId)
    if (!node) return
    if (entity.parentEntityId && entityMap.has(entity.parentEntityId)) {
      entityMap.get(entity.parentEntityId)!.children!.push(node)
    } else {
      rootEntities.push(node)
    }
  })
  sortChildrenByType(rootEntities)
  return rootEntities
}

function mergeCreditsFromSource(
  entities: HierarchyEntity[],
  sourceData: HierarchyEntity[]
): void {
  entities.forEach((entity) => {
    const src = sourceData.find((e) => e.entityId === entity.entityId)
    if (src) {
      if (src.availableCredits != null)
        entity.availableCredits = parseCredit(src.availableCredits)
      if (src.reservedCredits != null)
        entity.reservedCredits = parseCredit(src.reservedCredits)
      entity.totalCredits =
        parseCredit(entity.availableCredits) +
        parseCredit(entity.reservedCredits)
    }
    if (entity.children?.length)
      mergeCreditsFromSource(entity.children, sourceData)
  })
}

function findRootOrg(hierarchyData: HierarchyEntity[]): HierarchyEntity | null {
  let parent = hierarchyData.find(
    (o) => o.entityType === 'organization' && o.entityLevel === 1
  )
  if (!parent) {
    parent = hierarchyData.find(
      (o) =>
        o.entityType === 'organization' &&
        (o.entityLevel === 0 || !o.parentEntityId)
    )
  }
  if (!parent && hierarchyData.length > 0) {
    parent =
      hierarchyData.find((o) => o.entityType === 'organization') ||
      hierarchyData[0]
  }
  return parent ?? null
}

// Shape of the (loosely-structured) responses returned by makeRequest. Every
// field is optional because different endpoints populate different subsets.
interface HierarchyApiResponse {
  success?: boolean
  message?: string
  hierarchy?: HierarchyEntity[]
  entities?: HierarchyEntity[]
  totalEntities?: number
  data?: {
    hierarchy?: HierarchyEntity[]
    entities?: HierarchyEntity[]
    totalEntities?: number
  }
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useOrganizationHierarchyData(
  tenantId: string,
  makeRequest: (
    endpoint: string,
    options?: RequestInit
  ) => Promise<HierarchyApiResponse>
) {
  const [hierarchy, setHierarchy] = useState<OrganizationHierarchy | null>(null)
  const [parentOrg, setParentOrg] = useState<Organization | null>(null)
  const [locations, setLocations] = useState<Location[]>([])
  const [loading, setLoading] = useState(false)

  const loadData = useCallback(async () => {
    try {
      setLoading(true)
      const hierarchyResponse = await makeRequest(
        `/entities/hierarchy/${tenantId}`,
        {
          headers: { 'X-Application': 'crm' },
        }
      )

      if (!hierarchyResponse?.success) {
        // Fallback
        const fallbackResponse = await makeRequest(`/admin/organizations/all`, {
          headers: { 'X-Application': 'crm' },
        })
        if (fallbackResponse?.success) {
          setHierarchy({
            success: true,
            hierarchy: (
              fallbackResponse.data?.entities ||
              fallbackResponse.entities ||
              []
            ).map((entity) => ({
              ...entity,
              children: [],
            })) as unknown as Organization[],
            totalOrganizations:
              fallbackResponse.data?.entities?.length ||
              fallbackResponse.entities?.length ||
              0,
            message: 'Hierarchy loaded via fallback',
          })
        }
        return
      }

      const rawHierarchy: HierarchyEntity[] =
        hierarchyResponse.data?.hierarchy || hierarchyResponse.hierarchy || []

      const isAlreadyTree =
        rawHierarchy.length > 0 &&
        rawHierarchy.some(
          (e) =>
            e.children && Array.isArray(e.children) && e.children.length > 0
        )

      let hierarchyData: HierarchyEntity[]

      if (isAlreadyTree) {
        hierarchyData = rawHierarchy.map((node) => ({
          ...node,
          children: node.children || [],
        }))
        hierarchyData.forEach((node) => normalizeEntityCredits(node))
        sortChildrenByType(hierarchyData)
      } else {
        hierarchyData = buildTreeFromFlat(rawHierarchy)
      }

      // Re-normalize after tree construction
      hierarchyData.forEach((node) => normalizeEntityCredits(node))

      setParentOrg(
        (findRootOrg(hierarchyData) as unknown as Organization) ?? null
      )

      // Fetch locations and orgs to merge accurate credit values
      const [locRes, orgRes] = await Promise.all([
        makeRequest(`/entities/tenant/${tenantId}?entityType=location`),
        makeRequest(`/entities/tenant/${tenantId}?entityType=organization`),
      ])

      if (locRes?.success) {
        const locationsData = locRes.entities || []
        setLocations(locationsData as unknown as Location[])
        mergeCreditsFromSource(hierarchyData, locationsData)
      }

      if (orgRes?.success) {
        mergeCreditsFromSource(hierarchyData, orgRes.entities || [])
      }

      setHierarchy({
        success: true,
        hierarchy: hierarchyData as unknown as Organization[],
        totalOrganizations:
          hierarchyResponse.data?.totalEntities ||
          hierarchyResponse.totalEntities ||
          0,
        message: hierarchyResponse.message || 'Loaded',
      })
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error)
      toast.error(`Failed to load data: ${message}`)
    } finally {
      setLoading(false)
    }
  }, [tenantId, makeRequest])

  useEffect(() => {
    loadData()
  }, [loadData])

  return { hierarchy, parentOrg, locations, loading, loadData, setLocations }
}
