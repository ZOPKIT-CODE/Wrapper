import { Calendar, Crown, AlertTriangle, Clock, Shield, Sparkles } from 'lucide-react';
import { useCreditStatusQuery, useSubscriptionCurrent } from '@/hooks/useSharedQueries';
import { formatDate } from '@/lib/utils';
import { cn } from '@/lib/utils';

interface BillingStatusNavbarProps {
  className?: string;
}

export function BillingStatusNavbar({ className }: BillingStatusNavbarProps) {
  // Fetch credit status
  const { data: creditResponse, isLoading: creditLoading } = useCreditStatusQuery();

  // Fetch subscription status using shared hook
  const { data: subscription, isLoading: subscriptionLoading } = useSubscriptionCurrent();

  const creditData = creditResponse?.data;
  const isLoading = creditLoading || subscriptionLoading;

  if (isLoading) {
    return (
      <div className={cn("flex items-center gap-3 px-3 py-2", className)}>
        <div className="animate-pulse flex items-center gap-2">
          <div className="w-4 h-4 bg-gray-300 rounded"></div>
          <div className="w-16 h-3 bg-gray-300 rounded"></div>
        </div>
        <div className="animate-pulse flex items-center gap-2">
          <div className="w-4 h-4 bg-gray-300 rounded"></div>
          <div className="w-12 h-3 bg-gray-300 rounded"></div>
        </div>
      </div>
    );
  }

  if (!creditData || !subscription) {
    return null;
  }

  const {
    availableCredits = 0,
    freeCredits = 0,
    paidCredits = 0,
    seasonalCredits = 0,
    creditExpiry,
    lowBalanceThreshold = 100,
  } = creditData;

  // Calculate expiry status early
  const isExpiringSoon = creditExpiry ? new Date(creditExpiry) < new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) : false;

  const isLowBalance = availableCredits <= lowBalanceThreshold;

  const getExpiryColor = () => {
    if (isExpiringSoon) return 'text-orange-600';
    return 'text-gray-600';
  };

  // Map plan IDs to proper plan names
  const planNameMap: Record<string, string> = {
    'free': 'Free',
    'starter': 'Starter',
    'professional': 'Professional',
    'premium': 'Premium',
    'enterprise': 'Enterprise',
    'standard': 'Standard',
    'credit_based': 'Free' // Map credit_based to Free as default
  };
  
  // Get plan name - prioritize mapping, fallback to capitalized plan ID, default to Free
  const planId = subscription.plan || 'free';
  const planName = planNameMap[planId] || 
                   (planId === 'credit_based' ? 'Free' : planId.charAt(0).toUpperCase() + planId.slice(1)) || 
                   'Free';

  return (
    <div className={cn("flex items-center gap-3 px-4 py-2 bg-white rounded-xl border border-gray-100 shadow-sm hover:shadow-md transition-all duration-300", className)}>
      {/* Subscription Plan Expiry - SHOWN FIRST */}
      {subscription?.currentPeriodEnd && (
        <div className="group flex items-center gap-2 px-2 py-1 rounded-lg hover:bg-gray-50 transition-colors cursor-help" title={`Plan ${subscription.plan === 'free' ? 'expires' : 'renews'} on ${formatDate(subscription.currentPeriodEnd)}`}>
          <Calendar className={cn("w-4 h-4 transition-transform group-hover:scale-110", getExpiryColor())} />
          <div className="flex flex-col leading-none">
            <span className="text-[10px] uppercase tracking-wider font-semibold text-gray-500">
              {subscription.plan === 'free' ? 'Expires' : 'Renews'}
            </span>
            <span className={cn("text-xs font-bold", getExpiryColor())}>
              {formatDate(subscription.currentPeriodEnd).split(',')[0]}
            </span>
          </div>
        </div>
      )}

      <div className="w-px h-8 bg-gray-100"></div>

      {/* Subscription Plan */}
      <div className="group flex items-center gap-2 px-2 py-1 rounded-lg hover:bg-purple-50 transition-colors">
        <div className="p-1 bg-purple-100 rounded-full group-hover:bg-purple-200 transition-colors">
          <Crown className="w-3 h-3 text-purple-600" />
        </div>
        <div className="flex flex-col leading-none">
          <span className="text-[10px] uppercase tracking-wider font-semibold text-gray-500">Plan</span>
          <span className="text-xs font-bold text-[#1B2E5A] capitalize">
            {planName}
          </span>
        </div>
      </div>

      <div className="w-px h-8 bg-gray-100"></div>

      {/* Credits Section - Show Paid and Free Credits */}
      <div className="flex items-center gap-1">
        {/* Paid Credits */}
        {paidCredits > 0 && (
          <div className="group flex items-center gap-2 px-2 py-1 rounded-lg hover:bg-amber-50 transition-colors">
            <div className="p-1 bg-amber-100 rounded-full group-hover:bg-amber-200 transition-colors">
              <Shield className="w-3 h-3 text-amber-600" />
            </div>
            <div className="flex flex-col leading-none">
              <span className="text-[10px] uppercase tracking-wider font-semibold text-gray-500">Paid</span>
              <span className="text-xs font-bold text-[#1B2E5A]">
                {paidCredits.toLocaleString()}
              </span>
            </div>
          </div>
        )}

        {/* Free Credits */}
        <div className="group flex items-center gap-2 px-2 py-1 rounded-lg hover:bg-emerald-50 transition-colors">
          <div className="p-1 bg-emerald-100 rounded-full group-hover:bg-emerald-200 transition-colors">
            <Clock className="w-3 h-3 text-emerald-600" />
          </div>
          <div className="flex flex-col leading-none">
            <span className="text-[10px] uppercase tracking-wider font-semibold text-gray-500">Free</span>
            <span className="text-xs font-bold text-[#1B2E5A]">
              {freeCredits.toLocaleString()}
            </span>
          </div>
        </div>

        {/* Seasonal Credits - Only if present */}
        {seasonalCredits > 0 && (
          <div className="group flex items-center gap-2 px-2 py-1 rounded-lg hover:bg-indigo-50 transition-colors">
            <div className="p-1 bg-indigo-100 rounded-full group-hover:bg-indigo-200 transition-colors">
              <Sparkles className="w-3 h-3 text-indigo-600" />
            </div>
            <div className="flex flex-col leading-none">
              <span className="text-[10px] uppercase tracking-wider font-semibold text-gray-500">Seasonal</span>
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
          <div className="w-px h-8 bg-gray-100"></div>
          <div className="flex items-center justify-center w-8 h-8 rounded-full bg-orange-50 animate-pulse">
            <AlertTriangle className="w-4 h-4 text-orange-500" />
          </div>
        </>
      )}
    </div>
  );
}
