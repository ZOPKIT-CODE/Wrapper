/**
 * Billing page alerts: upgrade mode badge and onboarding CTA.
 */

import React from 'react'
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
  isAuthenticated
}: BillingAlertsProps) {
  const navigate = useNavigate()

  return (
    <>
      <div className="flex items-center justify-end gap-2 mb-6">
        {upgradeMode && (
          <Badge className="bg-[#1B2E5A]/5 text-[#1B2E5A] border-[#1B2E5A]/20 dark:bg-[#1B2E5A]/20 dark:text-[#4A6FA5] dark:border-[#1B2E5A]/40">
            <Zap className="h-3 w-3 mr-1" />
            Upgrade Mode
          </Badge>
        )}
      </div>

      {needsOnboarding && !mockMode && isAuthenticated && (
        <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 mb-6 dark:bg-orange-900/10 dark:border-orange-800">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-orange-100 rounded-lg dark:bg-orange-900/30">
              <Settings className="h-5 w-5 text-orange-600 dark:text-orange-400" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-orange-900 dark:text-orange-100">Setup Required</h3>
              <p className="text-orange-700 dark:text-orange-200 mt-1">
                Complete onboarding to access all subscription features
              </p>
            </div>
            <Button
              variant="default"
              size="sm"
              className="bg-orange-600 hover:bg-orange-700 text-white dark:bg-orange-500 dark:hover:bg-orange-600"
              onClick={() => navigate({ to: '/onboarding' })}
            >
              <ArrowRight className="h-4 w-4 mr-2" />
              Complete Setup
            </Button>
          </div>
        </div>
      )}
    </>
  )
}
