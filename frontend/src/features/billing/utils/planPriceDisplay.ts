/**
 * UI-only: show subscription plans as a monthly equivalent of the annual total.
 * Stripe and APIs still charge once per year.
 */
const MONTHS = 12

export function monthlyFromAnnual(annual: number): number {
  if (!Number.isFinite(annual) || annual <= 0) return 0
  return annual / MONTHS
}

export function formatMonthlyUsdDisplay(annualUsd: number): string {
  const m = monthlyFromAnnual(annualUsd)
  if (m <= 0) return '—'
  return `$${m.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`
}

export function formatMonthlyInrDisplay(annualInr: number): string {
  const m = monthlyFromAnnual(annualInr)
  if (m <= 0) return '—'
  return `₹${m.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`
}
