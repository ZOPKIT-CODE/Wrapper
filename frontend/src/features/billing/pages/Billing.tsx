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
import { Crown, Timer } from 'lucide-react'
import { useBilling } from '../hooks/useBilling'
import { DashboardPageHeader } from '@/components/dashboard/DashboardPageHeader'
import {
  BillingAlerts,
  SubscriptionTab,
  CreditTopupsTab,
  ApplicationPlansTab,
  HistoryTab,
  ExpiryBreakdownTab,
  CancelSubscriptionDialog,
  RefundDialog
} from '../components'

export function Billing() {
  return (
    <div style={{ maxWidth: 1480, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 28 }}>
      <DashboardPageHeader
        title="Billing"
        description="Manage your subscription, credits, plans, and payment history."
      />
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
    creditPricing,
    applicationPlans,
    creditBalance,
    creditAllocations,
    creditAllocationsLoading,
    entityBalances,
    entityBalancesLoading,
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
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div className="animate-pulse">
          <div style={{ height: 32, borderRadius: 8, background: 'var(--zk-line)', width: '25%', marginBottom: 16 }} />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 24 }}>
            {[...Array(3)].map((_, i) => (
              <div key={i} style={{ height: 256, borderRadius: 12, background: 'var(--zk-line)' }} />
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
        <TabsList className="inline-flex h-auto min-h-9 flex-wrap gap-1 rounded-lg p-1" style={{ background: 'var(--zk-paper)', border: '1px solid var(--zk-line)', fontFamily: 'var(--zk-font)', color: 'var(--zk-muted)' }}>
          <TabsTrigger
            value="subscription"
            className="flex items-center justify-center gap-2 data-[state=active]:bg-white data-[state=active]:shadow-sm transition-all text-xs sm:text-sm px-2"
          >
            <CreditBalanceIcon className="w-4 h-4 shrink-0" />
            <span className="hidden sm:inline">Credit Balance</span>
            <span className="sm:hidden">Balance</span>
          </TabsTrigger>
          <TabsTrigger
            value="topups"
            className="flex items-center justify-center gap-2 data-[state=active]:bg-white data-[state=active]:shadow-sm transition-all text-xs sm:text-sm px-2"
          >
            <CreditPackagesIcon className="w-4 h-4 shrink-0" />
            <span className="hidden sm:inline">Credit Top-ups</span>
            <span className="sm:hidden">Top-ups</span>
          </TabsTrigger>
          <TabsTrigger
            value="plans"
            className="flex items-center justify-center gap-2 data-[state=active]:bg-white data-[state=active]:shadow-sm transition-all text-xs sm:text-sm px-2"
          >
            <Crown className="w-4 h-4 shrink-0" />
            <span className="hidden sm:inline">Application Plans</span>
            <span className="sm:hidden">Plans</span>
          </TabsTrigger>
          <TabsTrigger
            value="history"
            className="flex items-center justify-center gap-2 data-[state=active]:bg-white data-[state=active]:shadow-sm transition-all text-xs sm:text-sm px-2"
          >
            <PaymentHistoryIcon className="w-4 h-4 shrink-0" />
            <span className="hidden sm:inline">Purchase History</span>
            <span className="sm:hidden">History</span>
          </TabsTrigger>
          <TabsTrigger
            value="expiry"
            className="flex items-center justify-center gap-2 data-[state=active]:bg-white data-[state=active]:shadow-sm transition-all text-xs sm:text-sm px-2"
          >
            <Timer className="w-4 h-4 shrink-0" />
            <span className="hidden sm:inline">Credit Expiry</span>
            <span className="sm:hidden">Expiry</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="subscription" className="space-y-8">
          <SubscriptionTab
            displaySubscription={displaySubscription}
            applicationPlans={applicationPlans}
            creditBalance={creditBalance}
            setActiveTab={setTab}
            planPriceCurrency={checkoutCurrency}
            creditAllocations={creditAllocations}
            creditAllocationsLoading={creditAllocationsLoading}
          />
        </TabsContent>

        <TabsContent value="topups" className="space-y-12">
          <CreditTopupsTab
            creditPricing={creditPricing}
            onCreditPurchase={handleCreditPurchase}
            isUpgrading={isUpgrading}
            currentBalance={creditBalance?.availableCredits}
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

        <TabsContent value="expiry" className="space-y-6">
          <ExpiryBreakdownTab
            creditAllocations={creditAllocations}
            creditBalance={creditBalance}
            entityBalances={entityBalances}
            isLoading={creditAllocationsLoading || entityBalancesLoading}
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
