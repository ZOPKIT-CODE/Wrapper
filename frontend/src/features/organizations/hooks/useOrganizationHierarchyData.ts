import { useState, useEffect } from 'react'
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
  address?: any
}

interface OrganizationHierarchy {
  success: boolean
  hierarchy: Organization[]
  totalOrganizations: number
  message: string
}

// ---------------------------------------------------------------------------
// Credit helpers (pure functions — no state)
// ---------------------------------------------------------------------------

function parseCredit(val: any): number {
  if (typeof val === 'number') return val
  if (typeof val === 'string') return parseFloat(val) || 0
  return 0
}

function normalizeEntityCredits(entity: any): void {
  if (entity.entityType === 'organization' || entity.entityType === 'location') {
    entity.availableCredits = entity.availableCredits != null ? parseCredit(entity.availableCredits) : 0
    entity.reservedCredits = entity.reservedCredits != null ? parseCredit(entity.reservedCredits) : 0
    entity.totalCredits = typeof entity.totalCredits === 'number'
      ? entity.totalCredits
      : entity.availableCredits + entity.reservedCredits
  }
  entity.children?.forEach((child: any) => normalizeEntityCredits(child))
}

function sortChildrenByType(entities: any[]): void {
  entities.forEach((entity) => {
    if (entity.children?.length) {
      entity.children.sort((a: any, b: any) => {
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

function buildTreeFromFlat(flatArray: any[]): any[] {
  const entityMap = new Map<string, any>()
  const rootEntities: any[] = []
  flatArray.forEach((entity: any) => {
    const node = { ...entity, children: [] }
    normalizeEntityCredits(node)
    entityMap.set(entity.entityId, node)
  })
  flatArray.forEach((entity: any) => {
    const node = entityMap.get(entity.entityId)
    if (entity.parentEntityId && entityMap.has(entity.parentEntityId)) {
      entityMap.get(entity.parentEntityId).children.push(node)
    } else {
      rootEntities.push(node)
    }
  })
  sortChildrenByType(rootEntities)
  return rootEntities
}

function mergeCreditsFromSource(entities: any[], sourceData: any[]): void {
  entities.forEach((entity: any) => {
    const src = sourceData.find((e: any) => e.entityId === entity.entityId)
    if (src) {
      if (src.availableCredits != null) entity.availableCredits = parseCredit(src.availableCredits)
      if (src.reservedCredits != null) entity.reservedCredits = parseCredit(src.reservedCredits)
      entity.totalCredits = (entity.availableCredits || 0) + (entity.reservedCredits || 0)
    }
    if (entity.children?.length) mergeCreditsFromSource(entity.children, sourceData)
  })
}

function findRootOrg(hierarchyData: any[]): any | null {
  let parent = hierarchyData.find((o: any) => o.entityType === 'organization' && o.entityLevel === 1)
  if (!parent) {
    parent = hierarchyData.find((o: any) =>
      o.entityType === 'organization' && (o.entityLevel === 0 || !o.parentEntityId)
    )
  }
  if (!parent && hierarchyData.length > 0) {
    parent = hierarchyData.find((o: any) => o.entityType === 'organization') || hierarchyData[0]
  }
  return parent ?? null
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useOrganizationHierarchyData(
  tenantId: string,
  makeRequest: (endpoint: string, options?: RequestInit) => Promise<any>
) {
  const [hierarchy, setHierarchy] = useState<OrganizationHierarchy | null>(null)
  const [parentOrg, setParentOrg] = useState<Organization | null>(null)
  const [locations, setLocations] = useState<Location[]>([])
  const [loading, setLoading] = useState(false)

  const loadData = async () => {
    try {
      setLoading(true)
      const hierarchyResponse = await makeRequest(`/entities/hierarchy/${tenantId}`, {
        headers: { 'X-Application': 'crm' },
      })

      if (!hierarchyResponse?.success) {
        // Fallback
        const fallbackResponse = await makeRequest(`/admin/organizations/all`, {
          headers: { 'X-Application': 'crm' },
        })
        if (fallbackResponse?.success) {
          setHierarchy({
            success: true,
            hierarchy: (fallbackResponse.data?.entities || fallbackResponse.entities || []).map(
              (entity: any) => ({ ...entity, children: [] })
            ),
            totalOrganizations:
              fallbackResponse.data?.entities?.length || fallbackResponse.entities?.length || 0,
            message: 'Hierarchy loaded via fallback',
          })
        }
        return
      }

      const rawHierarchy = hierarchyResponse.data?.hierarchy || hierarchyResponse.hierarchy || []

      const isAlreadyTree =
        rawHierarchy.length > 0 &&
        rawHierarchy.some((e: any) => e.children && Array.isArray(e.children) && e.children.length > 0)

      let hierarchyData: any[]

      if (isAlreadyTree) {
        hierarchyData = rawHierarchy.map((node: any) => ({ ...node, children: node.children || [] }))
        hierarchyData.forEach((node: any) => normalizeEntityCredits(node))
        sortChildrenByType(hierarchyData)
      } else {
        hierarchyData = buildTreeFromFlat(rawHierarchy)
      }

      // Re-normalize after tree construction
      hierarchyData.forEach((node: any) => normalizeEntityCredits(node))

      setParentOrg(findRootOrg(hierarchyData))

      // Fetch locations and orgs to merge accurate credit values
      const [locRes, orgRes] = await Promise.all([
        makeRequest(`/entities/tenant/${tenantId}?entityType=location`),
        makeRequest(`/entities/tenant/${tenantId}?entityType=organization`),
      ])

      if (locRes?.success) {
        const locationsData = locRes.entities || []
        setLocations(locationsData)
        mergeCreditsFromSource(hierarchyData, locationsData)
      }

      if (orgRes?.success) {
        mergeCreditsFromSource(hierarchyData, orgRes.entities || [])
      }

      setHierarchy({
        success: true,
        hierarchy: hierarchyData,
        totalOrganizations:
          hierarchyResponse.data?.totalEntities || hierarchyResponse.totalEntities || 0,
        message: hierarchyResponse.message || 'Loaded',
      })
    } catch (error: any) {
      toast.error(`Failed to load data: ${error.message}`)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadData() }, [tenantId])

  return { hierarchy, parentOrg, locations, loading, loadData, setLocations }
}
