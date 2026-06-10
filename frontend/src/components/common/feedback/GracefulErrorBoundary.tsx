import React from 'react'
import { AlertTriangle, Clock, Crown, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { useTrialStatus } from '@/hooks/useTrialStatus'

interface GracefulErrorBoundaryProps {
  children: React.ReactNode
  fallbackTitle?: string
  fallbackMessage?: string
  showRetry?: boolean
  onRetry?: () => void
}

export function GracefulErrorBoundary({
  children,
  fallbackTitle = "Service Temporarily Unavailable",
  fallbackMessage = "We're experiencing technical difficulties. Please try again in a moment.",
  showRetry = true,
  onRetry
}: GracefulErrorBoundaryProps) {
  const { isExpired, expiredData } = useTrialStatus()

  // If trial is expired, show graceful trial expiry message instead of generic error
  if (isExpired && expiredData) {
    return (
      <Card className="border-amber-200 bg-amber-50">
        <CardHeader className="text-center pb-4">
          <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-amber-100 mb-4">
            <Clock className="h-6 w-6 text-amber-600" />
          </div>
          <CardTitle className="text-lg font-semibold text-amber-900">
            Feature Access Limited
          </CardTitle>
          <Badge variant="secondary" className="bg-amber-100 text-amber-800 border-amber-300">
            {expiredData.plan?.toUpperCase() || 'TRIAL'} EXPIRED
          </Badge>
        </CardHeader>

        <CardContent className="text-center">
          <p className="text-amber-800 mb-6">
            This feature requires an active subscription. 
            Upgrade now to restore full access to all features.
          </p>

          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Button 
              onClick={() => window.location.href = expiredData?.isSubscriptionExpired ? '/billing?renew=true' : '/billing?upgrade=true'}
              className="gap-2 bg-amber-600 hover:bg-amber-700"
            >
              <Crown className="w-4 h-4" />
              {expiredData?.isSubscriptionExpired ? 'Renew Subscription' : 'Upgrade Plan'}
            </Button>
            
            <Button 
              variant="outline" 
              onClick={() => window.location.href = '/'}
            >
              Return to Home
            </Button>
          </div>

          <p className="text-xs text-amber-700 mt-4">
            Your data is safe and will be restored once you upgrade.
          </p>
        </CardContent>
      </Card>
    )
  }

  if (!isExpired) {
    return <>{children}</>
  }

  // For non-trial errors, show standard error message
  return (
    <Card className="border-red-200 bg-red-50">
      <CardContent className="text-center p-8">
        <AlertTriangle className="h-12 w-12 text-red-500 mx-auto mb-4" />
        <h3 className="text-lg font-semibold text-red-900 mb-2">{fallbackTitle}</h3>
        <p className="text-red-700 mb-6">{fallbackMessage}</p>
        
        {showRetry && onRetry && (
          <Button onClick={onRetry} className="gap-2">
            <RefreshCw className="w-4 h-4" />
            Try Again
          </Button>
        )}
      </CardContent>
    </Card>
  )
}

// Higher-order component for wrapping components with graceful error handling
export function withGracefulErrorHandling<T extends object>(
  Component: React.ComponentType<T>,
  options?: {
    fallbackTitle?: string
    fallbackMessage?: string
    showRetry?: boolean
  }
) {
  return function WrappedComponent(props: T & { onRetry?: () => void }) {
    const { onRetry, ...componentProps } = props
    
    return (
      <GracefulErrorBoundary
        fallbackTitle={options?.fallbackTitle}
        fallbackMessage={options?.fallbackMessage}
        showRetry={options?.showRetry}
        onRetry={onRetry}
      >
        <Component {...(componentProps as T)} />
      </GracefulErrorBoundary>
    )
  }
} 