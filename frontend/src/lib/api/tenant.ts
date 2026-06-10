import { api } from './client'
import type { Tenant, ApiResponse, UnifiedUser } from './types'

export const tenantAPI = {
  getCurrentTenant: () => api.get<Tenant>('/tenants/current'),

  getUsers: () => api.get<ApiResponse<UnifiedUser[]>>('/tenants/current/users'),

  inviteUser: (data: { email: string; roleId: string; message?: string }) =>
    api.post<ApiResponse<unknown>>('/tenants/current/users/invite', data),

  removeUser: (userId: string) =>
    api.delete<ApiResponse<unknown>>(`/tenants/current/users/${userId}`),

  updateUserRole: (userId: string, roleId: string) =>
    api.put<ApiResponse<unknown>>(`/tenants/current/users/${userId}/role`, {
      roleId,
    }),

  getUsage: (params?: {
    period?: string
    startDate?: string
    endDate?: string
  }) => api.get<ApiResponse<unknown>>('/tenants/current/usage', { params }),

  exportUsers: () => api.get('/tenants/current/users/export'),

  getOrganizationAssignments: () =>
    api.get<ApiResponse<unknown>>('/tenants/current/organization-assignments'),

  getTimeline: (params?: {
    limit?: number
    offset?: number
    includeActivity?: boolean
  }) => {
    const queryParams = new URLSearchParams()
    if (params?.limit != null)
      queryParams.append('limit', params.limit.toString())
    if (params?.offset != null)
      queryParams.append('offset', params.offset.toString())
    if (params?.includeActivity !== undefined)
      queryParams.append('includeActivity', params.includeActivity.toString())
    const queryString = queryParams.toString()
    return api.get<
      ApiResponse<{
        events: Array<{
          type: string
          label: string
          date: string
          metadata?: Record<string, unknown>
        }>
        pagination?: {
          offset: number
          limit: number
          activityTotal: number
          hasMore: boolean
        }
      }>
    >(`/tenants/current/timeline${queryString ? `?${queryString}` : ''}`)
  },
}
