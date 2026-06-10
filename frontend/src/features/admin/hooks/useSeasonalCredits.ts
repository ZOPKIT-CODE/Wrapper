import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  seasonalCreditsAPI,
  seasonalCreditBatchesAPI,
} from '@/lib/api/seasonal-credits'

// ─── Query Keys ───────────────────────────────────────────────────────────────

export const seasonalCreditKeys = {
  all: ['admin', 'seasonal-credits'] as const,
  campaigns: (filters?: object) =>
    [...seasonalCreditKeys.all, 'campaigns', filters] as const,
  campaign: (id: string) =>
    [...seasonalCreditKeys.all, 'campaign', id] as const,
  campaignStatus: (id: string) =>
    [...seasonalCreditKeys.all, 'campaign-status', id] as const,
  campaignTenantBreakdown: (id: string) =>
    [...seasonalCreditKeys.all, 'campaign-tenant-breakdown', id] as const,
  expiringSoon: (days?: number) =>
    [...seasonalCreditKeys.all, 'expiring-soon', days] as const,
  activeBatches: (filters?: object) =>
    [...seasonalCreditKeys.all, 'batches', 'active', filters] as const,
  expiredHistory: (filters?: object) =>
    [...seasonalCreditKeys.all, 'batches', 'expired', filters] as const,
  tenantSummary: (tenantId: string) =>
    [...seasonalCreditKeys.all, 'tenant', tenantId] as const,
  cronStatus: (limit?: number) =>
    [...seasonalCreditKeys.all, 'cron-status', limit] as const,
}

// ─── Campaign Queries ─────────────────────────────────────────────────────────

export function useCampaigns(filters?: {
  isActive?: boolean
  distributionStatus?: string
}) {
  return useQuery({
    queryKey: seasonalCreditKeys.campaigns(filters),
    queryFn: async () => {
      const res = await seasonalCreditsAPI.getCampaigns(filters)
      return res.data.data as Campaign[]
    },
    staleTime: 60_000,
  })
}

export function useCampaign(campaignId: string) {
  return useQuery({
    queryKey: seasonalCreditKeys.campaign(campaignId),
    queryFn: async () => {
      const res = await seasonalCreditsAPI.getCampaign(campaignId)
      return res.data.data
    },
    enabled: !!campaignId,
  })
}

export function useCampaignStatus(campaignId: string) {
  return useQuery({
    queryKey: seasonalCreditKeys.campaignStatus(campaignId),
    queryFn: async () => {
      const res = await seasonalCreditsAPI.getCampaignStatus(campaignId)
      return res.data.data
    },
    enabled: !!campaignId,
    refetchInterval: 10_000,
  })
}

export function useCampaignTenantBreakdown(campaignId: string) {
  return useQuery({
    queryKey: seasonalCreditKeys.campaignTenantBreakdown(campaignId),
    queryFn: async () => {
      const res =
        await seasonalCreditsAPI.getCampaignTenantBreakdown(campaignId)
      return res.data.data as CampaignTenantBreakdown
    },
    enabled: !!campaignId,
    staleTime: 30_000,
  })
}

export function useExpiringSoon(daysAhead = 30) {
  return useQuery({
    queryKey: seasonalCreditKeys.expiringSoon(daysAhead),
    queryFn: async () => {
      const res = await seasonalCreditsAPI.getExpiringSoon(daysAhead)
      return res.data.data as ExpiringCredit[]
    },
    staleTime: 120_000,
  })
}

// ─── Campaign Mutations ───────────────────────────────────────────────────────

export function useCreateCampaign() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: seasonalCreditsAPI.createCampaign,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: seasonalCreditKeys.all })
      toast.success('Campaign created successfully')
    },
    onError: (err: unknown) => {
      const e = err as {
        response?: { data?: { message?: string } }
        message?: string
      }
      const msg =
        e?.response?.data?.message ?? e?.message ?? 'Failed to create campaign'
      toast.error(msg)
    },
  })
}

export function useDistributeCampaign() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (campaignId: string) =>
      seasonalCreditsAPI.distributeCampaign(campaignId),
    onSuccess: (_data, campaignId) => {
      qc.invalidateQueries({
        queryKey: seasonalCreditKeys.campaign(campaignId),
      })
      qc.invalidateQueries({ queryKey: seasonalCreditKeys.campaigns() })
      qc.invalidateQueries({
        queryKey: seasonalCreditKeys.campaignTenantBreakdown(campaignId),
      })
      toast.success('Credits distributed successfully')
    },
    onError: (err: Error) => toast.error(err.message ?? 'Distribution failed'),
  })
}

export function useExtendCampaign() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ campaignId, days }: { campaignId: string; days: number }) =>
      seasonalCreditsAPI.extendCampaign(campaignId, days),
    onSuccess: (_data, { campaignId }) => {
      qc.invalidateQueries({
        queryKey: seasonalCreditKeys.campaign(campaignId),
      })
      toast.success('Campaign expiry extended')
    },
    onError: (err: Error) =>
      toast.error(err.message ?? 'Failed to extend campaign'),
  })
}

export function useCancelCampaign() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (campaignId: string) =>
      seasonalCreditsAPI.cancelCampaign(campaignId),
    onSuccess: (_data, campaignId) => {
      qc.invalidateQueries({ queryKey: seasonalCreditKeys.all })
      qc.invalidateQueries({
        queryKey: seasonalCreditKeys.campaignTenantBreakdown(campaignId),
      })
      toast.success('Campaign cancelled')
    },
    onError: (err: Error) =>
      toast.error(err.message ?? 'Failed to cancel campaign'),
  })
}

export function useRerunFailed() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (campaignId: string) =>
      seasonalCreditsAPI.rerunFailed(campaignId),
    onSuccess: (_data, campaignId) => {
      qc.invalidateQueries({
        queryKey: seasonalCreditKeys.campaign(campaignId),
      })
      qc.invalidateQueries({ queryKey: seasonalCreditKeys.campaigns() })
      qc.invalidateQueries({
        queryKey: seasonalCreditKeys.campaignTenantBreakdown(campaignId),
      })
      toast.success('Ready to distribute — click Distribute to retry')
    },
    onError: (err: Error) => toast.error(err.message ?? 'Rerun failed'),
  })
}

// ─── Batch Queries ────────────────────────────────────────────────────────────

export function useActiveBatches(filters?: {
  creditType?: string
  expiresWithin?: number
  tenantId?: string
  campaignId?: string
  limit?: number
  offset?: number
}) {
  return useQuery({
    queryKey: seasonalCreditKeys.activeBatches(filters),
    queryFn: async () => {
      const res = await seasonalCreditBatchesAPI.getActiveBatches(filters)
      return res.data.data as { batches: BatchRecord[]; total: number }
    },
    staleTime: 30_000,
  })
}

export function useExpiredHistory(filters?: {
  tenantId?: string
  campaignId?: string
  creditType?: string
  from?: string
  to?: string
  limit?: number
  offset?: number
}) {
  return useQuery({
    queryKey: seasonalCreditKeys.expiredHistory(filters),
    queryFn: async () => {
      const res = await seasonalCreditBatchesAPI.getExpiredHistory(filters)
      return res.data.data as { batches: BatchRecord[]; total: number }
    },
    staleTime: 60_000,
  })
}

export function useTenantCreditSummary(tenantId: string) {
  return useQuery({
    queryKey: seasonalCreditKeys.tenantSummary(tenantId),
    queryFn: async () => {
      const res = await seasonalCreditBatchesAPI.getTenantSummary(tenantId)
      return res.data.data
    },
    enabled: !!tenantId,
    staleTime: 30_000,
  })
}

export function useCronStatus(limit = 20) {
  return useQuery({
    queryKey: seasonalCreditKeys.cronStatus(limit),
    queryFn: async () => {
      const res = await seasonalCreditBatchesAPI.getCronStatus(limit)
      return res.data.data as CronStatusResult
    },
    staleTime: 30_000,
    refetchInterval: 60_000,
  })
}

// ─── Batch Mutations ──────────────────────────────────────────────────────────

export function useBulkExpire() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (allocationIds: string[]) =>
      seasonalCreditBatchesAPI.bulkExpire(allocationIds),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: seasonalCreditKeys.all })
      toast.success('Batches expired')
    },
    onError: (err: Error) => toast.error(err.message ?? 'Bulk expire failed'),
  })
}

export function useGrantToTenant() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({
      tenantId,
      data,
    }: {
      tenantId: string
      data: { creditAmount: number; expiresAt: string; reason?: string }
    }) => seasonalCreditBatchesAPI.grantToTenant(tenantId, data),
    onSuccess: (_data, { tenantId }) => {
      qc.invalidateQueries({
        queryKey: seasonalCreditKeys.tenantSummary(tenantId),
      })
      qc.invalidateQueries({ queryKey: seasonalCreditKeys.activeBatches() })
      toast.success('Credits granted successfully')
    },
    onError: (err: Error) => toast.error(err.message ?? 'Grant failed'),
  })
}

export function useTriggerCron() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => seasonalCreditBatchesAPI.triggerCron(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: seasonalCreditKeys.cronStatus() })
      qc.invalidateQueries({ queryKey: seasonalCreditKeys.activeBatches() })
      toast.success('Expiry cron triggered')
    },
    onError: (err: Error) => toast.error(err.message ?? 'Trigger failed'),
  })
}

// ─── Shared types ─────────────────────────────────────────────────────────────

export interface Campaign {
  campaignId: string
  campaignName: string
  creditType: string
  // Drizzle decimal columns come back as strings from the API
  totalCredits: string | number
  creditsPerTenant: string | number | null
  distributedCount: number
  failedCount: number
  expiresAt: string
  createdAt: string
  distributionStatus?: string
  isActive?: boolean
  targetAllTenants?: boolean
}

export interface ExpiringCredit {
  campaignId: string
  campaignName: string
  creditType: string
  tenantId: string
  tenantName: string
  totalCredits: number
  expiresAt: string
  daysUntilExpiry: number
}

export interface BatchRecord {
  allocationId: string
  tenantId: string
  tenantName?: string
  creditType: string
  totalCredits: number
  usedCredits: number
  remainingCredits: number
  expiresAt: string
  isExpired: boolean
  isActive: boolean
  campaignId?: string
  campaignName?: string
  targetApplication?: string
  createdAt: string
}

export interface CronStatusResult {
  lastRun: CronRun | null
  runs: CronRun[]
  stats: {
    total: number
    successful: number
    partial: number
    failed: number
    successRate: number
    avgDurationMs: number
  }
}

export interface CronRun {
  runId: string
  ranAt: string
  triggerSource: string
  triggeredBy: string | null
  batchesProcessed: number
  errorCount: number
  durationMs: number | null
  status: 'success' | 'partial' | 'error'
  errorMessage: string | null
}

export interface TenantBreakdownRow {
  tenantId: string
  tenantName: string
  allocatedCredits: number
  usedCredits: number
  remainingCredits: number
  utilizationPct: number
  expiresAt: string
  daysUntilExpiry: number
  expiryStatus: 'active' | 'expiring_soon' | 'expired'
  isExpired: boolean
  distributionStatus: string
  batchCount: number
}

export interface FailedTenantRow {
  tenantId: string
  tenantName: string
  error: string
}

export interface CampaignTenantBreakdown {
  campaignId: string
  campaignName: string
  distributionStatus: string
  expiresAt: string
  totalTenants: number
  successfulTenants: number
  failedTenantCount: number
  tenants: TenantBreakdownRow[]
  failedTenants: FailedTenantRow[]
  summary: {
    totalAllocated: number
    totalUsed: number
    totalRemaining: number
    expiredCount: number
    expiringSoonCount: number
    activeCount: number
  }
}
