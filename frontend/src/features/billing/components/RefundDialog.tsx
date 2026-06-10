/**
 * Request refund dialog for a payment.
 */

import { Button } from '@/components/ui/button'
import { ZopkitRoundLoader } from '@/components/common/feedback/ZopkitRoundLoader'

export interface RefundDialogProps {
  paymentId: string | null
  onClose: () => void
  refundReason: string
  onRefundReasonChange: (value: string) => void
  onConfirm: (paymentId: string, reason: string) => void
  isPending: boolean
}

export function RefundDialog({
  paymentId,
  onClose,
  refundReason,
  onRefundReasonChange,
  onConfirm,
  isPending,
}: RefundDialogProps) {
  if (!paymentId) return null

  return (
    <div className="bg-opacity-50 fixed inset-0 z-50 flex items-center justify-center bg-black">
      <div className="mx-4 w-full max-w-md rounded-lg bg-white p-6 dark:bg-gray-800">
        <h3 className="mb-4 text-lg font-semibold dark:text-white">
          Request Refund
        </h3>
        <p className="mb-4 text-gray-600 dark:text-gray-300">
          Request a refund for this payment. Refunds are typically processed
          within 5-10 business days.
        </p>

        <div className="mb-4">
          <label className="mb-2 block text-sm font-medium dark:text-gray-200">
            Reason (optional)
          </label>
          <textarea
            className="w-full rounded-md border p-2 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
            rows={3}
            placeholder="Please let us know why you're requesting a refund..."
            value={refundReason}
            onChange={(e) => onRefundReasonChange(e.target.value)}
          />
        </div>

        <div className="flex gap-3">
          <Button variant="outline" onClick={onClose} className="flex-1">
            Cancel
          </Button>
          <Button
            onClick={() =>
              onConfirm(paymentId, refundReason || 'customer_request')
            }
            className="flex-1 bg-orange-600 hover:bg-orange-700"
            disabled={isPending}
          >
            {isPending ? (
              <>
                <ZopkitRoundLoader size="xs" className="mr-2" />
                Processing...
              </>
            ) : (
              'Request Refund'
            )}
          </Button>
        </div>
      </div>
    </div>
  )
}
