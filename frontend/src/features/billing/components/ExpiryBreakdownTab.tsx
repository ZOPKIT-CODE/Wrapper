import React, { useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  AlertTriangle,
  Clock,
  CheckCircle,
  Infinity,
  Building2,
  MapPin,
  Users,
  Gift,
  Sparkles,
  CreditCard,
  ArrowRightLeft,
  AppWindow,
  TrendingUp,
  Shield,
  CalendarClock,
} from 'lucide-react'
import { formatDate, formatDateTime } from '@/lib/utils'
import { cn } from '@/lib/utils'
import type { AllocationItem, CreditBalanceSummary } from './CreditExpiryCard'

// ─── Brand tokens ────────────────────────────────────────────────────────────

// ─── Shared helpers ───────────────────────────────────────────────────────────

const NEVER_YEAR = 2999

function isNeverExpiry(d: Date) {
  return d.getFullYear() >= NEVER_YEAR
}

function msUntil(d: Date) {
  return d.getTime() - Date.now()
}

function formatCountdown(d: Date): string {
  const ms = msUntil(d)
  if (ms <= 0) return 'Expiring'
  const mins = Math.floor(ms / 60_000)
  const hours = Math.floor(mins / 60)
  const days = Math.floor(hours / 24)
  if (days >= 2) return `${days}d left`
  if (hours >= 1) {
    const m = mins % 60
    return m > 0 ? `${hours}h ${m}m left` : `${hours}h left`
  }
  if (mins >= 1) return `${mins}m left`
  return `${Math.floor(ms / 1000)}s left`
}

interface UrgencyTheme {
  badge: string
  bar: string
  text: string
  ring: string
  bg: string
  border: string
  icon: React.ReactNode
  pillBg: string
}

function urgencyStyle(expiresAt: Date | null): UrgencyTheme {
  if (!expiresAt)
    return {
      badge: 'bg-[#1B2E5A]/5 text-[#1B2E5A]',
      bar: 'bg-[#1B2E5A]/30',
      text: 'text-[#1B2E5A]/70',
      ring: 'ring-[#1B2E5A]/10',
      bg: 'bg-[#1B2E5A]/[0.03]',
      border: 'border-[#1B2E5A]/10',
      pillBg: 'bg-[#1B2E5A]/5',
      icon: <Infinity className="h-3 w-3" />,
    }
  const ms = msUntil(expiresAt)
  if (ms <= 0 || ms <= 86_400_000)
    return {
      badge: 'bg-rose-50 text-rose-700',
      bar: 'bg-gradient-to-r from-rose-400 to-rose-500',
      text: 'text-rose-600',
      ring: 'ring-rose-200/60',
      bg: 'bg-rose-50/60',
      border: 'border-rose-200/60',
      pillBg: 'bg-rose-50',
      icon: <AlertTriangle className="h-3 w-3" />,
    }
  const days = Math.ceil(ms / 86_400_000)
  if (days <= 7)
    return {
      badge: 'bg-rose-50 text-rose-700',
      bar: 'bg-gradient-to-r from-rose-400 to-rose-500',
      text: 'text-rose-600',
      ring: 'ring-rose-200/60',
      bg: 'bg-rose-50/60',
      border: 'border-rose-200/60',
      pillBg: 'bg-rose-50',
      icon: <AlertTriangle className="h-3 w-3" />,
    }
  if (days <= 30)
    return {
      badge: 'bg-amber-50 text-amber-700',
      bar: 'bg-gradient-to-r from-amber-300 to-amber-400',
      text: 'text-amber-600',
      ring: 'ring-amber-200/60',
      bg: 'bg-amber-50/60',
      border: 'border-amber-200/60',
      pillBg: 'bg-amber-50',
      icon: <Clock className="h-3 w-3" />,
    }
  return {
    badge: 'bg-emerald-50 text-emerald-700',
    bar: 'bg-gradient-to-r from-emerald-300 to-emerald-400',
    text: 'text-emerald-600',
    ring: 'ring-emerald-200/60',
    bg: 'bg-emerald-50/60',
    border: 'border-emerald-200/60',
    pillBg: 'bg-emerald-50',
    icon: <CheckCircle className="h-3 w-3" />,
  }
}

function creditTypeBadge(type: string | null | undefined): string {
  switch (type) {
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
    case 'seasonal':
      return 'Seasonal'
    case 'app':
      return 'App'
    case 'purchased':
      return 'Purchased'
    default:
      return type ?? 'Seasonal'
  }
}

function entityIcon(type: string | null | undefined) {
  switch (type) {
    case 'location':
      return <MapPin className="h-4 w-4" />
    case 'department':
      return <Users className="h-4 w-4" />
    case 'team':
      return <Users className="h-4 w-4" />
    default:
      return <Building2 className="h-4 w-4" />
  }
}

// ─── Internal types ───────────────────────────────────────────────────────────

interface NormalizedBatch {
  id: string
  campaignName: string | null
  creditType: string | null
  targetApplication: string | null
  available: number
  allocated: number
  expiresAt: Date | null
  allocatedAt: Date | null
  isTransferred: boolean
  icon: React.ReactNode
}

interface AppLedgerGroup {
  applicationKey: string
  applicationLabel: string
  batches: NormalizedBatch[]
  totalAvailable: number
}

interface EntityGroup {
  entityId: string
  entityName: string
  entityType: string
  totalAvailable: number
  earliestExpiry: Date | null
  appLedgers: AppLedgerGroup[]
  orgPools: NormalizedBatch[]
}

/** In-memory shape while aggregating; flattened batches are split into app ledgers + org pools at the end. */
interface EntityGroupDraft extends Omit<
  EntityGroup,
  'appLedgers' | 'orgPools'
> {
  batches: NormalizedBatch[]
}

function partitionIntoAppLedgersAndOrgPools(batches: NormalizedBatch[]): {
  appLedgers: AppLedgerGroup[]
  orgPools: NormalizedBatch[]
} {
  const byApp = new Map<string, NormalizedBatch[]>()
  const orgPools: NormalizedBatch[] = []
  for (const b of batches) {
    if (b.targetApplication) {
      const key = b.targetApplication.toLowerCase()
      if (!byApp.has(key)) byApp.set(key, [])
      byApp.get(key)!.push(b)
    } else {
      orgPools.push(b)
    }
  }
  const appLedgers: AppLedgerGroup[] = Array.from(byApp.entries())
    .map(([applicationKey, appBatches]) => ({
      applicationKey,
      applicationLabel:
        applicationKey.charAt(0).toUpperCase() + applicationKey.slice(1),
      batches: [...appBatches].sort((a, b) => {
        const ta = a.allocatedAt?.getTime() ?? 0
        const tb = b.allocatedAt?.getTime() ?? 0
        return tb - ta
      }),
      totalAvailable: appBatches.reduce((s, x) => s + x.available, 0),
    }))
    .sort((a, b) => a.applicationLabel.localeCompare(b.applicationLabel))
  orgPools.sort((a, b) => {
    if (!a.expiresAt && !b.expiresAt) return 0
    if (!a.expiresAt) return 1
    if (!b.expiresAt) return -1
    return a.expiresAt.getTime() - b.expiresAt.getTime()
  })
  return { appLedgers, orgPools }
}

function CreditExpiryBatchRow({ batch }: { batch: NormalizedBatch }) {
  const u = urgencyStyle(batch.expiresAt)
  const usedPct =
    batch.allocated > 0
      ? Math.round(
          ((batch.allocated - batch.available) / batch.allocated) * 100
        )
      : 0
  const remainPct = 100 - usedPct
  const isApp = !!batch.targetApplication

  return (
    <div
      className={cn(
        'flex items-center gap-4 px-5 py-4 transition-colors',
        isApp
          ? 'bg-blue-50/20 hover:bg-blue-50/40'
          : 'hover:bg-[#1B2E5A]/[0.015]'
      )}
    >
      <div
        className={cn(
          'flex min-w-[80px] shrink-0 flex-col items-center justify-center rounded-2xl border px-3 py-2 text-center',
          u.bg,
          u.border
        )}
      >
        <span
          className={cn(
            'flex items-center gap-1 text-[11px] font-bold tracking-tight',
            u.text
          )}
        >
          {u.icon}
          {batch.expiresAt ? formatCountdown(batch.expiresAt) : 'Never'}
        </span>
        {batch.expiresAt && (
          <span className="mt-0.5 text-[9px] font-medium whitespace-nowrap text-slate-400">
            Expires {formatDate(batch.expiresAt.toISOString())}
          </span>
        )}
      </div>

      <div className="min-w-0 flex-1">
        <div className="mb-1 flex flex-wrap items-center gap-2">
          <span className="flex items-center gap-1.5 text-[#1B2E5A]/60">
            {batch.icon}
          </span>
          <span className="text-sm font-semibold tracking-tight text-[#1B2E5A]">
            {batch.campaignName ?? 'Seasonal Credits'}
          </span>
          <Badge
            variant="secondary"
            className={cn(
              'shrink-0 rounded-md border-0 px-2 py-0.5 text-[10px] font-semibold tracking-wide uppercase',
              isApp ? 'bg-blue-100/80 text-blue-700' : u.pillBg + ' ' + u.text
            )}
          >
            {creditTypeBadge(batch.creditType)}
          </Badge>
          {batch.targetApplication && (
            <Badge
              variant="outline"
              className="shrink-0 rounded-md border-[#1B2E5A]/15 px-2 py-0.5 text-[10px] font-semibold text-[#1B2E5A]"
            >
              <AppWindow className="mr-1 h-2.5 w-2.5 opacity-60" />
              {batch.targetApplication.charAt(0).toUpperCase() +
                batch.targetApplication.slice(1)}
            </Badge>
          )}
          {batch.isTransferred && !batch.targetApplication && (
            <span className="flex items-center gap-1 text-[10px] font-semibold tracking-wide text-[#1B2E5A]/40">
              <ArrowRightLeft className="h-3 w-3" />
              Transferred
            </span>
          )}
        </div>

        {batch.allocatedAt && (
          <p className="mb-2 flex items-center gap-1.5 text-[10px] text-slate-500">
            <CalendarClock className="h-3 w-3 shrink-0 opacity-55" />
            <span>
              Allocated{' '}
              <span className="font-semibold text-slate-600">
                {formatDateTime(batch.allocatedAt)}
              </span>
            </span>
          </p>
        )}

        <div className="mb-1.5 h-1.5 overflow-hidden rounded-full bg-slate-100">
          <div
            className={cn(
              'h-full rounded-full transition-all duration-500',
              u.bar
            )}
            style={{ width: `${remainPct}%` }}
          />
        </div>

        <p className="text-[11px] tracking-wide text-slate-400">
          <span className="font-semibold text-[#1B2E5A]/70">
            {batch.available.toLocaleString()}
          </span>{' '}
          remaining
          {usedPct > 0 && (
            <span className="ml-2 text-slate-300">{usedPct}% used</span>
          )}
          {batch.allocated !== batch.available && (
            <span className="ml-2 text-slate-300">
              / {batch.allocated.toLocaleString()} allocated
            </span>
          )}
        </p>
      </div>

      <div className="shrink-0 pl-2 text-right">
        <div
          style={{
            fontFamily: 'var(--zk-mono)',
            fontWeight: 600,
            letterSpacing: '-0.04em',
          }}
          className={cn(
            'text-xl tabular-nums',
            isApp ? 'text-blue-600' : 'text-[#1B2E5A]'
          )}
        >
          {batch.available.toLocaleString()}
        </div>
        <div
          style={{
            fontFamily: 'var(--zk-mono)',
            fontSize: 10,
            letterSpacing: '0.06em',
            textTransform: 'uppercase' as const,
            color: 'var(--zk-muted-2)',
          }}
        >
          credits
        </div>
      </div>
    </div>
  )
}

// ─── Component ────────────────────────────────────────────────────────────────

export interface EntityBalance {
  entityId: string
  entityName: string
  entityType: string
  entityLevel: number | null
  parentEntityId: string | null
  availableCredits: number
}

interface ExpiryBreakdownTabProps {
  creditAllocations?: AllocationItem[] | null
  creditBalance?: CreditBalanceSummary | null
  entityBalances?: EntityBalance[] | null
  isLoading?: boolean
}

export function ExpiryBreakdownTab({
  creditAllocations,
  creditBalance,
  entityBalances,
  isLoading,
}: ExpiryBreakdownTabProps) {
  const entityGroups = useMemo<EntityGroup[]>(() => {
    const map = new Map<string, EntityGroupDraft>()

    const nameLookup = new Map<string, { name: string; type: string }>()
    for (const eb of entityBalances ?? []) {
      nameLookup.set(eb.entityId, { name: eb.entityName, type: eb.entityType })
    }

    for (const eb of entityBalances ?? []) {
      if (!map.has(eb.entityId)) {
        map.set(eb.entityId, {
          entityId: eb.entityId,
          entityName: eb.entityName,
          entityType: eb.entityType,
          totalAvailable: 0,
          earliestExpiry: null,
          batches: [],
        })
      }
    }

    const balanceLookup = new Map<string, number>()
    for (const eb of entityBalances ?? []) {
      balanceLookup.set(eb.entityId, eb.availableCredits)
    }

    interface RawBatchEntry {
      item: AllocationItem
      batchAvailable: number
      batchExpiresAt: Date | null
    }
    const entityBatchMap = new Map<string, RawBatchEntry[]>()

    // Compute subscription expiry fallback for paid/free batches with no real expiry
    const subExpiryFallback =
      creditBalance?.paidCreditsExpiry ??
      creditBalance?.subscriptionExpiry ??
      creditBalance?.freeCreditsExpiry
    const subExpiryDate = subExpiryFallback ? new Date(subExpiryFallback) : null
    const validSubExpiry =
      subExpiryDate && !isNeverExpiry(subExpiryDate) ? subExpiryDate : null

    for (const item of creditAllocations ?? []) {
      const { allocation } = item
      if (!allocation.isActive || allocation.isExpired) continue
      const allocated = parseFloat(allocation.allocatedCredits ?? '0')
      const used = parseFloat(allocation.usedCredits ?? '0')
      const batchAvailable = Math.max(0, allocated - used)
      if (batchAvailable <= 0) continue
      let batchExpiresAt: Date | null = null
      if (allocation.expiresAt) {
        const d = new Date(allocation.expiresAt)
        if (!isNeverExpiry(d)) batchExpiresAt = d
      }
      // Paid/free batches with no real expiry fall back to subscription expiry
      const batchCreditType = allocation.creditType ?? 'free'
      if (
        !batchExpiresAt &&
        (batchCreditType === 'paid' || batchCreditType === 'free') &&
        validSubExpiry
      ) {
        batchExpiresAt = validSubExpiry
      }
      const entityId = allocation.entityId
      if (!entityBatchMap.has(entityId)) entityBatchMap.set(entityId, [])
      entityBatchMap
        .get(entityId)!
        .push({ item, batchAvailable, batchExpiresAt })
    }

    for (const [entityId, rawBatches] of entityBatchMap) {
      const entityBalance =
        balanceLookup.get(entityId) ?? Number.POSITIVE_INFINITY
      const orgPoolTotal = rawBatches
        .filter((b) => !b.item.allocation.targetApplication)
        .reduce((s, b) => s + b.batchAvailable, 0)
      const orgScale =
        orgPoolTotal > 0 && entityBalance < orgPoolTotal
          ? entityBalance / orgPoolTotal
          : 1

      for (const entry of rawBatches) {
        const { allocation, campaign, entity } = entry.item
        const isAppBatch = !!allocation.targetApplication
        const available = isAppBatch
          ? entry.batchAvailable
          : Math.round(entry.batchAvailable * orgScale)
        const expiresAt = entry.batchExpiresAt
        if (available <= 0) continue

        const lookup = nameLookup.get(entityId)
        const entityName = lookup?.name ?? entity?.entityName ?? entityId
        const entityType = lookup?.type ?? entity?.entityType ?? 'organization'

        if (!map.has(entityId)) {
          map.set(entityId, {
            entityId,
            entityName,
            entityType,
            totalAvailable: 0,
            earliestExpiry: null,
            batches: [],
          })
        }
        const group = map.get(entityId)!
        if (!allocation.targetApplication) group.totalAvailable += available

        const campaignDistributedAt = (
          campaign as { distributedAt?: string | null } | null
        )?.distributedAt
        const isTransferred =
          !!campaign &&
          allocation.distributionStatus === 'completed' &&
          !!campaignDistributedAt &&
          new Date(allocation.allocatedAt) > new Date(campaignDistributedAt)

        const appName = allocation.targetApplication ?? null
        const batchCreditType =
          allocation.creditType ?? campaign?.creditType ?? 'free'
        const isPaidBatch = batchCreditType === 'paid'

        let batchLabel: string | null
        let batchIcon: React.ReactNode
        if (appName) {
          batchLabel = `${campaign?.campaignName ?? 'Credits'} → ${appName.charAt(0).toUpperCase() + appName.slice(1)}`
          batchIcon = <AppWindow className="h-3.5 w-3.5" />
        } else if (isPaidBatch) {
          batchLabel = 'Paid Credits'
          batchIcon = <CreditCard className="h-3.5 w-3.5" />
        } else if (campaign) {
          batchLabel = campaign.campaignName ?? 'Seasonal Credits'
          batchIcon = <Gift className="h-3.5 w-3.5" />
        } else {
          batchLabel = 'Free Credits'
          batchIcon = <Sparkles className="h-3.5 w-3.5" />
        }

        const allocatedAtRaw = allocation.allocatedAt
        const allocatedAt =
          allocatedAtRaw != null && !isNaN(new Date(allocatedAtRaw).getTime())
            ? new Date(allocatedAtRaw)
            : null

        group.batches.push({
          id: allocation.allocationId,
          campaignName: batchLabel,
          creditType: appName
            ? 'app'
            : isPaidBatch
              ? 'purchased'
              : (campaign?.creditType ?? allocation.creditType),
          targetApplication: appName,
          available,
          allocated: parseFloat(allocation.allocatedCredits ?? '0'),
          expiresAt,
          allocatedAt,
          isTransferred,
          icon: batchIcon,
        })

        if (
          expiresAt &&
          (!group.earliestExpiry || expiresAt < group.earliestExpiry)
        ) {
          group.earliestExpiry = expiresAt
        }
      }
    }

    const freeExpiry = creditBalance?.freeCreditsExpiry
      ? new Date(creditBalance.freeCreditsExpiry)
      : null
    const paidAmt = creditBalance?.paidCredits ?? 0

    for (const eb of entityBalances ?? []) {
      if (eb.availableCredits <= 0) continue
      const group = map.get(eb.entityId)
      if (!group) continue
      const batchTotal = group.batches.reduce((s, b) => s + b.available, 0)
      const freeAmt = Math.max(0, eb.availableCredits - batchTotal)
      if (freeAmt > 0) {
        group.totalAvailable += freeAmt
        group.batches.push({
          id: `__free__${eb.entityId}`,
          campaignName: 'Free Credits',
          creditType: 'subscription',
          targetApplication: null,
          available: freeAmt,
          allocated: freeAmt,
          expiresAt: freeExpiry,
          allocatedAt: null,
          isTransferred: false,
          icon: <Sparkles className="h-3.5 w-3.5" />,
        })
        if (
          freeExpiry &&
          (!group.earliestExpiry || freeExpiry < group.earliestExpiry)
        ) {
          group.earliestExpiry = freeExpiry
        }
      }
    }

    // Only show a separate "Paid Credits" row for paid credits NOT already
    // represented by a batch. Subtract paid batch credits to avoid double-counting.
    const paidBatchTotal = Array.from(map.values()).reduce(
      (s, g) =>
        s +
        g.batches
          .filter((b) => b.creditType === 'purchased')
          .reduce((bs, b) => bs + b.available, 0),
      0
    )
    const remainingPaid = Math.max(0, paidAmt - paidBatchTotal)
    if (remainingPaid > 0) {
      const primaryGroup = Array.from(map.values())[0]
      if (primaryGroup) {
        primaryGroup.totalAvailable += remainingPaid
        primaryGroup.batches.push({
          id: '__paid__',
          campaignName: 'Paid Credits',
          creditType: 'purchased',
          targetApplication: null,
          available: remainingPaid,
          allocated: remainingPaid,
          expiresAt: validSubExpiry,
          allocatedAt: null,
          isTransferred: false,
          icon: <CreditCard className="h-3.5 w-3.5" />,
        })
        if (
          validSubExpiry &&
          (!primaryGroup.earliestExpiry ||
            validSubExpiry < primaryGroup.earliestExpiry)
        ) {
          primaryGroup.earliestExpiry = validSubExpiry
        }
      }
    }

    return Array.from(map.values())
      .filter((g) => g.totalAvailable > 0 || g.batches.length > 0)
      .sort((a, b) => {
        if (!a.earliestExpiry && !b.earliestExpiry)
          return b.totalAvailable - a.totalAvailable
        if (!a.earliestExpiry) return 1
        if (!b.earliestExpiry) return -1
        return a.earliestExpiry.getTime() - b.earliestExpiry.getTime()
      })
      .map((g): EntityGroup => {
        const { appLedgers, orgPools } = partitionIntoAppLedgersAndOrgPools(
          g.batches
        )
        return {
          entityId: g.entityId,
          entityName: g.entityName,
          entityType: g.entityType,
          totalAvailable: g.totalAvailable,
          earliestExpiry: g.earliestExpiry,
          appLedgers,
          orgPools,
        }
      })
  }, [creditAllocations, creditBalance, entityBalances])

  // ── Derived stats ──
  const totalEntities = entityGroups.length
  const totalBatches = entityGroups.reduce(
    (s, g) =>
      s +
      g.orgPools.length +
      g.appLedgers.reduce((acc, ledger) => acc + ledger.batches.length, 0),
    0
  )
  const totalCredits = entityGroups.reduce((s, g) => s + g.totalAvailable, 0)
  const urgentBatches = entityGroups.reduce((s, g) => {
    const rows = [...g.orgPools, ...g.appLedgers.flatMap((l) => l.batches)]
    return (
      s +
      rows.filter((b) => b.expiresAt && msUntil(b.expiresAt) <= 7 * 86_400_000)
        .length
    )
  }, 0)

  // ── Loading skeleton ──
  if (isLoading) {
    return (
      <div className="space-y-5">
        <div className="animate-pulse rounded-3xl border border-[#1B2E5A]/10 bg-white p-5">
          <div className="mb-5 flex gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="h-20 flex-1 rounded-2xl"
                style={{ background: 'var(--zk-bg-2)' }}
              />
            ))}
          </div>
        </div>
        {[1, 2].map((i) => (
          <div
            key={i}
            className="animate-pulse rounded-3xl"
            style={{ border: '1px solid var(--zk-line)' }}
          >
            <div
              className="border-b p-5"
              style={{ borderColor: 'var(--zk-line)' }}
            >
              <div className="flex items-center gap-3">
                <div
                  className="h-11 w-11 rounded-2xl"
                  style={{ background: 'var(--zk-bg-2)' }}
                />
                <div className="flex-1 space-y-2">
                  <div
                    className="h-4 w-40 rounded-lg"
                    style={{ background: 'var(--zk-bg-2)' }}
                  />
                  <div
                    className="h-3 w-28 rounded-lg"
                    style={{ background: 'var(--zk-bg-2)' }}
                  />
                </div>
              </div>
            </div>
            <div className="space-y-3 p-4">
              {[1, 2].map((j) => (
                <div
                  key={j}
                  className="h-16 rounded-2xl"
                  style={{ background: 'var(--zk-bg)' }}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    )
  }

  // ── Empty state ──
  if (entityGroups.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-[#1B2E5A]/5">
          <Shield className="h-8 w-8 text-[#1B2E5A]/40" />
        </div>
        <p
          style={{
            fontFamily: 'var(--zk-display)',
            fontWeight: 600,
            letterSpacing: '-0.025em',
            color: 'var(--zk-ink)',
            fontSize: 16,
          }}
        >
          No Active Credit Pools
        </p>
        <p
          style={{
            fontFamily: 'var(--zk-font)',
            fontSize: 13,
            color: 'var(--zk-muted)',
          }}
          className="mt-1.5 max-w-sm"
        >
          Credits and their expiry schedules will appear here once campaigns are
          distributed to your organization.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-5 font-sans">
      {/* ── Summary header card ── */}
      <Card className="overflow-hidden rounded-3xl border border-[#1B2E5A]/10 bg-gradient-to-br from-white to-slate-50/50 shadow-sm">
        <CardContent className="p-0">
          <div className="grid grid-cols-2 divide-x divide-[#1B2E5A]/5 sm:grid-cols-4">
            {/* Entities */}
            <div className="p-4 sm:p-5">
              <div className="mb-2 flex items-center gap-2">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#1B2E5A]/[0.06]">
                  <Building2 className="h-3.5 w-3.5 text-[#1B2E5A]" />
                </div>
                <span
                  style={{
                    fontFamily: 'var(--zk-mono)',
                    fontSize: 11,
                    fontWeight: 500,
                    letterSpacing: '0.07em',
                    textTransform: 'uppercase' as const,
                    color: 'var(--zk-muted-2)',
                  }}
                >
                  Entities
                </span>
              </div>
              <p
                style={{
                  fontFamily: 'var(--zk-mono)',
                  fontWeight: 600,
                  letterSpacing: '-0.04em',
                  color: 'var(--zk-ink)',
                }}
                className="text-2xl"
              >
                {totalEntities}
              </p>
            </div>
            {/* Credit Pools */}
            <div className="p-4 sm:p-5">
              <div className="mb-2 flex items-center gap-2">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#1B2E5A]/[0.06]">
                  <Gift className="h-3.5 w-3.5 text-[#1B2E5A]" />
                </div>
                <span
                  style={{
                    fontFamily: 'var(--zk-mono)',
                    fontSize: 11,
                    fontWeight: 500,
                    letterSpacing: '0.07em',
                    textTransform: 'uppercase' as const,
                    color: 'var(--zk-muted-2)',
                  }}
                >
                  Credit Pools
                </span>
              </div>
              <p
                style={{
                  fontFamily: 'var(--zk-mono)',
                  fontWeight: 600,
                  letterSpacing: '-0.04em',
                  color: 'var(--zk-ink)',
                }}
                className="text-2xl"
              >
                {totalBatches}
              </p>
            </div>
            {/* Total Credits */}
            <div className="p-4 sm:p-5">
              <div className="mb-2 flex items-center gap-2">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#1B2E5A]/[0.06]">
                  <TrendingUp className="h-3.5 w-3.5 text-[#1B2E5A]" />
                </div>
                <span
                  style={{
                    fontFamily: 'var(--zk-mono)',
                    fontSize: 11,
                    fontWeight: 500,
                    letterSpacing: '0.07em',
                    textTransform: 'uppercase' as const,
                    color: 'var(--zk-muted-2)',
                  }}
                >
                  Total Credits
                </span>
              </div>
              <p
                style={{
                  fontFamily: 'var(--zk-mono)',
                  fontWeight: 600,
                  letterSpacing: '-0.04em',
                  color: 'var(--zk-ink)',
                }}
                className="text-2xl"
              >
                {totalCredits.toLocaleString()}
              </p>
            </div>
            {/* Expiry alerts */}
            <div className="p-4 sm:p-5">
              <div className="mb-2 flex items-center gap-2">
                <div
                  className={cn(
                    'flex h-7 w-7 items-center justify-center rounded-lg',
                    urgentBatches > 0 ? 'bg-rose-50' : 'bg-emerald-50'
                  )}
                >
                  {urgentBatches > 0 ? (
                    <AlertTriangle className="h-3.5 w-3.5 text-rose-500" />
                  ) : (
                    <CheckCircle className="h-3.5 w-3.5 text-emerald-500" />
                  )}
                </div>
                <span
                  style={{
                    fontFamily: 'var(--zk-mono)',
                    fontSize: 11,
                    fontWeight: 500,
                    letterSpacing: '0.07em',
                    textTransform: 'uppercase' as const,
                    color: 'var(--zk-muted-2)',
                  }}
                >
                  Expiring Soon
                </span>
              </div>
              <p
                style={{
                  fontFamily: 'var(--zk-mono)',
                  fontWeight: 600,
                  letterSpacing: '-0.04em',
                }}
                className={cn(
                  'text-2xl',
                  urgentBatches > 0 ? 'text-rose-600' : 'text-emerald-600'
                )}
              >
                {urgentBatches}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── Entity cards ── */}
      {entityGroups.map((group) => {
        const groupUrgency = urgencyStyle(group.earliestExpiry)
        const isUrgent =
          group.earliestExpiry &&
          msUntil(group.earliestExpiry) <= 7 * 86_400_000
        const orgBatchCount = group.orgPools.length
        const appBatchCount = group.appLedgers.reduce(
          (s, ledger) => s + ledger.batches.length,
          0
        )

        return (
          <Card
            key={group.entityId}
            className={cn(
              'overflow-hidden rounded-3xl border shadow-sm transition-all duration-200',
              isUrgent
                ? 'border-rose-200/70 hover:border-rose-300/80 hover:shadow-rose-100/50'
                : 'border-[#1B2E5A]/8 hover:border-[#1B2E5A]/15 hover:shadow-[#1B2E5A]/[0.04]'
            )}
          >
            {/* ── Entity header ── */}
            <CardHeader
              className={cn(
                'border-b pb-4',
                isUrgent
                  ? 'border-rose-100/60 bg-gradient-to-r from-rose-50/80 to-white'
                  : 'border-[#1B2E5A]/5 bg-gradient-to-r from-[#1B2E5A]/[0.03] to-white'
              )}
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3.5">
                  <div
                    className={cn(
                      'flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl',
                      isUrgent
                        ? 'bg-rose-100/80 text-rose-600'
                        : 'bg-[#1B2E5A]/[0.08] text-[#1B2E5A]'
                    )}
                  >
                    {entityIcon(group.entityType)}
                  </div>
                  <div>
                    <CardTitle
                      style={{
                        fontFamily: 'var(--zk-display)',
                        letterSpacing: '-0.025em',
                        color: 'var(--zk-ink)',
                        fontWeight: 600,
                        fontSize: 15,
                        textTransform: 'capitalize' as const,
                      }}
                    >
                      {group.entityName}
                    </CardTitle>
                    <div className="mt-0.5 flex items-center gap-2">
                      <span className="text-xs text-slate-400 capitalize">
                        {group.entityType}
                      </span>
                      <span className="text-slate-200">|</span>
                      <span className="text-xs font-semibold text-[#1B2E5A]">
                        {group.totalAvailable.toLocaleString()} credits
                      </span>
                      {appBatchCount > 0 && (
                        <>
                          <span className="text-slate-200">|</span>
                          <span className="text-xs font-medium text-blue-500">
                            {appBatchCount} app{' '}
                            {appBatchCount === 1 ? 'allocation' : 'allocations'}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
                {group.earliestExpiry && (
                  <div
                    className={cn(
                      'flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold',
                      isUrgent
                        ? 'border-rose-200/60 bg-rose-50 text-rose-700'
                        : 'border-emerald-200/60 bg-emerald-50 text-emerald-700'
                    )}
                  >
                    {groupUrgency.icon}
                    <span>
                      Next expiry: {formatCountdown(group.earliestExpiry)}
                    </span>
                  </div>
                )}
              </div>
            </CardHeader>

            {/* ── Batch rows: per-application ledgers, then org-wide pools ── */}
            <CardContent className="p-0">
              {group.appLedgers.map((ledger) => (
                <div
                  key={ledger.applicationKey}
                  className="border-b border-slate-100/90 last:border-b-0"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-blue-100/50 bg-gradient-to-r from-blue-50/70 to-transparent px-5 py-2.5">
                    <div className="flex min-w-0 items-center gap-2">
                      <AppWindow className="h-4 w-4 shrink-0 text-blue-600" />
                      <span className="truncate text-sm font-semibold text-[#1B2E5A]">
                        {ledger.applicationLabel}
                      </span>
                      <Badge
                        variant="outline"
                        className="shrink-0 border-blue-200 px-1.5 py-0 text-[9px] font-semibold tracking-wide text-blue-700 uppercase"
                      >
                        App ledger
                      </Badge>
                    </div>
                    <span className="shrink-0 text-[11px] font-medium text-slate-500 tabular-nums">
                      {ledger.batches.length}{' '}
                      {ledger.batches.length === 1 ? 'entry' : 'entries'}
                      <span className="mx-1.5 text-slate-300">·</span>
                      {ledger.totalAvailable.toLocaleString()} credits
                    </span>
                  </div>
                  <div className="divide-y divide-slate-100/80">
                    {ledger.batches.map((batch) => (
                      <CreditExpiryBatchRow key={batch.id} batch={batch} />
                    ))}
                  </div>
                </div>
              ))}

              {group.orgPools.length > 0 && (
                <div
                  className={cn(
                    group.appLedgers.length > 0 &&
                      'border-t border-slate-100/90'
                  )}
                >
                  {group.appLedgers.length > 0 && (
                    <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 bg-slate-50/90 px-5 py-2.5">
                      <Building2 className="h-4 w-4 shrink-0 text-slate-500" />
                      <span className="text-[11px] font-bold tracking-widest text-slate-500 uppercase">
                        Organization-wide pools
                      </span>
                      <span className="text-[10px] font-medium text-slate-400">
                        Shared balance, seasonal, and subscription credits
                      </span>
                    </div>
                  )}
                  <div className="divide-y divide-slate-100/80">
                    {group.orgPools.map((batch) => (
                      <CreditExpiryBatchRow key={batch.id} batch={batch} />
                    ))}
                  </div>
                </div>
              )}

              {/* ── Entity footer ── */}
              <div className="flex items-center justify-between border-t border-[#1B2E5A]/5 bg-[#1B2E5A]/[0.02] px-5 py-3">
                <span className="text-[11px] font-medium tracking-wide text-slate-400">
                  {orgBatchCount} {orgBatchCount === 1 ? 'pool' : 'pools'}
                  {appBatchCount > 0 && ` + ${appBatchCount} app`}
                </span>
                <span className="text-[11px] font-bold tracking-wide text-[#1B2E5A]">
                  {group.totalAvailable.toLocaleString()} credits available
                </span>
              </div>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}
