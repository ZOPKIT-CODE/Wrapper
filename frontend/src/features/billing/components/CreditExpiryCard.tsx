import React, { useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Calendar,
  Clock,
  AlertTriangle,
  CheckCircle,
  Infinity,
  CreditCard,
  Gift,
  Sparkles,
} from 'lucide-react'
import { formatDate } from '@/lib/utils'
import { cn } from '@/lib/utils'

// ─── Types ────────────────────────────────────────────────────────────────────

interface AllocationRecord {
  allocationId: string
  campaignId: string | null
  entityId: string
  allocatedCredits: string
  usedCredits: string | null
  expiresAt: string | Date | null
  isActive: boolean
  isExpired: boolean
  creditType: string | null
  allocatedAt: string | Date
  targetApplication: string | null
  distributionStatus: string | null
}

interface CampaignRecord {
  campaignId: string
  campaignName: string
  creditType: string | null
  description: string | null
}

export interface AllocationItem {
  allocation: AllocationRecord
  campaign: CampaignRecord | null
  entity: { entityId: string; entityName: string; entityType: string } | null
}

export interface CreditBalanceSummary {
  freeCredits?: number
  paidCredits?: number
  seasonalCredits?: number
  freeCreditsExpiry?: string | null
  paidCreditsExpiry?: string | null
  subscriptionExpiry?: string | null
}

interface ExpiryRow {
  id: string
  label: string
  creditTypeBadge: string
  type: 'seasonal' | 'free' | 'paid'
  icon: React.ReactNode
  available: number
  total: number
  expiresAt: Date | null
  daysUntilExpiry: number | null
}

// ─── Constants ────────────────────────────────────────────────────────────────

const NEVER_YEAR = 2999

// ─── Helpers ──────────────────────────────────────────────────────────────────

function isNeverExpiry(d: Date): boolean {
  return d.getFullYear() >= NEVER_YEAR
}

/** Milliseconds remaining until d. Negative = already past. */
function msUntil(d: Date): number {
  return d.getTime() - Date.now()
}

/** Rounded-up days, used for urgency bucketing only. */
function daysUntil(d: Date): number {
  return Math.ceil(msUntil(d) / 86_400_000)
}

/**
 * Human-readable countdown: minutes → hours → days.
 * Shows sub-day precision so 5-minute dev cycles are visible.
 */
function formatCountdown(d: Date): string {
  const ms = msUntil(d)
  if (ms <= 0) return 'Expiring'
  const totalSecs = Math.floor(ms / 1000)
  const totalMins = Math.floor(totalSecs / 60)
  const totalHours = Math.floor(totalMins / 60)
  const days = Math.floor(totalHours / 24)

  if (days >= 2) return `${days}d left`
  if (totalHours >= 1) {
    const remMins = totalMins % 60
    return remMins > 0
      ? `${totalHours}h ${remMins}m left`
      : `${totalHours}h left`
  }
  if (totalMins >= 1) return `${totalMins}m left`
  return `${totalSecs}s left`
}

function badgeLabel(creditType: string | null | undefined): string {
  switch (creditType) {
    case 'free_distribution':
      return 'Free'
    case 'promotional':
      return 'Promo'
    case 'holiday':
      return 'Holiday'
    case 'bonus':
      return 'Bonus'
    case 'event':
      return 'Event'
    default:
      return 'Seasonal'
  }
}

interface UrgencyStyle {
  ring: string
  bg: string
  border: string
  text: string
  countText: string
  barColor: string
  pill: string
}

function urgency(
  days: number | null,
  expiresAt: Date | null
): { style: UrgencyStyle; label: string; icon: React.ReactNode } {
  if (days === null || expiresAt === null)
    return {
      style: {
        ring: 'ring-slate-200',
        bg: 'bg-slate-50',
        border: 'border-slate-200',
        text: 'text-slate-500',
        countText: 'text-slate-600',
        barColor: 'bg-slate-300',
        pill: 'bg-slate-100 text-slate-600',
      },
      label: 'Never',
      icon: <Infinity className="h-3.5 w-3.5" />,
    }
  // Use real ms remaining for sub-day precision
  const ms = msUntil(expiresAt)
  const label = formatCountdown(expiresAt)

  // Urgent: < 24 hours OR cron hasn't run yet (ms <= 0 but still active in DB)
  if (days <= 1 || ms <= 0)
    return {
      style: {
        ring: 'ring-red-200',
        bg: 'bg-red-50',
        border: 'border-red-200',
        text: 'text-red-600',
        countText: 'text-red-700',
        barColor: 'bg-red-400',
        pill: 'bg-red-100 text-red-700',
      },
      label,
      icon: <AlertTriangle className="h-3.5 w-3.5" />,
    }
  if (days <= 7)
    return {
      style: {
        ring: 'ring-red-200',
        bg: 'bg-red-50',
        border: 'border-red-200',
        text: 'text-red-600',
        countText: 'text-red-700',
        barColor: 'bg-red-400',
        pill: 'bg-red-100 text-red-700',
      },
      label,
      icon: <AlertTriangle className="h-3.5 w-3.5" />,
    }
  if (days <= 30)
    return {
      style: {
        ring: 'ring-amber-200',
        bg: 'bg-amber-50',
        border: 'border-amber-200',
        text: 'text-amber-600',
        countText: 'text-amber-700',
        barColor: 'bg-amber-400',
        pill: 'bg-amber-100 text-amber-700',
      },
      label,
      icon: <Clock className="h-3.5 w-3.5" />,
    }
  return {
    style: {
      ring: 'ring-emerald-200',
      bg: 'bg-emerald-50',
      border: 'border-emerald-200',
      text: 'text-emerald-600',
      countText: 'text-emerald-700',
      barColor: 'bg-emerald-400',
      pill: 'bg-emerald-100 text-emerald-700',
    },
    label,
    icon: <CheckCircle className="h-3.5 w-3.5" />,
  }
}

// ─── Component ────────────────────────────────────────────────────────────────

interface CreditExpiryCardProps {
  creditAllocations?: AllocationItem[] | null
  creditBalance?: CreditBalanceSummary | null
  isLoading?: boolean
}

export function CreditExpiryCard({
  creditAllocations,
  creditBalance,
  isLoading,
}: CreditExpiryCardProps) {
  const rows = useMemo<ExpiryRow[]>(() => {
    const result: ExpiryRow[] = []

    // ── All allocation batches (seasonal, paid, free — from credit_batches) ──
    // Skip app-specific batches (targetApplication set) — those are shown in
    // the Credit Expiry tab, not here.
    let batchPaidTotal = 0

    for (const item of creditAllocations ?? []) {
      const { allocation, campaign } = item
      if (!allocation.isActive || allocation.isExpired) continue
      if (allocation.targetApplication) continue // app batches shown in Expiry tab

      const allocated = parseFloat(allocation.allocatedCredits ?? '0')
      const used = parseFloat(allocation.usedCredits ?? '0')
      const available = Math.max(0, allocated - used)
      if (available <= 0) continue

      let expiresAt: Date | null = null
      let days: number | null = null

      if (allocation.expiresAt) {
        const d = new Date(allocation.expiresAt)
        if (!isNeverExpiry(d)) {
          expiresAt = d
          days = daysUntil(d)
        }
      }

      // Determine label, badge, icon, and type based on credit type
      const creditType = allocation.creditType ?? campaign?.creditType ?? 'free'

      // Paid/free batches with no real expiry should fall back to subscription expiry
      if (!expiresAt && (creditType === 'paid' || creditType === 'free')) {
        const fallback =
          creditBalance?.paidCreditsExpiry ??
          creditBalance?.subscriptionExpiry ??
          creditBalance?.freeCreditsExpiry
        if (fallback) {
          const fd = new Date(fallback)
          if (!isNeverExpiry(fd)) {
            expiresAt = fd
            days = daysUntil(fd)
          }
        }
      }
      let label: string
      let badge: string
      let icon: React.ReactNode
      let rowType: 'seasonal' | 'free' | 'paid'

      if (creditType === 'paid') {
        label = 'Paid Credits'
        badge = 'Purchased'
        icon = <CreditCard className="h-4 w-4" />
        rowType = 'paid'
        batchPaidTotal += available
      } else if (campaign) {
        label = campaign.campaignName ?? 'Seasonal Credits'
        badge = badgeLabel(campaign.creditType ?? creditType)
        icon = <Gift className="h-4 w-4" />
        rowType = 'seasonal'
      } else {
        label = 'Free Credits'
        badge = 'Subscription'
        icon = <Sparkles className="h-4 w-4" />
        rowType = 'free'
      }

      result.push({
        id: allocation.allocationId,
        label,
        creditTypeBadge: badge,
        type: rowType,
        icon,
        available,
        total: allocated,
        expiresAt,
        daysUntilExpiry: days,
      })
    }

    // ── Free credits not covered by batches (legacy/uncategorized) ──
    const batchTotal = result.reduce((s, r) => s + r.available, 0)
    const freeAmt = Math.max(0, (creditBalance?.freeCredits ?? 0) - batchTotal)
    if (freeAmt > 0) {
      const rawExpiry = creditBalance?.freeCreditsExpiry
      const expiresAt = rawExpiry ? new Date(rawExpiry) : null
      const days = expiresAt ? daysUntil(expiresAt) : null
      result.push({
        id: '__free__',
        label: 'Free Credits',
        creditTypeBadge: 'Subscription',
        type: 'free',
        icon: <Sparkles className="h-4 w-4" />,
        available: freeAmt,
        total: freeAmt,
        expiresAt,
        daysUntilExpiry: days,
      })
    }

    // ── Paid credits not covered by batches (legacy pre-batch purchases) ──
    const paidAmt = Math.max(
      0,
      (creditBalance?.paidCredits ?? 0) - batchPaidTotal
    )
    if (paidAmt > 0) {
      const rawExpiry =
        creditBalance?.paidCreditsExpiry ?? creditBalance?.freeCreditsExpiry
      const expiresAt = rawExpiry ? new Date(rawExpiry) : null
      const days = expiresAt ? daysUntil(expiresAt) : null
      result.push({
        id: '__paid__',
        label: 'Paid Credits',
        creditTypeBadge: 'Purchased',
        type: 'paid',
        icon: <CreditCard className="h-4 w-4" />,
        available: paidAmt,
        total: paidAmt,
        expiresAt,
        daysUntilExpiry: days,
      })
    }

    // Sort: soonest expiry first, never-expire at end
    result.sort((a, b) => {
      if (a.expiresAt === null && b.expiresAt === null) return 0
      if (a.expiresAt === null) return 1
      if (b.expiresAt === null) return -1
      return a.expiresAt.getTime() - b.expiresAt.getTime()
    })

    return result
  }, [creditAllocations, creditBalance])

  // Urgent = expires within 24 hours (includes sub-minute dev-mode batches)
  const urgentCount = rows.filter(
    (r) => r.expiresAt !== null && msUntil(r.expiresAt) <= 86_400_000
  ).length
  const totalAvailable = rows.reduce((s, r) => s + r.available, 0)

  // Skeleton loader
  if (isLoading) {
    return (
      <Card className="overflow-hidden rounded-3xl border border-slate-100 bg-white shadow-sm">
        <CardHeader className="border-b border-slate-50 bg-slate-50/30 pb-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 animate-pulse rounded-xl bg-slate-100" />
            <div className="space-y-1.5">
              <div className="h-4 w-40 animate-pulse rounded bg-slate-100" />
              <div className="h-3 w-56 animate-pulse rounded bg-slate-100" />
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3 p-5">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex items-center gap-4">
              <div className="h-14 w-[72px] shrink-0 animate-pulse rounded-xl bg-slate-100" />
              <div className="flex-1 space-y-2">
                <div className="h-3.5 w-36 animate-pulse rounded bg-slate-100" />
                <div className="h-2 animate-pulse rounded-full bg-slate-100" />
                <div className="h-2.5 w-24 animate-pulse rounded bg-slate-100" />
              </div>
              <div className="h-7 w-16 shrink-0 animate-pulse rounded bg-slate-100" />
            </div>
          ))}
        </CardContent>
      </Card>
    )
  }

  if (rows.length === 0) return null

  return (
    <Card className="overflow-hidden rounded-3xl border border-slate-100 bg-white shadow-sm">
      {/* ── Header ── */}
      <CardHeader className="border-b border-slate-50 bg-slate-50/30 pb-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-[#1B2E5A]/10 p-2.5">
              <Calendar className="h-5 w-5 text-[#1B2E5A]" />
            </div>
            <div>
              <CardTitle className="text-base font-bold text-[#1B2E5A]">
                Credit Expiry Schedule
              </CardTitle>
              <p className="mt-0.5 text-xs text-slate-500">
                {rows.length} credit {rows.length === 1 ? 'pool' : 'pools'} ·{' '}
                {totalAvailable.toLocaleString()} credits total
              </p>
            </div>
          </div>
          {urgentCount > 0 && (
            <Badge className="gap-1 border border-red-200 bg-red-100 text-xs text-red-700">
              <AlertTriangle className="h-3 w-3" />
              {urgentCount} expiring within 7 days
            </Badge>
          )}
        </div>
      </CardHeader>

      {/* ── Rows ── */}
      <CardContent className="p-0">
        <div className="divide-y divide-slate-50">
          {rows.map((row) => {
            const u = urgency(row.daysUntilExpiry, row.expiresAt)
            const usedPct =
              row.total > 0
                ? Math.round(((row.total - row.available) / row.total) * 100)
                : 0
            const remainPct = 100 - usedPct

            return (
              <div
                key={row.id}
                className="group flex items-center gap-4 px-5 py-4 transition-colors hover:bg-slate-50/60"
              >
                {/* Countdown badge */}
                <div
                  className={cn(
                    'flex min-w-[76px] shrink-0 flex-col items-center justify-center rounded-xl border px-2.5 py-2 text-center ring-1',
                    u.style.bg,
                    u.style.border,
                    u.style.ring
                  )}
                >
                  <span
                    className={cn(
                      'flex items-center gap-1 text-xs font-bold',
                      u.style.text
                    )}
                  >
                    {u.icon}
                    {u.label}
                  </span>
                  {row.expiresAt ? (
                    <span className="mt-0.5 text-[10px] leading-tight whitespace-nowrap text-slate-400">
                      {formatDate(row.expiresAt.toISOString())}
                    </span>
                  ) : (
                    <span className="mt-0.5 text-[10px] text-slate-400">
                      no expiry
                    </span>
                  )}
                </div>

                {/* Middle: name + progress */}
                <div className="min-w-0 flex-1">
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    <div
                      className={cn('flex items-center gap-1.5', u.style.text)}
                    >
                      {row.icon}
                      <span className="truncate text-sm font-semibold text-slate-800">
                        {row.label}
                      </span>
                    </div>
                    <Badge
                      variant="secondary"
                      className={cn(
                        'shrink-0 border-0 px-1.5 py-0 text-[10px] font-medium',
                        u.style.pill
                      )}
                    >
                      {row.creditTypeBadge}
                    </Badge>
                  </div>

                  {/* Usage bar */}
                  <div className="mb-1.5 h-1.5 overflow-hidden rounded-full bg-slate-100">
                    <div
                      className={cn(
                        'h-full rounded-full transition-all duration-500',
                        u.style.barColor
                      )}
                      style={{ width: `${remainPct}%` }}
                    />
                  </div>

                  <p className="text-[11px] leading-none text-slate-400">
                    <span className="font-medium text-slate-600">
                      {row.available.toLocaleString()}
                    </span>{' '}
                    remaining
                    {usedPct > 0 && (
                      <span className="ml-1.5">
                        ·{' '}
                        <span className="text-slate-400">{usedPct}% used</span>
                      </span>
                    )}
                    {row.total !== row.available && (
                      <span className="ml-1.5 text-slate-300">
                        / {row.total.toLocaleString()} total
                      </span>
                    )}
                  </p>
                </div>

                {/* Right: big number */}
                <div className="shrink-0 text-right">
                  <div
                    className={cn(
                      'text-2xl font-bold tabular-nums',
                      u.style.countText
                    )}
                  >
                    {row.available.toLocaleString()}
                  </div>
                  <div className="text-[10px] font-medium tracking-wide text-slate-400 uppercase">
                    credits
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        {/* Footer */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 bg-slate-50/70 px-5 py-3">
          <div className="flex items-center gap-4 text-xs text-slate-500">
            {urgentCount > 0 && (
              <span className="flex items-center gap-1 font-medium text-red-600">
                <AlertTriangle className="h-3 w-3" />
                {urgentCount} batch{urgentCount > 1 ? 'es' : ''} expiring within
                24 hours — use them soon
              </span>
            )}
            {urgentCount === 0 &&
              rows.some(
                (r) => r.daysUntilExpiry !== null && r.daysUntilExpiry <= 30
              ) && (
                <span className="flex items-center gap-1 font-medium text-amber-600">
                  <Clock className="h-3 w-3" />
                  Some credits expire within 30 days
                </span>
              )}
            {urgentCount === 0 &&
              !rows.some(
                (r) => r.daysUntilExpiry !== null && r.daysUntilExpiry <= 30
              ) && (
                <span className="flex items-center gap-1 font-medium text-emerald-600">
                  <CheckCircle className="h-3 w-3" />
                  All credits are in good standing
                </span>
              )}
          </div>
          <span className="text-xs text-slate-400">
            {totalAvailable.toLocaleString()} credits available
          </span>
        </div>
      </CardContent>
    </Card>
  )
}
