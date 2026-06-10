/**
 * Post-onboarding welcome screen shown after successful onboarding creation.
 * Displays logo, welcome message with company name, credits unlocked, and CTA to go to dashboard.
 */

import React, { useState, useEffect } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { config } from '@/lib/config';
import { ONBOARDING_CONFETTI_COLORS } from '../constants';
import { CheckCircle2, Users, DollarSign, Shield, Zap } from 'lucide-react';
// @ts-ignore - canvas-confetti doesn't have types
import confetti from 'canvas-confetti';

interface OnboardingWelcomeSuccessProps {
  /** Redirect URL when user clicks "Go to Dashboard" (default: applications hub with onboarding sync param) */
  redirectUrl?: string;
  /** Company name to display in welcome message */
  companyName?: string;
}

export const OnboardingWelcomeSuccess: React.FC<OnboardingWelcomeSuccessProps> = ({
  redirectUrl = '/dashboard/applications?onboarding=complete',
  companyName,
}) => {
  const navigate = useNavigate();
  const [isNavigating, setIsNavigating] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);

  const handleGoToDashboard = () => {
    setIsNavigating(true);
    if (redirectUrl.startsWith('http')) {
      window.location.href = redirectUrl;
    } else {
      // OnboardingGuard uses ?onboarding=complete for post-onboarding auth sync
      const path = redirectUrl.split('?')[0];
      const search = redirectUrl.includes('?') ? redirectUrl.slice(redirectUrl.indexOf('?') + 1) : '';
      const params = new URLSearchParams(search);
      if ((path === '/dashboard' || path === '/dashboard/applications') && !params.has('onboarding')) {
        params.set('onboarding', 'complete');
      }
      const url = params.toString() ? `${path}?${params.toString()}` : path;
      navigate({ to: url });
    }
  };

  const steps = [
    { icon: Users, title: 'Team Management', desc: 'Invite and manage team members' },
    { icon: DollarSign, title: 'Billing & Payments', desc: 'Track subscriptions and invoices' },
    { icon: Shield, title: 'Security & Permissions', desc: 'Role-based access control' },
    { icon: Zap, title: 'Quick Setup', desc: 'Get started in minutes' },
  ];

  // Auto-progress through steps
  useEffect(() => {
    if (currentStep < steps.length) {
      const timer = setTimeout(() => {
        setCurrentStep(prev => prev + 1);
      }, 1500); // 1.5 seconds per step
      return () => clearTimeout(timer);
    } else if (currentStep === steps.length) {
      // Fire confetti when all steps are completed
      const fireConfetti = () => {
        const count = 200;
        const defaults = {
          origin: { y: 0.7 },
          zIndex: 9999,
        };

        function fire(particleRatio: number, opts: any) {
          if (confetti && typeof confetti === 'function') {
            confetti(Object.assign({}, defaults, opts, {
              particleCount: Math.floor(count * particleRatio)
            }));
          }
        }

        const blues = [...ONBOARDING_CONFETTI_COLORS];
        fire(0.25, { spread: 26, startVelocity: 55, colors: blues });
        fire(0.2, { spread: 60, colors: blues });
        fire(0.35, { spread: 100, decay: 0.91, scalar: 0.8, colors: blues });
        fire(0.1, { spread: 120, startVelocity: 25, decay: 0.92, scalar: 1.2, colors: blues });
        fire(0.1, { spread: 120, startVelocity: 45, colors: blues });
      };

      fireConfetti();
    }
  }, [currentStep, steps.length]);

  return (
    <div className="min-h-screen bg-background p-4 relative overflow-hidden">

      <div className="relative max-w-6xl mx-auto pt-6 pb-6">
        {/* Main Welcome Card */}
        <div className="flex justify-center mb-6">
          <div className="relative w-full max-w-lg z-10">
        <motion.div
          initial={{ scale: 0.9, opacity: 0, y: 30 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          transition={{ type: 'spring', stiffness: 100, damping: 15 }}
          className="relative rounded-lg border border-border bg-card px-6 pb-8 pt-10 text-center"
        >
          <div className="mb-5 flex justify-center px-1">
            <div className="flex aspect-square w-16 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border bg-white p-2 sm:w-20">
              <img
                src={config.ONBOARDING_LOGO_URL}
                alt="Zopkit"
                className="h-full w-full object-contain object-center"
              />
            </div>
          </div>

          <h1 className="text-2xl font-medium text-foreground tracking-[-0.02em] mb-1">
            Welcome to Zopkit
          </h1>

          <p className="text-sm font-medium text-muted-foreground mb-5">
            {companyName ? `${companyName} is ready` : 'Your workspace is ready'}
          </p>

          <p className="text-sm font-medium text-primary">
            Grow · Scale · Thrive
          </p>

          {/* Content */}
          <div className="mt-5 mb-2">
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.2 }}
              className="mb-4 text-base font-medium text-foreground"
            >
              1,000 free credits added to your account
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
              className="mb-3"
            >
              <p className="text-muted-foreground text-sm leading-relaxed max-w-xs mx-auto mb-3">
                Manage your team, finances, and operations from one workspace.
              </p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.7 }}
              className="mt-2"
            >
              {currentStep < steps.length && (
                <p className="text-xs text-muted-foreground mb-2">Complete the setup below to continue</p>
              )}
              <Button
                onClick={handleGoToDashboard}
                disabled={isNavigating || currentStep < steps.length}
                className="mx-auto w-full max-w-xs rounded-lg py-5 text-sm font-medium"
              >
                {isNavigating ? 'Taking you there...' : currentStep < steps.length ? 'Complete setup to continue...' : 'Go to Dashboard'}
              </Button>
            </motion.div>
          </div>
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
          <div className="w-full max-w-6xl overflow-hidden rounded-lg border border-border bg-white shadow-sm">
            <div className="flex h-12 items-center justify-between border-b border-border bg-muted/30 px-4 sm:px-6">
              <h3 className="text-base font-medium text-foreground">Setting up your workspace</h3>
              <div className="flex items-center gap-2 text-xs text-slate-500 font-medium">
                <span>Progress: {Math.round((currentStep / steps.length) * 100)}%</span>
              </div>
            </div>

            {/* Visualization Area */}
            <div className="relative flex flex-col justify-center px-6 py-6 overflow-hidden bg-[linear-gradient(to_right,#f1f5f9_1px,transparent_1px),linear-gradient(to_bottom,#f1f5f9_1px,transparent_1px)] bg-[size:40px_40px]">
              {/* Stepper Container */}
              <div className="relative w-full">
                {/* Track Background - spans exactly from first circle center to last circle center */}
                {/* With 4 columns, first circle center is at 12.5%, last at 87.5% */}
                {/* So track spans 75% width, starting at 12.5% */}
                <div className="absolute top-8 left-[12.5%] w-[75%] h-2 bg-slate-100 rounded-full z-0 overflow-hidden">
                  <div className="w-full h-full opacity-30" style={{ backgroundImage: 'linear-gradient(90deg, transparent 50%, #cbd5e1 50%)', backgroundSize: '10px 100%' }}></div>
                </div>

                {/* Active Progress Line - fills from first circle center to current step circle center */}
                <motion.div
                  className="absolute left-[12.5%] top-8 z-0 h-2 rounded-full bg-primary"
                  initial={{ width: '0%' }}
                  animate={{
                    width:
                      currentStep > 0
                        ? `${(75 * (currentStep - 1) / (steps.length - 1)).toFixed(2)}%`
                        : '0%',
                  }}
                  transition={{ duration: 0.5, ease: 'easeInOut' }}
                />

                {/* Steps Grid */}
                <div className="grid grid-cols-4 gap-0 relative z-10">
                  {steps.map((step, idx) => {
                    const isActive = idx === currentStep;
                    const isCompleted = idx < currentStep;
                    const Icon = step.icon;

                    return (
                      <div key={step.title} className="flex flex-col items-center group relative">
                        {/* Node Circle */}
                        <div
                          className={`
                          relative z-10 mx-auto flex h-16 w-16 scale-100 items-center justify-center rounded-full border-[3px] bg-white transition-all duration-500
                          ${
                            isActive
                              ? 'scale-105 border-primary/30 ring-2 ring-primary/15'
                              : isCompleted
                                ? 'scale-100 border-primary bg-primary text-primary-foreground'
                                : 'border-border text-muted-foreground'
                          }
                        `}
                        >
                          {isActive && (
                            <div className="absolute inset-0 animate-ping rounded-full bg-primary/20 opacity-30" />
                          )}

                          {isCompleted ? (
                            <CheckCircle2 className="h-6 w-6 text-white transition-all duration-300" />
                          ) : (
                            <Icon className={`h-6 w-6 transition-all duration-300 ${isActive ? 'scale-110 text-primary' : ''}`} />
                          )}

                          {/* Checkmark badge */}
                          {isCompleted && (
                            <div className="absolute -right-1 -bottom-1 bg-white text-emerald-500 rounded-full p-0.5 shadow-md border border-slate-100">
                              <CheckCircle2 className="w-3 h-3" />
                            </div>
                          )}
                        </div>

                        {/* Text Labels */}
                        <div className="mt-3 text-center w-full px-1">
                          <div className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">
                            Step 0{idx + 1}
                          </div>
                          <div className={`
                            text-xs font-bold transition-all duration-300
                            ${isActive ? 'text-primary scale-105' : isCompleted ? 'text-slate-700' : 'text-slate-400'}
                          `}>
                            {step.title}
                          </div>
                          <div className="text-[9px] text-slate-500 mt-0.5 font-medium bg-slate-50 px-1.5 py-0.5 rounded-full inline-block border border-slate-100">
                            {step.desc}
                          </div>
                        </div>
                      </div>
                    );
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
          <div className="inline-flex items-center gap-2 rounded-lg border border-border bg-muted/20 px-6 py-3">
            <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600" />
            <span className="text-sm font-medium text-foreground">
              Your organization is ready.{' '}
              <span className="font-medium text-primary">1,000 free credits</span> have been added.
            </span>
          </div>
        </motion.div>
      </div>
    </div>
  );
};
