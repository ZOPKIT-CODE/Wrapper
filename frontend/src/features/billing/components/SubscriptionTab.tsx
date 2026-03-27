import React from 'react'
import {
  Crown,
  CheckCircle,
  Calendar,
  Sparkles,
  TrendingUp,
  Coins,
  Clock,
  AlertTriangle,
  CreditCard as CreditCardLucide,
  ArrowRight,
  Zap,
  Activity
} from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { formatDate } from '@/lib/utils'
import {
  CreditBalanceIcon,
  StatsIcon
} from '@/components/common/billing/BillingIcons'
import type { DisplaySubscription } from '../hooks/useBilling'
import type { ApplicationPlan } from '@/types/pricing'

// ----------------------------------------------------------------------
// Interfaces & Types
// ----------------------------------------------------------------------

export interface CreditBalanceData {
  availableCredits?: number
  freeCredits?: number
  paidCredits?: number
  totalCredits?: number
  freeCreditsExpiry?: string
  creditExpiry?: string
}

export interface SubscriptionTabProps {
  displaySubscription: DisplaySubscription
  applicationPlans: ApplicationPlan[]
  creditBalance: CreditBalanceData | null | undefined
  setActiveTab: (tab: string) => void
}

const PLAN_NAME_MAP: Record<string, string> = {
  free: 'Free',
  starter: 'Starter',
  professional: 'Professional',
  premium: 'Premium',
  enterprise: 'Enterprise',
  standard: 'Standard',
  credit_based: 'Free'
}

function getPlanDisplayName(planId: string): string {
  return (
    PLAN_NAME_MAP[planId] ||
    (planId === 'credit_based' ? 'Free' : planId.charAt(0).toUpperCase() + planId.slice(1)) ||
    'Free'
  )
}

// ----------------------------------------------------------------------
// Main Component
// ----------------------------------------------------------------------

export function SubscriptionTab({
  displaySubscription,
  applicationPlans,
  creditBalance,
  setActiveTab
}: SubscriptionTabProps) {
  const planId = displaySubscription.plan || 'free'
  const currentPlan = applicationPlans.find((p) => p.id === planId)
  
  const availableCredits =
    displaySubscription.availableCredits ?? creditBalance?.availableCredits ?? 0
  const totalCredits = displaySubscription.totalCredits ?? creditBalance?.totalCredits ?? 0
  
  // Expiry Logic
  const freeCreditsExpiry =
    displaySubscription.freeCreditsExpiry ??
    creditBalance?.freeCreditsExpiry ??
    displaySubscription.currentPeriodEnd

  // Theme Constants (Light Blue/White)
  const isFree = displaySubscription.plan === 'free'
  
  return (
    <div className="space-y-4 font-sans text-slate-900">
      
      {/* --- Current Plan Card --- */}
      <Card className="group relative overflow-hidden rounded-3xl border border-blue-100 bg-white shadow-sm transition-all duration-300 hover:shadow-blue-100/50 hover:border-blue-200">
        {/* Background Decor */}
        <div className="absolute top-0 right-0 -mt-16 -mr-16 h-48 w-48 rounded-full bg-gradient-to-br from-blue-50 to-sky-50 opacity-50 blur-3xl transition-transform duration-500 group-hover:scale-110" />
        
        <CardHeader className="relative pb-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div
                className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl shadow-inner ${
                  isFree 
                    ? 'bg-slate-100 text-slate-500' 
                    : 'bg-gradient-to-br from-blue-500 to-blue-600 text-white shadow-blue-200'
                }`}
              >
                <Crown className="h-7 w-7" />
              </div>
              <div>
                <CardTitle className="text-xl font-bold tracking-tight text-[#1B2E5A]">
                  {getPlanDisplayName(planId)} Plan
                </CardTitle>
                <CardDescription className="flex items-center gap-2 text-slate-500 mt-1">
                  <span className={`inline-block h-2 w-2 rounded-full ${displaySubscription.status === 'active' ? 'bg-emerald-500' : 'bg-slate-400'}`} />
                  {displaySubscription.status ? displaySubscription.status.toUpperCase() : 'ACTIVE'}
                </CardDescription>
              </div>
            </div>
            
            <div className="flex items-end flex-col">
               {displaySubscription.plan !== 'free' ? (
                <>
                  <div className="flex items-baseline gap-1">
                    <span className="text-3xl font-bold text-blue-600">
                      ${displaySubscription.yearlyPrice || displaySubscription.monthlyPrice || '0.00'}
                    </span>
                    <span className="text-sm font-medium text-slate-400 uppercase tracking-wide">
                      / {displaySubscription.billingCycle || 'year'}
                    </span>
                  </div>
                  {displaySubscription.currentPeriodEnd && (
                     <p className="text-xs text-slate-400 mt-1 flex items-center gap-1">
                       <Clock className="w-3 h-3" />
                       Renews {formatDate(displaySubscription.currentPeriodEnd)}
                     </p>
                  )}
                </>
              ) : (
                <div className="text-right">
                  <span className="text-3xl font-bold text-slate-700">Free</span>
                </div>
              )}
            </div>
          </div>
        </CardHeader>
        
        <CardContent className="relative pt-0">
          <div className="mt-0 rounded-2xl bg-slate-50/50 p-4 border border-slate-100/50">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-3 gap-3">
              <h4 className="flex items-center gap-2 text-sm font-bold text-slate-800 uppercase tracking-wider">
                <Sparkles className="w-4 h-4 text-blue-500" />
                Current Features
              </h4>
              {isFree && (
                <Button
                  onClick={() => setActiveTab('plans')}
                  size="sm"
                  className="bg-[#1B2E5A] hover:bg-[#152449] text-white shadow-md shadow-blue-500/20 rounded-full px-6 transition-all hover:scale-105"
                  data-tour-feature="upgrade-plans"
                >
                  Upgrade Now <ArrowRight className="w-4 h-4 ml-1" />
                </Button>
              )}
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
              {(currentPlan?.features || ['Basic CRM tools', 'Limited support', 'Community Access', '1GB Storage'])
                .slice(0, 4)
                .map((feature, idx) => (
                  <div
                    key={idx}
                    className="flex items-center gap-3 rounded-lg bg-white p-3 shadow-sm border border-slate-100"
                  >
                    <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-100">
                       <CheckCircle className="h-3.5 w-3.5 text-emerald-600" />
                    </div>
                    <span className="text-sm font-medium text-slate-600 truncate">{feature}</span>
                  </div>
                ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* --- Plan Details, Stats & Credits --- */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        
        {/* Left Col: Subscription Details + Lifetime & Alerts inline */}
        <div className="lg:col-span-2">
           <Card className="h-full rounded-3xl border border-slate-100 bg-white shadow-sm overflow-hidden">
             <CardHeader className="pb-3 border-b border-slate-50 bg-slate-50/30">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-indigo-50 rounded-xl">
                    <TrendingUp className="w-5 h-5 text-indigo-500" />
                  </div>
                  <div>
                    <CardTitle className="text-base font-bold text-[#1B2E5A]">Subscription Details</CardTitle>
                    <CardDescription className="text-xs">Your plan configuration</CardDescription>
                  </div>
                </div>
             </CardHeader>
             <CardContent className="p-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                   <div className="group rounded-2xl border border-slate-100 bg-white p-3 transition-all hover:border-blue-100 hover:shadow-md hover:shadow-blue-50">
                      <div className="flex items-center gap-2 mb-1">
                        <Crown className="w-4 h-4 text-blue-500" />
                        <span className="text-xs font-semibold text-slate-400 uppercase">Tier</span>
                      </div>
                      <div className="text-lg font-bold text-slate-800">{getPlanDisplayName(planId)}</div>
                   </div>
                   <div className="group rounded-2xl border border-slate-100 bg-white p-3 transition-all hover:border-blue-100 hover:shadow-md hover:shadow-blue-50">
                      <div className="flex items-center gap-2 mb-1">
                        <CreditCardLucide className="w-4 h-4 text-blue-500" />
                        <span className="text-xs font-semibold text-slate-400 uppercase">Billing</span>
                      </div>
                      <div className="text-lg font-bold text-slate-800">
                        {displaySubscription.plan !== 'free' && displaySubscription.plan !== 'credit_based' ? (
                          <span>${(displaySubscription.billingCycle === 'monthly'
                            ? displaySubscription.monthlyPrice ?? currentPlan?.monthlyPrice ?? 0
                            : displaySubscription.yearlyPrice ?? displaySubscription.monthlyPrice ?? currentPlan?.annualPrice ?? 0
                          ).toFixed(2)} <span className="text-sm font-medium text-slate-400">/ {displaySubscription.billingCycle}</span></span>
                        ) : 'Free'}
                      </div>
                   </div>
                   {displaySubscription.currentPeriodEnd && (
                    <div className="group rounded-2xl border border-slate-100 bg-white p-3 transition-all hover:border-blue-100 hover:shadow-md hover:shadow-blue-50">
                        <div className="flex items-center gap-2 mb-1">
                          <Calendar className="w-4 h-4 text-blue-500" />
                          <span className="text-xs font-semibold text-slate-400 uppercase">
                            {isFree ? 'Expiration' : 'Renewal'}
                          </span>
                        </div>
                        <div className="text-lg font-bold text-slate-800">
                          {formatDate(displaySubscription.currentPeriodEnd)}
                        </div>
                    </div>
                   )}
                   {!isFree && (currentPlan?.freeCredits ?? 0) > 0 && (
                     <div className="rounded-2xl border border-indigo-100 bg-gradient-to-br from-indigo-50/50 to-white p-3">
                        <div className="flex items-center gap-2 mb-1">
                          <Zap className="w-4 h-4 text-indigo-500" />
                          <span className="text-xs font-semibold text-indigo-400 uppercase">Monthly Bonus</span>
                        </div>
                        <div className="text-lg font-bold text-indigo-900">
                          {(currentPlan?.freeCredits ?? 0).toLocaleString()} <span className="text-sm font-normal text-indigo-700">credits</span>
                        </div>
                     </div>
                   )}
                </div>
                {/* Lifetime Credits & System Alerts inside same card - no empty space */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4">
                  <div className="rounded-2xl border border-slate-100 bg-white shadow-sm flex items-center p-3 gap-3">
                    <div className="h-10 w-10 rounded-full bg-sky-50 flex items-center justify-center shrink-0">
                      <StatsIcon className="w-5 h-5 text-sky-500" />
                    </div>
                    <div>
                      <div className="text-xs font-medium text-slate-500">Lifetime Credits</div>
                      <div className="text-lg font-bold text-[#1B2E5A]">{totalCredits.toLocaleString()}</div>
                    </div>
                  </div>
                  <div className="rounded-2xl border border-slate-100 bg-white shadow-sm flex items-center p-3 gap-3">
                    <div className="h-10 w-10 rounded-full bg-amber-50 flex items-center justify-center shrink-0">
                      <AlertTriangle className="w-5 h-5 text-amber-500" />
                    </div>
                    <div>
                      <div className="text-xs font-medium text-slate-500">System Alerts</div>
                      <div className="text-lg font-bold text-[#1B2E5A]">{(displaySubscription.alerts ?? []).length} active</div>
                    </div>
                  </div>
                </div>
             </CardContent>
           </Card>
        </div>
        
        {/* Right Col: Credit Balance (Dynamic Hero Card) */}
        <div className="lg:col-span-1">
           <Card className="h-full rounded-3xl border-0 bg-gradient-to-br from-slate-900 to-slate-800 text-white shadow-xl shadow-slate-200 overflow-hidden relative flex flex-col justify-between">
              {/* Abstract shapes */}
              <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500 rounded-full mix-blend-overlay filter blur-3xl opacity-20 -translate-y-1/2 translate-x-1/2" />
              <div className="absolute bottom-0 left-0 w-48 h-48 bg-indigo-500 rounded-full mix-blend-overlay filter blur-3xl opacity-20 translate-y-1/2 -translate-x-1/2" />

              <CardHeader className="relative z-10 pb-0">
                 <div className="flex items-center justify-between mb-2">
                    <div className="p-2 bg-white/10 backdrop-blur-md rounded-xl border border-white/10">
                       <CreditBalanceIcon className="w-5 h-5 text-blue-200" />
                    </div>
                    {availableCredits < 100 && (
                      <Badge variant="destructive" className="bg-rose-500/20 text-rose-200 border-rose-500/30 hover:bg-rose-500/30">
                        Low Balance
                      </Badge>
                    )}
                 </div>
                 <CardTitle className="text-lg font-medium text-slate-300">Available Credits</CardTitle>
              </CardHeader>
              
              <CardContent className="relative z-10 pt-3 pb-4 flex-grow flex flex-col justify-end">
                 <div className="mb-4">
                    <div className="text-5xl font-bold tracking-tighter text-white mb-2">
                       {availableCredits.toLocaleString()}
                    </div>
                    <div className="flex items-center gap-2 text-sm text-slate-400">
                       <Activity className="w-4 h-4 text-emerald-400" />
                       <span>Total usage: {displaySubscription.usageThisPeriod ?? 0}</span>
                    </div>
                 </div>
                 {/* Breakdown Mini-Cards */}
                 <div className="space-y-2 mb-4">
                    <div className="flex items-center justify-between p-2.5 rounded-xl bg-white/5 border border-white/5 backdrop-blur-sm">
                       <div className="flex items-center gap-3">
                          <div className="w-1.5 h-1.5 rounded-full bg-blue-400 shadow-[0_0_8px_rgba(96,165,250,0.6)]" />
                          <span className="text-sm font-medium text-slate-200">Paid Credits</span>
                       </div>
                       <span className="font-bold text-white">{creditBalance?.paidCredits ?? 0}</span>
                    </div>
                    <div className="flex items-center justify-between p-2.5 rounded-xl bg-white/5 border border-white/5 backdrop-blur-sm">
                       <div className="flex items-center gap-3">
                          <div className="w-1.5 h-1.5 rounded-full bg-indigo-400" />
                          <span className="text-sm font-medium text-slate-200">Free Credits</span>
                       </div>
                       <span className="font-bold text-white">{creditBalance?.freeCredits ?? 0}</span>
                    </div>
                 </div>

                 {/* Action */}
                 <Button 
                    onClick={() => setActiveTab('plans')}
                    className="w-full bg-blue-500 hover:bg-blue-400 text-white border-0 shadow-lg shadow-blue-900/20 h-12 rounded-xl font-semibold transition-all active:scale-95"
                  >
                    <Coins className="w-4 h-4 mr-2" />
                    Top Up Credits
                 </Button>
                 
                 {/* Footer Info */}
                 {freeCreditsExpiry && (
                   <p className="text-[10px] text-center text-slate-500 mt-3">
                     Free credits expire on {formatDate(freeCreditsExpiry)}
                   </p>
                 )}
              </CardContent>
           </Card>
        </div>
      </div>

    </div>
  )
}