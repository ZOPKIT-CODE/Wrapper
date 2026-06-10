import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  DashboardRole,
  RoleFilters,
  RoleListResponse,
  RoleFormData,
} from '@/types/role-management'
import api from '@/lib/api'
import { toast } from 'sonner'

// Query key factory
export const roleKeys = {
  all: ['roles'] as const,
  lists: () => [...roleKeys.all, 'list'] as const,
  list: (filters: RoleFilters) => [...roleKeys.lists(), { filters }] as const,
  details: () => [...roleKeys.all, 'detail'] as const,
  detail: (id: string) => [...roleKeys.details(), id] as const,
}

// Fetch roles with filters
const fetchRoles = async (filters: RoleFilters): Promise<RoleListResponse> => {
  const response = await api.get('/permissions/roles', {
    params: {
      search: filters.searchQuery,
      type: filters.typeFilter !== 'all' ? filters.typeFilter : undefined,
      page: filters.page,
      limit: filters.pageSize,
      sort: filters.sortBy,
      order: filters.sortOrder,
    },
  })

  if (!response.data.success) {
    throw new Error(response.data.message || 'Failed to fetch roles')
  }

  return response.data.data
}

// Fetch single role
const fetchRole = async (roleId: string): Promise<DashboardRole> => {
  const response = await api.get(`/permissions/roles/${roleId}`)

  if (!response.data.success) {
    throw new Error(response.data.message || 'Failed to fetch role')
  }

  return response.data.data
}

// Create role
const createRole = async (roleData: RoleFormData): Promise<DashboardRole> => {
  const response = await api.post('/permissions/roles', roleData)

  if (!response.data.success) {
    throw new Error(response.data.message || 'Failed to create role')
  }

  return response.data.data
}

// Update role
const updateRole = async ({
  roleId,
  roleData,
}: {
  roleId: string
  roleData: RoleFormData
}): Promise<DashboardRole> => {
  const response = await api.put(`/permissions/roles/${roleId}`, roleData)

  if (!response.data.success) {
    throw new Error(response.data.message || 'Failed to update role')
  }

  return response.data.data
}

// Delete role
const deleteRole = async (
  roleId: string,
  force: boolean = true
): Promise<void> => {
  const response = await api.delete(`/permissions/roles/${roleId}`, {
    params: { force },
  })

  if (!response.data.success) {
    throw new Error(response.data.message || 'Failed to delete role')
  }
}

// Bulk delete roles
const bulkDeleteRoles = async (roleIds: string[]): Promise<void> => {
  // For now, delete one by one (could be optimized with bulk delete endpoint)
  for (const roleId of roleIds) {
    await deleteRole(roleId)
  }
}

// Custom hook for fetching roles with filters
export const useRoles = (filters: RoleFilters) => {
  return useQuery({
    queryKey: roleKeys.list(filters),
    queryFn: () => fetchRoles(filters),
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
  })
}

// Custom hook for fetching single role
export const useRole = (roleId: string, enabled = true) => {
  return useQuery({
    queryKey: roleKeys.detail(roleId),
    queryFn: () => fetchRole(roleId),
    enabled,
    staleTime: 10 * 60 * 1000, // 10 minutes
  })
}

// Custom hook for role mutations
export const useRoleMutations = () => {
  const queryClient = useQueryClient()

  const createMutation = useMutation({
    mutationFn: createRole,
    onSuccess: (data) => {
      // Invalidate and refetch roles list
      queryClient.invalidateQueries({ queryKey: roleKeys.lists() })
      toast.success(`Role "${data.roleName}" created successfully!`)
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to create role')
    },
  })

  const updateMutation = useMutation({
    mutationFn: updateRole,
    onSuccess: (data) => {
      // Invalidate and refetch roles list
      queryClient.invalidateQueries({ queryKey: roleKeys.lists() })
      // Update the specific role in cache
      queryClient.setQueryData(roleKeys.detail(data.roleId), data)
      toast.success(`Role "${data.roleName}" updated successfully!`)
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to update role')
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (roleId: string) => deleteRole(roleId),
    onSuccess: (_, roleId) => {
      // Invalidate and refetch roles list
      queryClient.invalidateQueries({ queryKey: roleKeys.lists() })
      // Remove the specific role from cache
      queryClient.removeQueries({ queryKey: roleKeys.detail(roleId) })
      toast.success('Role deleted successfully!')
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to delete role')
    },
  })

  const bulkDeleteMutation = useMutation({
    mutationFn: bulkDeleteRoles,
    onSuccess: (_, roleIds) => {
      // Invalidate and refetch roles list
      queryClient.invalidateQueries({ queryKey: roleKeys.lists() })
      // Remove specific roles from cache
      roleIds.forEach((roleId) => {
        queryClient.removeQueries({ queryKey: roleKeys.detail(roleId) })
      })
      toast.success(`${roleIds.length} roles deleted successfully!`)
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to delete roles')
    },
  })

  return {
    createRole: createMutation.mutateAsync,
    updateRole: updateMutation.mutateAsync,
    deleteRole: deleteMutation.mutateAsync,
    bulkDeleteRoles: bulkDeleteMutation.mutateAsync,
    isCreating: createMutation.isPending,
    isUpdating: updateMutation.isPending,
    isDeleting: deleteMutation.isPending,
    isBulkDeleting: bulkDeleteMutation.isPending,
  }
}
