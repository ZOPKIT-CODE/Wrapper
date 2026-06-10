/**
 * Billing page data and actions.
 * Centralizes subscription, credit, billing history, timeline, and mutations.
 */

import { useState, useEffect, useCallback } from 'react'
import { useNavigate, useSearch } from '@tanstack/react-router'
import { useDashboardTabParam } from '@/hooks/useDashboardTabParam'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/lib/auth/cognito-auth'
import { toast } from 'sonner'

import { subscriptionAPI, creditAPI, setIdpTokenGetter, api } from '@/lib/api'
import { useSubscriptionCurrent } from '@/hooks/useSharedQueries'
import { applicationPlansFallback } from '../constants/billingPlans'
import { mapSubscriptionPlansResponse } from '../utils/mapSubscriptionPlansResponse'
import type {
  ApplicationPlan,
  CheckoutCurrency,
  CreditPricing,
} from '@/types/pricing'

/** Display subscription shape — subscription table fields only. Credit data comes from useCreditStatusQuery. */
export interface DisplaySubscription {
  plan: string
  status: string
  currentPeriodEnd: string
  amount?: number
  currency?: string
  billingCycle?: string
  monthlyPrice?: number
  yearlyPrice?: number
  [key: string]: unknown
}

function ensureValidSubscription(
  sub: DisplaySubscription | null | undefined
): DisplaySubscription | null {
  if (!sub) return null
  let validCurrentPeriodEnd = sub.currentPeriodEnd
  if (
    !validCurrentPeriodEnd ||
    isNaN(new Date(validCurrentPeriodEnd).getTime())
  ) {
    validCurrentPeriodEnd = new Date(
      Date.now() + 365 * 24 * 60 * 60 * 1000
    ).toISOString()
  }
  return { ...sub, currentPeriodEnd: validCurrentPeriodEnd }
}

const defaultDisplaySubscription: DisplaySubscription = {
  plan: 'free',
  status: 'active',
  currentPeriodEnd: new Date(
    Date.now() + 365 * 24 * 60 * 60 * 1000
  ).toISOString(),
  amount: 0,
  currency: 'USD',
}

const BILLING_PRICE_CURRENCY_KEY = 'wrapper.billing.price-currency'

const BILLING_PAGE_TABS = [
  'subscription',
  'topups',
  'plans',
  'history',
  'expiry',
] as const

function readStoredCheckoutCurrency(): CheckoutCurrency {
  try {
    if (typeof window === 'undefined') return 'usd'
    const v = localStorage.getItem(BILLING_PRICE_CURRENCY_KEY)
    if (v === 'inr' || v === 'usd') return v
  } catch {
    /* ignore */
  }
  return 'usd'
}

export function useBilling() {
  const navigate = useNavigate()
  const search = useSearch({ strict: false }) as Record<string, string>
  const queryClient = useQueryClient()

  const [selectedPlan, setSelectedPlan] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useDashboardTabParam({
    allowed: BILLING_PAGE_TABS,
    defaultTab: 'subscription',
  })
  const [checkoutCurrency, setCheckoutCurrencyState] =
    useState<CheckoutCurrency>(() => readStoredCheckoutCurrency())

  const setCheckoutCurrency = useCallback((c: CheckoutCurrency) => {
    setCheckoutCurrencyState(c)
    try {
      localStorage.setItem(BILLING_PRICE_CURRENCY_KEY, c)
    } catch {
      /* ignore */
    }
  }, [])
  const [isUpgrading, setIsUpgrading] = useState(false)
  const [needsOnboarding, setNeedsOnboarding] = useState(false)
  const [showCancelDialog, setShowCancelDialog] = useState(false)
  const [selectedPaymentForRefund, setSelectedPaymentForRefund] = useState<
    string | null
  >(null)
  const [refundReason, setRefundReason] = useState('')
  const [, setProfileCompleted] = useState<boolean | null>(null)
  const [, setIsCheckingProfile] = useState(false)

  const { isAuthenticated, isLoading, getToken, login } = useAuth()

  const upgradeMode = search['upgrade'] === 'true'
  const paymentCancelled = search['payment'] === 'cancelled'
  const paymentSuccess = search['payment'] === 'success'
  const mockMode = search['mock'] === 'true'

  useEffect(() => {
    if (isAuthenticated && !isLoading) {
      queryClient.invalidateQueries({ queryKey: ['subscription'] })
      queryClient.invalidateQueries({ queryKey: ['credit'] })
    }
  }, [isAuthenticated, isLoading, queryClient])

  useEffect(() => {
    if (paymentCancelled) {
      const params = new URLSearchParams(window.location.search)
      navigate({ to: `/payment-cancelled?${params.toString()}` })
    }
  }, [paymentCancelled, navigate])

  useEffect(() => {
    if (!isLoading && !isAuthenticated && !mockMode) {
      toast.error('Not authenticated. Please log in first.')
    }
  }, [isAuthenticated, isLoading, mockMode])

  useEffect(() => {
    if (getToken) {
      setIdpTokenGetter(async () => {
        try {
          const token = await getToken()
          return token || null
        } catch (error) {
          console.error('Auth token getter error:', error)
          return null
        }
      })
    }
  }, [getToken, isAuthenticated])

  useEffect(() => {
    if (paymentSuccess) {
      queryClient.invalidateQueries({ queryKey: ['subscription'] })
      queryClient.invalidateQueries({ queryKey: ['credit'] })
      queryClient.invalidateQueries({ queryKey: ['payments'] })
      localStorage.removeItem('trialExpired')
      window.dispatchEvent(new CustomEvent('paymentSuccess'))
      window.dispatchEvent(new CustomEvent('subscriptionUpgraded'))
      window.dispatchEvent(new CustomEvent('profileCompleted'))
      const params = new URLSearchParams(window.location.search)
      navigate({ to: `/payment-success?${params.toString()}` })
    }
  }, [paymentSuccess, queryClient, navigate])

  const {
    data: subscription,
    isLoading: subscriptionLoading,
    refetch: refetchSubscription,
  } = useSubscriptionCurrent()

  const { data: plansFromApi } = useQuery({
    queryKey: ['subscription', 'plans'],
    queryFn: async () => {
      const response = await subscriptionAPI.getAvailablePlans()
      const raw = response.data?.data ?? response.data
      return mapSubscriptionPlansResponse(raw)
    },
    enabled: isAuthenticated && !mockMode,
    retry: 1,
  })

  const applicationPlans: ApplicationPlan[] =
    plansFromApi && plansFromApi.length > 0
      ? plansFromApi
      : applicationPlansFallback

  const { data: creditPricing } = useQuery<CreditPricing>({
    queryKey: ['credit', 'pricing'],
    queryFn: async () => {
      const response = await creditAPI.getCreditPricing()
      return response.data.data
    },
    enabled: isAuthenticated && !mockMode,
    staleTime: 5 * 60 * 1000,
    retry: 1,
  })

  const { data: creditBalance, refetch: refetchCreditBalance } = useQuery({
    queryKey: ['credit', 'current'],
    queryFn: async () => {
      try {
        const response = await creditAPI.getCurrentBalance()
        return response.data.data
      } catch (error: unknown) {
        console.warn('Failed to fetch credit balance:', error)
        return {
          availableCredits: 0,
          freeCredits: 0,
          paidCredits: 0,
          totalCredits: 0,
        }
      }
    },
    enabled: isAuthenticated && !mockMode,
    retry: 1,
  })

  const { data: creditAllocations, isLoading: creditAllocationsLoading } =
    useQuery({
      queryKey: ['credit', 'allocations'],
      queryFn: async () => {
        try {
          const response = await creditAPI.getTenantAllocations()
          return response.data.data ?? []
        } catch (error: unknown) {
          console.warn('Failed to fetch credit allocations:', error)
          return []
        }
      },
      enabled: isAuthenticated && !mockMode,
      staleTime: 2 * 60 * 1000,
      retry: 1,
    })

  const { data: entityBalances, isLoading: entityBalancesLoading } = useQuery({
    queryKey: ['credit', 'entity-balances'],
    queryFn: async () => {
      try {
        const response = await creditAPI.getEntityBalances()
        return response.data.data ?? []
      } catch (error: unknown) {
        console.warn('Failed to fetch entity balances:', error)
        return []
      }
    },
    enabled: isAuthenticated && !mockMode,
    staleTime: 2 * 60 * 1000,
    retry: 1,
  })

  const { data: billingHistory, isLoading: billingHistoryLoading } = useQuery({
    queryKey: ['subscription', 'billing-history'],
    queryFn: async () => {
      try {
        const response = await subscriptionAPI.getBillingHistory()
        return response.data.data ?? []
      } catch (error: unknown) {
        console.warn('Failed to fetch billing history:', error)
        return []
      }
    },
    enabled: isAuthenticated && !mockMode,
    retry: 1,
  })

  const displaySubscription: DisplaySubscription =
    ensureValidSubscription(subscription as DisplaySubscription) ??
    defaultDisplaySubscription
  const displayBillingHistory = billingHistory ?? []

  const createCheckoutMutation = useMutation({
    mutationFn: async ({
      planId,
      currency,
    }: {
      planId: string
      currency: CheckoutCurrency
    }) => {
      if (mockMode) {
        await new Promise((r) => setTimeout(r, 2000))
        return {
          checkoutUrl: `https://checkout.stripe.com/pay/mock-${planId}-${currency}#test`,
        }
      }
      const response = await subscriptionAPI.createCheckout({
        planId,
        currency,
        successUrl: `${window.location.origin}/payment-success?type=credit_purchase&session_id={CHECKOUT_SESSION_ID}`,
        cancelUrl: `${window.location.origin}/billing?payment=cancelled`,
      })
      return response.data.data
    },
    onSuccess: (data) => {
      if (data?.checkoutUrl) {
        toast.success('Redirecting to secure payment page...', {
          duration: 2000,
        })
        setTimeout(() => {
          if (mockMode) setIsUpgrading(false)
          else window.location.href = data.checkoutUrl
        }, 1000)
      } else {
        toast.error('No checkout URL received from server')
        setIsUpgrading(false)
      }
    },
    onError: (
      error: unknown & {
        response?: { data?: { action?: string } }
        message?: string
      }
    ) => {
      if (
        (error as { response?: { data?: { action?: string } } })?.response?.data
          ?.action === 'redirect_to_onboarding'
      ) {
        setNeedsOnboarding(true)
        toast.error(
          'Please complete onboarding first to create a subscription.',
          { duration: 5000 }
        )
      } else {
        toast.error(
          (error as { message?: string }).message ??
            'Failed to create checkout session',
          { duration: 8000 }
        )
      }
      setIsUpgrading(false)
    },
  })

  const changePlanMutation = useMutation({
    mutationFn: async ({
      planId,
      currency,
    }: {
      planId: string
      currency: CheckoutCurrency
    }) => {
      const response = await subscriptionAPI.changePlan({
        planId,
        currency,
        billingCycle: 'yearly',
      })
      return response.data
    },
    onSuccess: (data) => {
      if (data?.checkoutUrl) {
        toast.success('Redirecting to secure payment page...', {
          duration: 2000,
        })
        setTimeout(() => (window.location.href = data.checkoutUrl), 1000)
      } else {
        toast.success(data?.message ?? 'Plan changed successfully!', {
          duration: 3000,
        })
        refetchSubscription()
        setIsUpgrading(false)
      }
    },
    onError: (
      error: unknown & { response?: { data?: { message?: string } } }
    ) => {
      toast.error(
        (error as { response?: { data?: { message?: string } } })?.response
          ?.data?.message ?? 'Failed to change plan'
      )
      setIsUpgrading(false)
    },
  })

  const refundMutation = useMutation({
    mutationFn: async ({
      paymentId,
      reason,
    }: {
      paymentId: string
      amount?: number
      reason?: string
    }) => {
      const response = await subscriptionAPI.processRefund({
        paymentId,
        reason,
      })
      return response.data
    },
    onSuccess: () => {
      toast.success('Refund processed successfully!', { duration: 3000 })
      setSelectedPaymentForRefund(null)
      queryClient.invalidateQueries({
        queryKey: ['subscription', 'billing-history'],
      })
    },
    onError: (
      error: unknown & { response?: { data?: { message?: string } } }
    ) => {
      toast.error(
        (error as { response?: { data?: { message?: string } } })?.response
          ?.data?.message ?? 'Failed to process refund'
      )
    },
  })

  const checkProfileStatus = async () => {
    try {
      setIsCheckingProfile(true)
      const response = await api.get('/payment-upgrade/profile-status')
      const status = response.data
      setProfileCompleted(status.profileCompleted)
      return status
    } catch (error) {
      console.error('Failed to check profile status:', error)
      setProfileCompleted(false)
      return { profileCompleted: false }
    } finally {
      setIsCheckingProfile(false)
    }
  }

  const handleCreditPurchase = async (creditAmount: number) => {
    if (!isAuthenticated) {
      login({ provider: 'google' })
      return
    }
    setSelectedPlan(`credits_${creditAmount}`)
    setIsUpgrading(true)
    try {
      const response = await creditAPI.purchaseCredits({
        creditAmount,
        paymentMethod: 'stripe',
        currency: 'USD',
      })
      if (response.data.data?.checkoutUrl) {
        window.location.href = response.data.data.checkoutUrl
      } else {
        toast.success('Credits purchased successfully!')
        queryClient.invalidateQueries({ queryKey: ['credit'] })
        queryClient.invalidateQueries({ queryKey: ['subscription'] })
      }
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } } }
      toast.error(err?.response?.data?.message ?? 'Failed to purchase credits')
    } finally {
      setIsUpgrading(false)
      setSelectedPlan(null)
    }
  }

  const handlePlanPurchase = async (planId: string) => {
    if (!isAuthenticated) {
      login({ provider: 'google' })
      return
    }
    setSelectedPlan(planId)
    setIsUpgrading(true)
    try {
      const selectedPlanData = applicationPlans.find((p) => p.id === planId)
      if (!selectedPlanData) throw new Error('Selected plan not found')
      const hasActiveSubscription =
        displaySubscription?.status === 'active' &&
        displaySubscription?.plan !== 'free'
      if (hasActiveSubscription) {
        try {
          const response = await subscriptionAPI.changePlan({
            planId,
            billingCycle: 'yearly',
            currency: checkoutCurrency,
          })
          const data = response.data.data
          if (data?.upgraded) {
            // In-place upgrade with prorated payment — redirect to success page
            queryClient.invalidateQueries({ queryKey: ['subscription'] })
            queryClient.invalidateQueries({ queryKey: ['credit'] })
            const params = new URLSearchParams({
              type: 'plan_upgrade',
              plan: data.plan || planId,
              previousPlan: data.previousPlan || '',
              previousPlanName: data.previousPlanName || '',
              amount: String(data.proratedAmount || 0),
              currency: data.currency || 'USD',
              prorated: 'true',
            })
            navigate({ to: `/payment-success?${params.toString()}` })
          } else if (data?.checkoutUrl) {
            window.location.href = data.checkoutUrl
          } else {
            toast.success('Plan changed successfully!')
            queryClient.invalidateQueries({ queryKey: ['subscription'] })
            queryClient.invalidateQueries({ queryKey: ['credit'] })
          }
        } catch {
          const response = await subscriptionAPI.createCheckout({
            planId,
            currency: checkoutCurrency,
            successUrl: `${window.location.origin}/payment-success?type=subscription&session_id={CHECKOUT_SESSION_ID}`,
            cancelUrl: `${window.location.origin}/billing?payment=cancelled&type=subscription`,
          })
          if (response.data.data?.checkoutUrl) {
            window.location.href = response.data.data.checkoutUrl
          } else {
            toast.success('Plan activated successfully!')
            queryClient.invalidateQueries({ queryKey: ['subscription'] })
            queryClient.invalidateQueries({ queryKey: ['credit'] })
          }
        }
      } else {
        const response = await subscriptionAPI.createCheckout({
          planId,
          currency: checkoutCurrency,
          successUrl: `${window.location.origin}/payment-success?type=subscription&session_id={CHECKOUT_SESSION_ID}`,
          cancelUrl: `${window.location.origin}/billing?payment=cancelled&type=subscription`,
        })
        if (response.data.data?.checkoutUrl) {
          window.location.href = response.data.data.checkoutUrl
        } else {
          toast.success('Plan activated successfully!')
          queryClient.invalidateQueries({ queryKey: ['subscription'] })
          queryClient.invalidateQueries({ queryKey: ['credit'] })
        }
      }
    } catch (error: unknown) {
      toast.error(
        (error as { response?: { data?: { message?: string } } })?.response
          ?.data?.message ?? 'Failed to purchase plan'
      )
    } finally {
      setIsUpgrading(false)
      setSelectedPlan(null)
    }
  }

  const handleUpgrade = async (planId: string) => {
    if (planId === 'free') {
      toast.error('You are already on the free plan')
      return
    }
    const status = await checkProfileStatus()
    if (status?.profileCompleted) {
      setSelectedPlan(planId)
      setIsUpgrading(true)
      toast.loading(`Setting up your ${planId} plan upgrade...`, {
        duration: 2000,
      })
      try {
        await createCheckoutMutation.mutateAsync({
          planId,
          currency: checkoutCurrency,
        })
      } catch {
        setIsUpgrading(false)
        toast.error('Payment failed. Please try again.')
      }
    } else {
      navigate({
        to: `/dashboard/billing/upgrade?plan=${planId}&currency=${checkoutCurrency}`,
      })
    }
  }

  return {
    // UI state
    activeTab,
    setActiveTab,
    checkoutCurrency,
    setCheckoutCurrency,
    selectedPlan,
    isUpgrading,
    showCancelDialog,
    setShowCancelDialog,
    selectedPaymentForRefund,
    setSelectedPaymentForRefund,
    refundReason,
    setRefundReason,
    // Auth / mode
    isAuthenticated,
    mockMode,
    upgradeMode,
    needsOnboarding,
    navigate,
    // Data
    displaySubscription,
    displayBillingHistory,
    creditPricing: creditPricing ?? null,
    applicationPlans,
    creditBalance,
    // Loading
    subscriptionLoading,
    billingHistoryLoading,
    creditAllocationsLoading,
    // Credit allocations (expiry schedule)
    creditAllocations,
    entityBalances,
    entityBalancesLoading,
    // Mutations
    createCheckoutMutation,
    changePlanMutation,
    refundMutation,
    // Handlers
    handleCreditPurchase,
    handlePlanPurchase,
    handleUpgrade,
    checkProfileStatus,
    refetchSubscription,
    refetchCreditBalance,
  }
}
