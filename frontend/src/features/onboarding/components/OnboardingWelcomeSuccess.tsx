/**
 * Post-onboarding welcome screen shown after successful onboarding creation.
 * Displays logo, welcome message with company name, credits unlocked, and CTA to go to dashboard.
 */

import React, { useState, useEffect } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { motion } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { config } from '@/lib/config'
import { ONBOARDING_CONFETTI_COLORS } from '../constants'
import { CheckCircle2, Users, DollarSign, Shield, Zap } from 'lucide-react'
// @ts-expect-error - canvas-confetti doesn't have types
import confetti from 'canvas-confetti'

interface OnboardingWelcomeSuccessProps {
  /** Redirect URL when user clicks "Go to Dashboard" (default: applications hub with onboarding sync param) */
  redirectUrl?: string
  /** Company name to display in welcome message */
  companyName?: string
}

export const OnboardingWelcomeSuccess: React.FC<
  OnboardingWelcomeSuccessProps
> = ({
  redirectUrl = '/dashboard/applications?onboarding=complete',
  companyName: _companyName,
}) => {
  const navigate = useNavigate()
  const [isNavigating, setIsNavigating] = useState(false)
  const [currentStep, setCurrentStep] = useState(0)

  const handleGoToDashboard = () => {
    setIsNavigating(true)
    if (redirectUrl.startsWith('http')) {
      window.location.href = redirectUrl
    } else {
      // OnboardingGuard uses ?onboarding=complete for post-onboarding auth sync
      const path = redirectUrl.split('?')[0]
      const search = redirectUrl.includes('?')
        ? redirectUrl.slice(redirectUrl.indexOf('?') + 1)
        : ''
      const params = new URLSearchParams(search)
      if (
        (path === '/dashboard' || path === '/dashboard/applications') &&
        !params.has('onboarding')
      ) {
        params.set('onboarding', 'complete')
      }
      const url = params.toString() ? `${path}?${params.toString()}` : path
      navigate({ to: url })
    }
  }

  const steps = [
    {
      icon: Users,
      title: 'Team Management',
      desc: 'Invite and manage team members',
    },
    {
      icon: DollarSign,
      title: 'Billing & Payments',
      desc: 'Track subscriptions and invoices',
    },
    {
      icon: Shield,
      title: 'Security & Permissions',
      desc: 'Role-based access control',
    },
    { icon: Zap, title: 'Quick Setup', desc: 'Get started in minutes' },
  ]

  // Auto-progress through steps
  useEffect(() => {
    if (currentStep < steps.length) {
      const timer = setTimeout(() => {
        setCurrentStep((prev) => prev + 1)
      }, 1500) // 1.5 seconds per step
      return () => clearTimeout(timer)
    } else if (currentStep === steps.length) {
      // Fire confetti when all steps are completed
      const fireConfetti = () => {
        const count = 200
        const defaults = {
          origin: { y: 0.7 },
          zIndex: 9999,
        }

        function fire(particleRatio: number, opts: Record<string, unknown>) {
          if (confetti && typeof confetti === 'function') {
            confetti(
              Object.assign({}, defaults, opts, {
                particleCount: Math.floor(count * particleRatio),
              })
            )
          }
        }

        const blues = [...ONBOARDING_CONFETTI_COLORS]
        fire(0.25, { spread: 26, startVelocity: 55, colors: blues })
        fire(0.2, { spread: 60, colors: blues })
        fire(0.35, { spread: 100, decay: 0.91, scalar: 0.8, colors: blues })
        fire(0.1, {
          spread: 120,
          startVelocity: 25,
          decay: 0.92,
          scalar: 1.2,
          colors: blues,
        })
        fire(0.1, { spread: 120, startVelocity: 45, colors: blues })
      }

      fireConfetti()
    }
  }, [currentStep, steps.length])

  return (
    <div className="relative min-h-screen overflow-hidden bg-gradient-to-br from-slate-100 via-[#1B2E5A]/[0.06] to-slate-50 p-4">
      {/* Background decorative elements — deep blue wash (tenant dashboard) */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute top-20 left-10 h-72 w-72 rounded-full bg-[#1B2E5A]/10 blur-3xl" />
        <div className="absolute right-10 bottom-20 h-96 w-96 rounded-full bg-blue-300/15 blur-3xl" />
      </div>

      <div className="relative mx-auto max-w-6xl pt-6 pb-6">
        {/* Main Welcome Card */}
        <div className="mb-6 flex justify-center">
          <div className="relative z-10 w-full max-w-lg">
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 30 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              transition={{ type: 'spring', stiffness: 100, damping: 15 }}
              className="relative rounded-2xl border-r-4 border-b-8 border-blue-200/60 bg-white px-6 pt-10 pb-8 text-center shadow-[0_30px_60px_-12px_rgba(27,46,90,0.12),0_10px_20px_-5px_rgba(27,46,90,0.08)]"
            >
              <div className="mb-5 flex justify-center px-1">
                <div className="flex aspect-square w-16 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-white/80 bg-white p-2 shadow-md ring-1 ring-slate-200/60 sm:w-20">
                  <img
                    src={config.ONBOARDING_LOGO_URL}
                    alt="Zopkit"
                    className="h-full w-full object-contain object-center"
                  />
                </div>
              </div>
              {/* Ribbon Header */}
              <div className="absolute -top-5 left-1/2 z-20 flex w-[115%] -translate-x-1/2 items-center justify-center drop-shadow-xl filter">
                {/* Left Fold */}
                <div className="h-8 w-6 translate-x-1.5 translate-y-5 skew-y-12 transform rounded-l-sm bg-[#152247]" />

                {/* Main Ribbon — deep blue (#1B2E5A) */}
                <div className="relative flex transform cursor-default items-center justify-center rounded-lg bg-gradient-to-b from-[#243A6C] to-[#1B2E5A] px-10 py-3 text-xl font-black text-white shadow-lg transition-transform duration-300 hover:scale-[1.02]">
                  <span className="drop-shadow-md">Welcome to Zopkit!</span>
                  <div className="absolute top-1 right-2 bottom-1 left-2 rounded-md border-2 border-dashed border-white/25" />
                </div>

                {/* Right Fold */}
                <div className="h-8 w-6 -translate-x-1.5 translate-y-5 -skew-y-12 transform rounded-r-sm bg-[#152247]" />
              </div>

              <p className="text-sm font-bold tracking-wide text-[#1B2E5A] dark:text-blue-200">
                Grow · Scale · Thrive
              </p>

              {/* Content */}
              <div className="mt-5 mb-2">
                {/* Credits Announcement */}
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.2 }}
                  className="mb-3 animate-pulse text-base font-bold tracking-wider text-amber-600 uppercase dark:text-amber-400"
                >
                  You've Unlocked 1000 Free Credits
                </motion.p>

                {/* Credit Visuals - White Capsule with Yellow Coins */}
                <motion.div
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ delay: 0.4, type: 'spring' }}
                  className="relative mb-4 flex flex-col items-center"
                >
                  {/* White Capsule/Pill Shape */}
                  <div className="relative mb-2 flex h-16 w-28 items-center justify-center rounded-full bg-white shadow-lg">
                    {/* Glow effect */}
                    <div className="absolute inset-0 rounded-full bg-white opacity-60 blur-xl"></div>

                    {/* Yellow Coins Inside */}
                    <div className="relative z-10 flex items-center gap-1">
                      <div className="h-7 w-7 -rotate-12 transform rounded-full bg-yellow-400 shadow-md"></div>
                      <div className="-ml-2 h-7 w-7 rotate-12 transform rounded-full bg-yellow-400 shadow-md"></div>
                    </div>
                  </div>

                  {/* Yellow Dollar Sign Below */}
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ delay: 0.6, type: 'spring' }}
                    className="flex h-9 w-9 items-center justify-center rounded-full bg-yellow-400 shadow-lg"
                  >
                    <span className="text-base font-black text-white">$</span>
                  </motion.div>
                </motion.div>

                {/* Platform Description */}
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.5 }}
                  className="mb-3"
                >
                  <h2 className="mb-1.5 text-lg leading-tight font-bold text-[#1B2E5A] dark:text-slate-100">
                    The All-in-One Platform
                  </h2>
                  <p className="mx-auto mb-3 max-w-xs text-xs leading-relaxed text-slate-500">
                    Manage your team, finances, and growth in one unified
                    workspace designed for modern businesses.
                  </p>
                </motion.div>

                {/* Go to Dashboard Button - enabled only after stepper completes all 4 steps */}
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.7 }}
                  className="mt-2"
                >
                  {currentStep < steps.length && (
                    <p className="mb-2 text-xs text-slate-500">
                      Complete the setup above to continue
                    </p>
                  )}
                  <Button
                    onClick={handleGoToDashboard}
                    disabled={isNavigating || currentStep < steps.length}
                    className="group relative mx-auto w-full max-w-xs rounded-xl bg-[#1B2E5A] py-5 text-sm font-bold text-white shadow-lg transition-all hover:bg-[#243A6C] hover:shadow-xl disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isNavigating
                      ? 'Taking you there...'
                      : currentStep < steps.length
                        ? 'Complete setup to continue...'
                        : 'Go to Dashboard'}
                    {currentStep >= steps.length && !isNavigating && (
                      <motion.span
                        className="ml-2 inline-block"
                        animate={{ x: [0, 5, 0] }}
                        transition={{ duration: 1.5, repeat: Infinity }}
                      >
                        →
                      </motion.span>
                    )}
                  </Button>
                </motion.div>
              </div>

              {/* Card Reflection/Shadow on background */}
              <div className="absolute right-4 -bottom-4 left-4 h-8 rounded-full bg-black/10 blur-xl"></div>
            </motion.div>
          </div>
        </div>

        {/* Workflow Visualizer Style Stepper */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.8 }}
          className="mb-2 flex justify-center"
        >
          <div className="w-full max-w-6xl overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-xl dark:border-slate-700 dark:bg-slate-900">
            {/* Header */}
            <div className="flex h-12 items-center justify-between border-b border-slate-100 bg-slate-50/90 px-4 backdrop-blur-md sm:px-6 dark:border-slate-800 dark:bg-slate-900/80">
              <h3 className="text-lg font-bold text-[#1B2E5A]">
                Setting Up Your Workspace
              </h3>
              <div className="flex items-center gap-2 text-xs font-medium text-slate-500">
                <span>
                  Progress: {Math.round((currentStep / steps.length) * 100)}%
                </span>
              </div>
            </div>

            {/* Visualization Area */}
            <div className="relative flex flex-col justify-center overflow-hidden bg-[linear-gradient(to_right,#f1f5f9_1px,transparent_1px),linear-gradient(to_bottom,#f1f5f9_1px,transparent_1px)] bg-[size:40px_40px] px-6 py-6">
              {/* Stepper Container */}
              <div className="relative w-full">
                {/* Track Background - spans exactly from first circle center to last circle center */}
                {/* With 4 columns, first circle center is at 12.5%, last at 87.5% */}
                {/* So track spans 75% width, starting at 12.5% */}
                <div className="absolute top-8 left-[12.5%] z-0 h-2 w-[75%] overflow-hidden rounded-full bg-slate-100">
                  <div
                    className="h-full w-full opacity-30"
                    style={{
                      backgroundImage:
                        'linear-gradient(90deg, transparent 50%, #cbd5e1 50%)',
                      backgroundSize: '10px 100%',
                    }}
                  ></div>
                </div>

                {/* Active Progress Line - fills from first circle center to current step circle center */}
                <motion.div
                  className="absolute top-8 left-[12.5%] z-0 h-2 rounded-full shadow-lg shadow-blue-900/20"
                  initial={{ width: '0%' }}
                  animate={{
                    width:
                      currentStep > 0
                        ? `${((75 * (currentStep - 1)) / (steps.length - 1)).toFixed(2)}%`
                        : '0%',
                  }}
                  transition={{ duration: 0.5, ease: 'easeInOut' }}
                  style={{
                    background: 'linear-gradient(to right, #1B2E5A, #3b82f6)',
                  }}
                />

                {/* Steps Grid */}
                <div className="relative z-10 grid grid-cols-4 gap-0">
                  {steps.map((step, idx) => {
                    const isActive = idx === currentStep
                    const isCompleted = idx < currentStep
                    const Icon = step.icon

                    return (
                      <div
                        key={step.title}
                        className="group relative flex flex-col items-center"
                      >
                        {/* Node Circle */}
                        <div
                          className={`relative z-10 mx-auto flex h-16 w-16 scale-100 items-center justify-center rounded-full border-[3px] bg-white transition-all duration-500 ${
                            isActive
                              ? 'scale-110 border-white shadow-xl ring-4 ring-[#1B2E5A]/25 ring-offset-2'
                              : isCompleted
                                ? 'scale-100 border-white bg-gradient-to-br from-[#1B2E5A] to-[#243A6C] text-white shadow-md'
                                : 'border-slate-100 text-slate-300 shadow-sm'
                          } `}
                        >
                          {isActive && (
                            <div className="absolute inset-0 animate-ping rounded-full bg-[#1B2E5A]/20 opacity-30" />
                          )}

                          {isCompleted ? (
                            <CheckCircle2 className="h-6 w-6 text-white transition-all duration-300" />
                          ) : (
                            <Icon
                              className={`h-6 w-6 transition-all duration-300 ${isActive ? 'scale-110 text-[#1B2E5A]' : ''}`}
                            />
                          )}

                          {/* Checkmark badge */}
                          {isCompleted && (
                            <div className="absolute -right-1 -bottom-1 rounded-full border border-slate-100 bg-white p-0.5 text-emerald-500 shadow-md">
                              <CheckCircle2 className="h-3 w-3" />
                            </div>
                          )}
                        </div>

                        {/* Text Labels */}
                        <div className="mt-3 w-full px-1 text-center">
                          <div className="mb-0.5 text-[9px] font-bold tracking-wider text-slate-400 uppercase">
                            Step 0{idx + 1}
                          </div>
                          <div
                            className={`text-xs font-bold transition-all duration-300 ${isActive ? 'scale-105 text-[#1B2E5A]' : isCompleted ? 'text-slate-700' : 'text-slate-400'} `}
                          >
                            {step.title}
                          </div>
                          <div className="mt-0.5 inline-block rounded-full border border-slate-100 bg-slate-50 px-1.5 py-0.5 text-[9px] font-medium text-slate-500">
                            {step.desc}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Quick Start Section */}

        {/* Stats Section */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.4 }}
          className="mt-4 text-center"
        >
          <div className="inline-flex items-center gap-2 rounded-full border border-[#1B2E5A]/15 bg-white/90 px-6 py-3 shadow-lg backdrop-blur-sm dark:border-slate-700 dark:bg-slate-900/90">
            <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600" />
            <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">
              Your organization is ready!{' '}
              <span className="font-bold text-[#1B2E5A] dark:text-blue-300">
                1000 free credits
              </span>{' '}
              have been added to your account.
            </span>
          </div>
        </motion.div>
      </div>
    </div>
  )
}
