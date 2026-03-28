/**
 * Purchase history tab: payment history list and plan management card.
 */

import React from 'react'
import { useNavigate } from '@tanstack/react-router'
import {
  Crown,
  CheckCircle,
  X,
  Clock,
  Calendar,
  CreditCard as CreditCardLucide,
  ExternalLink,
  Download,
  Settings,
  ReceiptIcon
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { formatCurrency, formatDate } from '@/lib/utils'
import { PaymentHistoryIcon } from '@/components/common/billing/BillingIcons'
import { ZopkitRoundLoader } from '@/components/common/feedback/ZopkitRoundLoader'
import type { DisplaySubscription } from '../hooks/useBilling'

/** Minimal payment record shape for history list */
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

export function HistoryTab({
  displayBillingHistory,
  billingHistoryLoading,
  displaySubscription,
  onOpenCancelDialog
}: HistoryTabProps) {
  const navigate = useNavigate()

  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-100 shadow-sm relative overflow-hidden">
        <div className="absolute top-0 left-0 w-1 h-full bg-emerald-500" />
        <div className="flex items-center gap-3">
          <div className="p-3 bg-emerald-500 rounded-xl text-white">
            <PaymentHistoryIcon className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-[#1B2E5A] dark:text-white">Payment History</h3>
          </div>
        </div>
      </div>

      {billingHistoryLoading ? (
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <ZopkitRoundLoader size="xl" className="mx-auto mb-4" />
            <p className="text-lg text-gray-600 dark:text-gray-400">Loading payment history...</p>
          </div>
        </div>
      ) : !displayBillingHistory?.length ? (
        <div className="text-center py-12 bg-gray-50 dark:bg-gray-800 rounded-xl border-2 border-dashed border-gray-200 dark:border-gray-700">
          <div className="p-4 bg-gray-100 dark:bg-gray-700 rounded-full w-16 h-16 mx-auto mb-4 flex items-center justify-center">
            <ReceiptIcon className="h-8 w-8 text-gray-400" />
          </div>
          <h4 className="text-lg font-semibold text-[#1B2E5A] dark:text-white mb-2">
            No payment history yet
          </h4>
          <p className="text-gray-600 dark:text-gray-400">
            Your completed transactions will appear here
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {displayBillingHistory.map((payment: PaymentHistoryItem) => {
            const isPlanUpgrade = payment.type === 'plan_upgrade'
            return (
              <Card
                key={payment.id}
                className="hover:shadow-lg transition-all duration-200 border-0 shadow-md bg-gradient-to-r from-white to-gray-50 dark:from-gray-800 dark:to-gray-900"
              >
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-start gap-4">
                      <div
                        className={`rounded-xl p-3 ${
                          isPlanUpgrade
                            ? 'bg-violet-100 text-violet-600 dark:bg-violet-900/30 dark:text-violet-400'
                            : payment.status === 'succeeded' || payment.status === 'completed'
                              ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400'
                              : payment.status === 'failed'
                                ? 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400'
                                : 'bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400'
                        }`}
                      >
                        {isPlanUpgrade ? (
                          <Crown className="h-5 w-5" />
                        ) : payment.status === 'succeeded' || payment.status === 'completed' ? (
                          <CheckCircle className="h-5 w-5" />
                        ) : payment.status === 'failed' ? (
                          <X className="h-5 w-5" />
                        ) : (
                          <Clock className="h-5 w-5" />
                        )}
                      </div>

                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h4 className="font-semibold text-[#1B2E5A] dark:text-white text-lg">
                            {isPlanUpgrade
                              ? payment.planDisplayName
                                ? `Plan: ${payment.planDisplayName}`
                                : payment.description
                              : payment.description ||
                                (payment.type === 'subscription'
                                  ? 'Subscription'
                                  : payment.type === 'credit_purchase'
                                    ? 'Credit Purchase'
                                    : payment.type === 'credit_usage'
                                      ? 'Credit Usage'
                                      : 'Payment')}
                          </h4>
                          <Badge
                            className={
                              isPlanUpgrade
                                ? 'bg-violet-100 text-violet-800 border-violet-200 dark:bg-violet-900/30 dark:text-violet-300 dark:border-violet-800'
                                : payment.status === 'succeeded' || payment.status === 'completed'
                                  ? 'bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-800'
                                  : payment.status === 'failed'
                                    ? 'bg-red-100 text-red-800 border-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-800'
                                    : 'bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-800'
                            }
                          >
                            {isPlanUpgrade ? (
                              'Plan Upgrade'
                            ) : (payment.status === 'succeeded' || payment.status === 'completed') ? (
                              <>
                                <CheckCircle className="w-3 h-3 mr-1" />
                                {payment.type === 'credit_purchase'
                                  ? 'Purchased'
                                  : payment.type === 'credit_usage'
                                    ? 'Used'
                                    : 'Paid'}
                              </>
                            ) : payment.status === 'failed' ? (
                              <>
                                <X className="w-3 h-3 mr-1" />
                                Failed
                              </>
                            ) : (
                              <>
                                <Clock className="w-3 h-3 mr-1" />
                                Pending
                              </>
                            )}
                          </Badge>
                          {payment.type && (
                            <Badge variant="outline" className="text-xs">
                              {payment.type === 'plan_upgrade'
                                ? 'Plan Upgrade'
                                : payment.type === 'subscription'
                                  ? 'Subscription'
                                  : payment.type === 'credit_purchase'
                                    ? 'Credit Purchase'
                                    : payment.type === 'credit_usage'
                                      ? 'Credit Usage'
                                      : payment.type}
                            </Badge>
                          )}
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-3">
                          <div className="flex items-center gap-2">
                            <Calendar className="h-4 w-4 text-gray-400" />
                            <span className="text-sm text-gray-600 dark:text-gray-400">
                              {isPlanUpgrade ? (
                                <>
                                  Started: {formatDate(payment.paidAt || payment.createdAt || '')}
                                  {payment.currentPeriodEnd && (
                                    <span className="block mt-1">
                                      Renews: {formatDate(payment.currentPeriodEnd)}
                                    </span>
                                  )}
                                </>
                              ) : (
                                <>
                                  {formatDate(payment.paidAt || payment.createdAt || '')}
                                  {payment.billingReason &&
                                    ` • ${String(payment.billingReason).replace(/_/g, ' ')}`}
                                  {payment.expiryDate && payment.type === 'credit_purchase' && (
                                    <span className="block mt-1">
                                      Credits expire: {formatDate(payment.expiryDate)}
                                    </span>
                                  )}
                                </>
                              )}
                            </span>
                          </div>

                          {!isPlanUpgrade &&
                            (payment.paymentMethodDetails?.card || payment.paymentMethod) && (
                              <div className="flex items-center gap-2">
                                <CreditCardLucide className="h-4 w-4 text-gray-400" />
                                <span className="text-sm text-gray-600 dark:text-gray-400">
                                  {payment.paymentMethodDetails?.card ? (
                                    <>
                                      **** **** **** {payment.paymentMethodDetails.card.last4} •{' '}
                                      {payment.paymentMethodDetails.card.brand?.toUpperCase()}
                                    </>
                                  ) : (
                                    <>
                                      {payment.paymentMethod
                                        ? String(payment.paymentMethod).charAt(0).toUpperCase() +
                                          String(payment.paymentMethod).slice(1)
                                        : 'Card'}
                                    </>
                                  )}
                                </span>
                              </div>
                            )}
                          {isPlanUpgrade && payment.billingCycle && (
                            <div className="flex items-center gap-2">
                              <Clock className="h-4 w-4 text-gray-400" />
                              <span className="text-sm text-gray-600 dark:text-gray-400">
                                Billing:{' '}
                                {payment.billingCycle === 'yearly'
                                  ? 'Annual'
                                  : payment.billingCycle === 'monthly'
                                    ? 'Monthly'
                                    : payment.billingCycle}
                              </span>
                            </div>
                          )}
                        </div>

                        {!isPlanUpgrade && payment.invoiceNumber && (
                          <div className="flex items-center gap-2 mb-3">
                            <ReceiptIcon className="h-4 w-4 text-gray-400" />
                            <span className="text-sm text-gray-600 dark:text-gray-400">
                              Invoice #{payment.invoiceNumber}
                            </span>
                          </div>
                        )}

                        {!isPlanUpgrade && payment.stripePaymentIntentId && (
                          <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-3 text-xs text-gray-500 dark:text-gray-400">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                              <div>
                                <span className="font-medium">Payment ID:</span>
                                <div className="font-mono">{payment.stripePaymentIntentId}</div>
                              </div>
                              {payment.stripeChargeId &&
                                payment.stripeChargeId !== payment.stripePaymentIntentId && (
                                  <div>
                                    <span className="font-medium">Charge ID:</span>
                                    <div className="font-mono">{payment.stripeChargeId}</div>
                                  </div>
                                )}
                              {payment.stripeInvoiceId && (
                                <div>
                                  <span className="font-medium">Invoice ID:</span>
                                  <div className="font-mono">{payment.stripeInvoiceId}</div>
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="text-right flex flex-col items-end gap-3">
                      <div
                        className={
                          isPlanUpgrade
                            ? 'bg-violet-50 dark:bg-violet-900/20 rounded-lg px-4 py-3 border border-violet-200 dark:border-violet-800'
                            : 'bg-emerald-50 dark:bg-emerald-900/20 rounded-lg px-4 py-3 border border-emerald-200 dark:border-emerald-800'
                        }
                      >
                        <div
                          className={
                            isPlanUpgrade
                              ? 'text-lg font-bold text-violet-700 dark:text-violet-400'
                              : 'text-lg font-bold text-emerald-700 dark:text-emerald-400'
                          }
                        >
                          {formatCurrency(payment.amount)}
                        </div>
                        <div
                          className={
                            isPlanUpgrade
                              ? 'text-xs text-violet-600 dark:text-violet-500 mt-1'
                              : 'text-xs text-emerald-600 dark:text-emerald-500 mt-1'
                          }
                        >
                          {isPlanUpgrade
                            ? payment.billingCycle === 'yearly'
                              ? 'Annual Plan'
                              : 'Plan'
                            : payment.type === 'credit_purchase'
                              ? 'Purchase Amount'
                              : 'Total Amount'}
                        </div>
                      </div>

                      {!isPlanUpgrade && payment.creditsPurchased && (
                        <div className="bg-[#1B2E5A]/5 dark:bg-[#1B2E5A]/20 rounded-lg px-4 py-2 border border-[#1B2E5A]/20 dark:border-[#1B2E5A]/40">
                          <div className="text-sm font-semibold text-[#1B2E5A] dark:text-[#4A6FA5]">
                            +{payment.creditsPurchased.toLocaleString()} credits
                          </div>
                          <div className="text-xs text-[#1B2E5A]/80 dark:text-[#4A6FA5]">Credits Added</div>
                        </div>
                      )}

                      {!isPlanUpgrade &&
                        ((payment.taxAmount ?? 0) > 0 || (payment.processingFees ?? 0) > 0) && (
                          <div className="text-xs text-gray-500 space-y-1">
                            {(payment.taxAmount ?? 0) > 0 && (
                              <div className="flex items-center gap-1">
                                <span>Tax:</span>
                                <span className="font-medium">
                                  {formatCurrency(payment.taxAmount ?? 0)}
                                </span>
                              </div>
                            )}
                            {(payment.processingFees ?? 0) > 0 && (
                              <div className="flex items-center gap-1">
                                <span>Fees:</span>
                                <span className="font-medium">
                                  {formatCurrency(payment.processingFees ?? 0)}
                                </span>
                              </div>
                            )}
                          </div>
                        )}

                      <div className="flex items-center gap-2">
                        {!isPlanUpgrade && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => navigate({ to: `/dashboard/billing/payments/${payment.id}` })}
                            className="border-gray-300 hover:bg-gray-50 dark:border-gray-600 dark:hover:bg-gray-700"
                          >
                            <ExternalLink className="h-3 w-3 mr-1" />
                            Details
                          </Button>
                        )}
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            window.open(
                              `data:text/plain;charset=utf-8,${encodeURIComponent(JSON.stringify(payment, null, 2))}`,
                              '_blank'
                            )
                          }
                          className="border-gray-300 hover:bg-gray-50 dark:border-gray-600 dark:hover:bg-gray-700"
                        >
                          <Download className="h-3 w-3 mr-1" />
                          Receipt
                        </Button>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {displaySubscription.plan !== 'free' && (
        <Card className="border-0 shadow-xl bg-gradient-to-r from-slate-50 to-gray-50 dark:from-gray-800 dark:to-gray-900">
          <CardHeader className="pb-6">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-slate-500 rounded-xl text-white">
                <Settings className="w-6 h-6" />
              </div>
              <div>
                <CardTitle className="text-lg dark:text-white">Plan Management</CardTitle>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-gray-50 rounded-xl p-6 border border-red-200 hover:shadow-md transition-all dark:bg-gray-700/60 dark:border-red-800">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-red-100 rounded-lg dark:bg-red-900/30">
                    <X className="h-5 w-5 text-red-600 dark:text-red-400" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-[#1B2E5A] dark:text-white">
                      Cancel Subscription
                    </h4>
                    <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">
                      Cancel your subscription (effective at end of billing period)
                    </p>
                  </div>
                </div>
                <Button
                  variant="outline"
                  onClick={onOpenCancelDialog}
                  className="border-red-300 text-red-600 hover:bg-red-50 hover:border-red-400 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-900/20"
                >
                  <X className="h-4 w-4 mr-2" />
                  Cancel
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
