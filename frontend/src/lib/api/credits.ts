import { api } from './client'

export const creditAPI = {
  getCurrentBalance: () => api.get('/credits/current'),

  getTransactionHistory: (params?: {
    page?: number;
    limit?: number;
    type?: string;
    startDate?: string;
    endDate?: string;
  }) => api.get('/credits/transactions', { params }),

  getAlerts: () => api.get('/credits/alerts'),

  purchaseCredits: (data: {
    creditAmount: number;
    paymentMethod: 'stripe' | 'bank_transfer' | 'check';
    currency?: string;
    notes?: string;
  }) => api.post('/credits/purchase', data),

  consumeCredits: (data: {
    operationCode: string;
    creditCost: number;
    operationId?: string;
    description?: string;
    metadata?: any;
  }) => api.post('/credits/consume', data),

  getUsageSummary: (params?: {
    period?: 'day' | 'week' | 'month' | 'year';
    startDate?: string;
    endDate?: string;
  }) => api.get('/credits/usage-summary', { params }),

  transferCredits: (data: {
    toEntityType: 'organization' | 'location';
    toEntityId: string;
    creditAmount: number;
    reason?: string;
  }) => api.post('/credits/transfer', data),

  getOperationConfig: (operationCode: string) =>
    api.get(`/credits/config/${operationCode}`),

  markAlertAsRead: (alertId: string) =>
    api.put(`/credits/alerts/${alertId}/read`),

  getAvailablePackages: () => api.get('/credits/packages'),

  getCreditPricing: () => api.get('/credits/pricing'),

  getCreditStats: () => api.get('/credits/stats'),

  getPaymentDetails: (sessionId: string) => api.get(`/credits/payment/${sessionId}`),

  getTenantAllocations: () => api.get('/admin/seasonal-credits/tenant-allocations'),

  getEntityBalances: () => api.get('/credits/entity-balances'),
}
