/**
 * Purchase history tab: payment history list with filtering, stats, and plan management.
 */

import { useState, useMemo } from 'react'
import { useNavigate } from '@tanstack/react-router'
import {
  Crown,
  CheckCircle,
  XCircle,
  Clock,
  Calendar,
  CreditCard as CreditCardLucide,
  ExternalLink,
  Settings,
  ReceiptText,
  Coins,
  TrendingUp,
  Copy,
  Check,
  ChevronDown,
  ChevronUp,
  X,
  Download,
  Loader2
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { formatCurrency, formatDate } from '@/lib/utils'
import { ZopkitRoundLoader } from '@/components/common/feedback/ZopkitRoundLoader'
import type { DisplaySubscription } from '../hooks/useBilling'
import { useUserContext } from '@/contexts/UserContextProvider'
import { generateInvoicePDF } from '@/lib/invoiceGenerator'

// ─── Types ─────────────────────────────────────────────────────────────────

export interface PaymentHistoryItem {
  id: string
  type?: string
  status?: string
  description?: string
  amount: number
  paidAt?: string
  createdAt?: string
  currentPeriodEnd?: string
  billingReason?: string
  expiryDate?: string
  paymentMethod?: string
  paymentMethodDetails?: { card?: { last4?: string; brand?: string } }
  invoiceNumber?: string
  stripePaymentIntentId?: string
  stripeChargeId?: string
  stripeInvoiceId?: string
  creditsPurchased?: number
  taxAmount?: number
  processingFees?: number
  planDisplayName?: string
  billingCycle?: string
  [key: string]: unknown
}

export interface HistoryTabProps {
  displayBillingHistory: PaymentHistoryItem[]
  billingHistoryLoading: boolean
  displaySubscription: DisplaySubscription
  onOpenCancelDialog: () => void
}

// ─── Filter types ───────────────────────────────────────────────────────────

type FilterKey = 'all' | 'subscription' | 'credit_purchase' | 'plan_upgrade'

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'subscription', label: 'Subscriptions' },
  { key: 'credit_purchase', label: 'Credits' },
  { key: 'plan_upgrade', label: 'Upgrades' }
]

// ─── Helpers ────────────────────────────────────────────────────────────────

function getStatusConfig(payment: PaymentHistoryItem) {
  if (payment.type === 'plan_upgrade') {
    return {
      icon: <Crown className="h-4 w-4" />,
      iconBg: 'bg-violet-100 text-violet-600',
      badge: 'bg-violet-50 text-violet-700 border-violet-200',
      label: 'Upgrade'
    }
  }
  if (payment.status === 'succeeded' || payment.status === 'completed') {
    return {
      icon: <CheckCircle className="h-4 w-4" />,
      iconBg: 'bg-emerald-100 text-emerald-600',
      badge: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      label: payment.type === 'credit_purchase' ? 'Purchased' : 'Paid'
    }
  }
  if (payment.status === 'failed') {
    return {
      icon: <XCircle className="h-4 w-4" />,
      iconBg: 'bg-red-100 text-red-600',
      badge: 'bg-red-50 text-red-700 border-red-200',
      label: 'Failed'
    }
  }
  return {
    icon: <Clock className="h-4 w-4" />,
    iconBg: 'bg-amber-100 text-amber-600',
    badge: 'bg-amber-50 text-amber-700 border-amber-200',
    label: 'Pending'
  }
}

function getTypeLabel(type?: string): string {
  switch (type) {
    case 'plan_upgrade': return 'Plan Upgrade'
    case 'subscription': return 'Subscription'
    case 'credit_purchase': return 'Credit Purchase'
    case 'credit_usage': return 'Credit Usage'
    default: return type ? type.replace(/_/g, ' ') : 'Payment'
  }
}

function getPaymentTitle(payment: PaymentHistoryItem): string {
  if (payment.type === 'plan_upgrade') {
    return payment.planDisplayName ? `${payment.planDisplayName} Plan` : payment.description || 'Plan Upgrade'
  }
  return (
    payment.description ||
    getTypeLabel(payment.type)
  )
}

// ─── Sub-component: Stripe IDs row ──────────────────────────────────────────

function StripeRefRow({ payment }: { payment: PaymentHistoryItem }) {
  const [expanded, setExpanded] = useState(false)
  const [copied, setCopied] = useState<string | null>(null)

  const copy = (value: string, key: string) => {
    navigator.clipboard.writeText(value)
    setCopied(key)
    setTimeout(() => setCopied(null), 2000)
  }

  if (!payment.stripePaymentIntentId) return null

  const ids = [
    { key: 'pi', label: 'Payment ID', value: payment.stripePaymentIntentId },
    payment.stripeChargeId && payment.stripeChargeId !== payment.stripePaymentIntentId
      ? { key: 'ch', label: 'Charge ID', value: payment.stripeChargeId }
      : null,
    payment.stripeInvoiceId
      ? { key: 'inv', label: 'Invoice ID', value: payment.stripeInvoiceId }
      : null
  ].filter(Boolean) as { key: string; label: string; value: string }[]

  return (
    <div className="mt-3">
      <button
        onClick={() => setExpanded(v => !v)}
        className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-primary transition-colors"
      >
        {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
        Reference IDs
      </button>
      {expanded && (
        <div className="mt-2 rounded-xl bg-slate-50 border border-slate-100 p-3 space-y-2">
          {ids.map(({ key, label, value }) => (
            <div key={key} className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">{label}</p>
                <p className="font-mono text-xs text-slate-600 truncate">{value}</p>
              </div>
              <button
                onClick={() => copy(value, key)}
                className="shrink-0 p-1.5 rounded-lg hover:bg-slate-200 text-slate-400 hover:text-primary transition-colors"
              >
                {copied === key ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Sub-component: Payment Card ────────────────────────────────────────────

function PaymentCard({
  payment,
  onViewDetails,
  onDownload,
  isDownloading
}: {
  payment: PaymentHistoryItem
  onViewDetails: (id: string) => void
  onDownload: (payment: PaymentHistoryItem) => void
  isDownloading: boolean
}) {
  const isPlanUpgrade = payment.type === 'plan_upgrade'
  const statusCfg = getStatusConfig(payment)
  const dateStr = formatDate(payment.paidAt || payment.createdAt || '')

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-5">
      <div className="flex items-start justify-between gap-4">
        {/* Left: Icon + Details */}
        <div className="flex items-start gap-4 min-w-0 flex-1">
          <div className={`shrink-0 flex h-10 w-10 items-center justify-center rounded-xl ${statusCfg.iconBg}`}>
            {statusCfg.icon}
          </div>

          <div className="min-w-0 flex-1">
            {/* Title row */}
            <div className="flex flex-wrap items-center gap-2 mb-1.5">
              <h4 className="font-semibold text-primary text-sm leading-tight truncate max-w-xs">
                {getPaymentTitle(payment)}
              </h4>
              <Badge className={`${statusCfg.badge} text-[10px] font-semibold border px-2 py-0.5`}>
                {statusCfg.label}
              </Badge>
              <Badge variant="outline" className="text-[10px] text-slate-500 border-slate-200 px-2 py-0.5">
                {getTypeLabel(payment.type)}
              </Badge>
            </div>

            {/* Meta row */}
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
              <span className="flex items-center gap-1.5">
                <Calendar className="h-3 w-3 text-slate-400" />
                {isPlanUpgrade ? `Started ${dateStr}` : dateStr}
                {!isPlanUpgrade && payment.billingReason && (
                  <span className="text-slate-400">· {String(payment.billingReason).replace(/_/g, ' ')}</span>
                )}
              </span>

              {isPlanUpgrade && payment.currentPeriodEnd && (
                <span className="flex items-center gap-1.5">
                  <Clock className="h-3 w-3 text-slate-400" />
                  Renews {formatDate(payment.currentPeriodEnd)}
                </span>
              )}

              {!isPlanUpgrade && (payment.paymentMethodDetails?.card || payment.paymentMethod) && (
                <span className="flex items-center gap-1.5">
                  <CreditCardLucide className="h-3 w-3 text-slate-400" />
                  {payment.paymentMethodDetails?.card ? (
                    <>•••• {payment.paymentMethodDetails.card.last4} · {payment.paymentMethodDetails.card.brand?.toUpperCase()}</>
                  ) : (
                    String(payment.paymentMethod || 'Card')
                  )}
                </span>
              )}

              {isPlanUpgrade && payment.billingCycle && (
                <span className="flex items-center gap-1.5">
                  <Clock className="h-3 w-3 text-slate-400" />
                  {payment.billingCycle === 'yearly' ? 'Annual' : 'Monthly'} billing
                </span>
              )}

              {!isPlanUpgrade && payment.invoiceNumber && (
                <span className="flex items-center gap-1.5">
                  <ReceiptText className="h-3 w-3 text-slate-400" />
                  Invoice #{payment.invoiceNumber}
                </span>
              )}

              {!isPlanUpgrade && payment.expiryDate && payment.type === 'credit_purchase' && (
                <span className="text-slate-400">
                  Credits expire {formatDate(payment.expiryDate)}
                </span>
              )}
            </div>

            {/* Collapsible Stripe reference IDs */}
            {!isPlanUpgrade && <StripeRefRow payment={payment} />}
          </div>
        </div>

        {/* Right: Amount + Actions */}
        <div className="flex flex-col items-end gap-3 shrink-0">
          {/* Amount */}
          <div className={`rounded-xl px-4 py-2.5 text-right border ${
            isPlanUpgrade
              ? 'bg-violet-50 border-violet-100'
              : payment.status === 'failed'
                ? 'bg-red-50 border-red-100'
                : 'bg-primary/5 border-primary/10'
          }`}>
            <div style={{ fontFamily: 'var(--zk-mono)', fontWeight: 600 }} className={`text-base ${
              isPlanUpgrade
                ? 'text-violet-700'
                : payment.status === 'failed'
                  ? 'text-red-600'
                  : 'text-primary'
            }`}>
              {formatCurrency(payment.amount)}
            </div>
            <div style={{ fontFamily: 'var(--zk-mono)', fontSize: 10, letterSpacing: '0.06em', textTransform: 'uppercase' as const, color: 'var(--zk-muted-2)' }} className="mt-0.5">
              {isPlanUpgrade
                ? payment.billingCycle === 'yearly' ? 'Annual Plan' : 'Monthly Plan'
                : payment.type === 'credit_purchase' ? 'Purchase' : 'Total'}
            </div>
          </div>

          {/* Credits badge */}
          {!isPlanUpgrade && (payment.creditsPurchased ?? 0) > 0 && (
            <div className="flex items-center gap-1.5 rounded-xl bg-emerald-50 border border-emerald-100 px-3 py-2">
              <Coins className="h-3 w-3 text-emerald-600" />
              <span className="text-xs font-semibold text-emerald-700">
                +{(payment.creditsPurchased ?? 0).toLocaleString()} credits
              </span>
            </div>
          )}

          {/* Tax / fees */}
          {!isPlanUpgrade && ((payment.taxAmount ?? 0) > 0 || (payment.processingFees ?? 0) > 0) && (
            <div className="text-[10px] text-slate-400 text-right space-y-0.5">
              {(payment.taxAmount ?? 0) > 0 && (
                <div>Tax: {formatCurrency(payment.taxAmount ?? 0)}</div>
              )}
              {(payment.processingFees ?? 0) > 0 && (
                <div>Fees: {formatCurrency(payment.processingFees ?? 0)}</div>
              )}
            </div>
          )}

          {/* Actions — visible for ALL payment types */}
          <div className="flex items-center gap-2">
            {!isPlanUpgrade && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => onViewDetails(payment.id)}
                className="h-8 text-xs border-primary/15 text-primary hover:bg-primary/5 hover:border-primary/25"
              >
                <ExternalLink className="h-3 w-3 mr-1.5" />
                Details
              </Button>
            )}
            <Button
              variant="default"
              size="sm"
              onClick={() => onDownload(payment)}
              disabled={isDownloading}
              style={{ background: 'var(--zk-navy)' }}
              className="h-8 text-xs hover:bg-primary-hover text-white shadow-sm min-w-[130px]"
            >
              {isDownloading ? (
                <>
                  <Loader2 className="h-3 w-3 mr-1.5 animate-spin" />
                  Generating…
                </>
              ) : (
                <>
                  <Download className="h-3 w-3 mr-1.5" />
                  Download Invoice
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Main Component ─────────────────────────────────────────────────────────

export function HistoryTab({
  displayBillingHistory,
  billingHistoryLoading,
  displaySubscription,
  onOpenCancelDialog
}: HistoryTabProps) {
  const navigate = useNavigate()
  const [activeFilter, setActiveFilter] = useState<FilterKey>('all')
  const [downloadingId, setDownloadingId] = useState<string | null>(null)
  const { user, tenant } = useUserContext()

  const handleDownload = async (payment: PaymentHistoryItem) => {
    setDownloadingId(payment.id)
    // Double-rAF ensures the spinner actually paints before jsPDF blocks the main thread
    await new Promise<void>(resolve =>
      requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
    )
    try {
      generateInvoicePDF(payment, {
        name: user?.name || 'Customer',
        email: user?.email || '',
        companyName: tenant?.companyName,
      })
    } finally {
      setDownloadingId(null)
    }
  }

  // Compute summary stats
  const stats = useMemo(() => {
    const paid = displayBillingHistory.filter(
      p => p.status === 'succeeded' || p.status === 'completed'
    )
    return {
      totalSpent: paid.reduce((s, p) => s + (p.amount || 0), 0),
      txCount: displayBillingHistory.length,
      creditsTotal: paid.reduce((s, p) => s + (p.creditsPurchased || 0), 0)
    }
  }, [displayBillingHistory])

  // Filter counts
  const filterCounts = useMemo(() => {
    const counts: Record<FilterKey, number> = { all: displayBillingHistory.length, subscription: 0, credit_purchase: 0, plan_upgrade: 0 }
    for (const p of displayBillingHistory) {
      if (p.type === 'subscription') counts.subscription++
      else if (p.type === 'credit_purchase') counts.credit_purchase++
      else if (p.type === 'plan_upgrade') counts.plan_upgrade++
    }
    return counts
  }, [displayBillingHistory])

  // Filtered list
  const filtered = useMemo(() => {
    if (activeFilter === 'all') return displayBillingHistory
    return displayBillingHistory.filter(p => p.type === activeFilter)
  }, [displayBillingHistory, activeFilter])

  return (
    <div className="space-y-6">

      {/* ── Section header ── */}
      <div className="rounded-3xl border border-primary/10 bg-white shadow-sm p-6 relative overflow-hidden">
        <div className="absolute top-0 right-0 -mt-8 -mr-8 h-32 w-32 rounded-full bg-gradient-to-br from-blue-50 to-sky-50 opacity-60 blur-2xl" />
        <div className="relative flex items-center gap-4">
          <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-primary/10">
            <ReceiptText className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h3 style={{ fontFamily: 'var(--zk-display)', letterSpacing: '-0.025em', color: 'var(--zk-ink)', fontWeight: 600, fontSize: 18 }}>Payment History</h3>
            <p style={{ fontFamily: 'var(--zk-font)', fontSize: 13, color: 'var(--zk-muted)' }}>All transactions and invoices for your account</p>
          </div>
        </div>
      </div>

      {billingHistoryLoading ? (
        <div className="flex items-center justify-center py-16">
          <div className="text-center">
            <ZopkitRoundLoader size="xl" className="mx-auto mb-4" />
            <p className="text-sm text-slate-500">Loading payment history…</p>
          </div>
        </div>
      ) : !displayBillingHistory?.length ? (
        <div className="rounded-3xl border-2 border-dashed border-slate-200 bg-slate-50/50 py-16 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-lg bg-slate-100">
            <ReceiptText className="h-7 w-7 text-slate-400" />
          </div>
          <h4 className="text-base font-semibold text-primary mb-1">No transactions yet</h4>
          <p className="text-sm text-slate-500">Your completed transactions will appear here</p>
        </div>
      ) : (
        <>
          {/* ── Stats row ── */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white p-4">
              <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                <TrendingUp className="h-4 w-4 text-primary" />
              </div>
              <div>
                <p style={{ fontFamily: 'var(--zk-mono)', fontSize: 11, fontWeight: 500, letterSpacing: '0.07em', textTransform: 'uppercase' as const, color: 'var(--zk-muted-2)' }}>Total Spent</p>
                <p style={{ fontFamily: 'var(--zk-mono)', fontWeight: 600, color: 'var(--zk-ink)' }} className="text-lg">{formatCurrency(stats.totalSpent)}</p>
              </div>
            </div>
            <div className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white p-4">
              <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                <ReceiptText className="h-4 w-4 text-primary" />
              </div>
              <div>
                <p style={{ fontFamily: 'var(--zk-mono)', fontSize: 11, fontWeight: 500, letterSpacing: '0.07em', textTransform: 'uppercase' as const, color: 'var(--zk-muted-2)' }}>Transactions</p>
                <p style={{ fontFamily: 'var(--zk-mono)', fontWeight: 600, color: 'var(--zk-ink)' }} className="text-lg">{stats.txCount}</p>
              </div>
            </div>
            <div className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white p-4">
              <div className="h-10 w-10 rounded-xl bg-emerald-100 flex items-center justify-center shrink-0">
                <Coins className="h-4 w-4 text-emerald-600" />
              </div>
              <div>
                <p style={{ fontFamily: 'var(--zk-mono)', fontSize: 11, fontWeight: 500, letterSpacing: '0.07em', textTransform: 'uppercase' as const, color: 'var(--zk-muted-2)' }}>Credits Purchased</p>
                <p style={{ fontFamily: 'var(--zk-mono)', fontWeight: 600, color: 'var(--zk-ink)' }} className="text-lg">{stats.creditsTotal.toLocaleString()}</p>
              </div>
            </div>
          </div>

          {/* ── Filters ── */}
          <div className="flex flex-wrap items-center gap-2">
            {FILTERS.map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setActiveFilter(key)}
                className={`flex items-center gap-1.5 rounded-full px-4 py-1.5 text-sm font-medium transition-all border ${
                  activeFilter === key
                    ? 'bg-primary text-white border-primary shadow-sm'
                    : 'bg-white text-slate-600 border-slate-200 hover:border-primary/30 hover:text-primary'
                }`}
              >
                {label}
                <span className={`rounded-full text-[10px] font-bold px-1.5 py-0.5 ${
                  activeFilter === key
                    ? 'bg-white/20 text-white'
                    : 'bg-slate-100 text-slate-500'
                }`}>
                  {filterCounts[key]}
                </span>
              </button>
            ))}
          </div>

          {/* ── Payment list ── */}
          {filtered.length === 0 ? (
            <div className="rounded-lg border border-slate-200 bg-slate-50 py-10 text-center">
              <p className="text-sm text-slate-500">No transactions in this category</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filtered.map((payment) => (
                <PaymentCard
                  key={payment.id}
                  payment={payment}
                  onViewDetails={(id) =>
                    navigate({ to: `/dashboard/billing/payments/${id}` })
                  }
                  onDownload={handleDownload}
                  isDownloading={downloadingId === payment.id}
                />
              ))}
            </div>
          )}
        </>
      )}

      {/* ── Plan Management ── */}
      {displaySubscription.plan !== 'free' && (
        <Card className="rounded-3xl border border-slate-100 bg-white shadow-sm">
          <CardHeader className="pb-4 border-b border-slate-50">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
                <Settings className="h-5 w-5 text-primary" />
              </div>
              <div>
                <CardTitle style={{ fontFamily: 'var(--zk-display)', letterSpacing: '-0.025em', color: 'var(--zk-ink)', fontWeight: 600 }} className="text-base">Plan Management</CardTitle>
                <p style={{ fontFamily: 'var(--zk-font)', fontSize: 13, color: 'var(--zk-muted)' }} className="mt-0.5">Manage your active subscription</p>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-5">
            <div className="flex items-center justify-between gap-4 rounded-lg border border-red-100 bg-red-50/40 p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-red-100">
                  <X className="h-4 w-4 text-red-600" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-800">Cancel Subscription</p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Effective at end of current billing period
                  </p>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={onOpenCancelDialog}
                className="shrink-0 border-red-200 text-red-600 hover:bg-red-50 hover:border-red-300 h-9"
              >
                Cancel Plan
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
