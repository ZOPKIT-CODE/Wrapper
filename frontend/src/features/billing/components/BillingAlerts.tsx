/**
 * Billing page alerts: upgrade mode badge and onboarding CTA.
 */

import { useNavigate } from '@tanstack/react-router'
import { Zap, Settings, ArrowRight } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

export interface BillingAlertsProps {
  upgradeMode: boolean
  needsOnboarding: boolean
  mockMode: boolean
  isAuthenticated: boolean
}

export function BillingAlerts({
  upgradeMode,
  needsOnboarding,
  mockMode,
  isAuthenticated,
}: BillingAlertsProps) {
  const navigate = useNavigate()

  return (
    <>
      <div className="mb-6 flex items-center justify-end gap-2">
        {upgradeMode && (
          <Badge className="border-[#1B2E5A]/20 bg-[#1B2E5A]/5 text-[#1B2E5A] dark:border-[#1B2E5A]/40 dark:bg-[#1B2E5A]/20 dark:text-[#4A6FA5]">
            <Zap className="mr-1 h-3 w-3" />
            Upgrade Mode
          </Badge>
        )}
      </div>

      {needsOnboarding && !mockMode && isAuthenticated && (
        <div className="mb-6 rounded-lg border border-orange-200 bg-orange-50 p-4 dark:border-orange-800 dark:bg-orange-900/10">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-orange-100 p-2 dark:bg-orange-900/30">
              <Settings className="h-5 w-5 text-orange-600 dark:text-orange-400" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-orange-900 dark:text-orange-100">
                Setup Required
              </h3>
              <p className="mt-1 text-orange-700 dark:text-orange-200">
                Complete onboarding to access all subscription features
              </p>
            </div>
            <Button
              variant="default"
              size="sm"
              className="bg-orange-600 text-white hover:bg-orange-700 dark:bg-orange-500 dark:hover:bg-orange-600"
              onClick={() => navigate({ to: '/onboarding' })}
            >
              <ArrowRight className="mr-2 h-4 w-4" />
              Complete Setup
            </Button>
          </div>
        </div>
      )}
    </>
  )
}
