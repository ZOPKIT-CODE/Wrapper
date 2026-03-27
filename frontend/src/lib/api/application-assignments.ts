import { api } from './client'

export const applicationAssignmentAPI = {
  getOverview: () => api.get('/admin/application-assignments/overview'),

  getTenants: (params?: {
    search?: string;
    hasApps?: boolean;
    appCode?: string;
    limit?: number;
    offset?: number;
  }) => api.get('/admin/application-assignments/tenants', { params }),

  getTenantAssignments: (tenantId: string) =>
    api.get(`/admin/application-assignments/tenant/${tenantId}`),

  getTenantApplications: (tenantId: string) =>
    api.get(`/admin/application-assignments/tenant-apps/${tenantId}`),

  assignApplication: (data: {
    tenantId: string;
    appId: string;
    isEnabled?: boolean;
    subscriptionTier?: string;
    enabledModules?: string[];
    customPermissions?: Record<string, string[]>;
    licenseCount?: number;
    maxUsers?: number;
    expiresAt?: string;
  }) => api.post('/admin/application-assignments/assign', data),

  updateAssignment: (assignmentId: string, data: {
    isEnabled?: boolean;
    subscriptionTier?: string;
    enabledModules?: string[];
    licenseCount?: number;
    maxUsers?: number;
    expiresAt?: string;
  }) => api.put(`/admin/application-assignments/${assignmentId}`, data),

  removeAssignment: (assignmentId: string) =>
    api.delete(`/admin/application-assignments/${assignmentId}`),

  bulkAssign: (data: {
    tenantIds: string[];
    appIds: string[];
    defaultConfig?: {
      isEnabled?: boolean;
      subscriptionTier?: string;
      enabledModules?: string[];
      customPermissions?: Record<string, string[]>;
      licenseCount?: number;
      maxUsers?: number;
    };
  }) => api.post('/admin/application-assignments/bulk-assign', data),

  getApplications: (params?: {
    includeModules?: boolean;
  }) => api.get('/admin/application-assignments/applications', { params }),

  assignModule: (data: {
    tenantId: string;
    moduleId: string;
  }) => api.post('/admin/application-assignments/assign-module', data),

  updateModulePermissions: (data: {
    tenantId: string;
    moduleId: string;
    permissions: string[];
  }) => api.put('/admin/application-assignments/module-permissions', data),

  removeModule: (data: {
    tenantId: string;
    moduleId: string;
  }) => api.delete('/admin/application-assignments/modules', { data }),

  getTenantModules: (tenantId: string) =>
    api.get(`/admin/application-assignments/tenant-modules/${tenantId}`)
}
