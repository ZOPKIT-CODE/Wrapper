/**
 * Cancel subscription confirmation dialog.
 * Schedules cancellation at the end of the current billing period —
 * the user keeps full access until then.
 */

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { formatDate } from '@/lib/utils'
import { subscriptionAPI } from '@/lib/api'
import { useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'

export interface CancelSubscriptionDialogProps {
  open: boolean
  onClose: () => void
  currentPeriodEnd: string
}

export function CancelSubscriptionDialog({
  open,
  onClose,
  currentPeriodEnd
}: CancelSubscriptionDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const queryClient = useQueryClient()

  if (!open) return null

  const handleCancelSubscription = async () => {
    setIsSubmitting(true)
    try {
      const response = await subscriptionAPI.cancelSubscription()
      const message = response.data?.data?.message
        || `Your subscription will remain active until ${formatDate(currentPeriodEnd)}. You will not be charged again.`
      toast.success(message, { duration: 6000 })
      queryClient.invalidateQueries({ queryKey: ['subscription'] })
      onClose()
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } } }
      toast.error(err?.response?.data?.message ?? 'Failed to cancel subscription')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-md w-full mx-4">
        <h3 className="text-lg font-semibold mb-4 dark:text-white">Cancel Subscription</h3>
        <p className="text-gray-600 dark:text-gray-300 mb-4">
          Your subscription will be canceled at the end of your current billing period (
          {formatDate(currentPeriodEnd)}). You'll retain access to all features until then.
        </p>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
          You will not be charged again. If you change your mind, you can resubscribe at any time.
        </p>

        <div className="flex gap-3">
          <Button variant="outline" onClick={onClose} className="flex-1" disabled={isSubmitting}>
            Keep Subscription
          </Button>
          <Button
            onClick={handleCancelSubscription}
            disabled={isSubmitting}
            className="flex-1 bg-red-600 hover:bg-red-700"
          >
            {isSubmitting ? 'Canceling...' : 'Cancel Subscription'}
          </Button>
        </div>
      </div>
    </div>
  )
}
