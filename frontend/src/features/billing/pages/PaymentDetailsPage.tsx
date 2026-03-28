import React, { useEffect } from 'react'
import { useParams, useNavigate } from '@tanstack/react-router'
import { ArrowLeft, Download, RefreshCw, AlertTriangle, Copy, Check } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { formatCurrency, formatDate } from '@/lib/utils'
import { useQuery } from '@tanstack/react-query'
import { subscriptionAPI } from '@/lib/api'
import { Container } from '@/components/common/Page'
import AnimatedLoader from '@/components/common/feedback/AnimatedLoader'
import type { BillingHistoryItem } from '@/types/billing'
import { useBreadcrumbLabel } from '@/contexts/BreadcrumbLabelContext'

export function PaymentDetailsPage() {
  const { paymentId } = useParams({ strict: false })
  const navigate = useNavigate()
  const [copiedId, setCopiedId] = React.useState<string | null>(null)
  const { setLastSegmentLabel } = useBreadcrumbLabel()

  // Fetch billing history to find the payment
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
    }
  })

  // Find the payment by ID
  const payment = React.useMemo(() => {
    if (!billingHistory || !paymentId) return null
    return (billingHistory as BillingHistoryItem[]).find((p: BillingHistoryItem) => p.id === paymentId) || null
  }, [billingHistory, paymentId])

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text)
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 2000)
  }

  const getPaymentType = () => {
    if (!payment) return 'Payment'
    if (payment.type === 'credit_purchase') return 'Credit Purchase'
    if (payment.type === 'subscription') return 'Subscription'
    if (payment.type) return payment.type.charAt(0).toUpperCase() + payment.type.slice(1).replace(/_/g, ' ')
    return 'Payment'
  }

  // Set breadcrumb label when payment is loaded, clear on unmount
  useEffect(() => {
    if (payment) {
      const paymentType = getPaymentType()
      const paymentDate = payment.createdAt ? formatDate(payment.createdAt) : ''
      const label = paymentDate ? `${paymentType} - ${paymentDate}` : paymentType
      setLastSegmentLabel(label)
    }
    
    return () => {
      setLastSegmentLabel(null)
    }
  }, [payment, setLastSegmentLabel])

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'succeeded':
        return 'bg-green-100 text-green-800'
      case 'failed':
        return 'bg-red-100 text-red-800'
      case 'canceled':
        return 'bg-gray-100 text-gray-800'
      case 'refunded':
        return 'bg-orange-100 text-orange-800'
      case 'disputed':
        return 'bg-purple-100 text-purple-800'
      default:
        return 'bg-[#1B2E5A]/10 text-[#1B2E5A]'
    }
  }

  const getStatusText = (status: string) => {
    switch (status) {
      case 'succeeded':
        return 'Paid'
      case 'failed':
        return 'Failed'
      case 'canceled':
        return 'Canceled'
      case 'refunded':
        return 'Refunded'
      case 'partially_refunded':
        return 'Partial Refund'
      case 'disputed':
        return 'Disputed'
      default:
        return status
    }
  }

  const handleRefund = () => {
    // Navigate back to billing with refund state
    navigate({ to: `/dashboard/billing?refund=${paymentId}` })
  }

  if (isLoading) {
    return (
      <Container>
        <div className="flex items-center justify-center min-h-[400px]">
          <AnimatedLoader size="md" />
        </div>
      </Container>
    )
  }

  if (!payment) {
    return (
      <Container>
        <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4">
          <AlertTriangle className="h-12 w-12 text-gray-400" />
          <h2 className="text-xl font-semibold">Payment Not Found</h2>
          <p className="text-gray-600">The payment you're looking for doesn't exist or has been removed.</p>
          <Button onClick={() => navigate({ to: '/dashboard/billing' })} variant="outline">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Billing
          </Button>
        </div>
      </Container>
    )
  }

  return (
    <Container>
      <div className="space-y-6">
        {/* Header with Back Button */}
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate({ to: '/dashboard/billing' })}
            className="gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Billing
          </Button>
          <div className="flex-1">
            <h1 className="text-2xl font-semibold">Payment Details</h1>
          </div>
        </div>

        {/* Payment Overview */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Payment Overview</span>
              <Badge className={getStatusColor(payment.status)}>
                {getStatusText(payment.status)}
              </Badge>
            </CardTitle>
            <CardDescription>
              {payment.invoiceNumber ? `Invoice #${payment.invoiceNumber}` : 'Payment Record'}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {/* Payment ID */}
            {payment.id && (
              <div className="flex items-center justify-between pb-2 border-b">
                <div>
                  <p className="text-sm text-gray-600">Payment ID</p>
                  <p className="font-medium font-mono text-sm">{payment.id}</p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => copyToClipboard(payment.id, 'payment-id')}
                  className="h-8 w-8 p-0"
                >
                  {copiedId === 'payment-id' ? (
                    <Check className="h-4 w-4 text-green-600" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-gray-600">Amount</p>
                <p className="font-medium text-lg">
                  {formatCurrency(payment.amount || 0)}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Currency</p>
                <p className="font-medium">{(payment.currency || 'USD').toUpperCase()}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Payment Method</p>
                <p className="font-medium capitalize">{payment.paymentMethod || 'Card'}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Payment Type</p>
                <p className="font-medium capitalize">{getPaymentType()}</p>
              </div>
              {payment.creditsPurchased != null && (
                <div>
                  <p className="text-sm text-gray-600">Credits Purchased</p>
                  <p className="font-medium">{payment.creditsPurchased.toLocaleString()} credits</p>
                </div>
              )}
              {payment.unitPrice != null && (
                <div>
                  <p className="text-sm text-gray-600">Unit Price</p>
                  <p className="font-medium">{formatCurrency(payment.unitPrice)} per credit</p>
                </div>
              )}
            </div>
            
            {payment.description && (
              <div>
                <p className="text-sm text-gray-600">Description</p>
                <p className="font-medium">{payment.description}</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Financial Breakdown */}
        {(payment.taxAmount > 0 || payment.processingFees > 0) && (
          <Card>
            <CardHeader>
              <CardTitle>Financial Breakdown</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-600">Subtotal</p>
                  <p className="font-medium">
                    {formatCurrency(payment.netAmount || payment.amount || 0)}
                  </p>
                </div>
                {payment.taxAmount > 0 && (
                  <div>
                    <p className="text-sm text-gray-600">Tax</p>
                    <p className="font-medium">
                      {formatCurrency(payment.taxAmount || 0)}
                    </p>
                  </div>
                )}
                {payment.processingFees > 0 && (
                  <div>
                    <p className="text-sm text-gray-600">Processing Fees</p>
                    <p className="font-medium">
                      {formatCurrency(payment.processingFees || 0)}
                    </p>
                  </div>
                )}
                <div className="border-t pt-2">
                  <p className="text-sm text-gray-600">Total</p>
                  <p className="font-medium text-lg">
                    {formatCurrency(payment.amount || 0)}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Refund Information */}
        {(payment.amountRefunded > 0 || payment.status === 'refunded') && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <RefreshCw className="h-4 w-4" />
                Refund Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-600">Refunded Amount</p>
                  <p className="font-medium text-orange-600">
                    {formatCurrency(payment.amountRefunded || 0)}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Refund Date</p>
                  <p className="font-medium">
                    {payment.refundedAt ? formatDate(payment.refundedAt) : 'N/A'}
                  </p>
                </div>
              </div>
              {payment.refundReason && (
                <div>
                  <p className="text-sm text-gray-600">Refund Reason</p>
                  <p className="font-medium">{payment.refundReason}</p>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Dispute Information */}
        {(payment.amountDisputed > 0 || payment.status === 'disputed') && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4" />
                Dispute Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-600">Disputed Amount</p>
                  <p className="font-medium text-red-600">
                    {formatCurrency(payment.amountDisputed || 0)}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Dispute Status</p>
                  <p className="font-medium capitalize">{payment.disputeStatus || 'Open'}</p>
                </div>
              </div>
              {payment.disputeReason && (
                <div>
                  <p className="text-sm text-gray-600">Dispute Reason</p>
                  <p className="font-medium">{payment.disputeReason}</p>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Credit/Product Details */}
        {(payment.creditsPurchased != null || payment.type === 'credit_purchase') && (
          <Card>
            <CardHeader>
              <CardTitle>Credit Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-4">
                {payment.creditsPurchased != null && (
                  <div>
                    <p className="text-sm text-gray-600">Credits Purchased</p>
                    <p className="font-medium text-lg">{payment.creditsPurchased.toLocaleString()} credits</p>
                  </div>
                )}
                {payment.expiryDate && (
                  <div>
                    <p className="text-sm text-gray-600">Expiry Date</p>
                    <p className="font-medium">{formatDate(payment.expiryDate)}</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Timeline */}
        <Card>
          <CardHeader>
            <CardTitle>Timeline</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-4">
              {payment.requestedAt && (
                <div>
                  <p className="text-sm text-gray-600">Requested At</p>
                  <p className="font-medium">
                    {formatDate(payment.requestedAt)}
                  </p>
                </div>
              )}
              {payment.paidAt && (
                <div>
                  <p className="text-sm text-gray-600">Payment Date</p>
                  <p className="font-medium">
                    {formatDate(payment.paidAt)}
                  </p>
                </div>
              )}
              {payment.creditedAt && (
                <div>
                  <p className="text-sm text-gray-600">Credited At</p>
                  <p className="font-medium">
                    {formatDate(payment.creditedAt)}
                  </p>
                </div>
              )}
              {payment.createdAt && (
                <div>
                  <p className="text-sm text-gray-600">Created Date</p>
                  <p className="font-medium">
                    {formatDate(payment.createdAt)}
                  </p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Support/Reference Information */}
        {(payment.batchId || payment.stripePaymentIntentId || payment.paymentStatus) && (
          <Card>
            <CardHeader>
              <CardTitle>Support Reference</CardTitle>
              <CardDescription className="text-xs">
                These details may be requested by support for troubleshooting
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {payment.batchId && (
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <p className="text-sm text-gray-600">Batch ID</p>
                    <p className="font-medium font-mono text-sm break-all">{payment.batchId}</p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => copyToClipboard(payment.batchId, 'batch-id')}
                    className="h-8 w-8 p-0 ml-2"
                  >
                    {copiedId === 'batch-id' ? (
                      <Check className="h-4 w-4 text-green-600" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              )}
              {payment.stripePaymentIntentId && (
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <p className="text-sm text-gray-600">Stripe Payment Intent ID</p>
                    <p className="font-medium font-mono text-sm break-all">{payment.stripePaymentIntentId}</p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => copyToClipboard(payment.stripePaymentIntentId, 'stripe-id')}
                    className="h-8 w-8 p-0 ml-2"
                  >
                    {copiedId === 'stripe-id' ? (
                      <Check className="h-4 w-4 text-green-600" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              )}
              {payment.paymentStatus && (
                <div>
                  <p className="text-sm text-gray-600">Payment Status</p>
                  <p className="font-medium capitalize">{payment.paymentStatus}</p>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Actions */}
        <div className="flex justify-between items-center pt-4 border-t">
          <div className="flex gap-2">
            {payment.status === 'succeeded' && (
              <Button variant="outline" size="sm">
                <Download className="h-4 w-4 mr-2" />
                Download Receipt
              </Button>
            )}
          </div>
          
          <div className="flex gap-2">
            {payment.status === 'succeeded' && !payment.amountRefunded && (
              <Button 
                variant="outline" 
                size="sm"
                className="text-orange-600 hover:text-orange-700"
                onClick={handleRefund}
              >
                Request Refund
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={() => navigate({ to: '/dashboard/billing' })}>
              Close
            </Button>
          </div>
        </div>
      </div>
    </Container>
  )
}
