/**
 * Maps GET /subscriptions/plans rows to ApplicationPlan (same shape as dashboard billing).
 */
import type { ApplicationPlan } from '@/types/pricing'
import { applicationPlansFallback } from '../constants/billingPlans'

export function mapRawPlanToApplicationPlan(p: Record<string, unknown>): ApplicationPlan {
  const id = String(p.id ?? '')
  const fallback = applicationPlansFallback.find((f) => f.id === id)
  const yearlyPriceInrRaw =
    p.yearlyPriceInr ?? p.yearly_price_inr ?? p.yearlyPriceINR
  let annualPriceInr = Number(yearlyPriceInrRaw)
  if (!Number.isFinite(annualPriceInr) || annualPriceInr <= 0) {
    annualPriceInr = fallback?.annualPriceInr ?? 0
  }
  const yearlyPriceUsdRaw = p.yearlyPrice ?? p.yearly_price ?? p.price
  let annualPriceUsd = Number(yearlyPriceUsdRaw)
  if (!Number.isFinite(annualPriceUsd) || annualPriceUsd <= 0) {
    annualPriceUsd = fallback?.annualPriceUsd ?? 0
  }
  return {
    id,
    name: String(p.name ?? fallback?.name ?? id),
    description: String(p.description ?? fallback?.description ?? ''),
    annualPriceUsd,
    annualPriceInr,
    currency: 'USD',
    freeCredits: Number(p.credits ?? fallback?.freeCredits) || 0,
    features: Array.isArray(p.features)
      ? (p.features as string[])
      : (fallback?.features ?? []),
    popular: Boolean(p.popular ?? p.is_popular ?? fallback?.popular),
  }
}

export function mapSubscriptionPlansResponse(raw: unknown): ApplicationPlan[] {
  const list = Array.isArray(raw) ? raw : []
  return list.map((p) => mapRawPlanToApplicationPlan(p as Record<string, unknown>))
}
