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
  onCheckoutCurrencyChange
}: ApplicationPlansTabProps) {
  return (
    <div className="space-y-8">
      <div className="max-w-3xl mx-auto">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
          <div className="text-center sm:text-left flex-1 min-w-0">
            <h2 className={cn(DASHBOARD_PAGE_TITLE_CLASS, 'mb-3')}>
              Application Plans
            </h2>
            <p className={cn(DASHBOARD_PAGE_DESCRIPTION_CLASS, 'leading-relaxed')}>
              Prices shown per month for comparison. Billed annually.
            </p>
            <div className="mt-3 flex items-center justify-center sm:justify-start gap-2 text-sm text-muted-foreground">
              <Calendar className="w-4 h-4 shrink-0" />
              <span>Credits renew each billing year</span>
            </div>
          </div>
          <div className="flex justify-center sm:justify-end sm:pt-1 shrink-0">
            <div
              className="inline-flex rounded-full border border-slate-200 dark:border-slate-600 p-1 bg-slate-50 dark:bg-slate-800/80"
              role="group"
              aria-label="Billing currency"
            >
              <button
                type="button"
                onClick={() => onCheckoutCurrencyChange('usd')}
                className={cn(
                  'px-4 py-1.5 rounded-full text-sm font-semibold transition-colors min-w-[3.25rem]',
                  checkoutCurrency === 'usd'
                    ? 'bg-[#1B2E5A] text-white shadow'
                    : 'text-slate-600 dark:text-slate-300 hover:bg-white/80 dark:hover:bg-slate-700'
                )}
              >
                USD
              </button>
              <button
                type="button"
                onClick={() => onCheckoutCurrencyChange('inr')}
                className={cn(
                  'px-4 py-1.5 rounded-full text-sm font-semibold transition-colors min-w-[3.25rem]',
                  checkoutCurrency === 'inr'
                    ? 'bg-[#1B2E5A] text-white shadow'
                    : 'text-slate-600 dark:text-slate-300 hover:bg-white/80 dark:hover:bg-slate-700'
                )}
              >
                INR
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 lg:gap-10 items-start">
          {applicationPlans.map((plan, index) => (
            <div
              key={plan.id}
              className="flex justify-center items-start animate-slide-in-up"
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
