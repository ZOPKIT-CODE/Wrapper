import { useState, useEffect } from 'react'
import { logger } from '@/lib/logger'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { CreditCard, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { api } from '@/lib/api'
import { useQueryClient } from '@tanstack/react-query'
import { useTenantApplications } from '@/hooks/useSharedQueries'

interface CreditAllocationModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess?: () => void
  entityId: string
  entityName: string
  entityType: 'organization' | 'location'
  availableCredits?: number
}

export function CreditAllocationModal({
  isOpen,
  onClose,
  onSuccess,
  entityId,
  entityName,
  entityType: _entityType,
  availableCredits = 0,
}: CreditAllocationModalProps) {
  const queryClient = useQueryClient()
  const [loading, setLoading] = useState(false)
  const [allocationForm, setAllocationForm] = useState({
    targetApplication: '',
    creditAmount: 0,
    allocationPurpose: '',
    autoReplenish: false,
  })

  const {
    data: organizationApplications = [],
    isLoading: isLoadingApplications,
  } = useTenantApplications()

  useEffect(() => {
    if (isOpen) {
      setAllocationForm({
        targetApplication: '',
        creditAmount: 0,
        allocationPurpose: '',
        autoReplenish: false,
      })
    }
  }, [isOpen])

  const handleAllocateCredits = async () => {
    if (loading) return

    if (!allocationForm.targetApplication || !allocationForm.creditAmount) {
      toast.error('Please fill in all required fields')
      return
    }

    if (allocationForm.creditAmount > availableCredits) {
      toast.error('Cannot allocate more credits than are available')
      return
    }

    let loadingToastId: string | number | undefined
    try {
      setLoading(true)
      loadingToastId = toast.loading('Allocating credits...')
      const idempotencyKey = `credit-allocation:${entityId}:${allocationForm.targetApplication}:${Date.now()}:${Math.random().toString(36).slice(2, 10)}`

      const response = await api.post(
        '/credits/allocate/application',
        {
          sourceEntityId: entityId,
          targetApplication: allocationForm.targetApplication,
          creditAmount: allocationForm.creditAmount,
          allocationPurpose: allocationForm.allocationPurpose,
          autoReplenish: allocationForm.autoReplenish,
        },
        {
          headers: {
            'X-Idempotency-Key': idempotencyKey,
          },
        }
      )

      if (response.data.success) {
        toast.success(
          `Successfully allocated ${allocationForm.creditAmount} credits to ${allocationForm.targetApplication}`
        )

        try {
          queryClient.invalidateQueries({ queryKey: ['credit'] })
          queryClient.invalidateQueries({
            queryKey: ['creditStatus'],
            exact: false,
          })
          queryClient.invalidateQueries({ queryKey: ['admin', 'entities'] })
          queryClient.invalidateQueries({
            queryKey: ['organizations', 'hierarchy'],
          })
          queryClient.refetchQueries({
            queryKey: ['organizations', 'hierarchy'],
            type: 'active',
          })
        } catch (invalidateError) {
          logger.warn('Failed to invalidate queries:', invalidateError)
        }

        setAllocationForm({
          targetApplication: '',
          creditAmount: 0,
          allocationPurpose: '',
          autoReplenish: false,
        })
        onSuccess?.()
        onClose()
      } else {
        toast.error(response.data?.message || 'Failed to allocate credits')
      }
    } catch (error: unknown) {
      console.error('Failed to allocate credits:', error)
      const errorWithResponse = error as {
        response?: { data?: { message?: string } }
      }
      const errorMessage =
        errorWithResponse.response?.data?.message ||
        'Failed to allocate credits'
      toast.error(errorMessage)
    } finally {
      if (loadingToastId !== undefined) {
        toast.dismiss(loadingToastId)
      }
      setLoading(false)
    }
  }

  return (
    <Sheet
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
    >
      <SheetContent
        side="right"
        className="flex h-full min-h-0 w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-lg [&>button]:text-white [&>button]:hover:bg-white/15"
      >
        <SheetHeader className="bg-primary shrink-0 space-y-2 border-b border-white/10 px-6 pt-8 pb-5 text-white">
          <SheetTitle className="flex items-center gap-2 text-lg font-semibold text-white">
            <CreditCard className="h-5 w-5 shrink-0" aria-hidden />
            Allocate Credits to Application
          </SheetTitle>
          <SheetDescription className="text-sm text-white/85">
            Allocate credits from{' '}
            <Badge className="border-white/30 bg-white/15 text-white">
              {entityName}
            </Badge>{' '}
            to a specific application. Available:{' '}
            <span className="font-semibold text-white">
              {availableCredits.toLocaleString()}
            </span>{' '}
            credits.
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 space-y-4 overflow-y-auto px-6 py-5">
          <div className="border-primary/20 bg-primary/5 rounded-lg border p-3">
            <p className="text-sm text-slate-700">
              Available credits:{' '}
              <span className="text-primary font-semibold">
                {availableCredits.toLocaleString()}
              </span>
            </p>
          </div>

          <div className="space-y-2">
            <Label className="text-[13px] font-medium">
              Application <span className="text-red-500">*</span>
            </Label>
            <Select
              value={allocationForm.targetApplication}
              onValueChange={(value) =>
                setAllocationForm({
                  ...allocationForm,
                  targetApplication: value,
                })
              }
              disabled={isLoadingApplications}
            >
              <SelectTrigger className="focus:border-primary focus:ring-ring min-w-0 focus:ring-2 [&>span]:block [&>span]:min-w-0 [&>span]:truncate [&>span]:overflow-hidden [&>span]:text-ellipsis [&>span]:whitespace-nowrap">
                <SelectValue
                  placeholder={
                    isLoadingApplications
                      ? 'Loading applications...'
                      : 'Select application'
                  }
                />
              </SelectTrigger>
              <SelectContent className="max-h-[min(16rem,70vh)]">
                {isLoadingApplications ? (
                  <div className="text-muted-foreground p-2 text-sm">
                    Loading applications...
                  </div>
                ) : organizationApplications.length === 0 ? (
                  <div className="text-muted-foreground p-2 text-sm">
                    No applications available
                  </div>
                ) : (
                  organizationApplications
                    .filter(
                      (app: { isEnabled?: boolean }) => app.isEnabled !== false
                    )
                    .map(
                      (app: {
                        appId?: string
                        appCode?: string
                        appName?: string
                        name?: string
                        description?: string
                      }) => {
                        const displayName =
                          app.appName ||
                          app.name ||
                          app.appCode ||
                          'Application'
                        const fullLabel = app.description
                          ? `${displayName} – ${app.description}`
                          : displayName
                        return (
                          <SelectItem
                            key={app.appId || app.appCode}
                            value={app.appCode || app.appId || ''}
                            title={fullLabel}
                          >
                            {displayName}
                          </SelectItem>
                        )
                      }
                    )
                )}
              </SelectContent>
            </Select>
            {organizationApplications.length === 0 &&
              !isLoadingApplications && (
                <p className="text-muted-foreground mt-1 text-xs">
                  No applications are available for this organization.
                </p>
              )}
          </div>

          <div className="space-y-2">
            <Label className="text-[13px] font-medium">
              Credit amount <span className="text-red-500">*</span>
            </Label>
            <Input
              type="number"
              min="0.01"
              step="0.01"
              max={availableCredits}
              value={allocationForm.creditAmount || ''}
              onChange={(e) =>
                setAllocationForm({
                  ...allocationForm,
                  creditAmount: parseFloat(e.target.value) || 0,
                })
              }
              placeholder="Enter credit amount"
              className="focus:border-primary focus:ring-ring focus:ring-2"
            />
            {allocationForm.creditAmount > availableCredits && (
              <p className="mt-1 text-sm text-red-600">
                Cannot allocate more than available credits
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label className="text-[13px] font-medium">
              Purpose (optional)
            </Label>
            <Input
              value={allocationForm.allocationPurpose}
              onChange={(e) =>
                setAllocationForm({
                  ...allocationForm,
                  allocationPurpose: e.target.value,
                })
              }
              placeholder="Describe the purpose of this allocation"
              className="focus:border-primary focus:ring-ring focus:ring-2"
            />
          </div>

          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              id="credit-alloc-auto-replenish"
              checked={allocationForm.autoReplenish}
              onChange={(e) =>
                setAllocationForm({
                  ...allocationForm,
                  autoReplenish: e.target.checked,
                })
              }
              className="focus:ring-ring h-4 w-4 rounded border-slate-300 focus:ring-2 focus:ring-offset-0"
            />
            <Label
              htmlFor="credit-alloc-auto-replenish"
              className="cursor-pointer text-sm font-normal"
            >
              Auto-replenish when credits run low
            </Label>
          </div>
        </div>

        <SheetFooter className="border-primary/10 bg-muted mt-0 shrink-0 flex-row justify-end gap-2 border-t px-6 py-4">
          <Button variant="outline" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button
            onClick={handleAllocateCredits}
            disabled={
              loading ||
              !allocationForm.targetApplication ||
              !allocationForm.creditAmount ||
              allocationForm.creditAmount > availableCredits
            }
            className="bg-primary text-primary-foreground hover:bg-primary-hover"
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Allocating...
              </>
            ) : (
              <>
                <CreditCard className="mr-2 h-4 w-4" />
                Allocate Credits
              </>
            )}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
