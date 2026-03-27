/**
 * Post-onboarding welcome screen shown after successful onboarding creation.
 * Displays logo, welcome message with company name, credits unlocked, and CTA to go to dashboard.
 */

import React, { useState, useEffect } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { CheckCircle2, Users, DollarSign, Shield, Zap } from 'lucide-react';
// @ts-ignore - canvas-confetti doesn't have types
import confetti from 'canvas-confetti';

interface OnboardingWelcomeSuccessProps {
  /** Redirect URL when user clicks "Go to Dashboard" (default: /dashboard?onboarding=complete so dashboard tour shows) */
  redirectUrl?: string;
  /** Company name to display in welcome message */
  companyName?: string;
}

export const OnboardingWelcomeSuccess: React.FC<OnboardingWelcomeSuccessProps> = ({
  redirectUrl = '/dashboard?onboarding=complete',
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
      // Ensure dashboard tour (user guide) shows after onboarding - Dashboard checks for ?onboarding=complete
      const path = redirectUrl.split('?')[0];
      const search = redirectUrl.includes('?') ? redirectUrl.slice(redirectUrl.indexOf('?') + 1) : '';
      const params = new URLSearchParams(search);
      if (path === '/dashboard' && !params.has('onboarding')) {
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

        fire(0.25, { spread: 26, startVelocity: 55, colors: ['#ec4899', '#f43f5e'] });
        fire(0.2, { spread: 60, colors: ['#FFD700', '#FFA500'] });
        fire(0.35, { spread: 100, decay: 0.91, scalar: 0.8, colors: ['#ec4899', '#d946ef'] });
        fire(0.1, { spread: 120, startVelocity: 25, decay: 0.92, scalar: 1.2, colors: ['#FFD700'] });
        fire(0.1, { spread: 120, startVelocity: 45, colors: ['#ec4899', '#f43f5e'] });
      };

      fireConfetti();
    }
  }, [currentStep, steps.length]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-100 via-blue-50/30 to-white p-4 relative overflow-hidden">
      {/* Background decorative elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 left-10 w-72 h-72 bg-pink-200/20 rounded-full blur-3xl"></div>
        <div className="absolute bottom-20 right-10 w-96 h-96 bg-blue-200/20 rounded-full blur-3xl"></div>
      </div>

      <div className="relative max-w-6xl mx-auto pt-6 pb-6">
        {/* Main Welcome Card */}
        <div className="flex justify-center mb-6">
          <div className="relative w-full max-w-lg z-10">
        <motion.div
          initial={{ scale: 0.9, opacity: 0, y: 30 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          transition={{ type: 'spring', stiffness: 100, damping: 15 }}
          className="bg-[#fffcf5] rounded-2xl pt-10 pb-8 px-6 text-center shadow-[0_30px_60px_-12px_rgba(0,0,0,0.15),0_10px_20px_-5px_rgba(0,0,0,0.1)] border-b-8 border-r-4 border-pink-100 relative"
        >
          {/* Ribbon Header */}
          <div className="absolute -top-5 left-1/2 -translate-x-1/2 w-[115%] flex justify-center items-center z-20 filter drop-shadow-xl">
            {/* Left Fold */}
            <div className="h-8 w-6 bg-[#be185d] transform skew-y-12 translate-y-5 translate-x-1.5 rounded-l-sm" />
            
            {/* Main Ribbon */}
            <div className="bg-[#db2777] text-white text-xl font-black py-3 px-10 rounded-lg relative flex items-center justify-center transform hover:scale-105 transition-transform duration-300 cursor-default shadow-lg">
              <span className="drop-shadow-md">Welcome to Zopkit!</span>
              {/* Stitching effect */}
              <div className="absolute top-1 left-2 right-2 bottom-1 border-2 border-dashed border-white/30 rounded-md"></div>
            </div>
            
            {/* Right Fold */}
            <div className="h-8 w-6 bg-[#be185d] transform -skew-y-12 translate-y-5 -translate-x-1.5 rounded-r-sm" />
          </div>

          <p className="text-[#be185d] font-bold text-sm tracking-wide">
                Grow · Scale · Thrive
          </p>

          {/* Content */}
          <div className="mt-5 mb-2">
            {/* Credits Announcement */}
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.2 }}
              className="text-orange-400 font-bold text-base uppercase tracking-wider mb-3 animate-pulse"
            >
              You've Unlocked 1000 Free Credits
            </motion.p>

            {/* Credit Visuals - White Capsule with Yellow Coins */}
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.4, type: 'spring' }}
              className="relative flex flex-col items-center mb-4"
            >
              {/* White Capsule/Pill Shape */}
              <div className="relative w-28 h-16 bg-white rounded-full shadow-lg flex items-center justify-center mb-2">
                {/* Glow effect */}
                <div className="absolute inset-0 bg-white rounded-full blur-xl opacity-60"></div>
                
                {/* Yellow Coins Inside */}
                <div className="relative z-10 flex items-center gap-1">
                  <div className="w-7 h-7 bg-yellow-400 rounded-full shadow-md transform -rotate-12"></div>
                  <div className="w-7 h-7 bg-yellow-400 rounded-full shadow-md transform rotate-12 -ml-2"></div>
                </div>
              </div>

              {/* Yellow Dollar Sign Below */}
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.6, type: 'spring' }}
                className="w-9 h-9 bg-yellow-400 rounded-full flex items-center justify-center shadow-lg"
              >
                <span className="text-white font-black text-base">$</span>
              </motion.div>
            </motion.div>

            {/* Platform Description */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
              className="mb-3"
            >
              <h2 className="text-lg font-bold text-slate-800 mb-1.5 leading-tight">
                The All-in-One Platform
              </h2>
              <p className="text-slate-500 text-xs leading-relaxed max-w-xs mx-auto mb-3">
                Manage your team, finances, and growth in one unified workspace designed for modern businesses.
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
                <p className="text-xs text-slate-500 mb-2">Complete the setup above to continue</p>
              )}
              <Button
                onClick={handleGoToDashboard}
                disabled={isNavigating || currentStep < steps.length}
                className="w-full max-w-xs mx-auto bg-[#db2777] hover:bg-[#be185d] text-white font-bold py-5 rounded-xl shadow-lg hover:shadow-xl transition-all text-sm relative group disabled:opacity-60 disabled:pointer-events-none disabled:cursor-not-allowed"
              >
                {isNavigating ? 'Taking you there...' : currentStep < steps.length ? 'Complete setup to continue...' : 'Go to Dashboard'}
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
          <div className="absolute -bottom-4 left-4 right-4 h-8 bg-black/10 blur-xl rounded-full"></div>
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
          <div className="bg-white rounded-2xl overflow-hidden border border-slate-200 shadow-xl w-full max-w-6xl">
            {/* Header */}
            <div className="h-12 border-b border-slate-100 bg-white/80 backdrop-blur-md flex items-center justify-between px-4 sm:px-6">
              <h3 className="text-lg font-bold text-[#1B2E5A]">Setting Up Your Workspace</h3>
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
                  className="absolute top-8 left-[12.5%] h-2 rounded-full z-0 shadow-lg shadow-pink-200"
                  initial={{ width: '0%' }}
                  animate={{ 
                    width: currentStep > 0 
                      ? `${(75 * (currentStep - 1) / (steps.length - 1)).toFixed(2)}%`
                      : '0%'
                  }}
                  transition={{ duration: 0.5, ease: 'easeInOut' }}
                  style={{
                    background: 'linear-gradient(to right, #ec4899, #f43f5e)'
                  }}
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
                        <div className={`
                          w-16 h-16 rounded-full flex items-center justify-center border-[3px] transition-all duration-500 relative bg-white z-10 mx-auto
                          ${isActive
                            ? 'border-white shadow-xl scale-110 ring-4 ring-offset-2 ring-pink-200 ring-opacity-50'
                            : isCompleted
                            ? 'border-white shadow-md text-white scale-100 bg-gradient-to-br from-pink-500 to-rose-500'
                            : 'border-slate-100 text-slate-300 shadow-sm'
                          }
                        `}>
                          {/* Pulse effect for active */}
                          {isActive && (
                            <div className="absolute inset-0 rounded-full animate-ping opacity-20 bg-pink-500"></div>
                          )}

                          {isCompleted ? (
                            <CheckCircle2 className="w-6 h-6 transition-all duration-300" />
                          ) : (
                            <Icon className={`w-6 h-6 transition-all duration-300 ${isActive && 'scale-110'}`} />
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
                            ${isActive ? 'text-[#1B2E5A] scale-105' : isCompleted ? 'text-slate-700' : 'text-slate-400'}
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
          <div className="inline-flex items-center gap-2 bg-white/80 backdrop-blur-sm px-6 py-3 rounded-full shadow-lg border border-white/50">
            <CheckCircle2 className="w-5 h-5 text-emerald-500" />
            <span className="text-sm font-semibold text-gray-700">
              Your organization is ready! <span className="text-pink-600">1000 free credits</span> have been added to your account.
            </span>
          </div>
        </motion.div>
      </div>
    </div>
  );
};
