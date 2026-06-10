import { api } from './client'

export const creditConfigurationAPI = {
  getTenantConfigurations: (tenantId: string) =>
    api.get(`/admin/credit-configurations/${tenantId}`),

  updateTenantOperationConfig: (
    tenantId: string,
    operationCode: string,
    data: {
      creditCost?: number
      unit?: string
      unitMultiplier?: number
      freeAllowance?: number
      freeAllowancePeriod?: string
      volumeTiers?: Array<{
        minVolume: number
        maxVolume: number
        creditCost: number
        isActive: boolean
      }>
      allowOverage?: boolean
      overageLimit?: number
      overagePeriod?: string
      overageCost?: number
      scope?: string
      isActive?: boolean
    }
  ) =>
    api.put(
      `/admin/credit-configurations/${tenantId}/operation/${operationCode}`,
      data
    ),

  updateTenantModuleConfig: (
    tenantId: string,
    moduleCode: string,
    data: {
      defaultCreditCost?: number
      defaultUnit?: string
      maxOperationsPerPeriod?: number
      periodType?: string
      creditBudget?: number
      budgetResetPeriod?: string
      allowOverBudget?: boolean
      scope?: string
      isActive?: boolean
    }
  ) =>
    api.put(
      `/admin/credit-configurations/${tenantId}/module/${moduleCode}`,
      data
    ),

  updateTenantAppConfig: (
    tenantId: string,
    appCode: string,
    data: {
      defaultCreditCost?: number
      defaultUnit?: string
      maxOperationsPerPeriod?: number
      periodType?: string
      creditBudget?: number
      budgetResetPeriod?: string
      allowOverBudget?: boolean
      scope?: string
      isActive?: boolean
    }
  ) => api.put(`/admin/credit-configurations/${tenantId}/app/${appCode}`, data),

  resetTenantConfig: (
    tenantId: string,
    configType: 'operation' | 'module' | 'app',
    configCode: string
  ) =>
    api.delete(
      `/admin/credit-configurations/${tenantId}/${configType}/${configCode}`
    ),

  getTenantsForConfig: () => api.get('/admin/credit-configurations/tenants'),

  bulkUpdateTenantConfigs: (data: {
    tenantIds: string[]
    configType: 'operation' | 'module' | 'app'
    configCode: string
    configData: Record<string, unknown>
  }) => api.post('/admin/credit-configurations/bulk-update', data),
}

export const applicationCreditAPI = {
  getApplicationCreditConfigs: () =>
    api.get('/admin/credit-configurations/applications'),

  updateApplicationCreditConfig: (
    appCode: string,
    data: {
      defaultCreditCost?: number
      defaultUnit?: string
      maxOperationsPerPeriod?: number
      periodType?: string
      creditBudget?: number
      budgetResetPeriod?: string
      allowOverBudget?: boolean
      scope?: string
      isActive?: boolean
    }
  ) => api.put(`/admin/credit-configurations/applications/${appCode}`, data),

  updateModuleCreditConfig: (
    appCode: string,
    moduleCode: string,
    data: {
      defaultCreditCost?: number
      defaultUnit?: string
      maxOperationsPerPeriod?: number
      periodType?: string
      creditBudget?: number
      budgetResetPeriod?: string
      allowOverBudget?: boolean
      scope?: string
      isActive?: boolean
    }
  ) =>
    api.put(
      `/admin/credit-configurations/applications/${appCode}/modules/${moduleCode}`,
      data
    ),

  bulkUpdateApplicationConfigs: (data: {
    appCodes: string[]
    configData: Record<string, unknown>
  }) => api.post('/admin/credit-configurations/applications/bulk-update', data),

  createTenantOperationCost: (
    tenantId: string,
    data: {
      operationCode: string
      operationName?: string
      creditCost: number
      unit?: string
      unitMultiplier?: number
      category?: string
      freeAllowance?: number
      freeAllowancePeriod?: string
      volumeTiers?: Array<{
        minVolume: number
        maxVolume: number
        creditCost: number
        isActive: boolean
      }>
      allowOverage?: boolean
      overageLimit?: number
      overagePeriod?: string
      overageCost?: number
      scope?: string
      isActive?: boolean
      priority?: number
    }
  ) =>
    api.post(
      `/admin/credit-configurations/tenant/${tenantId}/operations`,
      data
    ),

  initializeTenantCredits: (tenantId: string, initialCredits: number = 1000) =>
    api.post(`/admin/credit-configurations/initialize-credits/${tenantId}`, {
      initialCredits,
    }),
}
