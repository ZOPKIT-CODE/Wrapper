import { useQuery } from '@tanstack/react-query'
import api from '@/lib/api'

// Types based on the hierarchy chart component
interface Entity {
  entityId: string
  entityName: string
  entityType: 'organization' | 'location' | 'department' | 'team'
  organizationType?: string
  locationType?: string
  departmentType?: string
  teamType?: string
  entityLevel: number
  hierarchyPath: string
  fullHierarchyPath: string
  parentEntityId?: string
  responsiblePersonId?: string
  responsiblePersonName?: string
  isActive: boolean
  description?: string
  children: Entity[]
  availableCredits?: number
  reservedCredits?: number
  address?: {
    street: string
    city: string
    state: string
    zipCode: string
    country: string
  }
  createdAt?: string
  updatedAt?: string
}

export function useOrganizationHierarchy(tenantId?: string) {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['organizations', 'hierarchy', tenantId],
    queryFn: async () => {
      if (!tenantId) {
        throw new Error('No tenant ID provided')
      }

      // REAL API CALL - Now working with the correct response format
      const response = await api(`/admin/entities/hierarchy/${tenantId}`, {
        method: 'GET',
        headers: { 'X-Application': 'crm' },
      })

      // Extract hierarchy data from the API response
      // The response structure is: axios_response.data = api_response
      // So we need: response.data.data.hierarchy
      let hierarchyData = null

      if (
        response &&
        response.data &&
        response.data.data &&
        response.data.data.hierarchy &&
        Array.isArray(response.data.data.hierarchy)
      ) {
        hierarchyData = response.data.data.hierarchy
      } else if (
        response &&
        response.data &&
        response.data.hierarchy &&
        Array.isArray(response.data.hierarchy)
      ) {
        hierarchyData = response.data.hierarchy
      } else {
        throw new Error('Failed to load hierarchy - unexpected response format')
      }

      // Parse credits from strings to numbers recursively
      type RawEntity = Omit<
        Entity,
        'availableCredits' | 'reservedCredits' | 'children'
      > & {
        availableCredits?: string | number | null
        reservedCredits?: string | number | null
        children?: RawEntity[]
      }
      const parseCredits = (entities: RawEntity[]): Entity[] => {
        return entities.map((entity) => {
          const parsedEntity: Entity = {
            ...entity,
            availableCredits:
              entity.availableCredits !== undefined &&
              entity.availableCredits !== null
                ? typeof entity.availableCredits === 'string'
                  ? parseFloat(entity.availableCredits) || 0
                  : typeof entity.availableCredits === 'number'
                    ? entity.availableCredits
                    : 0
                : undefined,
            reservedCredits:
              entity.reservedCredits !== undefined &&
              entity.reservedCredits !== null
                ? typeof entity.reservedCredits === 'string'
                  ? parseFloat(entity.reservedCredits) || 0
                  : typeof entity.reservedCredits === 'number'
                    ? entity.reservedCredits
                    : 0
                : undefined,
            children:
              entity.children && Array.isArray(entity.children)
                ? parseCredits(entity.children)
                : [],
          }
          return parsedEntity
        })
      }

      return parseCredits(hierarchyData) as Entity[]
    },
    enabled: !!tenantId,
    staleTime: 30 * 1000, // 30 seconds - data is considered fresh for 30 seconds
    refetchOnWindowFocus: true, // Refetch when window regains focus
  })

  return {
    hierarchy: data || null,
    loading: isLoading,
    error: error ? (error as Error).message : null,
    refetch,
  }
}
