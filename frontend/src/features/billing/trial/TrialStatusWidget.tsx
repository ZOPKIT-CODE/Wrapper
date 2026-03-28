import React from 'react'
import { Clock, Crown, AlertTriangle } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { useNavigate } from '@tanstack/react-router'
import { useTrialStatus } from '@/hooks/useTrialStatus'
import { cn } from '@/lib/utils'

export function TrialStatusWidget() {
  const { trialStatus, isExpired, daysRemaining, getStatusSeverity, getDisplayMessage } = useTrialStatus()
  const navigate = useNavigate()

  // Don't show widget if no trial info
  if (!trialStatus || !trialStatus.hasTrial) {
    return null
  }

  const severity = getStatusSeverity()
  const message = getDisplayMessage()

  const handleUpgrade = () => {
    navigate({ to: '/billing?upgrade=true&source=header_widget' })
  }

  const getWidgetStyle = () => {
    switch (severity) {
      case 'error':
        return {
          badgeVariant: 'destructive' as const,
          iconColor: 'text-red-600',
          textColor: 'text-red-700'
        }
      case 'warning':
        return {
          badgeVariant: 'secondary' as const,
          iconColor: 'text-amber-600',
          textColor: 'text-amber-700'
        }
      case 'success':
        return {
          badgeVariant: 'secondary' as const,
          iconColor: 'text-green-600',
          textColor: 'text-green-700'
        }
      default:
        return {
          badgeVariant: 'secondary' as const,
          iconColor: 'text-[#1B2E5A]',
          textColor: 'text-[#1B2E5A]'
        }
    }
  }

  const style = getWidgetStyle()

  // Compact view for mobile
  const CompactView = () => (
    <div className="flex items-center gap-2">
      {isExpired ? (
        <AlertTriangle className={cn('h-4 w-4', style.iconColor)} />
      ) : (
        <Clock className={cn('h-4 w-4', style.iconColor)} />
      )}
      <Badge variant={style.badgeVariant} className="text-xs">
        {isExpired ? 'Expired' : `${daysRemaining}d`}
      </Badge>
    </div>
  )

  // Full view for desktop
  const FullView = () => (
    <div className="flex items-center gap-3">
      <div className="flex items-center gap-2">
        {isExpired ? (
          <AlertTriangle className={cn('h-4 w-4', style.iconColor)} />
        ) : (
          <Clock className={cn('h-4 w-4', style.iconColor)} />
        )}
        <div className="text-right">
          <div className="text-xs font-medium text-gray-600">
            {isExpired ? 'Trial' : 'Trial ends'}
          </div>
          <div className={cn('text-xs', style.textColor)}>
            {isExpired ? 'Expired' : `${daysRemaining} days`}
          </div>
        </div>
      </div>
      
      {(isExpired || daysRemaining <= 7) && (
        <Button
          size="sm"
          variant={isExpired ? "destructive" : "outline"}
          className="text-xs h-7"
          onClick={handleUpgrade}
        >
          <Crown className="h-3 w-3 mr-1" />
          {isExpired ? 'Restore' : 'Upgrade'}
        </Button>
      )}
    </div>
  )

  return (
    <div className="flex items-center">
      {/* Mobile view */}
      <div className="sm:hidden">
        <CompactView />
      </div>
      
      {/* Desktop view */}
      <div className="hidden sm:flex">
        <FullView />
      </div>
    </div>
  )
} 