import React, { useEffect, useState, useRef } from 'react'
import { useNavigate, useSearch } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import {
  motion,
  Variants,
  useMotionValue,
  useSpring,
  useTransform,
} from 'framer-motion'
import {
  CreditCard,
  Users,
  Home,
  FileText,
  Zap,
  Coins,
  CheckCircle2,
  Sparkles,
  TrendingUp,
  Shield,
  Star,
  Download,
  Loader2,
} from 'lucide-react'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { subscriptionAPI, creditAPI } from '@/lib/api'
import { formatCurrency } from '@/lib/utils'
import { useUserContext } from '@/contexts/UserContextProvider'
import { generateInvoicePDF } from '@/lib/invoiceGenerator'
// @ts-expect-error - canvas-confetti doesn't have types
import confetti from 'canvas-confetti'

// Floating Particles Component
const FloatingParticles: React.FC = () => {
  const particles = Array.from({ length: 20 }, (_, i) => ({
    id: i,
    x: Math.random() * 100,
    y: Math.random() * 100,
    delay: Math.random() * 2,
    duration: 3 + Math.random() * 2,
  }))

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {particles.map((particle) => (
        <motion.div
          key={particle.id}
          className="absolute h-2 w-2 rounded-full bg-blue-400/30 blur-sm"
          initial={{
            x: `${particle.x}%`,
            y: `${particle.y}%`,
            opacity: 0,
          }}
          animate={{
            y: [`${particle.y}%`, `${particle.y - 20}%`, `${particle.y}%`],
            x: [
              `${particle.x}%`,
              `${particle.x + (Math.random() - 0.5) * 10}%`,
              `${particle.x}%`,
            ],
            opacity: [0, 0.6, 0],
          }}
          transition={{
            duration: particle.duration,
            delay: particle.delay,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
        />
      ))}
    </div>
  )
}

// Shimmer Effect Component
const Shimmer: React.FC<{ className?: string }> = ({ className = '' }) => (
  <motion.div
    className={`absolute inset-0 bg-gradient-to-r from-transparent via-white/60 to-transparent ${className}`}
    animate={{
      x: ['-100%', '200%'],
    }}
    transition={{
      duration: 2,
      repeat: Infinity,
      ease: 'linear',
    }}
  />
)

// Fire canvas-confetti burst on payment success (full viewport)
function fireConfettiBurst() {
  const confettiFn =
    typeof confetti === 'function'
      ? confetti
      : (confetti as { default?: typeof confetti })?.default
  if (!confettiFn) return
  const duration = 2500
  const end = Date.now() + duration
  const colors = ['#3b82f6', '#2563eb', '#1d4ed8', '#60a5fa', '#93c5fd']

  ;(function frame() {
    confettiFn({
      particleCount: 4,
      angle: 60,
      spread: 55,
      origin: { x: 0 },
      colors,
    })
    confettiFn({
      particleCount: 4,
      angle: 120,
      spread: 55,
      origin: { x: 1 },
      colors,
    })
    if (Date.now() < end) requestAnimationFrame(frame)
  })()
  // One big burst from center
  setTimeout(() => {
    confettiFn({
      particleCount: 100,
      spread: 100,
      origin: { y: 0.6 },
      colors,
    })
  }, 100)
}

// Helper component for counting up numbers with enhanced animation
const CountUp: React.FC<{ end: number; prefix?: string; suffix?: string }> = ({
  end,
  prefix = '',
  suffix = '',
}) => {
  const [count, setCount] = useState(0)
  const spring = useSpring(0, { stiffness: 100, damping: 30 })
  const display = useTransform(spring, (current) => Math.floor(current))

  useEffect(() => {
    spring.set(end)
  }, [end, spring])

  useEffect(() => {
    return display.onChange((latest) => setCount(latest))
  }, [display])

  return (
    <motion.span
      initial={{ scale: 0.8, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ duration: 0.3 }}
    >
      {prefix}
      {count.toLocaleString()}
      {suffix}
    </motion.span>
  )
}

const PaymentSuccess: React.FC = () => {
  const navigate = useNavigate()
  const search = useSearch({ strict: false }) as Record<string, string>
  const { tenant, user } = useUserContext()
  const confettiFiredRef = useRef(false)
  const cardRef = useRef<HTMLDivElement>(null)

  // Safety timeout: if the payment details API keeps failing (e.g. DB migration
  // not run, webhook hasn't fired yet), show the success page anyway after 8s.
  // The payment DID succeed at Stripe — this page only fetches receipt details.
  const [timedOut, setTimedOut] = useState(false)
  const [isDownloading, setIsDownloading] = useState(false)
  useEffect(() => {
    const t = setTimeout(() => setTimedOut(true), 8000)
    return () => clearTimeout(t)
  }, [])

  // Mouse position tracking for parallax effect (must be at top level for consistent hook order)
  const mouseX = useMotionValue(0)
  const mouseY = useMotionValue(0)
  const x = useTransform(mouseX, [0, 1], [-10, 10])
  const y = useTransform(mouseY, [0, 1], [-10, 10])

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (cardRef.current) {
        const rect = cardRef.current.getBoundingClientRect()
        mouseX.set((e.clientX - rect.left) / rect.width)
        mouseY.set((e.clientY - rect.top) / rect.height)
      }
    }

    window.addEventListener('mousemove', handleMouseMove)
    return () => window.removeEventListener('mousemove', handleMouseMove)
  }, [mouseX, mouseY])

  // Animations variants for cards
  const containerVariants: Variants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.15,
        delayChildren: 0.2,
      },
    },
  }

  const itemVariants: Variants = {
    hidden: { y: 30, opacity: 0, scale: 0.95 },
    visible: {
      y: 0,
      opacity: 1,
      scale: 1,
      transition: {
        type: 'spring',
        stiffness: 120,
        damping: 14,
      },
    },
  }

  const floatingVariants: Variants = {
    animate: {
      y: [0, -10, 0],
      transition: {
        duration: 3,
        repeat: Infinity,
        ease: 'easeInOut',
      },
    },
  }

  // Get payment details from URL parameters
  const sessionId = search['session_id']
  const urlPaymentType = search['type']

  // Determine payment type
  const determinePaymentType = () => {
    if (
      urlPaymentType &&
      ['subscription', 'credit_purchase', 'plan_upgrade'].includes(
        urlPaymentType
      )
    ) {
      return urlPaymentType
    }
    if (sessionId) {
      if (sessionId.startsWith('mock_session_')) {
        return search['plan'] ? 'subscription' : 'credit_purchase'
      }
      return 'subscription'
    }
    return 'subscription'
  }

  const paymentType = determinePaymentType()

  // Plan upgrade details from URL params (no checkout session involved)
  const planUpgradeDetails =
    paymentType === 'plan_upgrade'
      ? {
          plan: search['plan'] || '',
          previousPlan: search['previousPlan'] || '',
          previousPlanName:
            search['previousPlanName'] || search['previousPlan'] || '',
          amount: parseFloat(search['amount'] || '0'),
          currency: search['currency'] || 'USD',
          prorated: search['prorated'] === 'true',
        }
      : null

  // Fetch payment details — retry aggressively because the webhook may not have
  // created the payment record yet when we first land on this page.
  // Skip fetching for plan_upgrade (details come from URL params, not a session).
  const {
    data: paymentData,
    isLoading: paymentLoading,
    error: paymentError,
  } = useQuery({
    queryKey: ['payment', sessionId, paymentType],
    queryFn: async () => {
      if (!sessionId) throw new Error('Session ID is required')
      if (paymentType === 'subscription') {
        return await subscriptionAPI.getPaymentDetailsBySession(sessionId)
      } else {
        return await creditAPI.getPaymentDetails(sessionId)
      }
    },
    enabled: !!sessionId && !timedOut && paymentType !== 'plan_upgrade',
    retry: 5,
    retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 8000),
  })

  const { data: subscriptionData, isLoading: subscriptionLoading } = useQuery({
    queryKey: ['subscription'],
    queryFn: () => subscriptionAPI.getCurrent(),
    enabled: paymentType === 'subscription',
  })

  const { data: creditData, isLoading: creditLoading } = useQuery({
    queryKey: ['credit'],
    queryFn: () => creditAPI.getCurrentBalance(),
    enabled: !!sessionId,
    refetchInterval: paymentType === 'subscription' ? 2000 : false, // Refetch credits every 2s for subscription so UI updates when webhook allocates plan credits
    refetchIntervalInBackground: true,
  })

  // Unwrap API responses
  const rawPayload = paymentData?.data
  const paymentDetails =
    rawPayload?.success === true ? rawPayload.data : rawPayload

  const subscription =
    subscriptionData?.data?.success === true
      ? subscriptionData.data.data
      : subscriptionData?.data
  const creditBalance =
    creditData?.data?.success === true ? creditData.data.data : creditData?.data

  const paymentInfo = paymentDetails

  // For subscription success, show the plan they just paid for (from receipt) so "Current Plan" is correct
  // even if the webhook hasn't updated the subscription yet.
  const effectivePlan =
    paymentType === 'plan_upgrade' && planUpgradeDetails?.plan
      ? planUpgradeDetails.plan
      : paymentType === 'subscription' && paymentInfo?.planId
        ? paymentInfo.planId
        : subscription?.plan || 'free'

  // Store previous state for comparison
  const getPreviousState = () => {
    if (paymentType === 'plan_upgrade' && planUpgradeDetails) {
      const currentCredits = Number(creditBalance?.availableCredits || 0)
      return {
        credits: currentCredits,
        paidCredits: Number(creditBalance?.paidCredits || 0),
        freeCredits: Number(creditBalance?.freeCredits || 0),
        plan:
          planUpgradeDetails.previousPlanName ||
          planUpgradeDetails.previousPlan,
      }
    }

    if (!creditBalance || !paymentInfo) return null

    const currentCredits = Number(creditBalance?.availableCredits || 0)
    const currentPaidCredits = Number(creditBalance?.paidCredits || 0)
    const currentFreeCredits = Number(creditBalance?.freeCredits || 0)

    if (paymentType === 'credit_purchase') {
      const creditsAdded =
        Number(paymentInfo.credits ?? paymentInfo.creditsAdded ?? 0) ||
        (paymentInfo.amount != null
          ? Math.floor(Number(paymentInfo.amount) * 100)
          : 0)
      return {
        credits: Math.max(0, currentCredits - creditsAdded),
        paidCredits: Math.max(0, currentPaidCredits - creditsAdded),
        freeCredits: currentFreeCredits,
        plan: subscription?.plan || 'free',
      }
    }

    if (paymentType === 'subscription') {
      const planHierarchy = ['free', 'starter', 'professional', 'enterprise']
      const currentIndex = planHierarchy.indexOf(effectivePlan)
      const previousPlan =
        currentIndex > 0 ? planHierarchy[currentIndex - 1] : 'free'

      return {
        credits: currentCredits,
        paidCredits: currentPaidCredits,
        freeCredits: currentFreeCredits,
        plan: previousPlan,
      }
    }

    return null
  }

  const previousState = getPreviousState()
  const creditsFromPayment =
    paymentType === 'credit_purchase'
      ? (paymentInfo?.credits ?? paymentInfo?.creditsAdded ?? 0)
      : 0

  const currentState = creditBalance
    ? {
        credits:
          Number(creditBalance?.availableCredits || 0) ||
          Number(creditsFromPayment),
        paidCredits:
          Number(creditBalance?.paidCredits || 0) || Number(creditsFromPayment),
        freeCredits: Number(creditBalance?.freeCredits || 0),
        plan: effectivePlan,
      }
    : creditsFromPayment
      ? {
          credits: Number(creditsFromPayment),
          paidCredits: Number(creditsFromPayment),
          freeCredits: 0,
          plan: effectivePlan,
        }
      : paymentType === 'plan_upgrade'
        ? {
            credits: 0,
            paidCredits: 0,
            freeCredits: 0,
            plan: effectivePlan,
          }
        : null

  const planDetails =
    paymentType === 'plan_upgrade' && planUpgradeDetails
      ? {
          name:
            planUpgradeDetails.plan.charAt(0).toUpperCase() +
            planUpgradeDetails.plan.slice(1),
          price: planUpgradeDetails.amount,
          billingCycle: 'yearly',
          features: [],
          subscription: null,
        }
      : paymentInfo && paymentType === 'subscription'
        ? {
            name: paymentInfo.planName || paymentInfo.planId,
            price: paymentInfo.amount,
            billingCycle: paymentInfo.billingCycle,
            features: paymentInfo.features || [],
            subscription: paymentInfo.subscription,
          }
        : null

  const companyName = tenant?.companyName || 'your organization'

  const handleDownloadInvoice = async () => {
    if (!paymentInfo) return
    setIsDownloading(true)
    await new Promise<void>((resolve) =>
      requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
    )
    try {
      generateInvoicePDF(
        {
          id:
            paymentInfo.stripePaymentIntentId ||
            paymentInfo.transactionId ||
            sessionId ||
            '',
          type:
            paymentInfo.paymentType ||
            (paymentType === 'credit_purchase'
              ? 'credit_purchase'
              : 'subscription'),
          status: paymentInfo.status,
          description: paymentInfo.description,
          amount: paymentInfo.amount ?? 0,
          paidAt:
            paymentInfo.paidAt ||
            paymentInfo.processedAt ||
            paymentInfo.createdAt,
          createdAt: paymentInfo.createdAt,
          invoiceNumber: paymentInfo.invoiceNumber,
          paymentMethod: paymentInfo.paymentMethod,
          paymentMethodDetails: paymentInfo.paymentMethodDetails,
          taxAmount: paymentInfo.taxAmount,
          planDisplayName: paymentInfo.planName || paymentInfo.planId,
          billingCycle: paymentInfo.billingCycle,
          currency: paymentInfo.currency,
          stripePaymentIntentId: paymentInfo.stripePaymentIntentId,
          stripeInvoiceId: paymentInfo.stripeInvoiceId,
        } as any,
        {
          name: user?.name || user?.email || '',
          email: user?.email || '',
          companyName: tenant?.companyName || '',
        }
      )
    } finally {
      setIsDownloading(false)
    }
  }

  // Show success if we have payment data OR if we timed out waiting for it.
  // The payment succeeded at Stripe regardless — this page is just a receipt.
  // For plan_upgrade, we always show success (details come from URL params).
  const isSuccessView =
    paymentType === 'plan_upgrade' ||
    (!!sessionId &&
      // Normal path: all data loaded
      ((!paymentLoading &&
        !subscriptionLoading &&
        !(paymentType === 'credit_purchase' && creditLoading) &&
        !paymentError &&
        !!paymentData) ||
        // Timeout path: show success anyway (receipt details may be missing)
        timedOut))

  // Fire confetti once when success content is shown (must be before any return to keep hook order consistent)
  useEffect(() => {
    if (isSuccessView && !confettiFiredRef.current) {
      confettiFiredRef.current = true
      // Small delay so the success view is painted before confetti runs
      const t = setTimeout(() => {
        fireConfettiBurst()
      }, 300)
      return () => clearTimeout(t)
    }
  }, [isSuccessView])

  if (
    !isSuccessView &&
    !timedOut &&
    (paymentLoading ||
      subscriptionLoading ||
      (paymentType === 'credit_purchase' && creditLoading))
  ) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="text-center">
          <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-4 border-[#1B2E5A] border-t-transparent"></div>
          <p className="font-bold text-slate-600">Confirming payment...</p>
        </div>
      </div>
    )
  }

  if (!isSuccessView && (paymentError || !sessionId)) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
        <Card className="w-full max-w-md border-red-100 shadow-xl">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-red-50 text-red-500">
              <Zap className="h-8 w-8" />
            </div>
            <CardTitle className="text-red-900">Payment Error</CardTitle>
            <CardDescription>
              {paymentError instanceof Error
                ? paymentError.message
                : 'Missing session information'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              onClick={() => navigate({ to: '/dashboard/billing' })}
              className="w-full rounded-xl bg-[#1B2E5A] py-6 font-bold text-white hover:bg-[#162447]"
            >
              Return to Billing
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  const CelebrationCard = () => (
    <div
      className="perspective-1000 relative mx-auto mt-12 mb-3 w-full max-w-md"
      ref={cardRef}
    >
      <FloatingParticles />
      <motion.div
        initial={{ scale: 0.5, opacity: 0, rotateX: 20 }}
        animate={{ scale: 1, opacity: 1, rotateX: 0 }}
        transition={{ type: 'spring', stiffness: 260, damping: 20 }}
        style={{ x, y }}
        className="group relative z-10 overflow-visible rounded-[2.5rem] border-r-4 border-b-4 border-[#1B2E5A]/20 bg-[#1B2E5A]/5 px-6 pt-10 pb-6 text-center shadow-[0_40px_80px_-15px_rgba(59,130,246,0.2)]"
      >
        {/* Animated Background Gradient */}
        <div className="absolute inset-0 rounded-[2.5rem] bg-gradient-to-br from-blue-100/50 via-transparent to-blue-50/30 opacity-50 transition-opacity duration-500 group-hover:opacity-75" />
        <Shimmer className="rounded-[2.5rem]" />

        {/* Ribbon with enhanced animation */}
        <motion.div
          className="absolute -top-4 left-1/2 z-20 flex w-[115%] -translate-x-1/2 items-center justify-center"
          initial={{ y: -50, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
        >
          <div className="h-8 w-6 translate-x-2 translate-y-5 skew-y-12 transform rounded-l-sm bg-gradient-to-b from-blue-700 to-blue-800 shadow-lg" />
          <motion.div
            className="relative flex items-center justify-center rounded-xl bg-[#1B2E5A] px-8 py-2.5 text-lg font-black text-white shadow-2xl"
            whileHover={{ scale: 1.05 }}
            animate={{
              boxShadow: [
                '0 20px 40px -12px rgba(59, 130, 246, 0.4)',
                '0 25px 50px -12px rgba(59, 130, 246, 0.5)',
                '0 20px 40px -12px rgba(59, 130, 246, 0.4)',
              ],
            }}
            transition={{ duration: 2, repeat: Infinity }}
          >
            <motion.span
              className="relative z-10 drop-shadow-lg"
              animate={{ scale: [1, 1.05, 1] }}
              transition={{ duration: 2, repeat: Infinity }}
            >
              {paymentType === 'credit_purchase'
                ? 'Credits Added!'
                : 'Plan Upgraded!'}
            </motion.span>
            <div className="absolute top-1 right-2 bottom-1 left-2 rounded-lg border-2 border-dashed border-white/20" />
            <Sparkles className="absolute -top-2 -right-2 h-6 w-6 animate-pulse text-yellow-400" />
          </motion.div>
          <div className="h-8 w-6 -translate-x-2 translate-y-5 -skew-y-12 transform rounded-r-sm bg-gradient-to-b from-blue-700 to-blue-800 shadow-lg" />
        </motion.div>

        <div className="relative z-10 mt-2">
          <motion.p
            className="mb-1 text-base font-black tracking-[0.15em] text-[#1B2E5A] uppercase"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
          >
            {paymentType === 'credit_purchase' ? (
              <>
                <span className="mr-2">Unlocked</span>
                <CountUp end={currentState?.credits ?? 0} /> Credits
              </>
            ) : (
              `Congratulations, ${companyName}!`
            )}
          </motion.p>
          {(paymentType === 'subscription' || paymentType === 'plan_upgrade') &&
            planDetails?.name && (
              <motion.p
                className="mb-3 text-sm font-bold tracking-wider text-slate-500 uppercase"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.5 }}
              >
                Welcome to {planDetails.name}
              </motion.p>
            )}

          <motion.div
            className="relative mx-auto mb-3 h-28 w-28 lg:h-32 lg:w-32"
            variants={floatingVariants}
            animate="animate"
          >
            {/* Multiple glow layers */}
            <motion.div
              className="absolute inset-0 rounded-full bg-blue-400/30 blur-3xl"
              animate={{ scale: [1, 1.2, 1], opacity: [0.3, 0.5, 0.3] }}
              transition={{ duration: 3, repeat: Infinity }}
            />
            <motion.div
              className="absolute inset-0 rounded-full bg-blue-500/20 blur-2xl"
              animate={{ scale: [1, 1.3, 1], opacity: [0.2, 0.4, 0.2] }}
              transition={{ duration: 2.5, repeat: Infinity, delay: 0.5 }}
            />

            <div className="absolute relative inset-2 flex items-center justify-center overflow-hidden rounded-full border-4 border-white bg-gradient-to-tr from-white via-blue-50 to-white shadow-inner">
              <Shimmer />
              <motion.div
                animate={{ rotate: [0, 360] }}
                transition={{ duration: 20, repeat: Infinity, ease: 'linear' }}
              >
                <Coins
                  className="h-14 w-14 text-blue-500 drop-shadow-xl lg:h-16 lg:w-16"
                  fill="currentColor"
                />
              </motion.div>
            </div>

            <motion.div
              initial={{ scale: 0, rotate: -180 }}
              animate={{ scale: 1, rotate: 0 }}
              whileHover={{ scale: 1.1, rotate: 360 }}
              transition={{
                delay: 0.5,
                type: 'spring',
                stiffness: 200,
                duration: 0.5,
              }}
              className="absolute right-1 bottom-1 flex h-10 w-10 items-center justify-center rounded-full border-4 border-white bg-[#1B2E5A] text-xl font-black text-white shadow-2xl"
            >
              $
            </motion.div>

            {/* Orbiting stars */}
            {[0, 120, 240].map((angle, i) => (
              <motion.div
                key={i}
                className="absolute h-3 w-3"
                style={{
                  top: '50%',
                  left: '50%',
                  originX: 0.5,
                  originY: 0.5,
                }}
                animate={{
                  rotate: [angle, angle + 360],
                  x: [0, Math.cos((angle * Math.PI) / 180) * 80],
                  y: [0, Math.sin((angle * Math.PI) / 180) * 80],
                }}
                transition={{
                  duration: 4,
                  repeat: Infinity,
                  ease: 'linear',
                  delay: i * 0.3,
                }}
              >
                <Star className="h-3 w-3 fill-blue-400 text-blue-400" />
              </motion.div>
            ))}
          </motion.div>

          <motion.h2
            className="mb-2 text-xl font-black tracking-tight text-[#1B2E5A]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.6 }}
          >
            The All-in-One Platform
          </motion.h2>
          <motion.p
            className="mx-auto mb-3 max-w-xs text-xs leading-relaxed font-medium text-slate-500"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.7 }}
          >
            Your workspace is now supercharged with new capabilities and
            increased limits.
          </motion.p>

          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.8, type: 'spring' }}
          >
            <Badge className="group relative overflow-hidden rounded-full border-0 bg-gradient-to-r from-blue-100 to-blue-200 px-4 py-1.5 text-[10px] font-black tracking-widest text-blue-700 uppercase shadow-md hover:from-blue-200 hover:to-blue-300">
              <Shimmer />
              <span className="relative z-10 flex items-center gap-1.5">
                <CheckCircle2 className="h-2.5 w-2.5" />
                {paymentType === 'credit_purchase'
                  ? 'Transaction Complete'
                  : 'Active Subscription'}
              </span>
            </Badge>
          </motion.div>
        </div>
      </motion.div>
      <motion.div
        className="absolute right-10 -bottom-6 left-10 h-12 rounded-full bg-blue-200/30 blur-3xl"
        animate={{ opacity: [0.3, 0.5, 0.3] }}
        transition={{ duration: 3, repeat: Infinity }}
      />
    </div>
  )

  return (
    <div className="relative flex h-screen flex-col overflow-hidden bg-gradient-to-br from-slate-50 via-blue-50/30 to-slate-50 font-sans selection:bg-blue-100 selection:text-blue-900">
      {/* Animated background elements */}
      <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
        <motion.div
          className="absolute top-20 left-10 h-72 w-72 rounded-full bg-blue-200/20 blur-3xl"
          animate={{
            x: [0, 100, 0],
            y: [0, 50, 0],
            scale: [1, 1.2, 1],
          }}
          transition={{ duration: 20, repeat: Infinity, ease: 'easeInOut' }}
        />
        <motion.div
          className="absolute right-10 bottom-20 h-96 w-96 rounded-full bg-blue-300/10 blur-3xl"
          animate={{
            x: [0, -80, 0],
            y: [0, -40, 0],
            scale: [1, 1.3, 1],
          }}
          transition={{
            duration: 25,
            repeat: Infinity,
            ease: 'easeInOut',
            delay: 1,
          }}
        />
      </div>

      <motion.div
        className="relative z-10 container mx-auto min-h-0 flex-1 overflow-x-hidden overflow-y-auto px-4 py-3 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        variants={containerVariants}
        initial="hidden"
        animate="visible"
      >
        <div className="mx-auto max-w-4xl">
          <CelebrationCard />

          <div className="mt-12 grid gap-3 lg:grid-cols-12 lg:gap-4">
            {/* Main Stats Column */}
            <div className="space-y-3 lg:col-span-8 lg:space-y-4">
              {/* Summary Card */}
              <motion.div variants={itemVariants}>
                <Card className="group relative overflow-hidden rounded-[2rem] border-0 bg-white shadow-2xl shadow-slate-200/50 transition-all duration-500 hover:shadow-blue-100/50">
                  {/* Animated border gradient */}
                  <div className="absolute inset-0 rounded-[2rem] bg-gradient-to-r from-blue-500/0 via-blue-500/10 to-blue-500/0 opacity-0 transition-opacity duration-500 group-hover:opacity-100" />
                  <Shimmer className="rounded-[2rem] opacity-0 group-hover:opacity-100" />

                  <CardHeader className="relative z-10 border-b border-slate-100 bg-gradient-to-br from-slate-50/80 to-white p-4 pb-3 lg:p-5">
                    <div className="flex items-center justify-between gap-4">
                      <div className="min-w-0">
                        <CardTitle className="flex items-center gap-2 text-lg font-black tracking-tight text-[#1B2E5A]">
                          <motion.div
                            className="shrink-0 rounded-lg bg-gradient-to-br from-blue-600 to-blue-700 p-1.5 text-white shadow-lg"
                            whileHover={{ rotate: 360, scale: 1.1 }}
                            transition={{ duration: 0.5 }}
                          >
                            <Zap className="h-5 w-5" />
                          </motion.div>
                          Account Updated
                        </CardTitle>
                        <CardDescription className="mt-0.5 flex items-center gap-1.5 text-[10px] font-bold tracking-widest text-slate-500 uppercase">
                          <TrendingUp className="h-2.5 w-2.5 shrink-0" />
                          {paymentType === 'subscription'
                            ? 'Plan Details'
                            : 'Credit Balance Change'}
                        </CardDescription>
                      </div>
                      {currentState && (
                        <motion.div
                          className="shrink-0 text-right"
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          transition={{ delay: 0.5, type: 'spring' }}
                        >
                          <p className="mb-0.5 text-[9px] font-black tracking-widest text-slate-400 uppercase">
                            New Total
                          </p>
                          <motion.p
                            className="text-2xl font-black tracking-tighter text-[#1B2E5A]"
                            animate={{ scale: [1, 1.05, 1] }}
                            transition={{ duration: 2, repeat: Infinity }}
                          >
                            <CountUp end={currentState.credits} />
                          </motion.p>
                        </motion.div>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent className="p-4 pt-4 lg:p-5">
                    <div className="grid items-start gap-4 md:grid-cols-2 lg:gap-6">
                      {/* Previous State */}
                      <div className="space-y-2.5">
                        <h3 className="mb-2 flex items-center gap-1.5 text-[9px] font-black tracking-[0.2em] text-slate-400 uppercase">
                          <div className="h-1.5 w-1.5 shrink-0 rounded-full bg-slate-300" />
                          Previous State
                        </h3>
                        <div className="space-y-2">
                          {previousState && (
                            <>
                              <div className="group flex items-center justify-between gap-3 rounded-xl border border-slate-100 bg-slate-50 p-3 transition-colors hover:bg-slate-100">
                                <span className="shrink-0 text-xs font-bold text-slate-500 group-hover:text-slate-700">
                                  Total Credits
                                </span>
                                <span className="text-sm font-black text-slate-400 tabular-nums group-hover:text-slate-600">
                                  {previousState.credits.toLocaleString()}
                                </span>
                              </div>
                              <div className="group flex items-center justify-between gap-3 rounded-xl border border-slate-100 bg-slate-50 p-3 transition-colors hover:bg-slate-100">
                                <span className="shrink-0 text-xs font-bold text-slate-500 group-hover:text-slate-700">
                                  Plan Status
                                </span>
                                <span className="text-xs font-black text-slate-400 uppercase group-hover:text-slate-600">
                                  {previousState.plan}
                                </span>
                              </div>
                            </>
                          )}
                        </div>
                      </div>

                      {/* New Balance */}
                      <div className="space-y-2.5">
                        <h3 className="mb-2 flex items-center gap-1.5 text-[9px] font-black tracking-[0.2em] text-blue-600 uppercase">
                          <div className="h-1.5 w-1.5 shrink-0 animate-pulse rounded-full bg-[#1B2E5A]" />
                          New Balance
                        </h3>
                        <div className="space-y-2">
                          {currentState && (
                            <>
                              <motion.div
                                className="group relative flex items-center justify-between gap-3 overflow-hidden rounded-xl border-2 border-[#1B2E5A]/20 bg-[#1B2E5A]/5 p-3 shadow-lg shadow-blue-100/50"
                                whileHover={{
                                  scale: 1.02,
                                  borderColor: 'rgb(59 130 246)',
                                }}
                                initial={{ x: 20, opacity: 0 }}
                                animate={{ x: 0, opacity: 1 }}
                                transition={{ delay: 0.3 }}
                              >
                                <Shimmer className="rounded-xl" />
                                <div className="relative z-10 min-w-0">
                                  <span className="flex items-center gap-1.5 text-xs font-bold text-blue-700">
                                    <Shield className="h-2.5 w-2.5 shrink-0" />
                                    Total Credits
                                  </span>
                                  {currentState.credits -
                                    (previousState?.credits || 0) >
                                    0 && (
                                    <motion.div
                                      className="mt-0.5 flex items-center gap-1.5"
                                      initial={{ scale: 0 }}
                                      animate={{ scale: 1 }}
                                      transition={{
                                        delay: 0.5,
                                        type: 'spring',
                                      }}
                                    >
                                      <span className="rounded-full border border-[#1B2E5A]/20 bg-white/90 px-1.5 py-0.5 text-[10px] font-black text-[#1B2E5A] shadow-sm">
                                        +
                                        {(
                                          currentState.credits -
                                          (previousState?.credits || 0)
                                        ).toLocaleString()}
                                      </span>
                                    </motion.div>
                                  )}
                                </div>
                                <motion.span
                                  className="relative z-10 shrink-0 text-xl font-black text-[#1B2E5A] tabular-nums"
                                  animate={{ scale: [1, 1.1, 1] }}
                                  transition={{ duration: 2, repeat: Infinity }}
                                >
                                  <CountUp end={currentState.credits} />
                                </motion.span>
                                <motion.div
                                  className="absolute top-0 right-0 h-24 w-24 translate-x-1/2 -translate-y-1/2 rounded-full bg-blue-500/10"
                                  animate={{
                                    scale: [1, 1.5, 1],
                                    opacity: [0.1, 0.3, 0.1],
                                  }}
                                  transition={{ duration: 3, repeat: Infinity }}
                                />
                              </motion.div>
                              <div className="flex items-center justify-between gap-3 rounded-xl border border-[#1B2E5A]/10 bg-[#1B2E5A]/5 p-3">
                                <span className="shrink-0 text-xs font-bold text-blue-700">
                                  Current Plan
                                </span>
                                <span className="rounded-full bg-white/80 px-2 py-0.5 text-xs font-black text-blue-900 uppercase shadow-sm">
                                  {currentState.plan}
                                </span>
                              </div>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>

              {/* Action Buttons */}
              <motion.div
                variants={itemVariants}
                className="flex flex-col gap-2 pt-1 sm:flex-row"
              >
                <motion.div
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="flex-1"
                >
                  <Button
                    onClick={() => navigate({ to: '/dashboard/applications' })}
                    className="group relative flex w-full items-center justify-center gap-2 overflow-hidden rounded-xl bg-[#1B2E5A] px-6 py-5 text-base font-black text-white shadow-2xl shadow-blue-200/50 transition-all hover:bg-[#152449]"
                  >
                    <Shimmer className="opacity-30" />
                    <motion.div className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/20 to-transparent transition-transform duration-1000 group-hover:translate-x-full" />
                    <Home className="relative z-10 h-5 w-5 transition-transform group-hover:rotate-12" />
                    <span className="relative z-10">Enter Dashboard</span>
                    <motion.div
                      className="absolute -inset-1 rounded-[2rem] bg-blue-400 opacity-0 blur transition-opacity group-hover:opacity-50"
                      animate={{ opacity: [0, 0.3, 0] }}
                      transition={{ duration: 2, repeat: Infinity }}
                    />
                  </Button>
                </motion.div>
                <motion.div
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  <Button
                    onClick={() => navigate({ to: '/dashboard/billing' })}
                    variant="outline"
                    className="group flex items-center justify-center gap-2 rounded-xl border-2 border-slate-200 px-6 py-5 text-sm font-black text-slate-600 transition-all hover:border-[#1B2E5A]/20 hover:bg-blue-50/50 hover:text-blue-700"
                  >
                    <CreditCard className="h-5 w-5 transition-transform group-hover:scale-110" />
                    View Billing
                  </Button>
                </motion.div>
              </motion.div>
            </div>

            {/* Sidebar Column */}
            <div className="space-y-3 lg:col-span-4 lg:space-y-4">
              {/* Receipt Details */}
              <motion.div variants={itemVariants}>
                <Card className="group relative overflow-hidden rounded-[2rem] border-0 bg-white shadow-xl shadow-slate-200/50 transition-all duration-500 hover:shadow-2xl hover:shadow-blue-100/30">
                  <div className="absolute inset-0 rounded-[2rem] bg-gradient-to-br from-blue-50/0 to-blue-50/0 transition-all duration-500 group-hover:from-blue-50/50 group-hover:to-transparent" />
                  <Shimmer className="rounded-[2rem] opacity-0 group-hover:opacity-100" />
                  <CardHeader className="relative z-10 px-4 pt-4 pb-2">
                    <CardTitle className="flex items-center gap-2 text-base font-black text-[#1B2E5A]">
                      <motion.div
                        className="rounded-lg bg-slate-50 p-1.5 transition-colors group-hover:bg-blue-50"
                        whileHover={{ rotate: [0, -10, 10, -10, 0] }}
                        transition={{ duration: 0.5 }}
                      >
                        <FileText className="h-4 w-4 text-slate-400 transition-colors group-hover:text-[#1B2E5A]" />
                      </motion.div>
                      Receipt
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="relative z-10 space-y-2.5 px-4 pb-4">
                    {/* Primary transaction reference */}
                    {paymentType !== 'plan_upgrade' && (
                      <motion.div
                        className="rounded-xl border border-slate-100 bg-slate-50 p-3 transition-colors group-hover:border-[#1B2E5A]/20"
                        whileHover={{ scale: 1.01 }}
                      >
                        <p className="mb-1 text-[9px] font-black tracking-widest text-slate-400 uppercase">
                          Transaction ID
                        </p>
                        <p className="font-mono text-[9px] leading-tight break-all text-slate-600 transition-colors group-hover:text-blue-700">
                          {paymentInfo?.stripePaymentIntentId ||
                            paymentInfo?.transactionId ||
                            sessionId}
                        </p>
                      </motion.div>
                    )}

                    {/* Plan upgrade proration details */}
                    {paymentType === 'plan_upgrade' && planUpgradeDetails && (
                      <motion.div
                        className="rounded-xl border border-blue-100 bg-blue-50 p-3"
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.3 }}
                      >
                        <p className="mb-2 text-[9px] font-black tracking-widest text-blue-600 uppercase">
                          Proration Summary
                        </p>
                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] font-bold text-slate-500">
                              Previous Plan
                            </span>
                            <span className="text-[10px] font-black text-slate-700 capitalize">
                              {planUpgradeDetails.previousPlanName ||
                                planUpgradeDetails.previousPlan}
                            </span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] font-bold text-slate-500">
                              New Plan
                            </span>
                            <span className="text-[10px] font-black text-[#1B2E5A] capitalize">
                              {planUpgradeDetails.plan}
                            </span>
                          </div>
                          <div className="mt-1.5 border-t border-blue-100 pt-1.5">
                            <div className="flex items-center justify-between">
                              <span className="text-[10px] font-bold text-slate-500">
                                Prorated Amount
                              </span>
                              <span className="text-[10px] font-black text-[#1B2E5A]">
                                {formatCurrency(
                                  planUpgradeDetails.amount,
                                  planUpgradeDetails.currency
                                )}
                              </span>
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    )}

                    {/* Detail rows */}
                    <div className="space-y-2">
                      {/* Date — for plan upgrade, show current date */}
                      {paymentType === 'plan_upgrade' ? (
                        <div className="flex items-center justify-between">
                          <p className="text-[9px] font-black tracking-widest text-slate-400 uppercase">
                            Upgrade Date
                          </p>
                          <p className="text-[10px] font-bold text-[#1B2E5A]">
                            {new Date().toLocaleDateString('en-US', {
                              year: 'numeric',
                              month: 'short',
                              day: 'numeric',
                            })}
                          </p>
                        </div>
                      ) : paymentInfo?.paidAt || paymentInfo?.processedAt ? (
                        <div className="flex items-center justify-between">
                          <p className="text-[9px] font-black tracking-widest text-slate-400 uppercase">
                            Payment Date
                          </p>
                          <p className="text-[10px] font-bold text-[#1B2E5A]">
                            {new Date(
                              paymentInfo.paidAt || paymentInfo.processedAt
                            ).toLocaleDateString('en-US', {
                              year: 'numeric',
                              month: 'short',
                              day: 'numeric',
                            })}
                          </p>
                        </div>
                      ) : null}

                      {/* Card */}
                      {paymentInfo?.paymentMethodDetails?.card && (
                        <div className="flex items-center justify-between">
                          <p className="text-[9px] font-black tracking-widest text-slate-400 uppercase">
                            Card
                          </p>
                          <p className="text-[10px] font-bold text-[#1B2E5A]">
                            {paymentInfo.paymentMethodDetails.card.brand?.toUpperCase()}{' '}
                            •••• {paymentInfo.paymentMethodDetails.card.last4}
                          </p>
                        </div>
                      )}

                      {/* Plan + billing cycle */}
                      {planDetails?.name && (
                        <div className="flex items-center justify-between">
                          <p className="text-[9px] font-black tracking-widest text-slate-400 uppercase">
                            Plan
                          </p>
                          <p className="text-[10px] font-bold text-[#1B2E5A] capitalize">
                            {planDetails.name} · Annual billing
                          </p>
                        </div>
                      )}

                      {/* Renewal date */}
                      {paymentInfo?.subscription?.renewalDate && (
                        <div className="flex items-center justify-between">
                          <p className="text-[9px] font-black tracking-widest text-slate-400 uppercase">
                            Renews
                          </p>
                          <p className="text-[10px] font-bold text-[#1B2E5A]">
                            {new Date(
                              paymentInfo.subscription.renewalDate
                            ).toLocaleDateString('en-US', {
                              year: 'numeric',
                              month: 'short',
                              day: 'numeric',
                            })}
                          </p>
                        </div>
                      )}

                      {/* Invoice number */}
                      {paymentInfo?.invoiceNumber && (
                        <div className="flex items-center justify-between">
                          <p className="text-[9px] font-black tracking-widest text-slate-400 uppercase">
                            Invoice #
                          </p>
                          <p className="text-[10px] font-bold text-[#1B2E5A]">
                            {paymentInfo.invoiceNumber}
                          </p>
                        </div>
                      )}
                    </div>

                    {/* Total + Status */}
                    <div className="mt-1 flex items-end justify-between border-t border-slate-100 pt-3">
                      <motion.div
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.3 }}
                      >
                        <p className="mb-0.5 text-[9px] font-black tracking-widest text-slate-400 uppercase">
                          {paymentType === 'plan_upgrade'
                            ? 'Prorated Charge'
                            : 'Total Paid'}
                        </p>
                        <motion.p
                          className="text-xl font-black text-[#1B2E5A]"
                          animate={{ scale: [1, 1.05, 1] }}
                          transition={{ duration: 2, repeat: Infinity }}
                        >
                          {paymentType === 'plan_upgrade' && planUpgradeDetails
                            ? formatCurrency(
                                planUpgradeDetails.amount,
                                planUpgradeDetails.currency
                              )
                            : paymentInfo?.amount
                              ? formatCurrency(paymentInfo.amount)
                              : '---'}
                        </motion.p>
                      </motion.div>
                      <motion.div
                        initial={{ scale: 0, rotate: -180 }}
                        animate={{ scale: 1, rotate: 0 }}
                        transition={{ delay: 0.5, type: 'spring' }}
                      >
                        <Badge className="relative mb-0.5 overflow-hidden rounded-full border-0 bg-[#1B2E5A] px-3 py-0.5 text-[9px] font-black tracking-widest text-white shadow-lg shadow-blue-100">
                          <Shimmer className="opacity-50" />
                          <span className="relative z-10 flex items-center gap-1">
                            <CheckCircle2 className="h-2.5 w-2.5" />
                            PAID
                          </span>
                        </Badge>
                      </motion.div>
                    </div>

                    {/* Download Invoice button */}
                    {paymentInfo && (
                      <motion.div
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.6 }}
                        className="pt-2"
                      >
                        <Button
                          onClick={handleDownloadInvoice}
                          disabled={isDownloading}
                          variant="outline"
                          className="flex w-full items-center justify-center gap-2 rounded-xl border border-[#1B2E5A]/20 py-4 text-[10px] font-black tracking-widest text-[#1B2E5A] uppercase transition-all hover:border-[#1B2E5A]/40 hover:bg-[#1B2E5A]/5"
                        >
                          {isDownloading ? (
                            <>
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              Generating PDF...
                            </>
                          ) : (
                            <>
                              <Download className="h-3.5 w-3.5" />
                              Download Invoice
                            </>
                          )}
                        </Button>
                      </motion.div>
                    )}
                  </CardContent>
                </Card>
              </motion.div>

              {/* Help Card */}
              <motion.div variants={itemVariants}>
                <motion.div
                  className="group relative overflow-hidden rounded-[2rem] bg-[#1B2E5A] p-4 text-white shadow-2xl shadow-blue-200 lg:p-5"
                  whileHover={{ scale: 1.02 }}
                  transition={{ type: 'spring', stiffness: 300 }}
                >
                  {/* Animated background orbs */}
                  <motion.div
                    className="absolute top-0 right-0 h-40 w-40 translate-x-1/2 -translate-y-1/2 rounded-full bg-white/10 blur-3xl"
                    animate={{ scale: [1, 1.5, 1], opacity: [0.3, 0.6, 0.3] }}
                    transition={{ duration: 4, repeat: Infinity }}
                  />
                  <motion.div
                    className="absolute bottom-0 left-0 h-32 w-32 -translate-x-1/2 translate-y-1/2 rounded-full bg-white/5 blur-2xl"
                    animate={{ scale: [1, 1.3, 1], opacity: [0.2, 0.4, 0.2] }}
                    transition={{ duration: 3, repeat: Infinity, delay: 1 }}
                  />

                  {/* Floating particles */}
                  {Array.from({ length: 5 }).map((_, i) => (
                    <motion.div
                      key={i}
                      className="absolute h-1 w-1 rounded-full bg-white/30"
                      style={{
                        left: `${20 + i * 15}%`,
                        top: `${30 + i * 10}%`,
                      }}
                      animate={{
                        y: [0, -20, 0],
                        opacity: [0.3, 0.6, 0.3],
                      }}
                      transition={{
                        duration: 2 + i * 0.5,
                        repeat: Infinity,
                        delay: i * 0.3,
                      }}
                    />
                  ))}

                  <div className="relative z-10">
                    <motion.div
                      className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-white/20 shadow-lg backdrop-blur-md"
                      whileHover={{ rotate: 360, scale: 1.1 }}
                      transition={{ duration: 0.5 }}
                    >
                      <Users className="h-5 w-5 text-white" />
                    </motion.div>
                    <h4 className="mb-1.5 flex items-center gap-1.5 text-base font-black tracking-tight">
                      <Sparkles className="h-4 w-4 text-yellow-300" />
                      Need Help?
                    </h4>
                    <p className="mb-3 text-xs leading-relaxed font-medium text-blue-100/80">
                      Our premium support team is available 24/7 to assist with
                      your upgrade.
                    </p>
                    <motion.div
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                    >
                      <Button
                        variant="outline"
                        className="group/btn relative w-full overflow-hidden rounded-xl border-white/20 bg-white/10 py-4 text-[10px] font-black tracking-widest text-white uppercase hover:bg-white/20 hover:text-white"
                      >
                        <Shimmer className="opacity-0 group-hover/btn:opacity-50" />
                        <span className="relative z-10 flex items-center justify-center gap-2">
                          <Shield className="h-4 w-4" />
                          Contact Support
                        </span>
                      </Button>
                    </motion.div>
                  </div>
                </motion.div>
              </motion.div>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  )
}

export default PaymentSuccess
