import {
  Calendar,
  Crown,
  AlertTriangle,
  Clock,
  Shield,
  Sparkles,
} from 'lucide-react'
import {
  useCreditStatusQuery,
  useSubscriptionCurrent,
} from '@/hooks/useSharedQueries'
import { formatDate } from '@/lib/utils'
import { cn } from '@/lib/utils'

interface BillingStatusNavbarProps {
  className?: string
}

export function BillingStatusNavbar({ className }: BillingStatusNavbarProps) {
  // Fetch credit status
  const { data: creditResponse, isLoading: creditLoading } =
    useCreditStatusQuery()

  // Fetch subscription status using shared hook
  const { data: subscription, isLoading: subscriptionLoading } =
    useSubscriptionCurrent()

  const creditData = creditResponse?.data
  const isLoading = creditLoading || subscriptionLoading

  if (isLoading) {
    return (
      <div className={cn('flex items-center gap-3 px-3 py-2', className)}>
        <div className="flex animate-pulse items-center gap-2">
          <div className="h-4 w-4 rounded bg-gray-300"></div>
          <div className="h-3 w-16 rounded bg-gray-300"></div>
        </div>
        <div className="flex animate-pulse items-center gap-2">
          <div className="h-4 w-4 rounded bg-gray-300"></div>
          <div className="h-3 w-12 rounded bg-gray-300"></div>
        </div>
      </div>
    )
  }

  if (!creditData || !subscription) {
    return null
  }

  const {
    availableCredits = 0,
    freeCredits = 0,
    paidCredits = 0,
    seasonalCredits = 0,
    creditExpiry,
    lowBalanceThreshold = 100,
  } = creditData

  // Calculate expiry status early
  const isExpiringSoon = creditExpiry
    ? new Date(creditExpiry) < new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
    : false

  const isLowBalance = availableCredits <= lowBalanceThreshold

  const getExpiryColor = () => {
    if (isExpiringSoon) return 'text-orange-600 dark:text-orange-400'
    return 'text-gray-600 dark:text-gray-400'
  }

  // Map plan IDs to proper plan names
  const planNameMap: Record<string, string> = {
    free: 'Free',
    starter: 'Starter',
    professional: 'Professional',
    premium: 'Premium',
    enterprise: 'Enterprise',
    standard: 'Standard',
    credit_based: 'Free', // Map credit_based to Free as default
  }

  // Get plan name - prioritize mapping, fallback to capitalized plan ID, default to Free
  const planId = subscription.plan || 'free'
  const planName =
    planNameMap[planId] ||
    (planId === 'credit_based'
      ? 'Free'
      : planId.charAt(0).toUpperCase() + planId.slice(1)) ||
    'Free'
  return (
    <div
      className={cn(
        'flex items-center gap-3 rounded-xl border border-gray-100 bg-white px-4 py-2 shadow-sm transition-all duration-300 hover:shadow-md',
        className
      )}
    >
      {/* Subscription Plan Expiry - SHOWN FIRST */}
      {subscription?.currentPeriodEnd && (
        <div
          className="group flex cursor-help items-center gap-2 rounded-lg px-2 py-1 transition-colors hover:bg-gray-50"
          title={`Plan ${subscription.plan === 'free' ? 'expires' : 'renews'} on ${formatDate(subscription.currentPeriodEnd)}`}
        >
          <Calendar
            className={cn(
              'h-4 w-4 transition-transform group-hover:scale-110',
              getExpiryColor()
            )}
          />
          <div className="flex flex-col leading-none">
            <span className="text-[10px] font-semibold tracking-wider text-gray-500 uppercase">
              {subscription.plan === 'free' ? 'Expires' : 'Renews'}
            </span>
            <span className={cn('text-xs font-bold', getExpiryColor())}>
              {formatDate(subscription.currentPeriodEnd).split(',')[0]}
            </span>
          </div>
        </div>
      )}

      <div className="h-8 w-px bg-gray-100"></div>

      {/* Subscription Plan */}
      <div className="group flex items-center gap-2 rounded-lg px-2 py-1 transition-colors hover:bg-purple-50">
        <div className="rounded-full bg-purple-100 p-1 transition-colors group-hover:bg-purple-200">
          <Crown className="h-3 w-3 text-purple-600" />
        </div>
        <div className="flex flex-col leading-none">
          <span className="text-[10px] font-semibold tracking-wider text-gray-500 uppercase">
            Plan
          </span>
          <span className="text-xs font-bold text-[#1B2E5A] capitalize">
            {planName}
          </span>
        </div>
      </div>

      <div className="h-8 w-px bg-gray-100"></div>

      {/* Credits Section - Show Paid and Free Credits */}
      <div className="flex items-center gap-1">
        {/* Paid Credits */}
        {paidCredits > 0 && (
          <div className="group flex items-center gap-2 rounded-lg px-2 py-1 transition-colors hover:bg-amber-50">
            <div className="rounded-full bg-amber-100 p-1 transition-colors group-hover:bg-amber-200">
              <Shield className="h-3 w-3 text-amber-600" />
            </div>
            <div className="flex flex-col leading-none">
              <span className="text-[10px] font-semibold tracking-wider text-gray-500 uppercase">
                Paid
              </span>
              <span className="text-xs font-bold text-[#1B2E5A]">
                {paidCredits.toLocaleString()}
              </span>
            </div>
          </div>
        )}

        {/* Free Credits */}
        <div className="group flex items-center gap-2 rounded-lg px-2 py-1 transition-colors hover:bg-emerald-50">
          <div className="rounded-full bg-emerald-100 p-1 transition-colors group-hover:bg-emerald-200">
            <Clock className="h-3 w-3 text-emerald-600" />
          </div>
          <div className="flex flex-col leading-none">
            <span className="text-[10px] font-semibold tracking-wider text-gray-500 uppercase">
              Free
            </span>
            <span className="text-xs font-bold text-[#1B2E5A]">
              {freeCredits.toLocaleString()}
            </span>
          </div>
        </div>

        {/* Seasonal Credits - Only if present */}
        {seasonalCredits > 0 && (
          <div className="group flex items-center gap-2 rounded-lg px-2 py-1 transition-colors hover:bg-indigo-50">
            <div className="rounded-full bg-indigo-100 p-1 transition-colors group-hover:bg-indigo-200">
              <Sparkles className="h-3 w-3 text-indigo-600" />
            </div>
            <div className="flex flex-col leading-none">
              <span className="text-[10px] font-semibold tracking-wider text-gray-500 uppercase">
                Seasonal
              </span>
              <span className="text-xs font-bold text-[#1B2E5A]">
                {seasonalCredits.toLocaleString()}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Low Balance Warning */}
      {(isLowBalance || isExpiringSoon) && (
        <>
          <div className="h-8 w-px bg-gray-100"></div>
          <div className="flex h-8 w-8 animate-pulse items-center justify-center rounded-full bg-orange-50">
            <AlertTriangle className="h-4 w-4 text-orange-500" />
          </div>
        </>
      )}
    </div>
  )
}
