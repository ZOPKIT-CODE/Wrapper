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
  isPending
}: RefundDialogProps) {
  if (!paymentId) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
        <h3 className="text-lg font-semibold mb-4">Request Refund</h3>
        <p className="text-gray-600 mb-4">
          Request a refund for this payment. Refunds are typically processed within 5-10 business
          days.
        </p>

        <div className="mb-4">
          <label className="block text-sm font-medium mb-2">
            Reason (optional)
          </label>
          <textarea
            className="w-full p-2 border rounded-md"
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
            onClick={() => onConfirm(paymentId, refundReason || 'customer_request')}
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
