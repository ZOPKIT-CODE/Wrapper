import React, { useEffect, useState } from 'react'
import { useParams, useNavigate } from '@tanstack/react-router'
import {
  ArrowLeft,
  Download,
  RefreshCw,
  AlertTriangle,
  Copy,
  Check,
  CheckCircle,
  XCircle,
  Clock,
  Calendar,
  CreditCard,
  Coins,
  FileText,
  ReceiptText,
  Loader2,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { formatCurrency, formatDate } from '@/lib/utils'
import { useQuery } from '@tanstack/react-query'
import { subscriptionAPI } from '@/lib/api'
import { Container } from '@/components/common/Page'
import AnimatedLoader from '@/components/common/feedback/AnimatedLoader'
import type { BillingHistoryItem } from '@/types/billing'
import { useBreadcrumbLabel } from '@/contexts/BreadcrumbLabelContext'
import { useUserContext } from '@/contexts/UserContextProvider'
import { generateInvoicePDF } from '@/lib/invoiceGenerator'

// ─── Status helpers ─────────────────────────────────────────────────────────

type StatusKey =
  | 'succeeded'
  | 'failed'
  | 'canceled'
  | 'refunded'
  | 'partially_refunded'
  | 'disputed'
  | string

function getStatusConfig(status: StatusKey) {
  switch (status) {
    case 'succeeded':
      return {
        label: 'Paid',
        icon: <CheckCircle className="h-4 w-4" />,
        badge: 'bg-emerald-50 text-emerald-700 border-emerald-200',
        headerAccent: 'bg-emerald-500',
      }
    case 'failed':
      return {
        label: 'Failed',
        icon: <XCircle className="h-4 w-4" />,
        badge: 'bg-red-50 text-red-700 border-red-200',
        headerAccent: 'bg-red-500',
      }
    case 'canceled':
      return {
        label: 'Canceled',
        icon: <XCircle className="h-4 w-4" />,
        badge: 'bg-slate-100 text-slate-600 border-slate-200',
        headerAccent: 'bg-slate-400',
      }
    case 'refunded':
      return {
        label: 'Refunded',
        icon: <RefreshCw className="h-4 w-4" />,
        badge: 'bg-orange-50 text-orange-700 border-orange-200',
        headerAccent: 'bg-orange-500',
      }
    case 'partially_refunded':
      return {
        label: 'Partial Refund',
        icon: <RefreshCw className="h-4 w-4" />,
        badge: 'bg-orange-50 text-orange-700 border-orange-200',
        headerAccent: 'bg-orange-400',
      }
    case 'disputed':
      return {
        label: 'Disputed',
        icon: <AlertTriangle className="h-4 w-4" />,
        badge: 'bg-violet-50 text-violet-700 border-violet-200',
        headerAccent: 'bg-violet-500',
      }
    default:
      return {
        label: status,
        icon: <Clock className="h-4 w-4" />,
        badge: 'bg-amber-50 text-amber-700 border-amber-200',
        headerAccent: 'bg-amber-400',
      }
  }
}

function getPaymentType(type?: string): string {
  switch (type) {
    case 'credit_purchase':
      return 'Credit Purchase'
    case 'subscription':
      return 'Subscription'
    case 'plan_upgrade':
      return 'Plan Upgrade'
    default:
      return type
        ? type.charAt(0).toUpperCase() + type.slice(1).replace(/_/g, ' ')
        : 'Payment'
  }
}

// ─── Copy-ID row ─────────────────────────────────────────────────────────────

function CopyRow({
  label,
  value,
  copiedId,
  onCopy,
}: {
  label: string
  value: string
  copiedId: string | null
  onCopy: (value: string, id: string) => void
}) {
  const id = label.toLowerCase().replace(/\s+/g, '-')
  return (
    <div className="flex items-center justify-between gap-3 border-b border-slate-50 py-2.5 last:border-0">
      <div className="min-w-0 flex-1">
        <p className="mb-0.5 text-[10px] font-semibold tracking-wider text-slate-400 uppercase">
          {label}
        </p>
        <p className="font-mono text-xs break-all text-slate-700">{value}</p>
      </div>
      <button
        onClick={() => onCopy(value, id)}
        className="hover:text-primary shrink-0 rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100"
      >
        {copiedId === id ? (
          <Check className="h-3.5 w-3.5 text-emerald-500" />
        ) : (
          <Copy className="h-3.5 w-3.5" />
        )}
      </button>
    </div>
  )
}

// ─── Detail row ──────────────────────────────────────────────────────────────

function DetailRow({
  label,
  value,
}: {
  label: string
  value: React.ReactNode
}) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-slate-50 py-3 last:border-0">
      <span className="shrink-0 text-sm text-slate-500">{label}</span>
      <span className="text-primary text-right text-sm font-semibold">
        {value}
      </span>
    </div>
  )
}

// ─── Timeline step ───────────────────────────────────────────────────────────

function TimelineStep({
  label,
  value,
  isLast = false,
}: {
  label: string
  value: string
  isLast?: boolean
}) {
  return (
    <div className="flex gap-4">
      <div className="flex flex-col items-center">
        <div className="bg-primary/10 flex h-7 w-7 shrink-0 items-center justify-center rounded-full">
          <div className="bg-primary h-2 w-2 rounded-full" />
        </div>
        {!isLast && <div className="mt-1 w-px flex-1 bg-slate-100" />}
      </div>
      <div className="min-w-0 pb-5">
        <p className="text-xs font-medium text-slate-500">{label}</p>
        <p className="text-primary mt-0.5 text-sm font-semibold">{value}</p>
      </div>
    </div>
  )
}

// ─── Main Component ──────────────────────────────────────────────────────────

export function PaymentDetailsPage() {
  const { paymentId } = useParams({ strict: false })
  const navigate = useNavigate()
  const [copiedId, setCopiedId] = React.useState<string | null>(null)
  const [isDownloading, setIsDownloading] = useState(false)
  const { setLastSegmentLabel } = useBreadcrumbLabel()
  const { user, tenant } = useUserContext()

  const { data: billingHistory, isLoading } = useQuery({
    queryKey: ['subscription', 'billing-history'],
    queryFn: async () => {
      try {
        const response = await subscriptionAPI.getBillingHistory()
        return response.data.data || []
      } catch (error) {
        console.warn('Failed to fetch billing history:', error)
        return []
      }
    },
  })

  const payment = React.useMemo(() => {
    if (!billingHistory || !paymentId) return null
    return (
      (billingHistory as BillingHistoryItem[]).find(
        (p: BillingHistoryItem) => p.id === paymentId
      ) || null
    )
  }, [billingHistory, paymentId])

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text)
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 2000)
  }

  const handleRefund = () => {
    navigate({ to: `/dashboard/billing?refund=${paymentId}` })
  }

  const handleDownloadInvoice = async () => {
    if (!payment) return
    setIsDownloading(true)
    // Double-rAF ensures the spinner actually paints before jsPDF blocks the main thread
    await new Promise<void>((resolve) =>
      requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
    )
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      generateInvoicePDF(payment as any, {
        name: user?.name || 'Customer',
        email: user?.email || '',
        companyName: tenant?.companyName,
      })
    } finally {
      setIsDownloading(false)
    }
  }

  useEffect(() => {
    if (payment) {
      const paymentType = getPaymentType(payment.type)
      const paymentDate = payment.createdAt ? formatDate(payment.createdAt) : ''
      const label = paymentDate
        ? `${paymentType} - ${paymentDate}`
        : paymentType
      setLastSegmentLabel(label)
    }
    return () => {
      setLastSegmentLabel(null)
    }
  }, [payment, setLastSegmentLabel])

  if (isLoading) {
    return (
      <Container>
        <div className="flex min-h-[400px] items-center justify-center">
          <AnimatedLoader size="md" />
        </div>
      </Container>
    )
  }

  if (!payment) {
    return (
      <Container>
        <div className="flex min-h-[400px] flex-col items-center justify-center space-y-4">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100">
            <AlertTriangle className="h-7 w-7 text-slate-400" />
          </div>
          <h2 className="text-primary text-xl font-semibold">
            Payment Not Found
          </h2>
          <p className="text-sm text-slate-500">
            The payment you're looking for doesn't exist or has been removed.
          </p>
          <Button
            onClick={() => navigate({ to: '/dashboard/billing' })}
            variant="outline"
            size="sm"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Billing
          </Button>
        </div>
      </Container>
    )
  }

  const statusCfg = getStatusConfig(payment.status)
  const invoiceRef = payment.invoiceNumber
    ? `#${payment.invoiceNumber}`
    : `#${payment.id.slice(0, 8).toUpperCase()}`
  const paymentDate = formatDate(payment.paidAt || payment.createdAt || '')
  const hasFinancialBreakdown =
    (payment.taxAmount ?? 0) > 0 || (payment.processingFees ?? 0) > 0

  // Timeline items (only non-empty)
  const timelineItems = [
    payment.requestedAt
      ? { label: 'Requested', value: formatDate(payment.requestedAt) }
      : null,
    payment.createdAt
      ? { label: 'Created', value: formatDate(payment.createdAt) }
      : null,
    payment.paidAt
      ? { label: 'Payment Confirmed', value: formatDate(payment.paidAt) }
      : null,
    payment.creditedAt
      ? { label: 'Credits Applied', value: formatDate(payment.creditedAt) }
      : null,
  ].filter(Boolean) as { label: string; value: string }[]

  return (
    <Container>
      {/* print: add a <style> tag to hide navigation on print */}
      <style>{`@media print { .no-print { display: none !important; } }`}</style>

      <div className="mx-auto max-w-3xl space-y-6">
        {/* ── Navigation ── */}
        <div className="no-print flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate({ to: '/dashboard/billing' })}
            className="hover:text-primary gap-2 text-slate-500"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Billing
          </Button>
        </div>

        {/* ── Invoice Header ── */}
        <Card className="border-primary/10 overflow-hidden rounded-3xl border bg-white shadow-sm">
          {/* Navy header band */}
          <div className="from-primary to-primary-hover bg-gradient-to-r px-8 py-7 text-white">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="mb-1 flex items-center gap-2">
                  <ReceiptText className="h-4 w-4 text-blue-300" />
                  <p className="text-xs font-semibold tracking-widest text-blue-200 uppercase">
                    Invoice
                  </p>
                </div>
                <h1 className="text-3xl font-bold text-white">{invoiceRef}</h1>
                <p className="mt-2 flex items-center gap-1.5 text-sm text-blue-200">
                  <Calendar className="h-3.5 w-3.5" />
                  {paymentDate}
                </p>
              </div>
              <Badge
                className={`${statusCfg.badge} flex items-center gap-1.5 border px-3 py-1.5 text-sm font-semibold`}
              >
                {statusCfg.icon}
                {statusCfg.label}
              </Badge>
            </div>
          </div>

          {/* Invoice overview */}
          <CardContent className="p-6">
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <div className="rounded-2xl border border-slate-100 bg-slate-50 p-3">
                <p className="mb-1 text-[10px] font-semibold tracking-wider text-slate-400 uppercase">
                  Amount
                </p>
                <p className="text-primary text-xl font-bold">
                  {formatCurrency(payment.amount || 0)}
                </p>
              </div>
              <div className="rounded-2xl border border-slate-100 bg-slate-50 p-3">
                <p className="mb-1 text-[10px] font-semibold tracking-wider text-slate-400 uppercase">
                  Currency
                </p>
                <p className="text-primary text-xl font-bold">
                  {(payment.currency || 'USD').toUpperCase()}
                </p>
              </div>
              <div className="rounded-2xl border border-slate-100 bg-slate-50 p-3">
                <p className="mb-1 text-[10px] font-semibold tracking-wider text-slate-400 uppercase">
                  Type
                </p>
                <p className="text-primary mt-0.5 text-sm leading-tight font-bold capitalize">
                  {getPaymentType(payment.type)}
                </p>
              </div>
              <div className="rounded-2xl border border-slate-100 bg-slate-50 p-3">
                <p className="mb-1 text-[10px] font-semibold tracking-wider text-slate-400 uppercase">
                  Method
                </p>
                <p className="text-primary mt-0.5 text-sm leading-tight font-bold capitalize">
                  {payment.paymentMethodDetails?.card
                    ? `${payment.paymentMethodDetails.card.brand?.toUpperCase()} ···· ${payment.paymentMethodDetails.card.last4}`
                    : payment.paymentMethod || 'Card'}
                </p>
              </div>
            </div>

            {payment.description && (
              <div className="mt-4 rounded-xl border border-slate-100 bg-slate-50 px-4 py-3">
                <p className="mb-1 text-[10px] font-semibold tracking-wider text-slate-400 uppercase">
                  Description
                </p>
                <p className="text-sm text-slate-700">{payment.description}</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* ── Financial Breakdown ── */}
        {hasFinancialBreakdown && (
          <Card className="rounded-3xl border border-slate-100 bg-white shadow-sm">
            <CardHeader className="border-b border-slate-50 pb-3">
              <div className="flex items-center gap-3">
                <div className="bg-primary/10 flex h-9 w-9 items-center justify-center rounded-xl">
                  <FileText className="text-primary h-4 w-4" />
                </div>
                <CardTitle className="text-primary text-sm font-bold">
                  Financial Breakdown
                </CardTitle>
              </div>
            </CardHeader>
            <CardContent className="p-5">
              <div className="overflow-hidden rounded-xl border border-slate-100">
                <div className="divide-y divide-slate-50">
                  <div className="flex items-center justify-between px-4 py-3">
                    <span className="text-sm text-slate-500">Subtotal</span>
                    <span className="text-primary text-sm font-semibold">
                      {formatCurrency(payment.netAmount || payment.amount || 0)}
                    </span>
                  </div>
                  {(payment.taxAmount ?? 0) > 0 && (
                    <div className="flex items-center justify-between px-4 py-3">
                      <span className="text-sm text-slate-500">Tax</span>
                      <span className="text-primary text-sm font-semibold">
                        {formatCurrency(payment.taxAmount ?? 0)}
                      </span>
                    </div>
                  )}
                  {(payment.processingFees ?? 0) > 0 && (
                    <div className="flex items-center justify-between px-4 py-3">
                      <span className="text-sm text-slate-500">
                        Processing Fees
                      </span>
                      <span className="text-primary text-sm font-semibold">
                        {formatCurrency(payment.processingFees ?? 0)}
                      </span>
                    </div>
                  )}
                  <div className="bg-primary/5 flex items-center justify-between px-4 py-3">
                    <span className="text-primary text-sm font-bold">
                      Total
                    </span>
                    <span className="text-primary text-base font-bold">
                      {formatCurrency(payment.amount || 0)}
                    </span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* ── Credit Details ── */}
        {(payment.creditsPurchased != null ||
          payment.type === 'credit_purchase') && (
          <Card className="rounded-3xl border border-slate-100 bg-white shadow-sm">
            <CardHeader className="border-b border-slate-50 pb-3">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-100">
                  <Coins className="h-4 w-4 text-emerald-600" />
                </div>
                <CardTitle className="text-primary text-sm font-bold">
                  Credit Details
                </CardTitle>
              </div>
            </CardHeader>
            <CardContent className="p-5">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {payment.creditsPurchased != null && (
                  <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-4 text-center">
                    <p className="mb-1 text-[10px] font-semibold tracking-wider text-emerald-500 uppercase">
                      Credits Purchased
                    </p>
                    <p className="text-2xl font-bold text-emerald-700">
                      {payment.creditsPurchased.toLocaleString()}
                    </p>
                  </div>
                )}
                {payment.unitPrice != null && (
                  <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4 text-center">
                    <p className="mb-1 text-[10px] font-semibold tracking-wider text-slate-400 uppercase">
                      Unit Price
                    </p>
                    <p className="text-primary text-2xl font-bold">
                      {formatCurrency(payment.unitPrice)}
                    </p>
                    <p className="mt-0.5 text-xs text-slate-400">per credit</p>
                  </div>
                )}
              </div>
              {payment.expiryDate && (
                <div className="mt-3 flex items-center gap-2 rounded-xl border border-amber-100 bg-amber-50 px-3 py-2.5 text-xs text-slate-500">
                  <Clock className="h-3.5 w-3.5 shrink-0 text-amber-500" />
                  Credits expire on{' '}
                  <strong className="text-amber-700">
                    {formatDate(payment.expiryDate)}
                  </strong>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* ── Refund Information ── */}
        {((payment.amountRefunded ?? 0) > 0 ||
          payment.status === 'refunded') && (
          <Card className="rounded-3xl border border-orange-100 bg-white shadow-sm">
            <CardHeader className="border-b border-orange-50 bg-orange-50/30 pb-3">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-orange-100">
                  <RefreshCw className="h-4 w-4 text-orange-600" />
                </div>
                <CardTitle className="text-primary text-sm font-bold">
                  Refund Information
                </CardTitle>
              </div>
            </CardHeader>
            <CardContent className="p-5">
              <div className="divide-y divide-slate-50">
                <DetailRow
                  label="Refunded Amount"
                  value={
                    <span className="text-orange-600">
                      {formatCurrency(payment.amountRefunded || 0)}
                    </span>
                  }
                />
                <DetailRow
                  label="Refund Date"
                  value={
                    payment.refundedAt ? formatDate(payment.refundedAt) : 'N/A'
                  }
                />
                {payment.refundReason && (
                  <DetailRow label="Reason" value={payment.refundReason} />
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* ── Dispute Information ── */}
        {((payment.amountDisputed ?? 0) > 0 ||
          payment.status === 'disputed') && (
          <Card className="rounded-3xl border border-violet-100 bg-white shadow-sm">
            <CardHeader className="border-b border-violet-50 bg-violet-50/30 pb-3">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-violet-100">
                  <AlertTriangle className="h-4 w-4 text-violet-600" />
                </div>
                <CardTitle className="text-primary text-sm font-bold">
                  Dispute Information
                </CardTitle>
              </div>
            </CardHeader>
            <CardContent className="p-5">
              <div className="divide-y divide-slate-50">
                <DetailRow
                  label="Disputed Amount"
                  value={
                    <span className="text-red-600">
                      {formatCurrency(payment.amountDisputed || 0)}
                    </span>
                  }
                />
                <DetailRow
                  label="Status"
                  value={
                    <span className="capitalize">
                      {payment.disputeStatus || 'Open'}
                    </span>
                  }
                />
                {payment.disputeReason && (
                  <DetailRow label="Reason" value={payment.disputeReason} />
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* ── Timeline ── */}
        {timelineItems.length > 0 && (
          <Card className="rounded-3xl border border-slate-100 bg-white shadow-sm">
            <CardHeader className="border-b border-slate-50 pb-3">
              <div className="flex items-center gap-3">
                <div className="bg-primary/10 flex h-9 w-9 items-center justify-center rounded-xl">
                  <Calendar className="text-primary h-4 w-4" />
                </div>
                <CardTitle className="text-primary text-sm font-bold">
                  Timeline
                </CardTitle>
              </div>
            </CardHeader>
            <CardContent className="p-5">
              <div>
                {timelineItems.map((item, idx) => (
                  <TimelineStep
                    key={item.label}
                    label={item.label}
                    value={item.value}
                    isLast={idx === timelineItems.length - 1}
                  />
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* ── Support Reference ── */}
        {(payment.batchId ||
          payment.stripePaymentIntentId ||
          payment.stripeChargeId ||
          payment.stripeInvoiceId) && (
          <Card className="rounded-3xl border border-slate-100 bg-white shadow-sm">
            <CardHeader className="border-b border-slate-50 pb-3">
              <div className="flex items-center gap-3">
                <div className="bg-primary/10 flex h-9 w-9 items-center justify-center rounded-xl">
                  <CreditCard className="text-primary h-4 w-4" />
                </div>
                <div>
                  <CardTitle className="text-primary text-sm font-bold">
                    Support Reference
                  </CardTitle>
                  <p className="mt-0.5 text-xs text-slate-400">
                    Share these IDs with support when troubleshooting
                  </p>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-5">
              <div className="divide-y divide-slate-100 rounded-xl border border-slate-100 bg-slate-50/50 p-3">
                {payment.id && (
                  <CopyRow
                    label="Payment ID"
                    value={payment.id}
                    copiedId={copiedId}
                    onCopy={copyToClipboard}
                  />
                )}
                {payment.batchId && (
                  <CopyRow
                    label="Batch ID"
                    value={payment.batchId}
                    copiedId={copiedId}
                    onCopy={copyToClipboard}
                  />
                )}
                {payment.stripePaymentIntentId && (
                  <CopyRow
                    label="Stripe Payment Intent"
                    value={payment.stripePaymentIntentId}
                    copiedId={copiedId}
                    onCopy={copyToClipboard}
                  />
                )}
                {payment.stripeChargeId &&
                  payment.stripeChargeId !== payment.stripePaymentIntentId && (
                    <CopyRow
                      label="Stripe Charge ID"
                      value={payment.stripeChargeId}
                      copiedId={copiedId}
                      onCopy={copyToClipboard}
                    />
                  )}
                {payment.stripeInvoiceId && (
                  <CopyRow
                    label="Stripe Invoice ID"
                    value={payment.stripeInvoiceId}
                    copiedId={copiedId}
                    onCopy={copyToClipboard}
                  />
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* ── Actions ── */}
        <div className="no-print flex flex-col items-center justify-between gap-3 border-t border-slate-100 pt-2 sm:flex-row">
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate({ to: '/dashboard/billing' })}
            className="hover:text-primary gap-2 text-slate-500"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Billing
          </Button>

          <div className="flex gap-2">
            {payment.status === 'succeeded' && !payment.amountRefunded && (
              <Button
                variant="outline"
                size="sm"
                className="border-orange-200 text-orange-600 hover:border-orange-300 hover:bg-orange-50"
                onClick={handleRefund}
              >
                <RefreshCw className="mr-2 h-4 w-4" />
                Request Refund
              </Button>
            )}
            <Button
              variant="default"
              size="sm"
              className="bg-primary hover:bg-primary-hover min-w-[150px] gap-2 text-white shadow-sm"
              onClick={handleDownloadInvoice}
              disabled={isDownloading}
            >
              {isDownloading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Generating…
                </>
              ) : (
                <>
                  <Download className="h-4 w-4" />
                  Download Invoice
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </Container>
  )
}
