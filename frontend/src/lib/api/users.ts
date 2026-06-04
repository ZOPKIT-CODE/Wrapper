import { api } from './client'

export interface UserListParams {
  search?: string
  status?: 'active' | 'invited' | 'inactive' | 'all'
  page?: number
  limit?: number
  sortBy?: 'name' | 'email' | 'createdAt' | 'lastActiveAt'
  sortOrder?: 'asc' | 'desc'
}

export interface InvitationListParams {
  status?: 'pending' | 'accepted' | 'expired' | 'cancelled' | 'all'
  search?: string
  page?: number
  limit?: number
}

export interface InviteUserData {
  email: string
  roleId?: string
  targetEntities?: Array<{ entityId: string; roleId?: string; entityType?: string }>
  message?: string
}

export interface UpdateProfileData {
  firstName?: string
  lastName?: string
  name?: string
  title?: string
  department?: string
  phone?: string
}

export interface AssignRoleData {
  userId: string
  roleId: string
  organizationId?: string
  scope?: string
  isTemporary?: boolean
  expiresAt?: string
}

export interface AssignOrganizationData {
  entityId: string
  accessLevel?: 'admin' | 'manager' | 'standard' | 'limited'
}

export const usersAPI = {
  getUsers: (params?: UserListParams) =>
    api.get('/users', { params }),

  getUserDetail: (userId: string) =>
    api.get(`/users/${userId}`),

  getUserStats: () =>
    api.get('/users/stats'),

  getInvitations: (params?: InvitationListParams) =>
    api.get('/users/invitations', { params }),

  getAvailableRoles: () =>
    api.get('/users/roles/available'),

  getUserRoles: (userId: string) =>
    api.get(`/users/${userId}/roles`),

  inviteUser: (data: InviteUserData) =>
    api.post('/users/invite', data),

  updateProfile: (userId: string, data: UpdateProfileData) =>
    api.put(`/users/${userId}/profile`, data),

  updateStatus: (userId: string, isActive: boolean) =>
    api.put(`/users/${userId}/status`, { isActive }),

  removeUser: (userId: string) =>
    api.delete(`/users/${userId}`),

  assignRole: (data: AssignRoleData) =>
    api.post(`/users/${data.userId}/roles`, data),

  removeRoleAssignment: (userId: string, assignmentId: string) =>
    api.delete(`/users/${userId}/roles/${assignmentId}`),

  addOrganizationMembership: (userId: string, data: AssignOrganizationData) =>
    api.post(`/users/${userId}/organizations`, data),

  removeOrganizationMembership: (userId: string, membershipId: string) =>
    api.delete(`/users/${userId}/organizations/${membershipId}`),

  resendInvitation: (invitationId: string) =>
    api.post(`/users/invitations/${invitationId}/resend`),

  cancelInvitation: (invitationId: string) =>
    api.delete(`/users/invitations/${invitationId}`),
}
