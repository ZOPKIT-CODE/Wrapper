import React, {
  createContext,
  useContext,
  useCallback,
  ReactNode,
  useMemo,
} from 'react'
import {
  useEntityScope as useEntityScopeQuery,
  useInvalidateQueries,
} from '@/hooks/useSharedQueries'

export interface EntityScope {
  scope: 'tenant' | 'entity' | 'none'
  entityIds: string[]
  isUnrestricted: boolean
  responsibilities?: unknown[]
  userEmail?: string
}

interface EntityScopeContextType {
  entityScope: EntityScope | null
  loading: boolean
  canAccessEntity: (entityId: string) => boolean
  isTenantAdmin: boolean
  isEntityAdmin: boolean
  refreshEntityScope: () => Promise<void>
}

const EntityScopeContext = createContext<EntityScopeContextType | null>(null)

interface EntityScopeProviderProps {
  children: ReactNode
}

export const EntityScopeProvider: React.FC<EntityScopeProviderProps> = ({
  children,
}) => {
  // Use shared hook with caching instead of direct API calls
  const {
    data: entityScope,
    isLoading: loading,
    refetch,
  } = useEntityScopeQuery()
  const { invalidateEntityScope } = useInvalidateQueries()

  const canAccessEntity = useCallback(
    (entityId: string): boolean => {
      if (!entityScope) return false
      if (entityScope.isUnrestricted) return true
      return entityScope.entityIds.includes(entityId)
    },
    [entityScope]
  )

  const refreshEntityScope = useCallback(async () => {
    invalidateEntityScope()
    await refetch()
  }, [invalidateEntityScope, refetch])

  const value: EntityScopeContextType = useMemo(
    () => ({
      entityScope: entityScope || null,
      loading,
      canAccessEntity,
      isTenantAdmin: entityScope?.isUnrestricted || false,
      isEntityAdmin: entityScope?.scope === 'entity',
      refreshEntityScope,
    }),
    [entityScope, loading, canAccessEntity, refreshEntityScope]
  )

  return (
    <EntityScopeContext.Provider value={value}>
      {children}
    </EntityScopeContext.Provider>
  )
}

export const useEntityScope = (): EntityScopeContextType => {
  const context = useContext(EntityScopeContext)
  if (!context) {
    throw new Error('useEntityScope must be used within EntityScopeProvider')
  }
  return context
}

export default EntityScopeProvider
