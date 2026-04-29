import { api } from './client';

// ─── Campaign endpoints (/api/admin/seasonal-credits) ────────────────────────

export const seasonalCreditsAPI = {
  getCampaigns: (params?: { isActive?: boolean; distributionStatus?: string }) =>
    api.get('/admin/seasonal-credits/campaigns', { params }),

  getCampaign: (campaignId: string) =>
    api.get(`/admin/seasonal-credits/campaigns/${campaignId}`),

  getCampaignStatus: (campaignId: string) =>
    api.get(`/admin/seasonal-credits/campaigns/${campaignId}/status`),

  createCampaign: (data: {
    campaignName: string;
    creditType: string;
    totalCredits: number;
    creditsPerTenant?: number;
    expiresAt?: string;
    minutesUntilExpiry?: number; // dev mode: server computes expiresAt from its own clock
    targetAllTenants?: boolean;
    targetTenantIds?: string[];
    description?: string;
    notifyTenants?: boolean;
    modalConfig?: object;
  }) => api.post('/admin/seasonal-credits/campaigns', data),

  distributeCampaign: (campaignId: string) =>
    api.post(`/admin/seasonal-credits/campaigns/${campaignId}/distribute`),

  extendCampaign: (campaignId: string, additionalDays: number) =>
    api.put(`/admin/seasonal-credits/campaigns/${campaignId}/extend`, { additionalDays }),

  cancelCampaign: (campaignId: string) =>
    api.post(`/admin/seasonal-credits/campaigns/${campaignId}/cancel`),

  rerunFailed: (campaignId: string) =>
    api.post(`/admin/seasonal-credits/campaigns/${campaignId}/rerun-failed`),

  getCampaignTenantBreakdown: (campaignId: string) =>
    api.get(`/admin/seasonal-credits/campaigns/${campaignId}/tenant-breakdown`),

  getExpiringSoon: (daysAhead?: number) =>
    api.get('/admin/seasonal-credits/expiring-soon', { params: { daysAhead } }),

  sendWarnings: (daysAhead?: number) =>
    api.post('/admin/seasonal-credits/send-warnings', { daysAhead }),

  processExpiries: () =>
    api.post('/admin/seasonal-credits/process-expiries'),
};

// ─── Batch monitoring endpoints (/api/admin/seasonal-credit-batches) ─────────

export const seasonalCreditBatchesAPI = {
  getActiveBatches: (params?: {
    creditType?: string;
    expiresWithin?: number;
    tenantId?: string;
    campaignId?: string;
    limit?: number;
    offset?: number;
  }) => api.get('/admin/seasonal-credit-batches/active', { params }),

  getExpiredHistory: (params?: {
    tenantId?: string;
    campaignId?: string;
    creditType?: string;
    from?: string;
    to?: string;
    limit?: number;
    offset?: number;
  }) => api.get('/admin/seasonal-credit-batches/expired', { params }),

  bulkExpire: (allocationIds: string[]) =>
    api.post('/admin/seasonal-credit-batches/bulk-expire', { allocationIds }),

  getTenantSummary: (tenantId: string) =>
    api.get(`/admin/seasonal-credit-batches/tenants/${tenantId}`),

  grantToTenant: (
    tenantId: string,
    data: { creditAmount: number; expiresAt: string; reason?: string },
  ) => api.post(`/admin/seasonal-credit-batches/tenants/${tenantId}/grant`, data),

  getCronStatus: (limit?: number) =>
    api.get('/admin/seasonal-credit-batches/cron-status', { params: { limit } }),

  triggerCron: () =>
    api.post('/admin/seasonal-credit-batches/cron-status/trigger'),
};
