/**
 * Payment Failure Demo
 * Route: /dev/payment-failure
 *
 * Developer tool to preview the PaymentCancelled page in different failure states.
 * Remove the route from router.tsx before going to production.
 */
import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  XCircle, CreditCard, AlertTriangle, RefreshCw, ShieldOff,
  WifiOff, Clock, ChevronRight, SlidersHorizontal, X,
  HelpCircle, ArrowLeft,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ONBOARDING_LOGO_URL } from '@/lib/config'

// ── Scenario definitions ──────────────────────────────────────────────────────
const SCENARIOS = [
  {
    id: 'card_declined',
    label: 'Card Declined',
    description: 'Bank declined the transaction',
    badge: 'declined',
    badgeColor: 'bg-red-100 text-red-700 border-red-200',
    icon: ShieldOff,
    iconColor: '#ef4444',
    headline: 'Card Declined',
    subheading: 'Your card was declined by your bank.',
    errorCode: 'card_declined',
    errorMessage: 'Your card was declined. Please try a different payment method or contact your bank.',
    paymentMethod: 'Visa •••• 4242',
    amount: 99.99,
    paymentType: 'subscription',
    troubleshooting: [
      'Check that your card number, expiry, and CVV are correct',
      'Ensure your billing address matches your card records',
      'Contact your bank — they may have flagged this transaction',
      'Try a different credit or debit card',
      'Check if your card has international transactions enabled',
    ],
    unchanged: [
      { label: 'Account Status', value: 'Active' },
      { label: 'Current Plan', value: 'Free Plan' },
      { label: 'Available Credits', value: 'Unchanged' },
      { label: 'No Charges Made', value: '✓ Confirmed' },
    ],
  },
  {
    id: 'insufficient_funds',
    label: 'Insufficient Funds',
    description: 'Not enough balance on card',
    badge: 'funds',
    badgeColor: 'bg-orange-100 text-orange-700 border-orange-200',
    icon: CreditCard,
    iconColor: '#f97316',
    headline: 'Insufficient Funds',
    subheading: 'Your card does not have enough balance.',
    errorCode: 'insufficient_funds',
    errorMessage: 'Insufficient funds on your card. Please check your balance or try a different card.',
    paymentMethod: 'Mastercard •••• 5555',
    amount: 24.99,
    paymentType: 'credit_purchase',
    troubleshooting: [
      'Check your current card balance',
      'Top up your account balance and retry',
      'Use a different card with sufficient funds',
      'Consider splitting the purchase if possible',
      'Contact your bank to increase your spending limit',
    ],
    unchanged: [
      { label: 'Account Status', value: 'Active' },
      { label: 'Credits Balance', value: 'Unchanged' },
      { label: 'Subscription Plan', value: 'Unchanged' },
      { label: 'No Charges Made', value: '✓ Confirmed' },
    ],
  },
  {
    id: 'expired_card',
    label: 'Expired Card',
    description: 'Payment method has expired',
    badge: 'expired',
    badgeColor: 'bg-amber-100 text-amber-700 border-amber-200',
    icon: Clock,
    iconColor: '#d97706',
    headline: 'Card Expired',
    subheading: 'Your saved payment method has expired.',
    errorCode: 'expired_card',
    errorMessage: 'Your card has expired. Please update your payment information and try again.',
    paymentMethod: 'Amex •••• 0005',
    amount: 999.00,
    paymentType: 'subscription',
    troubleshooting: [
      'Update your payment method in account settings',
      'Add a new card with a valid expiry date',
      'Check your physical card for the expiry printed on the front',
      'Your bank may have issued a replacement — use that card instead',
      'Contact support if you need help updating billing info',
    ],
    unchanged: [
      { label: 'Account Status', value: 'Active' },
      { label: 'Current Plan', value: 'Free Plan' },
      { label: 'Available Credits', value: 'Unchanged' },
      { label: 'No Charges Made', value: '✓ Confirmed' },
    ],
  },
  {
    id: 'processing_error',
    label: 'Processing Error',
    description: 'Network or gateway timeout',
    badge: 'error',
    badgeColor: 'bg-slate-100 text-slate-700 border-slate-200',
    icon: WifiOff,
    iconColor: '#64748b',
    headline: 'Processing Error',
    subheading: 'A temporary issue prevented the payment.',
    errorCode: 'processing_error',
    errorMessage: 'There was a temporary processing error. No charge was made — please try again.',
    paymentMethod: 'Visa •••• 9876',
    amount: 49.99,
    paymentType: 'credit_purchase',
    troubleshooting: [
      'Check your internet connection and try again',
      'Wait a few minutes — the issue may resolve itself',
      'Clear your browser cache and reload the page',
      'Try a different browser or device',
      'Contact support if the error persists after multiple attempts',
    ],
    unchanged: [
      { label: 'Account Status', value: 'Active' },
      { label: 'Credits Balance', value: 'Unchanged' },
      { label: 'Subscription Plan', value: 'Unchanged' },
      { label: 'No Charges Made', value: '✓ Confirmed' },
    ],
  },
]

// ── Floating particles ────────────────────────────────────────────────────────
const particles = Array.from({ length: 14 }, (_, i) => ({
  id: i,
  x: Math.random() * 100,
  y: Math.random() * 100,
  delay: Math.random() * 2,
  dur: 3 + Math.random() * 2,
}))

// ── Main demo component ───────────────────────────────────────────────────────
export default function PaymentFailureDemo() {
  const [activeId, setActiveId] = useState(SCENARIOS[0].id)
  const [panelOpen, setPanelOpen] = useState(true)

  const scenario = SCENARIOS.find(s => s.id === activeId)!
  const FailureIcon = scenario.icon

  return (
    <div className="min-h-screen relative overflow-hidden" style={{ background: 'linear-gradient(135deg, #1a0a0a 0%, #2d1010 40%, #3d1a1a 100%)' }}>
      {/* Ambient glow */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute top-0 left-1/4 w-96 h-96 rounded-full bg-red-500/10 blur-3xl" />
        <div className="absolute bottom-0 right-1/4 w-80 h-80 rounded-full bg-orange-400/8 blur-3xl" />
      </div>

      {/* Particles */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        {particles.map(p => (
          <motion.div
            key={p.id}
            className="absolute w-1.5 h-1.5 rounded-full bg-red-300/20"
            initial={{ x: `${p.x}%`, y: `${p.y}%`, opacity: 0 }}
            animate={{
              y: [`${p.y}%`, `${p.y - 14}%`, `${p.y}%`],
              opacity: [0, 0.4, 0],
            }}
            transition={{ duration: p.dur, delay: p.delay, repeat: Infinity, ease: 'easeInOut' }}
          />
        ))}
      </div>

      {/* ── Scenario switcher ── */}
      <div className="fixed top-4 right-4 z-50">
        <AnimatePresence>
          {panelOpen && (
            <motion.div
              initial={{ opacity: 0, y: -8, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -8, scale: 0.96 }}
              className="w-64 rounded-2xl border border-white/15 bg-[#1a0a0a]/90 backdrop-blur-md shadow-2xl overflow-hidden mb-2"
            >
              <div className="px-4 py-3 border-b border-white/10 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <SlidersHorizontal className="h-3.5 w-3.5 text-red-400" />
                  <span className="text-xs font-semibold text-white">Failure scenario</span>
                </div>
                <button onClick={() => setPanelOpen(false)} className="text-white/40 hover:text-white/70">
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
              <div className="p-2 space-y-1">
                {SCENARIOS.map(s => {
                  const Icon = s.icon
                  return (
                    <button
                      key={s.id}
                      onClick={() => setActiveId(s.id)}
                      className={`w-full flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl text-left text-sm transition-all ${
                        activeId === s.id
                          ? 'bg-red-600/25 text-white'
                          : 'text-white/60 hover:bg-white/5 hover:text-white/80'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <Icon className="h-3.5 w-3.5 shrink-0 text-red-400/70" />
                        <div>
                          <p className="font-medium text-xs">{s.label}</p>
                          <p className="text-[10px] opacity-60 mt-0.5">{s.description}</p>
                        </div>
                      </div>
                      {activeId === s.id && <ChevronRight className="h-3.5 w-3.5 shrink-0 text-red-400" />}
                    </button>
                  )
                })}
              </div>
              <div className="px-4 py-2.5 border-t border-white/10">
                <p className="text-[10px] text-white/30 text-center">Remove <code className="bg-white/10 px-1 rounded">/dev/payment-failure</code> before shipping</p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
        {!panelOpen && (
          <button
            onClick={() => setPanelOpen(true)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#1a0a0a]/80 backdrop-blur border border-white/15 text-xs font-medium text-white/70 hover:text-white shadow-lg"
          >
            <SlidersHorizontal className="h-3.5 w-3.5" />
            Scenarios
          </button>
        )}
      </div>

      {/* ── Page content ── */}
      <AnimatePresence mode="wait">
        <motion.div
          key={activeId}
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -16 }}
          transition={{ duration: 0.35 }}
          className="relative z-10 flex flex-col items-center justify-center min-h-screen px-4 py-16"
        >
          {/* Logo */}
          <div className="w-14 h-14 rounded-2xl bg-white shadow-xl flex items-center justify-center mb-8 ring-4 ring-white/10">
            <img src={ONBOARDING_LOGO_URL} alt="Zopkit" className="w-9 h-9 object-contain" />
          </div>

          {/* Failure badge */}
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', stiffness: 260, damping: 20, delay: 0.1 }}
            className="w-20 h-20 rounded-full flex items-center justify-center mb-6 shadow-lg"
            style={{ background: `linear-gradient(135deg, ${scenario.iconColor}dd, ${scenario.iconColor}99)` }}
          >
            <XCircle className="h-10 w-10 text-white" />
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="text-3xl font-bold text-white mb-2 text-center"
          >
            Payment Failed
          </motion.h1>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="text-red-200/60 text-sm mb-8 text-center"
          >
            {scenario.subheading}
          </motion.p>

          {/* Summary card */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25 }}
            className="w-full max-w-md rounded-2xl border border-white/15 bg-white/[0.07] backdrop-blur-sm overflow-hidden mb-4"
          >
            {/* Error header */}
            <div className="px-6 py-5 border-b border-white/10 flex items-center justify-between">
              <div>
                <p className="text-xs text-red-200/50 font-medium uppercase tracking-wider mb-1">Amount attempted</p>
                <p className="text-3xl font-bold text-white">${scenario.amount.toFixed(2)}</p>
                <p className="text-xs text-red-200/50 mt-1">USD · {scenario.paymentMethod}</p>
              </div>
              <div className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${scenario.badgeColor}`}>
                {scenario.badge}
              </div>
            </div>

            {/* Error message */}
            <div className="px-6 py-4 border-b border-white/10">
              <div className="flex items-start gap-3 p-3 rounded-xl bg-red-500/10 border border-red-500/20">
                <AlertTriangle className="h-4 w-4 text-red-400 mt-0.5 shrink-0" />
                <p className="text-sm text-red-200/80">{scenario.errorMessage}</p>
              </div>
            </div>

            {/* Troubleshooting */}
            <div className="px-6 py-4 border-b border-white/10">
              <p className="text-xs font-semibold text-red-200/50 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                <HelpCircle className="h-3 w-3 text-red-400" /> How to fix this
              </p>
              <div className="space-y-2">
                {scenario.troubleshooting.map((step, i) => (
                  <div key={i} className="flex items-start gap-2.5">
                    <div className="w-5 h-5 rounded-full bg-red-500/20 flex items-center justify-center shrink-0 mt-0.5">
                      <span className="text-[10px] font-semibold text-red-300">{i + 1}</span>
                    </div>
                    <p className="text-xs text-white/60">{step}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* What's unchanged */}
            <div className="px-6 py-4">
              <p className="text-xs font-semibold text-green-300/60 uppercase tracking-wider mb-3">Your current status</p>
              <div className="space-y-2">
                {scenario.unchanged.map(item => (
                  <div key={item.label} className="flex items-center justify-between py-1.5 px-3 rounded-lg bg-white/[0.04]">
                    <span className="text-xs text-white/50">{item.label}</span>
                    <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-[10px] px-2">{item.value}</Badge>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>

          {/* CTAs */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="w-full max-w-md flex flex-col gap-3"
          >
            <Button
              className="w-full font-semibold py-5 rounded-xl text-white"
              style={{ background: 'linear-gradient(135deg, #dc2626, #b91c1c)' }}
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Try Again
            </Button>
            <Button variant="outline" className="w-full py-4 rounded-xl border-white/20 text-white/80 hover:bg-white/5 hover:text-white">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Dashboard
            </Button>
          </motion.div>

          <p className="mt-8 text-xs text-white/20">No charges were made to your account.</p>
        </motion.div>
      </AnimatePresence>
    </div>
  )
}
