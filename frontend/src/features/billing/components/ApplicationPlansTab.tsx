/**
 * Application subscription plans (annual billing, USD / INR display).
 */

import { Calendar } from 'lucide-react'
import PricingCard from '@/components/common/data-display/PricingCard'
import type { ApplicationPlan, CheckoutCurrency } from '@/types/pricing'
import { cn } from '@/lib/utils'
import {
  DASHBOARD_PAGE_DESCRIPTION_CLASS,
  DASHBOARD_PAGE_TITLE_CLASS,
} from '@/components/dashboard/DashboardPageHeader'

export interface ApplicationPlansTabProps {
  applicationPlans: ApplicationPlan[]
  onPlanPurchase: (planId: string) => void
  isUpgrading: boolean
  selectedPlan: string | null
  checkoutCurrency: CheckoutCurrency
  onCheckoutCurrencyChange: (c: CheckoutCurrency) => void
}

export function ApplicationPlansTab({
  applicationPlans,
  onPlanPurchase,
  isUpgrading,
  selectedPlan,
  checkoutCurrency,
  onCheckoutCurrencyChange,
}: ApplicationPlansTabProps) {
  return (
    <div className="space-y-8">
      <div className="mx-auto max-w-3xl">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
          <div className="min-w-0 flex-1 text-center sm:text-left">
            <h2 className={cn(DASHBOARD_PAGE_TITLE_CLASS, 'mb-3')}>
              Application Plans
            </h2>
            <p
              className={cn(
                DASHBOARD_PAGE_DESCRIPTION_CLASS,
                'leading-relaxed'
              )}
            >
              Prices shown per month for comparison. Billed annually.
            </p>
            <div className="text-muted-foreground mt-3 flex items-center justify-center gap-2 text-sm sm:justify-start">
              <Calendar className="h-4 w-4 shrink-0" />
              <span>Credits renew each billing year</span>
            </div>
          </div>
          <div className="flex shrink-0 justify-center sm:justify-end sm:pt-1">
            <div
              className="inline-flex rounded-full border border-slate-200 bg-slate-50 p-1"
              role="group"
              aria-label="Billing currency"
            >
              <button
                type="button"
                onClick={() => onCheckoutCurrencyChange('usd')}
                className={cn(
                  'min-w-[3.25rem] rounded-full px-4 py-1.5 text-sm font-semibold transition-colors',
                  checkoutCurrency === 'usd'
                    ? 'bg-primary text-white shadow'
                    : 'text-slate-600 hover:bg-white/80'
                )}
              >
                USD
              </button>
              <button
                type="button"
                onClick={() => onCheckoutCurrencyChange('inr')}
                className={cn(
                  'min-w-[3.25rem] rounded-full px-4 py-1.5 text-sm font-semibold transition-colors',
                  checkoutCurrency === 'inr'
                    ? 'bg-primary text-white shadow'
                    : 'text-slate-600 hover:bg-white/80'
                )}
              >
                INR
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl">
        <div className="grid grid-cols-1 items-start gap-8 md:grid-cols-3 lg:gap-10">
          {applicationPlans.map((plan, index) => (
            <div
              key={plan.id}
              className="animate-slide-in-up flex items-start justify-center"
              style={{ animationDelay: `${index * 150}ms` }}
            >
              <PricingCard
                name={plan.name}
                description={plan.description}
                annualPriceUsd={plan.annualPriceUsd}
                annualPriceInr={plan.annualPriceInr}
                applicationDisplayCurrency={checkoutCurrency}
                currency={plan.currency}
                features={plan.features}
                freeCredits={plan.freeCredits}
                recommended={plan.popular}
                isPremium={plan.popular}
                type="application"
                onPurchase={() => onPlanPurchase(plan.id)}
                isLoading={isUpgrading && selectedPlan === plan.id}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
