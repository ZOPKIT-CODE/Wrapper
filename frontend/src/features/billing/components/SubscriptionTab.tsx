import {
  Crown,
  Calendar,
  Coins,
  Clock,
  CreditCard as CreditCardLucide,
  ArrowRight,
  Zap,
  Activity,
  Layers,
} from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { formatDate } from '@/lib/utils'
import { cn } from '@/lib/utils'
import type { DisplaySubscription } from '../hooks/useBilling'
import type { ApplicationPlan, CheckoutCurrency } from '@/types/pricing'
import { formatMonthlyInrDisplay, formatMonthlyUsdDisplay } from '../utils/planPriceDisplay'
import { CreditExpiryCard } from './CreditExpiryCard'
import type { AllocationItem } from './CreditExpiryCard'

// ─── Types ───────────────────────────────────────────────────────────────────

export interface CreditBalanceData {
  availableCredits?: number
  freeCredits?: number
  paidCredits?: number
  totalCredits?: number
  freeCreditsExpiry?: string
  paidCreditsExpiry?: string | null
  subscriptionExpiry?: string | null
  creditExpiry?: string
}

export interface SubscriptionTabProps {
  displaySubscription: DisplaySubscription
  applicationPlans: ApplicationPlan[]
  creditBalance: CreditBalanceData | null | undefined
  setActiveTab: (tab: string) => void
  planPriceCurrency?: CheckoutCurrency
  creditAllocations?: AllocationItem[] | null
  creditAllocationsLoading?: boolean
}

// ─── Constants ───────────────────────────────────────────────────────────────

const PLAN_NAME_MAP: Record<string, string> = {
  free: 'Free', starter: 'Starter', professional: 'Professional',
  premium: 'Premium', enterprise: 'Enterprise', standard: 'Standard',
  credit_based: 'Free',
}

function getPlanDisplayName(planId: string): string {
  return PLAN_NAME_MAP[planId]
    || (planId === 'credit_based' ? 'Free' : planId.charAt(0).toUpperCase() + planId.slice(1))
    || 'Free'
}

// ─── Component ───────────────────────────────────────────────────────────────

export function SubscriptionTab({
  displaySubscription,
  applicationPlans,
  creditBalance,
  setActiveTab,
  planPriceCurrency = 'usd',
  creditAllocations,
  creditAllocationsLoading,
}: SubscriptionTabProps) {
  const planId = displaySubscription.plan || 'free'
  const currentPlan = applicationPlans.find((p) => p.id === planId)
  const showInr = planPriceCurrency === 'inr' && (currentPlan?.annualPriceInr ?? 0) > 0
  const annualUsdForDisplay = Number(displaySubscription.yearlyPrice ?? currentPlan?.annualPriceUsd ?? 0)
  const annualInrForDisplay = currentPlan?.annualPriceInr ?? 0

  const availableCredits = creditBalance?.availableCredits ?? 0
  const freeCreditsExpiry = creditBalance?.freeCreditsExpiry ?? displaySubscription.currentPeriodEnd

  const isFree = displaySubscription.plan === 'free'

  return (
    <div className="space-y-5 font-sans text-[#1B2E5A]">

      {/* ── Current Plan Card ── */}
      <Card className="group relative overflow-hidden rounded-3xl border border-[#1B2E5A]/8 bg-white shadow-sm transition-all duration-300 hover:shadow-md hover:shadow-[#1B2E5A]/[0.06] hover:border-[#1B2E5A]/15">
        {/* Decorative gradient orb */}
        <div className="absolute top-0 right-0 -mt-20 -mr-20 h-56 w-56 rounded-full bg-gradient-to-br from-[#1B2E5A]/[0.04] to-blue-100/30 blur-3xl transition-transform duration-500 group-hover:scale-110" />

        <CardHeader className="relative pb-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className={cn(
                'flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl shadow-inner',
                isFree
                  ? 'bg-[#1B2E5A]/[0.06] text-[#1B2E5A]/60'
                  : 'bg-gradient-to-br from-[#1B2E5A] to-[#152449] text-white shadow-[#1B2E5A]/20'
              )}>
                <Crown className="h-7 w-7" />
              </div>
              <div>
                <CardTitle style={{ fontFamily: 'var(--zk-display)', letterSpacing: '-0.025em', color: 'var(--zk-ink)', fontWeight: 600 }} className="text-xl tracking-tight">
                  <span style={{ fontFamily: 'var(--zk-display)', fontWeight: 600 }}>{getPlanDisplayName(planId)}</span> Plan
                </CardTitle>
                <CardDescription style={{ fontFamily: 'var(--zk-font)', color: 'var(--zk-muted)', fontSize: 13 }} className="flex items-center gap-2 mt-1">
                  <span className={cn(
                    'inline-block h-2 w-2 rounded-full',
                    displaySubscription.status === 'active' ? 'bg-emerald-500' : 'bg-slate-400'
                  )} />
                  <span style={{ fontFamily: 'var(--zk-mono)', fontSize: 10, letterSpacing: '0.06em', textTransform: 'uppercase' as const, color: 'var(--zk-muted-2)' }}>
                    {displaySubscription.status ? displaySubscription.status.toUpperCase() : 'ACTIVE'}
                  </span>
                </CardDescription>
              </div>
            </div>

            <div className="flex items-end flex-col">
              {!isFree ? (
                <>
                  <div className="flex items-baseline gap-1">
                    <span style={{ fontFamily: 'var(--zk-mono)', fontWeight: 600, color: 'var(--zk-ink)' }} className="text-2xl tracking-tight">
                      {showInr
                        ? formatMonthlyInrDisplay(annualInrForDisplay)
                        : formatMonthlyUsdDisplay(annualUsdForDisplay)}
                    </span>
                    <span style={{ fontFamily: 'var(--zk-mono)', fontSize: 10, letterSpacing: '0.06em', textTransform: 'uppercase' as const, color: 'var(--zk-muted-2)' }}>
                      {showInr ? '/ mo INR' : '/ mo USD'}
                    </span>
                  </div>
                  {displaySubscription.currentPeriodEnd && (
                    <p style={{ fontFamily: 'var(--zk-font)', fontSize: 11, color: 'var(--zk-muted-2)' }} className="mt-1 flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      Renews {formatDate(displaySubscription.currentPeriodEnd)}
                    </p>
                  )}
                </>
              ) : (
                <span style={{ fontFamily: 'var(--zk-display)', fontWeight: 600, letterSpacing: '-0.025em', color: 'var(--zk-ink)', opacity: 0.5 }} className="text-3xl">Free</span>
              )}
            </div>
          </div>
        </CardHeader>

        {isFree && (
          <CardContent className="relative pt-0">
            <div className="flex justify-end">
              <Button
                onClick={() => setActiveTab('plans')}
                size="sm"
                style={{ background: 'var(--zk-navy)' }}
                className="hover:bg-[#152449] text-white shadow-lg shadow-[#1B2E5A]/15 rounded-full px-6 font-semibold transition-all hover:scale-[1.02] active:scale-95"
              >
                Upgrade Now <ArrowRight className="w-4 h-4 ml-1" />
              </Button>
            </div>
          </CardContent>
        )}
      </Card>

      {/* ── Plan Details + Credit Balance ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

        {/* Left: Subscription Details */}
        <div className="lg:col-span-2">
          <Card className="h-full rounded-3xl border border-[#1B2E5A]/8 bg-white shadow-sm overflow-hidden">
            <CardHeader className="pb-3 border-b border-[#1B2E5A]/5 bg-[#1B2E5A]/[0.015]">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-[#1B2E5A]/[0.06] rounded-xl">
                  <Layers className="w-5 h-5 text-[#1B2E5A]" />
                </div>
                <div>
                  <CardTitle style={{ fontFamily: 'var(--zk-display)', letterSpacing: '-0.025em', color: 'var(--zk-ink)', fontWeight: 600 }} className="text-base tracking-tight">Subscription Details</CardTitle>
                  <CardDescription style={{ fontFamily: 'var(--zk-font)', color: 'var(--zk-muted)', fontSize: 13 }} className="tracking-wide">Your plan configuration</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Tier */}
                <div className="group rounded-2xl border border-[#1B2E5A]/5 bg-white p-4 transition-all hover:border-[#1B2E5A]/10 hover:shadow-md hover:shadow-[#1B2E5A]/[0.04]">
                  <div className="flex items-center gap-2 mb-1.5">
                    <Crown className="w-4 h-4 text-[#1B2E5A]/50" />
                    <span style={{ fontFamily: 'var(--zk-mono)', fontSize: 10, letterSpacing: '0.07em', textTransform: 'uppercase' as const, color: 'var(--zk-muted-2)', fontWeight: 500 }}>Tier</span>
                  </div>
                  <div style={{ fontFamily: 'var(--zk-display)', fontWeight: 600, color: 'var(--zk-ink)', letterSpacing: '-0.025em' }} className="text-lg tracking-tight">{getPlanDisplayName(planId)}</div>
                </div>
                {/* Billing */}
                <div className="group rounded-2xl border border-[#1B2E5A]/5 bg-white p-4 transition-all hover:border-[#1B2E5A]/10 hover:shadow-md hover:shadow-[#1B2E5A]/[0.04]">
                  <div className="flex items-center gap-2 mb-1.5">
                    <CreditCardLucide className="w-4 h-4 text-[#1B2E5A]/50" />
                    <span style={{ fontFamily: 'var(--zk-mono)', fontSize: 10, letterSpacing: '0.07em', textTransform: 'uppercase' as const, color: 'var(--zk-muted-2)', fontWeight: 500 }}>Billing</span>
                  </div>
                  <div style={{ fontFamily: 'var(--zk-mono)', fontWeight: 600, color: 'var(--zk-ink)' }} className="text-lg tracking-tight">
                    {!isFree && displaySubscription.plan !== 'credit_based' ? (
                      <span>
                        {showInr ? formatMonthlyInrDisplay(annualInrForDisplay) : formatMonthlyUsdDisplay(annualUsdForDisplay)}
                        <span style={{ fontFamily: 'var(--zk-font)', fontSize: 13, color: 'var(--zk-muted)', fontWeight: 400 }}> / month</span>
                        <span style={{ display: 'block', fontFamily: 'var(--zk-font)', fontSize: 11, color: 'var(--zk-muted-2)', fontWeight: 400 }} className="mt-0.5">Billed annually</span>
                      </span>
                    ) : (
                      'Free'
                    )}
                  </div>
                </div>
                {/* Renewal / Expiration */}
                {displaySubscription.currentPeriodEnd && (
                  <div className="group rounded-2xl border border-[#1B2E5A]/5 bg-white p-4 transition-all hover:border-[#1B2E5A]/10 hover:shadow-md hover:shadow-[#1B2E5A]/[0.04]">
                    <div className="flex items-center gap-2 mb-1.5">
                      <Calendar className="w-4 h-4 text-[#1B2E5A]/50" />
                      <span style={{ fontFamily: 'var(--zk-mono)', fontSize: 10, letterSpacing: '0.07em', textTransform: 'uppercase' as const, color: 'var(--zk-muted-2)', fontWeight: 500 }}>
                        {isFree ? 'Expiration' : 'Renewal'}
                      </span>
                    </div>
                    <div style={{ fontFamily: 'var(--zk-mono)', fontWeight: 600, color: 'var(--zk-ink)' }} className="text-lg tracking-tight">
                      {formatDate(displaySubscription.currentPeriodEnd)}
                    </div>
                  </div>
                )}
                {/* Plan Credits */}
                {!isFree && (currentPlan?.freeCredits ?? 0) > 0 && (
                  <div className="rounded-2xl border border-[#1B2E5A]/10 bg-gradient-to-br from-[#1B2E5A]/[0.03] to-white p-4">
                    <div className="flex items-center gap-2 mb-1.5">
                      <Zap className="w-4 h-4 text-[#1B2E5A]/60" />
                      <span style={{ fontFamily: 'var(--zk-mono)', fontSize: 10, letterSpacing: '0.07em', textTransform: 'uppercase' as const, color: 'var(--zk-muted-2)', fontWeight: 500 }}>Plan Credits</span>
                    </div>
                    <div style={{ fontFamily: 'var(--zk-mono)', fontWeight: 600, color: 'var(--zk-ink)' }} className="text-lg tracking-tight">
                      {(currentPlan?.freeCredits ?? 0).toLocaleString()}
                      <span style={{ fontFamily: 'var(--zk-font)', fontSize: 13, color: 'var(--zk-muted)', fontWeight: 400 }}> credits</span>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right: Credit Balance Hero */}
        <div className="lg:col-span-1">
          <Card className="h-full rounded-3xl border-0 bg-gradient-to-br from-[#1B2E5A] to-[#0F1D3A] text-white shadow-xl shadow-[#1B2E5A]/20 overflow-hidden relative flex flex-col justify-between">
            {/* Ambient glow */}
            <div className="absolute top-0 right-0 w-72 h-72 bg-blue-400 rounded-full mix-blend-overlay filter blur-[80px] opacity-[0.07] -translate-y-1/2 translate-x-1/2" />
            <div className="absolute bottom-0 left-0 w-52 h-52 bg-blue-300 rounded-full mix-blend-overlay filter blur-[60px] opacity-[0.05] translate-y-1/2 -translate-x-1/2" />

            <CardHeader className="relative z-10 pb-0">
              <div className="flex items-center justify-between mb-3">
                <div className="p-2.5 bg-white/[0.08] backdrop-blur-md rounded-xl border border-white/[0.08]">
                  <Layers className="w-5 h-5 text-blue-200" />
                </div>
                {availableCredits < 100 && (
                  <Badge variant="destructive" className="bg-rose-500/20 text-rose-200 border-rose-500/20 text-[10px] font-semibold tracking-wide">
                    Low Balance
                  </Badge>
                )}
              </div>
              <CardTitle style={{ fontFamily: 'var(--zk-mono)', fontSize: 10, letterSpacing: '0.06em', textTransform: 'uppercase' as const, fontWeight: 600, color: 'rgba(255,255,255,0.5)' }}>Available Credits</CardTitle>
            </CardHeader>

            <CardContent className="relative z-10 pt-3 pb-5 flex-grow flex flex-col justify-end">
              <div className="mb-5">
                <div style={{ fontFamily: 'var(--zk-mono)', fontWeight: 600, letterSpacing: '-0.04em', color: '#ffffff' }} className="text-5xl mb-2">
                  {availableCredits.toLocaleString()}
                </div>
                <div className="flex items-center gap-2 text-sm text-white/40">
                  <Activity className="w-4 h-4 text-emerald-400/80" />
                  <span style={{ fontFamily: 'var(--zk-font)', fontWeight: 500 }}>Total usage: {(creditBalance as any)?.usageThisPeriod ?? 0}</span>
                </div>
              </div>

              {/* Breakdown */}
              <div className="space-y-2 mb-5">
                <div className="flex items-center justify-between p-3 rounded-xl bg-white/[0.04] border border-white/[0.06]">
                  <div className="flex items-center gap-3">
                    <div className="w-1.5 h-1.5 rounded-full bg-blue-400 shadow-[0_0_6px_rgba(96,165,250,0.4)]" />
                    <span style={{ fontFamily: 'var(--zk-font)', fontSize: 13, color: 'rgba(255,255,255,0.7)' }}>Paid Credits</span>
                  </div>
                  <span style={{ fontFamily: 'var(--zk-mono)', fontWeight: 600, color: '#ffffff' }} className="tabular-nums">{creditBalance?.paidCredits ?? 0}</span>
                </div>
                <div className="flex items-center justify-between p-3 rounded-xl bg-white/[0.04] border border-white/[0.06]">
                  <div className="flex items-center gap-3">
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.4)]" />
                    <span style={{ fontFamily: 'var(--zk-font)', fontSize: 13, color: 'rgba(255,255,255,0.7)' }}>Free Credits</span>
                  </div>
                  <span style={{ fontFamily: 'var(--zk-mono)', fontWeight: 600, color: '#ffffff' }} className="tabular-nums">{creditBalance?.freeCredits ?? 0}</span>
                </div>
              </div>

              {/* CTA */}
              <Button
                onClick={() => setActiveTab('topups')}
                className="w-full bg-white/[0.1] hover:bg-white/[0.15] text-white border border-white/[0.1] hover:border-white/[0.2] shadow-lg h-12 rounded-xl font-semibold transition-all active:scale-95 backdrop-blur-sm"
              >
                <Coins className="w-4 h-4 mr-2 opacity-80" />
                Top Up Credits
              </Button>

              {freeCreditsExpiry && (
                <p style={{ fontFamily: 'var(--zk-font)', fontSize: 10, color: 'rgba(255,255,255,0.3)', fontWeight: 500, letterSpacing: '0.03em' }} className="text-center mt-3">
                  Free credits expire on {formatDate(freeCreditsExpiry)}
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* ── Credit Expiry Schedule ── */}
      <CreditExpiryCard
        creditAllocations={creditAllocations}
        creditBalance={creditBalance ?? undefined}
        isLoading={creditAllocationsLoading}
      />
    </div>
  )
}
