import React, { useEffect, useState } from 'react'
import { AlertTriangle, Crown, Clock, CreditCard, CheckCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { useNavigate } from '@tanstack/react-router'
import { useTrialStatus } from '@/hooks/useTrialStatus'
import { cn } from '@/lib/utils'

interface TrialExpiryModalProps {
  isOpen?: boolean
  onClose?: () => void
  blockingMode?: boolean
}

export function TrialExpiryModal({ 
  isOpen: propIsOpen, 
  onClose, 
  blockingMode = false 
}: TrialExpiryModalProps) {
  const { expiredData, shouldBlockApp, trialStatus } = useTrialStatus()
  const [isVisible, setIsVisible] = useState(false)
  const navigate = useNavigate()

  // Determine if modal should be shown
  const shouldShow = propIsOpen ?? (shouldBlockApp && expiredData?.expired)

  useEffect(() => {
    setIsVisible(shouldShow)
  }, [shouldShow])

  // Don't render anything if not visible
  if (!isVisible || !expiredData) return null

  const handleUpgrade = () => {
    navigate({ to: '/billing?upgrade=true&source=trial_modal' })
    if (onClose && !blockingMode) onClose()
  }

  const handleClose = () => {
    if (!blockingMode && onClose) {
      onClose()
    }
  }

  const getDaysExpired = () => {
    if (!expiredData.trialEnd) return 0
    const trialEnd = new Date(expiredData.trialEnd)
    const now = new Date()
    return Math.floor((now.getTime() - trialEnd.getTime()) / (1000 * 60 * 60 * 24))
  }

  const daysExpired = getDaysExpired()

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-[100] p-4">
      <Card className="w-full max-w-lg mx-auto shadow-2xl border-0">
        <CardHeader className="text-center pb-4">
          <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-red-100 mb-4">
            <AlertTriangle className="h-8 w-8 text-red-600" />
          </div>
          <CardTitle className="text-xl font-bold text-[#1B2E5A] mb-2">
            Trial Period Expired
          </CardTitle>
          <div className="flex items-center justify-center gap-2">
            <Badge variant="destructive" className="text-sm">
              {expiredData.plan?.toUpperCase() || 'TRIAL'}
            </Badge>
            <span className="text-sm text-gray-500">•</span>
            <span className="text-sm text-gray-500">
              Expired {expiredData.expiredDuration}
            </span>
          </div>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Expiry Details */}
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <Clock className="h-5 w-5 text-red-600 mt-0.5 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <h4 className="font-medium text-red-900 mb-1">Access Suspended</h4>
                <p className="text-sm text-red-800">
                  Your trial ended on {expiredData.trialEndFormatted}
                  {daysExpired > 0 && (
                    <span className="block mt-1">
                      That was {daysExpired} day{daysExpired !== 1 ? 's' : ''} ago.
                    </span>
                  )}
                </p>
              </div>
            </div>
          </div>

          {/* What's affected */}
          <div className="space-y-3">
            <h4 className="font-medium text-[#1B2E5A]">What's affected:</h4>
            <div className="grid grid-cols-1 gap-2">
              {[
                'Dashboard and analytics',
                'User management',
                'Data export and reports',
                'API access',
                'Premium features'
              ].map((feature, index) => (
                <div key={index} className="flex items-center gap-2 text-sm text-gray-600">
                  <div className="h-1.5 w-1.5 rounded-full bg-red-400" />
                  {feature}
                </div>
              ))}
            </div>
          </div>

          {/* What you can still do */}
          <div className="space-y-3">
            <h4 className="font-medium text-[#1B2E5A]">You can still:</h4>
            <div className="grid grid-cols-1 gap-2">
              {[
                'Upgrade your subscription',
                'Access billing settings',
                'Contact support'
              ].map((feature, index) => (
                <div key={index} className="flex items-center gap-2 text-sm text-gray-600">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  {feature}
                </div>
              ))}
            </div>
          </div>

          {/* Action buttons */}
          <div className="space-y-3 pt-4">
            <Button
              onClick={handleUpgrade}
              className="w-full bg-red-600 hover:bg-red-700 text-white font-medium py-3"
              size="lg"
            >
              <Crown className="h-5 w-5 mr-2" />
              Restore Access Now
            </Button>
            
            {!blockingMode && onClose && (
              <Button
                variant="outline"
                onClick={handleClose}
                className="w-full"
              >
                I'll upgrade later
              </Button>
            )}
          </div>

          {/* Support link */}
          <div className="text-center pt-2">
            <p className="text-xs text-gray-500">
              Need help? {' '}
              <a 
                href="mailto:support@yourapp.com" 
                className="text-[#1B2E5A] hover:text-[#162447] underline"
              >
                Contact Support
              </a>
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

// Auto-triggered modal for app-blocking scenarios
export function AutoTrialExpiryModal() {
  const { shouldBlockApp, expiredData } = useTrialStatus()
  const [hasShown, setHasShown] = useState(false)

  useEffect(() => {
    // Reset hasShown when trial status changes
    if (!shouldBlockApp) {
      setHasShown(false)
    }
  }, [shouldBlockApp])

  // Show modal when trial blocks app loading and haven't shown it yet
  if (shouldBlockApp && expiredData?.blockAppLoading && !hasShown) {
    return (
      <TrialExpiryModal 
        isOpen={true} 
        blockingMode={true}
        onClose={() => setHasShown(true)}
      />
    )
  }

  return null
} 