import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  usersAPI,
  UserListParams,
  InvitationListParams,
  InviteUserData,
  UpdateProfileData,
  AssignRoleData,
} from '@/lib/api/users'
import { toast } from 'sonner'

const userKeys = {
  all: ['users'] as const,
  list: (params?: UserListParams) => [...userKeys.all, 'list', params] as const,
  detail: (userId: string) => [...userKeys.all, 'detail', userId] as const,
  stats: () => [...userKeys.all, 'stats'] as const,
  roles: (userId: string) => [...userKeys.all, 'roles', userId] as const,
  invitations: (params?: InvitationListParams) =>
    [...userKeys.all, 'invitations', params] as const,
  availableRoles: () => [...userKeys.all, 'availableRoles'] as const,
}

export function useUsers(params?: UserListParams) {
  return useQuery({
    queryKey: userKeys.list(params),
    queryFn: async () => {
      const { data } = await usersAPI.getUsers(params)
      return data.data
    },
  })
}

export function useUserDetail(userId: string | null) {
  return useQuery({
    queryKey: userKeys.detail(userId!),
    queryFn: async () => {
      const { data } = await usersAPI.getUserDetail(userId!)
      return data.data
    },
    enabled: !!userId,
  })
}

export function useUserStats() {
  return useQuery({
    queryKey: userKeys.stats(),
    queryFn: async () => {
      const { data } = await usersAPI.getUserStats()
      return data.data
    },
  })
}

export function useInvitations(params?: InvitationListParams) {
  return useQuery({
    queryKey: userKeys.invitations(params),
    queryFn: async () => {
      const { data } = await usersAPI.getInvitations(params)
      return data.data
    },
  })
}

export function useAvailableRoles() {
  return useQuery({
    queryKey: userKeys.availableRoles(),
    queryFn: async () => {
      const { data } = await usersAPI.getAvailableRoles()
      return data.data
    },
  })
}

export function useUserRoles(userId: string | null) {
  return useQuery({
    queryKey: userKeys.roles(userId!),
    queryFn: async () => {
      const { data } = await usersAPI.getUserRoles(userId!)
      return data.data
    },
    enabled: !!userId,
  })
}

export function useInviteUser() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: InviteUserData) => usersAPI.inviteUser(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: userKeys.all })
      toast.success('Invitation sent successfully')
    },
    onError: (err: Error & { response?: { data?: { error?: string } } }) => {
      toast.error(err?.response?.data?.error || 'Failed to send invitation')
    },
  })
}

export function useUpdateProfile() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ userId, data }: { userId: string; data: UpdateProfileData }) =>
      usersAPI.updateProfile(userId, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: userKeys.all })
      toast.success('Profile updated')
    },
    onError: (err: Error & { response?: { data?: { error?: string } } }) => {
      toast.error(err?.response?.data?.error || 'Failed to update profile')
    },
  })
}

export function useUpdateUserStatus() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ userId, isActive }: { userId: string; isActive: boolean }) =>
      usersAPI.updateStatus(userId, isActive),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: userKeys.all })
      toast.success('User status updated')
    },
    onError: (err: Error & { response?: { data?: { error?: string } } }) => {
      toast.error(err?.response?.data?.error || 'Failed to update status')
    },
  })
}

export function useRemoveUser() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (userId: string) => usersAPI.removeUser(userId),
    onSuccess: (_data, userId) => {
      qc.invalidateQueries({ queryKey: userKeys.all })
      toast.success(userId.startsWith('inv_') ? 'Invitation cancelled' : 'User removed')
    },
    onError: (err: Error & { response?: { data?: { error?: string } } }) => {
      toast.error(err?.response?.data?.error || 'Failed to remove user')
    },
  })
}

export function useAssignRole() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: AssignRoleData) => usersAPI.assignRole(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: userKeys.all })
      toast.success('Role assigned')
    },
    onError: (err: Error & { response?: { data?: { error?: string } } }) => {
      toast.error(err?.response?.data?.error || 'Failed to assign role')
    },
  })
}

export function useRemoveRoleAssignment() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ userId, assignmentId }: { userId: string; assignmentId: string }) =>
      usersAPI.removeRoleAssignment(userId, assignmentId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: userKeys.all })
      toast.success('Role removed')
    },
    onError: (err: Error & { response?: { data?: { error?: string } } }) => {
      toast.error(err?.response?.data?.error || 'Failed to remove role')
    },
  })
}

export function useRemoveOrganizationMembership() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ userId, membershipId }: { userId: string; membershipId: string }) =>
      usersAPI.removeOrganizationMembership(userId, membershipId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: userKeys.all })
      toast.success('Organization assignment removed')
    },
    onError: (err: Error & { response?: { data?: { error?: string } } }) => {
      toast.error(err?.response?.data?.error || 'Failed to remove organization assignment')
    },
  })
}

export function useResendInvitation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (invitationId: string) => usersAPI.resendInvitation(invitationId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: userKeys.all })
      toast.success('Invitation resent')
    },
    onError: (err: Error & { response?: { data?: { error?: string } } }) => {
      toast.error(err?.response?.data?.error || 'Failed to resend invitation')
    },
  })
}

export function useCancelInvitation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (invitationId: string) => usersAPI.cancelInvitation(invitationId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: userKeys.all })
      toast.success('Invitation cancelled')
    },
    onError: (err: Error & { response?: { data?: { error?: string } } }) => {
      toast.error(err?.response?.data?.error || 'Failed to cancel invitation')
    },
  })
}
