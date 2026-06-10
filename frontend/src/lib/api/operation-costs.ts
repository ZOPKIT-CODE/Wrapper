import { api } from './client'
import { creditConfigurationAPI } from './credit-configuration'

export const operationCostAPI = {
  /** @deprecated Use getGlobalOperationCosts or getTenantOperationCosts instead */
  getOperationCosts: (params?: {
    search?: string
    category?: string
    isGlobal?: boolean
    isActive?: boolean
    includeUsage?: boolean
  }) => api.get('/admin/operation-costs', { params }),

  getGlobalOperationCosts: (params?: {
    search?: string
    category?: string
    isActive?: boolean
    includeUsage?: boolean
  }) => api.get('/admin/operation-costs/global', { params }),

  getTenantOperationCosts: (
    tenantId: string,
    params?: {
      search?: string
      category?: string
      isActive?: boolean
      includeUsage?: boolean
    }
  ) => api.get(`/admin/operation-costs/tenant/${tenantId}`, { params }),

  createOperationCost: (data: {
    operationCode: string
    operationName?: string
    creditCost: number
    unit?: string
    unitMultiplier?: number
    category?: string
    isGlobal?: boolean
    isActive?: boolean
    priority?: number
    tenantId?: string
  }) => api.post('/admin/operation-costs', data),

  updateOperationCost: (
    configId: string,
    data: {
      operationCode?: string
      creditCost?: number
      unit?: string
      unitMultiplier?: number
      isGlobal?: boolean
      isActive?: boolean
    }
  ) => api.put(`/admin/operation-costs/${configId}`, data),

  deleteOperationCost: (configId: string) =>
    api.delete(`/admin/operation-costs/${configId}`),

  getAnalytics: () => api.get('/admin/operation-costs/analytics'),

  getTemplates: () => api.get('/admin/operation-costs/templates'),

  applyTemplate: (data: { templateId: string }) =>
    api.post('/admin/operation-costs/apply-template', data),

  exportCosts: () =>
    api.get('/admin/operation-costs/export', {
      responseType: 'blob',
    }),
}

export const smartOperationCostAPI = {
  /**
   * Smart fetch — automatically chooses the best endpoint based on context.
   * When both global and tenant-specific costs are needed, uses the comprehensive endpoint.
   */
  getSmartOperationCosts: async (context: {
    tenantId?: string
    includeGlobal?: boolean
    params?: {
      search?: string
      category?: string
      isActive?: boolean
      includeUsage?: boolean
    }
  }) => {
    const { tenantId, includeGlobal = true, params } = context

    if (!tenantId) {
      return operationCostAPI.getGlobalOperationCosts(params)
    }

    if (!includeGlobal) {
      return operationCostAPI.getTenantOperationCosts(tenantId, params)
    }

    return creditConfigurationAPI.getTenantConfigurations(tenantId)
  },

  /**
   * Get the effective cost for an operation using fallback hierarchy:
   * tenant-specific → global → null
   */
  getEffectiveOperationCost: async (
    operationCode: string,
    tenantId?: string
  ) => {
    if (!tenantId) {
      const response = await operationCostAPI.getGlobalOperationCosts({
        search: operationCode,
      })
      const operation = response.data.operations.find(
        (op: { operationCode: string }) => op.operationCode === operationCode
      )
      return operation || null
    }

    const response =
      await creditConfigurationAPI.getTenantConfigurations(tenantId)

    let operation = response.data.configurations.operations.find(
      (op: { operationCode: string }) => op.operationCode === operationCode
    )
    if (operation) return operation

    operation = response.data.globalConfigs.operations.find(
      (op: { operationCode: string }) => op.operationCode === operationCode
    )
    if (operation) return operation

    return null
  },
}
