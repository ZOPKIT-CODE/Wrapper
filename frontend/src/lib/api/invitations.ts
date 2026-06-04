import { api } from './client'

export const invitationAPI = {
  getAdminInvitations: (orgCode: string) => 
    api.get(`/invitations/admin/${orgCode}`),

  createInvitation: (data: { email: string; roleName: string }) => 
    api.post('/invitations/create', data),

  createTestInvitation: (data: { orgCode: string; email: string; roleName: string }) => 
    api.post('/invitations/create-test-invitation', data),

  resendInvitation: (orgCode: string, invitationId: string) => 
    api.post(`/invitations/admin/${orgCode}/${invitationId}/resend`),

  cancelInvitation: (orgCode: string, invitationId: string) => 
    api.delete(`/invitations/admin/${orgCode}/${invitationId}`),

  getInvitationDetails: (org: string, email: string) => 
    api.get('/invitations/details', { params: { org, email } }),

  acceptInvitation: (data: { org: string; email: string; idpSub: string }) =>
    api.post('/invitations/accept', data),

  assignOrganizationToUser: (userId: string, data: {
    entityId: string;
    roleId?: string;
    membershipType?: string;
    isPrimary?: boolean;
  }) => api.post(`/admin/users/${userId}/organizations`, data),

  removeOrganizationFromUser: (userId: string, membershipId: string) =>
    api.delete(`/admin/users/${userId}/organizations/${membershipId}`),

  updateUserOrganizationRole: (userId: string, membershipId: string, data: { roleId?: string | null }) =>
    api.put(`/admin/users/${userId}/organizations/${membershipId}`, data)
}
