/**
 * Credit top-up packages only (one-time purchases).
 */

import { cn } from '@/lib/utils'
import {
  DASHBOARD_PAGE_DESCRIPTION_CLASS,
  DASHBOARD_PAGE_TITLE_CLASS,
} from '@/components/dashboard/DashboardPageHeader'
import PricingCard from '@/components/common/data-display/PricingCard'
import type { CreditTopup } from '@/types/pricing'

export interface CreditTopupsTabProps {
  creditTopups: CreditTopup[]
  onCreditPurchase: (packageId: string) => void
  isUpgrading: boolean
  selectedPlan: string | null
}

export function CreditTopupsTab({
  creditTopups,
  onCreditPurchase,
  isUpgrading,
  selectedPlan
}: CreditTopupsTabProps) {
  return (
    <div className="space-y-8">
      <div className="text-center max-w-2xl mx-auto">
        <h2 className={cn(DASHBOARD_PAGE_TITLE_CLASS, 'mb-4')}>Credit Top-ups</h2>
        <p className={cn(DASHBOARD_PAGE_DESCRIPTION_CLASS, 'leading-relaxed')}>
          Need more credits? Purchase additional credits that never expire and use them anytime for
          your business operations.
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
  )
}
