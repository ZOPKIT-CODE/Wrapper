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
          <div className="bg-muted h-4 w-4 rounded"></div>
          <div className="bg-muted h-3 w-16 rounded"></div>
        </div>
        <div className="flex animate-pulse items-center gap-2">
          <div className="bg-muted h-4 w-4 rounded"></div>
          <div className="bg-muted h-3 w-12 rounded"></div>
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
    return 'text-muted-foreground'
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
        'border-border bg-card flex items-center gap-3 rounded-xl border px-4 py-2 shadow-sm transition-all duration-300 hover:shadow-md',
        className
      )}
    >
      {/* Subscription Plan Expiry - SHOWN FIRST */}
      {subscription?.currentPeriodEnd && (
        <div
          className="group hover:bg-muted/50 flex cursor-help items-center gap-2 rounded-lg px-2 py-1 transition-colors"
          title={`Plan ${subscription.plan === 'free' ? 'expires' : 'renews'} on ${formatDate(subscription.currentPeriodEnd)}`}
        >
          <Calendar
            className={cn(
              'h-4 w-4 transition-transform group-hover:scale-110',
              getExpiryColor()
            )}
          />
          <div className="flex flex-col leading-none">
            <span className="text-muted-foreground text-[10px] font-semibold tracking-wider uppercase">
              {subscription.plan === 'free' ? 'Expires' : 'Renews'}
            </span>
            <span className={cn('text-xs font-bold', getExpiryColor())}>
              {formatDate(subscription.currentPeriodEnd).split(',')[0]}
            </span>
          </div>
        </div>
      )}

      <div className="bg-border h-8 w-px"></div>

      {/* Subscription Plan */}
      <div className="group flex items-center gap-2 rounded-lg px-2 py-1 transition-colors hover:bg-purple-500/10 dark:hover:bg-purple-500/15">
        <div className="rounded-full bg-purple-500/15 p-1 transition-colors group-hover:bg-purple-500/25 dark:bg-purple-500/20">
          <Crown className="h-3 w-3 text-purple-600 dark:text-purple-300" />
        </div>
        <div className="flex flex-col leading-none">
          <span className="text-muted-foreground text-[10px] font-semibold tracking-wider uppercase">
            Plan
          </span>
          <span className="text-foreground text-xs font-bold capitalize">
            {planName}
          </span>
        </div>
      </div>

      <div className="bg-border h-8 w-px"></div>

      {/* Credits Section - Show Paid and Free Credits */}
      <div className="flex items-center gap-1">
        {/* Paid Credits */}
        {paidCredits > 0 && (
          <div className="group flex items-center gap-2 rounded-lg px-2 py-1 transition-colors hover:bg-amber-500/10 dark:hover:bg-amber-500/15">
            <div className="rounded-full bg-amber-500/15 p-1 transition-colors group-hover:bg-amber-500/25 dark:bg-amber-500/20">
              <Shield className="h-3 w-3 text-amber-600 dark:text-amber-300" />
            </div>
            <div className="flex flex-col leading-none">
              <span className="text-muted-foreground text-[10px] font-semibold tracking-wider uppercase">
                Paid
              </span>
              <span className="text-foreground text-xs font-bold">
                {paidCredits.toLocaleString()}
              </span>
            </div>
          </div>
        )}

        {/* Free Credits */}
        <div className="group flex items-center gap-2 rounded-lg px-2 py-1 transition-colors hover:bg-emerald-500/10 dark:hover:bg-emerald-500/15">
          <div className="rounded-full bg-emerald-500/15 p-1 transition-colors group-hover:bg-emerald-500/25 dark:bg-emerald-500/20">
            <Clock className="h-3 w-3 text-emerald-600 dark:text-emerald-300" />
          </div>
          <div className="flex flex-col leading-none">
            <span className="text-muted-foreground text-[10px] font-semibold tracking-wider uppercase">
              Free
            </span>
            <span className="text-foreground text-xs font-bold">
              {freeCredits.toLocaleString()}
            </span>
          </div>
        </div>

        {/* Seasonal Credits - Only if present */}
        {seasonalCredits > 0 && (
          <div className="group flex items-center gap-2 rounded-lg px-2 py-1 transition-colors hover:bg-indigo-500/10 dark:hover:bg-indigo-500/15">
            <div className="rounded-full bg-indigo-500/15 p-1 transition-colors group-hover:bg-indigo-500/25 dark:bg-indigo-500/20">
              <Sparkles className="h-3 w-3 text-indigo-600 dark:text-indigo-300" />
            </div>
            <div className="flex flex-col leading-none">
              <span className="text-muted-foreground text-[10px] font-semibold tracking-wider uppercase">
                Seasonal
              </span>
              <span className="text-foreground text-xs font-bold">
                {seasonalCredits.toLocaleString()}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Low Balance Warning */}
      {(isLowBalance || isExpiringSoon) && (
        <>
          <div className="bg-border h-8 w-px"></div>
          <div className="flex h-8 w-8 animate-pulse items-center justify-center rounded-full bg-orange-500/15 dark:bg-orange-500/20">
            <AlertTriangle className="h-4 w-4 text-orange-500" />
          </div>
        </>
      )}
    </div>
  )
}
