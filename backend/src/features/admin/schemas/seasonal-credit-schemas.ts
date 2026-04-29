import { z } from 'zod';

// ─── Campaign ───────────────────────────────────────────────────────────────

export const createCampaignSchema = z.object({
  campaignName: z.string().min(2).max(255),
  creditType: z.enum(['free_distribution', 'promotional', 'holiday', 'bonus', 'event']),
  totalCredits: z.number().positive(),
  creditsPerTenant: z.number().positive().optional(),
  expiresAt: z.string().datetime(),
  targetTenantIds: z.array(z.string().uuid()).optional(),
  description: z.string().max(1000).optional(),
  notifyTenants: z.boolean().default(false),
});

export const extendCampaignSchema = z.object({
  additionalDays: z.number().int().positive(),
});

// ─── Active Batches ──────────────────────────────────────────────────────────

export const activeBatchesQuerySchema = z.object({
  creditType: z.enum(['seasonal', 'free', 'paid']).optional(),
  expiresWithin: z.coerce.number().int().positive().optional(), // days
  tenantId: z.string().uuid().optional(),
  campaignId: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

// ─── Expired Batch History ───────────────────────────────────────────────────

export const expiredBatchHistoryQuerySchema = z.object({
  tenantId: z.string().uuid().optional(),
  campaignId: z.string().uuid().optional(),
  creditType: z.enum(['seasonal', 'free', 'paid']).optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

// ─── Bulk Expire ─────────────────────────────────────────────────────────────

export const bulkExpireSchema = z.object({
  allocationIds: z.array(z.string().uuid()).min(1),
});

// ─── Grant Credits ───────────────────────────────────────────────────────────

export const grantCreditsSchema = z.object({
  creditAmount: z.number().positive(),
  expiresAt: z.string().datetime(),
  reason: z.string().max(500).optional(),
});

// ─── Cron Status ─────────────────────────────────────────────────────────────

export const cronStatusQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
});
