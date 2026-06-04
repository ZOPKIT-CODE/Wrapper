import { api } from './client'

export const onboardingAPI = {
  checkSubdomain: async (subdomain: string) => {
    return await api.get(`/onboarding/check-subdomain?subdomain=${subdomain}`)
  },

  checkStatus: async () => {
    return await api.get('/onboarding/status')
  },

  markUserAsOnboarded: async (tenantId: string) => {
    return await api.post('/onboarding/mark-onboarded', { tenantId })
  },

  getUserOrganization: () => api.get('/onboarding/user-organization'),
  
  getDataByEmail: (email: string) => 
    api.post('/onboarding/get-data', { email }),
  
  markComplete: (organizationId: string) => 
    api.post('/onboarding/mark-complete', { organizationId }),
  
  updateStep: (step: string, data?: any, email?: string, formData?: any, idpSub?: string) => 
    api.post('/onboarding/update-step', { step, data, email, formData, idpSub }),
  
  reset: (targetUserId?: string) => 
    api.post('/onboarding/reset', targetUserId ? { targetUserId } : {}),

  verifyPAN: async (pan: string, name?: string) => {
    return await api.post('/onboarding/verify-pan', { pan, name })
  },

  verifyGSTIN: async (gstin: string, businessName?: string) => {
    return await api.post('/onboarding/verify-gstin', { gstin, businessName })
  },
}
