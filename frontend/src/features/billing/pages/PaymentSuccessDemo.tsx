/**
 * Payment Success Demo
 * Route: /dev/payment-success
 *
 * Mirrors production PaymentSuccess layout + deep-blue confetti (~1s).
 * Remove the route from router.tsx before going to production.
 */
import React, { useState, useEffect } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { motion, AnimatePresence, useSpring, useTransform } from 'framer-motion'
import {
  CreditCard,
  Sparkles,
  Star,
  Shield,
  Zap,
  ChevronRight,
  SlidersHorizontal,
  X,
  Download,
  Activity,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ONBOARDING_LOGO_URL } from '@/lib/config'
import { formatCurrency } from '@/lib/utils'
import { fireDeepBlueConfetti } from '@/features/billing/lib/paymentSuccessConfetti'

const PaymentSuccessBackdrop: React.FC = () => (
  <div className="pointer-events-none fixed inset-0 z-0" aria-hidden>
    <div className="absolute inset-0 bg-gradient-to-b from-[#0a1628] via-[#0c192f] to-[#030712]" />
    <div className="absolute inset-x-0 top-0 h-56 bg-gradient-to-b from-blue-500/[0.10] to-transparent" />
    <div className="absolute -right-24 top-[15%] h-72 w-72 rounded-full bg-blue-500/[0.08] blur-3xl" />
    <div className="absolute -left-20 bottom-[10%] h-64 w-64 rounded-full bg-blue-800/[0.12] blur-3xl" />
    <div className="absolute left-1/2 top-1/3 h-[min(80vw,28rem)] w-[min(80vw,28rem)] -translate-x-1/2 rounded-full bg-blue-600/[0.06] blur-[100px]" />
  </div>
)

const SCENARIOS = [
  {
    id: 'subscription_upgrade',
    label: 'Plan Upgrade',
    description: 'Professional plan, monthly billing',
    kind: 'subscription' as const,
    planName: 'Professional',
    billingCycle: 'monthly',
    amount: 99.99,
    currency: 'USD',
    creditsAdded: 5000,
    totalCreditsAfter: 12000,
    transactionId: 'txn_demo_3KdP2mX9',
    paymentMethod: 'Visa •••• 4242',
    newFeatures: ['Unlimited Organizations', 'Priority Support', 'Advanced Analytics', 'Custom Roles'],
  },
  {
    id: 'credit_topup',
    label: 'Credit Top-Up',
    description: '2,500 credits purchased',
    kind: 'credit_purchase' as const,
    planName: null,
    billingCycle: null,
    amount: 24.99,
    currency: 'USD',
    creditsAdded: 2500,
    totalCreditsAfter: 8500,
    transactionId: 'txn_demo_8RqL7nW4',
    paymentMethod: 'Mastercard •••• 5555',
    newFeatures: [] as string[],
  },
  {
    id: 'annual_upgrade',
    label: 'Annual Plan',
    description: 'Enterprise plan, yearly billing',
    kind: 'subscription' as const,
    planName: 'Enterprise',
    billingCycle: 'yearly',
    amount: 999.0,
    currency: 'USD',
    creditsAdded: 50000,
    totalCreditsAfter: 62000,
    transactionId: 'txn_demo_5HjK1pQ6',
    paymentMethod: 'Amex •••• 0005',
    newFeatures: [
      'Unlimited Everything',
      'Dedicated Support',
      'SLA Guarantee',
      'Custom Integrations',
      'White-labelling',
    ],
  },
]

function DemoCountUp({ end }: { end: number }) {
  const [count, setCount] = useState(0)
  const spring = useSpring(0, { stiffness: 100, damping: 30 })
  const display = useTransform(spring, (v) => Math.floor(v))

  useEffect(() => {
    spring.set(end)
  }, [end, spring])

  useEffect(() => {
    return display.onChange((latest) => setCount(latest))
  }, [display])

  return (
    <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="tabular-nums">
      {count.toLocaleString()}
    </motion.span>
  )
}

export default function PaymentSuccessDemo() {
  const navigate = useNavigate()
  const [activeId, setActiveId] = useState(SCENARIOS[0].id)
  const [panelOpen, setPanelOpen] = useState(true)

  const scenario = SCENARIOS.find((s) => s.id === activeId)!

  const billingWord =
    scenario.billingCycle === 'yearly'
      ? 'yearly'
      : scenario.billingCycle === 'monthly'
        ? 'monthly'
        : scenario.billingCycle || null

  useEffect(() => {
    const t = window.setTimeout(() => fireDeepBlueConfetti(), 200)
    return () => window.clearTimeout(t)
  }, [activeId])

  return (
    <div className="relative flex h-[100dvh] max-h-[100dvh] flex-col overflow-hidden bg-[#050c16] font-sans text-slate-200 selection:bg-blue-500/30 selection:text-white">
      <PaymentSuccessBackdrop />

      <div className="fixed right-4 top-4 z-50">
        <AnimatePresence>
          {panelOpen && (
            <motion.div
              initial={{ opacity: 0, y: -8, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -8, scale: 0.96 }}
              className="mb-2 w-64 overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-white/[0.12] to-white/[0.03] shadow-[0_24px_48px_-12px_rgba(0,0,0,0.5),inset_0_1px_0_0_rgba(255,255,255,0.1)] backdrop-blur-xl"
            >
              <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
                <div className="flex items-center gap-2">
                  <SlidersHorizontal className="h-3.5 w-3.5 text-sky-400" />
                  <span className="text-xs font-semibold text-white">Payment scenario</span>
                </div>
                <button type="button" onClick={() => setPanelOpen(false)} className="text-slate-500 hover:text-slate-300">
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
              <div className="space-y-1 p-2">
                {SCENARIOS.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setActiveId(s.id)}
                    className={`flex w-full items-center justify-between gap-2 rounded-xl px-3 py-2.5 text-left text-sm transition-all ${
                      activeId === s.id
                        ? 'bg-blue-600/25 text-white ring-1 ring-sky-500/30'
                        : 'text-slate-400 hover:bg-white/[0.06] hover:text-slate-200'
                    }`}
                  >
                    <div>
                      <p className="text-xs font-medium">{s.label}</p>
                      <p className="mt-0.5 text-[10px] opacity-70">{s.description}</p>
                    </div>
                    {activeId === s.id && <ChevronRight className="h-3.5 w-3.5 shrink-0 text-sky-400" />}
                  </button>
                ))}
              </div>
              <div className="border-t border-white/10 px-4 py-2.5">
                <p className="text-center text-[10px] text-slate-600">
                  Remove <code className="rounded bg-white/10 px-1">/dev/payment-success</code> before shipping
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
        {!panelOpen && (
          <button
            type="button"
            onClick={() => setPanelOpen(true)}
            className="flex items-center gap-1.5 rounded-xl border border-white/15 bg-white/[0.08] px-3 py-2 text-xs font-medium text-slate-300 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.08)] backdrop-blur-md hover:bg-white/[0.12] hover:text-white"
          >
            <SlidersHorizontal className="h-3.5 w-3.5" />
            Scenarios
          </button>
        )}
      </div>

      <div className="relative z-10 flex min-h-0 flex-1 flex-col overflow-hidden">
        <AnimatePresence mode="wait">
        <motion.div
          key={activeId}
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.3 }}
          className="mx-auto flex min-h-0 w-full max-w-lg flex-1 flex-col justify-center overflow-hidden px-4 py-3 sm:py-4"
        >
          <div className="text-center">
            <div className="mx-auto mb-2 flex h-[4.5rem] w-[4.5rem] items-center justify-center overflow-hidden rounded-2xl border border-white/35 bg-white p-2.5 shadow-[0_20px_50px_-12px_rgba(56,189,248,0.35),0_12px_28px_-10px_rgba(0,0,0,0.5)] ring-4 ring-sky-400/10 sm:h-[5.25rem] sm:w-[5.25rem] sm:p-3">
              <img src={ONBOARDING_LOGO_URL} alt="Zopkit" className="h-full w-full object-contain" />
            </div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-sky-300/80">Thank you</p>
            <h1 className="mt-1 bg-gradient-to-b from-white to-slate-200 bg-clip-text text-xl font-bold tracking-tight text-transparent drop-shadow-sm sm:text-2xl">
              Payment successful!
            </h1>
            <p className="mt-2.5 text-xs text-slate-400">
              Transaction{' '}
              <span className="rounded-lg border border-white/20 bg-white/[0.1] px-2.5 py-1 font-mono text-[11px] text-slate-100 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.12)] backdrop-blur-md">
                {scenario.transactionId}
              </span>
            </p>
          </div>

          <div className="relative mt-3 overflow-hidden rounded-3xl border border-white/40 bg-gradient-to-b from-white/[0.52] via-white/[0.28] to-white/[0.14] shadow-[0_32px_64px_-20px_rgba(0,0,0,0.55),inset_0_1px_0_0_rgba(255,255,255,0.65)] backdrop-blur-3xl">
            <div
              className="pointer-events-none absolute inset-x-0 top-0 h-20 bg-gradient-to-b from-white/70 to-transparent"
              aria-hidden
            />
            <div
              className="pointer-events-none absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-sky-500/[0.07] to-transparent"
              aria-hidden
            />
            <div className="relative z-10 p-3.5 sm:p-4">
            <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-200/60 pb-3.5">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">Amount charged</p>
                <p className="mt-1 text-2xl font-bold tabular-nums tracking-tight text-[#0c1222] sm:text-[1.65rem]">
                  {formatCurrency(scenario.amount)}
                </p>
                <p className="mt-1 text-xs font-medium text-slate-600">
                  {scenario.currency} · {scenario.paymentMethod}
                </p>
              </div>
              <Badge className="h-fit shrink-0 rounded-full border border-[#1B2E5A]/18 bg-white/70 px-3 py-1 text-[10px] font-bold uppercase tracking-wide text-[#142a52] shadow-sm ring-1 ring-[#1B2E5A]/8 backdrop-blur-sm">
                {scenario.kind === 'credit_purchase' ? 'Credits' : 'Subscription'}
              </Badge>
            </div>

            <div className="space-y-2.5 border-b border-slate-200/60 py-3.5 text-sm">
              {scenario.planName && (
                <div className="flex items-center justify-between gap-3">
                  <span className="text-slate-500">Plan</span>
                  <span className="text-right font-medium text-slate-800">
                    {scenario.planName}
                    {billingWord ? ` / ${billingWord}` : ''}
                  </span>
                </div>
              )}
              <div className="flex items-center justify-between gap-3">
                <span className="text-slate-500">Credits</span>
                <div className="text-right">
                  <span className="font-medium tabular-nums text-slate-800">
                    <DemoCountUp end={scenario.totalCreditsAfter} key={activeId} />
                  </span>
                  {scenario.creditsAdded > 0 && (
                    <div className="text-xs font-semibold text-emerald-600">
                      +{scenario.creditsAdded.toLocaleString()} from this checkout
                    </div>
                  )}
                </div>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-slate-500">Status</span>
                <div className="flex items-center gap-2 rounded-full border border-emerald-200/80 bg-emerald-50/95 py-1 pl-1 pr-3 shadow-[0_2px_8px_-2px_rgba(16,185,129,0.25)] ring-1 ring-emerald-100/80">
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-full border border-white bg-white p-0.5 shadow-sm">
                    <img src={ONBOARDING_LOGO_URL} alt="" className="h-full w-full object-contain" decoding="async" />
                  </div>
                  <span className="text-[11px] font-bold uppercase tracking-wide text-emerald-800">Confirmed</span>
                </div>
              </div>
            </div>

            {scenario.newFeatures.length > 0 && (
              <div className="border-t border-slate-200/60 pt-2.5">
                <p className="mb-2 flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-[0.12em] text-slate-500">
                  <Sparkles className="h-3.5 w-3.5 text-[#1B2E5A]" />
                  Unlocked features
                </p>
                <div className="rounded-2xl border border-slate-200/50 bg-slate-100/40 p-2 backdrop-blur-sm">
                  <div className="grid grid-cols-2 gap-1.5">
                    {scenario.newFeatures.map((f) => (
                      <div
                        key={f}
                        className="flex items-start gap-2 rounded-xl border border-slate-200/70 bg-white/85 p-2.5 text-[10px] font-medium leading-snug text-slate-700 shadow-[0_2px_8px_-4px_rgba(15,23,42,0.12)] backdrop-blur-sm"
                      >
                        <Star className="mt-0.5 h-3 w-3 shrink-0 text-amber-500 drop-shadow-sm" />
                        <span>{f}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            <p className="pt-2.5 text-center text-[10px] font-medium text-slate-500">Demo timestamp · {new Date().toLocaleString()}</p>
            </div>
          </div>

          <div className="mt-3 grid grid-cols-3 gap-2 sm:gap-2.5">
            <div className="rounded-2xl border border-white/20 bg-white/[0.12] px-2 py-2.5 text-center shadow-[inset_0_1px_0_0_rgba(255,255,255,0.14),0_10px_28px_-12px_rgba(0,0,0,0.35)] backdrop-blur-xl ring-1 ring-white/10 transition-colors hover:bg-white/[0.16] sm:px-3">
              <div className="mx-auto mb-1.5 flex h-8 w-8 items-center justify-center rounded-xl bg-amber-400/15 text-amber-300 ring-1 ring-amber-400/20">
                <Zap className="h-4 w-4" />
              </div>
              <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Credits</p>
              <p className="mt-0.5 text-sm font-bold tabular-nums tracking-tight text-white">
                {scenario.totalCreditsAfter >= 1000
                  ? `${(scenario.totalCreditsAfter / 1000).toFixed(scenario.totalCreditsAfter % 1000 === 0 ? 0 : 1)}k`
                  : scenario.totalCreditsAfter}
              </p>
            </div>
            <div className="rounded-2xl border border-white/20 bg-white/[0.12] px-2 py-2.5 text-center shadow-[inset_0_1px_0_0_rgba(255,255,255,0.14),0_10px_28px_-12px_rgba(0,0,0,0.35)] backdrop-blur-xl ring-1 ring-white/10 transition-colors hover:bg-white/[0.16] sm:px-3">
              <div className="mx-auto mb-1.5 flex h-8 w-8 items-center justify-center rounded-xl bg-sky-400/15 text-sky-300 ring-1 ring-sky-400/25">
                <Activity className="h-4 w-4" />
              </div>
              <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Billing</p>
              <p className="mt-0.5 text-sm font-bold capitalize tracking-tight text-white">{billingWord || 'One-time'}</p>
            </div>
            <div className="rounded-2xl border border-white/20 bg-white/[0.12] px-2 py-2.5 text-center shadow-[inset_0_1px_0_0_rgba(255,255,255,0.14),0_10px_28px_-12px_rgba(0,0,0,0.35)] backdrop-blur-xl ring-1 ring-white/10 transition-colors hover:bg-white/[0.16] sm:px-3">
              <div className="mx-auto mb-1.5 flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-400/15 text-emerald-300 ring-1 ring-emerald-400/25">
                <Shield className="h-4 w-4" />
              </div>
              <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Secure</p>
              <p className="mt-0.5 text-sm font-bold text-emerald-300">Verified</p>
            </div>
          </div>

          <div className="mt-3 flex shrink-0 flex-col gap-2">
            <Button
              type="button"
              onClick={() => navigate({ to: '/dashboard/applications' })}
              className="h-11 w-full rounded-2xl border border-sky-400/30 bg-gradient-to-r from-sky-500 via-blue-600 to-blue-700 text-sm font-semibold text-white shadow-[0_16px_40px_-12px_rgba(37,99,235,0.55),inset_0_1px_0_0_rgba(255,255,255,0.2)] transition-all hover:brightness-110 hover:shadow-[0_20px_44px_-12px_rgba(37,99,235,0.45)] active:scale-[0.99]"
            >
              Go to dashboard
              <ChevronRight className="ml-1 h-4 w-4 opacity-90" />
            </Button>
            <Button
              type="button"
              variant="outline"
              className="h-11 w-full rounded-2xl border border-white/25 bg-white/[0.1] text-sm font-semibold text-white shadow-[inset_0_1px_0_0_rgba(255,255,255,0.12)] backdrop-blur-xl hover:border-white/35 hover:bg-white/[0.14]"
              onClick={() => {
                window.alert('Demo only — production page generates a PDF receipt.')
              }}
            >
              <Download className="mr-2 h-4 w-4" />
              Download receipt
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={() => navigate({ to: '/dashboard/billing' })}
              className="h-9 text-xs font-medium text-slate-400 hover:bg-white/[0.06] hover:text-slate-200"
            >
              <CreditCard className="mr-2 h-4 w-4" />
              View billing
            </Button>
          </div>

          <p className="mt-2 text-center text-[10px] font-medium text-slate-500">Deep blue confetti runs ~1s when you switch scenarios.</p>
        </motion.div>
        </AnimatePresence>
      </div>
    </div>
  )
}
