/**
 * Plans tab: credit top-ups and application plans with pricing cards.
 */

import React from 'react'
import { Calendar } from 'lucide-react'
import PricingCard from '@/components/common/data-display/PricingCard'
import type { ApplicationPlan, CreditTopup } from '@/types/pricing'

export interface PlansTabProps {
  creditTopups: CreditTopup[]
  applicationPlans: ApplicationPlan[]
  onCreditPurchase: (packageId: string) => void
  onPlanPurchase: (planId: string) => void
  isUpgrading: boolean
  selectedPlan: string | null
}

export function PlansTab({
  creditTopups,
  applicationPlans,
  onCreditPurchase,
  onPlanPurchase,
  isUpgrading,
  selectedPlan
}: PlansTabProps) {
  return (
    <div className="space-y-12">
      {/* Credit Top-ups */}
      <div className="space-y-8">
        <div className="text-center max-w-2xl mx-auto">
          <h2 className="text-3xl font-bold text-[#1B2E5A] dark:text-white mb-4">
            Credit Top-ups
          </h2>
          <p className="text-lg text-gray-600 dark:text-gray-400 leading-relaxed">
            Need more credits? Purchase additional credits that never expire and use them anytime
            for your business operations.
          </p>
        </div>

        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 lg:gap-10">
            {creditTopups.map((topup, index) => (
              <div
                key={topup.id}
                className="flex justify-center animate-slide-in-up"
                style={{ animationDelay: `${index * 150}ms` }}
              >
                <PricingCard
                  name={topup.name}
                  description={topup.description}
                  credits={topup.credits}
                  price={topup.price}
                  currency={topup.currency}
                  features={topup.features}
                  recommended={topup.recommended}
                  isPremium={topup.recommended}
                  type="topup"
                  onPurchase={() => onCreditPurchase(topup.id)}
                  isLoading={isUpgrading && selectedPlan === topup.id}
                />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Visual separator */}
      <div className="flex items-center justify-center">
        <div className="flex-1 h-px bg-gradient-to-r from-transparent via-gray-300 dark:via-gray-600 to-transparent" />
        <div className="px-6">
          <div className="w-2 h-2 bg-gray-400 dark:bg-gray-500 rounded-full" />
        </div>
        <div className="flex-1 h-px bg-gradient-to-r from-transparent via-gray-300 dark:via-gray-600 to-transparent" />
      </div>

      {/* Application Plans */}
      <div className="space-y-8" data-tour-feature="upgrade-plans">
        <div className="text-center max-w-2xl mx-auto">
          <h2 className="text-3xl font-bold text-[#1B2E5A] dark:text-white mb-4">
            Application Plans
          </h2>
          <p className="text-lg text-gray-600 dark:text-gray-400 leading-relaxed">
            Choose a plan that fits your business needs with included free credits and access to
            premium features.
          </p>
          <div className="mt-6 flex items-center justify-center gap-2 text-sm text-gray-500 dark:text-gray-400">
            <Calendar className="w-4 h-4" />
            <span>All plans include annual free credits that renew with your subscription</span>
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
                  monthlyPrice={plan.monthlyPrice}
                  annualPrice={plan.annualPrice}
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
    </div>
  )
}
