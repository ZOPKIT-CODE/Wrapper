/**
 * Billing page: subscription, credit balance, plans, history, and timeline.
 * Composes useBilling hook and feature components.
 */

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  CreditBalanceIcon,
  CreditPackagesIcon,
  PaymentHistoryIcon
} from '@/components/common/billing/BillingIcons'
import { Crown } from 'lucide-react'
import { useBilling } from '../hooks/useBilling'
import {
  BillingAlerts,
  SubscriptionTab,
  CreditTopupsTab,
  ApplicationPlansTab,
  HistoryTab,
  CancelSubscriptionDialog,
  RefundDialog
} from '../components'

export function Billing() {
  return (
    <div>
      <BillingContent />
    </div>
  )
}

function BillingContent() {
  const {
    activeTab,
    setActiveTab,
    displaySubscription,
    displayBillingHistory,
    displayCreditTopups,
    applicationPlans,
    creditBalance,
    subscriptionLoading,
    billingHistoryLoading,
    upgradeMode,
    needsOnboarding,
    mockMode,
    isAuthenticated,
    selectedPlan,
    isUpgrading,
    showCancelDialog,
    setShowCancelDialog,
    selectedPaymentForRefund,
    setSelectedPaymentForRefund,
    refundReason,
    setRefundReason,
    refundMutation,
    handleCreditPurchase,
    handlePlanPurchase,
    checkoutCurrency,
    setCheckoutCurrency,
    setActiveTab: setTab
  } = useBilling()

  if (subscriptionLoading) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/4 mb-4 dark:bg-gray-700" />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[...Array(3)].map((_, i) => (
              <div
                key={i}
                className="h-64 bg-gray-200 rounded dark:bg-gray-700"
              />
            ))}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <BillingAlerts
        upgradeMode={upgradeMode}
        needsOnboarding={needsOnboarding}
        mockMode={mockMode}
        isAuthenticated={isAuthenticated}
      />

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-2 sm:grid-cols-4 gap-1 bg-gray-100 p-1 min-h-12 h-auto sm:h-12 dark:bg-gray-800">
          <TabsTrigger
            value="subscription"
            className="flex items-center justify-center gap-2 data-[state=active]:bg-white data-[state=active]:shadow-sm data-[state=active]:dark:bg-gray-700 transition-all text-xs sm:text-sm px-2"
          >
            <CreditBalanceIcon className="w-4 h-4 shrink-0" />
            <span className="hidden sm:inline">Credit Balance</span>
            <span className="sm:hidden">Balance</span>
          </TabsTrigger>
          <TabsTrigger
            value="topups"
            className="flex items-center justify-center gap-2 data-[state=active]:bg-white data-[state=active]:shadow-sm data-[state=active]:dark:bg-gray-700 transition-all text-xs sm:text-sm px-2"
          >
            <CreditPackagesIcon className="w-4 h-4 shrink-0" />
            <span className="hidden sm:inline">Credit Top-ups</span>
            <span className="sm:hidden">Top-ups</span>
          </TabsTrigger>
          <TabsTrigger
            value="plans"
            className="flex items-center justify-center gap-2 data-[state=active]:bg-white data-[state=active]:shadow-sm data-[state=active]:dark:bg-gray-700 transition-all text-xs sm:text-sm px-2"
          >
            <Crown className="w-4 h-4 shrink-0" />
            <span className="hidden sm:inline">Application Plans</span>
            <span className="sm:hidden">Plans</span>
          </TabsTrigger>
          <TabsTrigger
            value="history"
            className="flex items-center justify-center gap-2 data-[state=active]:bg-white data-[state=active]:shadow-sm data-[state=active]:dark:bg-gray-700 transition-all text-xs sm:text-sm px-2"
          >
            <PaymentHistoryIcon className="w-4 h-4 shrink-0" />
            <span className="hidden sm:inline">Purchase History</span>
            <span className="sm:hidden">History</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="subscription" className="space-y-8">
          <SubscriptionTab
            displaySubscription={displaySubscription}
            applicationPlans={applicationPlans}
            creditBalance={creditBalance}
            setActiveTab={setTab}
            planPriceCurrency={checkoutCurrency}
          />
        </TabsContent>

        <TabsContent value="topups" className="space-y-12">
          <CreditTopupsTab
            creditTopups={displayCreditTopups}
            onCreditPurchase={handleCreditPurchase}
            isUpgrading={isUpgrading}
            selectedPlan={selectedPlan}
          />
        </TabsContent>

        <TabsContent value="plans" className="space-y-12">
          <ApplicationPlansTab
            applicationPlans={applicationPlans}
            onPlanPurchase={handlePlanPurchase}
            isUpgrading={isUpgrading}
            selectedPlan={selectedPlan}
            checkoutCurrency={checkoutCurrency}
            onCheckoutCurrencyChange={setCheckoutCurrency}
          />
        </TabsContent>

        <TabsContent value="history" className="space-y-6">
          <HistoryTab
            displayBillingHistory={displayBillingHistory}
            billingHistoryLoading={billingHistoryLoading}
            displaySubscription={displaySubscription}
            onOpenCancelDialog={() => setShowCancelDialog(true)}
          />
        </TabsContent>

      </Tabs>

      <CancelSubscriptionDialog
        open={showCancelDialog}
        onClose={() => setShowCancelDialog(false)}
        currentPeriodEnd={displaySubscription.currentPeriodEnd}
      />

      <RefundDialog
        paymentId={selectedPaymentForRefund}
        onClose={() => setSelectedPaymentForRefund(null)}
        refundReason={refundReason}
        onRefundReasonChange={setRefundReason}
        onConfirm={(paymentId, reason) =>
          refundMutation.mutate({ paymentId, reason })
        }
        isPending={refundMutation.isPending}
      />
    </div>
  )
}

export default Billing
