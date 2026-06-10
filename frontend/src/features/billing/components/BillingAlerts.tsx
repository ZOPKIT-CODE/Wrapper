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
  isAuthenticated
}: BillingAlertsProps) {
  const navigate = useNavigate()

  return (
    <>
      <div className="flex items-center justify-end gap-2 mb-6">
        {upgradeMode && (
          <Badge className="bg-primary/5 text-primary border-primary/20">
            <Zap className="h-3 w-3 mr-1" />
            Upgrade Mode
          </Badge>
        )}
      </div>

      {needsOnboarding && !mockMode && isAuthenticated && (
        <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 mb-6">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-orange-100 rounded-lg">
              <Settings className="h-5 w-5 text-orange-600" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-orange-900">Setup Required</h3>
              <p className="text-orange-700 mt-1">
                Complete onboarding to access all subscription features
              </p>
            </div>
            <Button
              variant="default"
              size="sm"
              className="bg-orange-600 hover:bg-orange-700 text-white"
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
