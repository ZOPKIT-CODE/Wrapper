import { api } from './client'

export const permissionsAPI = {
  getAvailablePermissions: () => api.get('/api/permissions/available'),

  getApplications: () => api.get('/api/permissions/applications'),

  getUsers: () => api.get('/api/permissions/users'),
  getUserPermissions: (userId: string) => api.get(`/api/permissions/users/${userId}/permissions`),

  bulkAssignPermissions: (assignments: Array<{
    userId: string;
    appId: string;
    moduleId: string;
    permissions: string[];
  }>) => api.post('/api/permissions/bulk-assign', { assignments }),

  getTemplates: () => api.get('/api/permissions/templates'),
  applyTemplate: (userId: string, data: {
    templateId: string;
    clearExisting?: boolean;
  }) => api.post(`/api/permissions/users/${userId}/apply-template`, data),

  removeUserPermissions: (userId: string, data: {
    appId?: string;
    moduleId?: string;
    permissionIds?: string[];
  }) => api.delete(`/api/permissions/users/${userId}/permissions`, { data }),

  getRoles: (params?: { page?: number; limit?: number; search?: string; type?: string }) =>
    api.get('/api/permissions/roles', { params }),
  updateRole: (roleId: string, data: {
    name?: string;
    description?: string;
    permissions?: string[];
    restrictions?: any
  }) => api.put(`/api/permissions/roles/${roleId}`, data),
  deleteRole: (roleId: string, force: boolean = true) => api.delete(`/api/permissions/roles/${roleId}`, { params: { force } }),

  getRoleBuilderOptions: () => api.get('/custom-roles/builder-options'),
  createRoleFromBuilder: (data: {
    roleName: string;
    description?: string;
    selectedApps: string[];
    selectedModules: Record<string, string[]>;
    selectedPermissions: Record<string, string[]>;
    restrictions?: Record<string, boolean>;
    metadata?: any;
  }) => api.post('/custom-roles', data),
  assignUserPermissions: (data: {
    userId: string;
    appCode: string;
    moduleCode: string;
    permissions: string[];
    reason?: string;
    expiresAt?: string;
  }) => api.post('/custom-roles/assign-user-permissions', data),
  getCustomUserPermissions: (userId: string) => api.get(`/custom-roles/user-permissions/${userId}`),
  
  getAssignments: (params?: { 
    userId?: string; 
    roleId?: string; 
    page?: number; 
    limit?: number 
  }) => api.get('/permissions/assignments', { params }),
  assignRole: (data: {
    userId: string;
    roleId: string;
    expiresAt?: string;
    conditions?: any;
  }) => api.post('/permissions/assignments', data),
  removeAssignment: (assignmentId: string) => 
    api.delete(`/permissions/assignments/${assignmentId}`),
  bulkAssignRoles: (assignments: Array<{
    userId: string;
    roleId: string;
    expiresAt?: string;
  }>) => api.post('/permissions/assignments/bulk', { assignments }),
  
  checkPermissions: (data: {
    permissions: string[];
    userId?: string;
    resource?: string;
    context?: any;
  }) => api.post('/permissions/check', data),
  getUserEffectivePermissions: (userId: string) => 
    api.get(`/permissions/user/${userId}/effective`),
  
  getAuditLog: (params?: {
    userId?: string;
    action?: string;
    resource?: string;
    startDate?: string;
    endDate?: string;
    page?: number;
    limit?: number;
  }) => api.get('/permissions/audit', { params }),
}
