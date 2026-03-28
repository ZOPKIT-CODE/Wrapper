import React, { useState, useEffect, useRef } from 'react';
import { StepIndicator } from './StepIndicator';
import { NavigationButtons } from './NavigationButtons';
import { StepRenderer } from './StepRenderer';
import { UseFormReturn } from 'react-hook-form';
import { newBusinessData, existingBusinessData } from '../schemas';
import { StepConfig } from '../config/flowConfigs';
import { UserClassification } from './FlowSelector';
import { config } from '@/lib/config';
import {
  ShieldCheck,
  Loader2,
  Globe,
  Zap,
  FileText,
  HelpCircle,
  Sparkles,
  ChevronUp,
  ChevronDown,
  ArrowRight
} from 'lucide-react';

interface OnboardingLayoutProps {
  form: UseFormReturn<newBusinessData | existingBusinessData>;
  stepsConfig: StepConfig[];
  currentStep: number;
  canProceed: () => boolean;
  canSubmit: () => boolean;
  getStepStatus: (stepNumber: number) => 'completed' | 'active' | 'error' | 'upcoming';
  onPrev: () => void;
  onNext: () => void;
  onSubmit?: () => void;
  onEditStep?: (stepNumber: number) => void;
  onStepClick?: (stepNumber: number) => void;
  userClassification?: UserClassification;
  isSubmitting?: boolean;
}

export const OnboardingLayoutOptimized = React.memo(({
  form,
  stepsConfig = [],
  currentStep,
  canProceed,
  canSubmit,
  getStepStatus,
  onPrev,
  onNext,
  onSubmit,
  onEditStep,
  onStepClick,
  userClassification,
  isSubmitting = false
}: OnboardingLayoutProps) => {
  const [showSupport, setShowSupport] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);
  const lastStepRef = useRef(currentStep);

  // OPTIMIZED: Scroll to top only when step actually changes (not on re-renders)
  useEffect(() => {
    if (lastStepRef.current !== currentStep && contentRef.current) {
      // Use requestAnimationFrame for smoother scrolling and prevent glitches
      requestAnimationFrame(() => {
        if (contentRef.current) {
          contentRef.current.scrollTo({ top: 0, behavior: 'auto' });
        }
      });
      lastStepRef.current = currentStep;
    }
  }, [currentStep]);

  if (!stepsConfig || stepsConfig.length === 0) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-white">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 text-[#1B2E5A] animate-spin" />
          <p className="text-slate-500 font-medium text-sm">Initializing...</p>
        </div>
      </div>
    );
  }

  const progressPercent = Math.round((currentStep / stepsConfig.length) * 100);

  // Dynamic content configuration based on current step
  const getFooterContent = (step: number) => {
    switch (step) {
      case 1: // Location
        return {
          title: "Regional Intelligence",
          subtitle: "Optimizing for India",
          text: "Zopkit is actively configuring local tax schemas and compliance rules for your region.",
          icon: <Globe className="w-4 h-4 text-emerald-600" />,
          color: "emerald"
        };
      case 2: // Business Details
        return {
          title: "Entity Verification",
          subtitle: "Real-time Registry Check",
          text: "We are syncing with official business registries to verify your trade name availability.",
          icon: <Zap className="w-4 h-4 text-amber-600" />,
          color: "amber"
        };
      case 3: // Owner/Personal
        return {
          title: "Secure Vault",
          subtitle: "AES-256 Encryption",
          text: "Your sensitive personal data is being encrypted before transmission. Zopkit Shield™ active.",
          icon: <ShieldCheck className="w-4 h-4 text-blue-600" />,
          color: "blue"
        };
      case 4: // Review
        return {
          title: "Compliance Audit",
          subtitle: "Final System Check",
          text: "Our AI is scanning your application for inconsistencies before submission to regulators.",
          icon: <FileText className="w-4 h-4 text-rose-600" />,
          color: "rose"
        };
      default:
        return {
          title: "Onboarding Guide",
          subtitle: "Zopkit Assistant",
          text: "Follow the steps to complete your profile. We're here to help you set up correctly.",
          icon: <Sparkles className="w-4 h-4 text-purple-600" />,
          color: "purple"
        };
    }
  };

  const footerContent = getFooterContent(currentStep);

  return (
    <div
      className="h-screen w-full flex flex-col lg:flex-row overflow-hidden font-sans text-[#1B2E5A] selection:bg-slate-200 selection:text-slate-900 relative"
      style={{
        // Prevent layout shifts that cause scroll glitches
        contain: 'layout style paint',
        willChange: 'auto'
      }}
    >
      {/* OPTIMIZED: Single simple background gradient instead of multiple blur effects */}
      <div className="absolute inset-0 bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/40 pointer-events-none -z-10" />

      {/* LEFT SIDEBAR: Simplified design - removed expensive animations */}
      <aside className="hidden lg:flex flex-col w-[340px] border-r border-slate-200 z-20 relative bg-white overflow-hidden">
        <div className="flex flex-col h-full">
          <div className="p-8 flex-1 flex flex-col min-h-0 overflow-y-auto">
            {/* Brand Header - Simplified */}
            <div className="flex flex-col gap-6 mb-8">
              <div className="flex justify-center w-full">
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                  <img
                    src={config.LOGO_URL}
                    alt="Zopkit Logo"
                    className="h-20 w-auto object-contain"
                  />
                </div>
              </div>
              <div className="h-px w-full bg-slate-200" />
            </div>

            <div className="flex-1 pl-1">
              <StepIndicator
                stepsConfig={stepsConfig}
                currentStep={currentStep}
                getStepStatus={getStepStatus}
                onStepClick={onStepClick}
              />
            </div>
          </div>

          {/* SIMPLIFIED FOOTER - Removed glass effects and animations */}
          <div className="border-t border-slate-200 bg-slate-50 flex-shrink-0">
            <div className="absolute top-0 left-0 h-[3px] bg-slate-900" style={{ width: `${progressPercent}%` }}></div>

            <div className="p-6">
              {/* Context Card - Simplified */}
              <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
                <div className="flex items-start gap-4">
                  <div className="p-2 rounded-lg bg-slate-100 shrink-0">
                    {footerContent.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <h4 className="text-sm font-semibold text-[#1B2E5A]">
                        {footerContent.title}
                      </h4>
                      <span className="text-xs font-medium text-slate-500 bg-slate-100 px-2 py-1 rounded">
                        STEP {currentStep}/{stepsConfig.length}
                      </span>
                    </div>
                    <p className="text-xs font-medium text-slate-600 uppercase tracking-wide mb-1">
                      {footerContent.subtitle}
                    </p>
                    <p className="text-sm text-slate-600 leading-relaxed">
                      {footerContent.text}
                    </p>
                  </div>
                </div>
              </div>

              {/* Expandable Support Area - Simplified */}
              <div className="mt-3" id="need-assistance-section">
                <div className={`overflow-hidden transition-all duration-300 ease-out ${showSupport ? 'max-h-[300px] mb-3 opacity-100' : 'max-h-0 opacity-0'}`}>
                  <div className="space-y-2 bg-white rounded-lg p-3 border border-slate-200">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                      }}
                      className="w-full flex items-center justify-between p-3 rounded-lg bg-slate-50 hover:bg-slate-100 border border-slate-200 text-left cursor-pointer transition-colors duration-200"
                    >
                      <div>
                        <div className="text-sm font-medium text-[#1B2E5A]">Read Documentation</div>
                        <div className="text-xs text-slate-500">View guide for Step {currentStep}</div>
                      </div>
                      <div className="h-6 w-6 rounded-full bg-slate-200 flex items-center justify-center">
                        <ArrowRight className="w-3 h-3 text-slate-600" />
                      </div>
                    </button>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    const newShowSupport = !showSupport;
                    setShowSupport(newShowSupport);
                    if (newShowSupport) {
                      setTimeout(() => {
                        const section = document.getElementById('need-assistance-section');
                        if (section) {
                          section.scrollIntoView({ behavior: 'smooth', block: 'end' });
                        }
                      }, 100);
                    }
                  }}
                  className="w-full flex items-center justify-between px-4 py-2.5 rounded-lg hover:bg-slate-50 transition-colors duration-200 border border-slate-200"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-6 h-6 rounded-full bg-slate-200 flex items-center justify-center">
                      <HelpCircle className="w-4 h-4 text-slate-600" />
                    </div>
                    <span className="text-sm font-medium text-slate-700">Need help?</span>
                  </div>
                  {showSupport ? (
                    <ChevronDown className="w-4 h-4 text-slate-400" />
                  ) : (
                    <ChevronUp className="w-4 h-4 text-slate-400" />
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      </aside>

      {/* MOBILE HEADER - Simplified */}
      <div className="lg:hidden border-b border-slate-200 sticky top-0 z-30 px-4 py-3 bg-white">
        <div className="flex justify-between items-center mb-2">
           <div className="flex items-center gap-3">
             <img
               src={config.LOGO_URL}
               alt="Zopkit Logo"
               className="h-8 w-auto object-contain"
             />
             <div>
               <span className="block text-sm font-semibold text-[#1B2E5A]">Step {currentStep}</span>
               <span className="text-xs text-slate-500 font-medium uppercase tracking-wide">
                 {stepsConfig.find(s => s.number === currentStep)?.title}
               </span>
             </div>
           </div>
           <span className="text-sm font-semibold text-[#1B2E5A]">{progressPercent}%</span>
        </div>
        <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-slate-900 rounded-full transition-all duration-300"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

      {/* RIGHT CONTENT: Main Area - Optimized for smooth scrolling */}
      <main
        className="flex-1 flex flex-col relative overflow-hidden"
        style={{
          // Prevent layout shifts and improve scrolling performance
          contain: 'layout style',
          willChange: 'auto'
        }}
      >
        {/* Simplified background */}
        <div className="absolute inset-0 bg-gradient-to-br from-slate-50 via-blue-50/20 to-indigo-50/30 pointer-events-none" />

        {/* OPTIMIZED: Scrollable Content with smooth scrolling and performance improvements */}
        <div
          ref={contentRef}
          className="flex-1 overflow-y-auto relative z-10"
          style={{
            // Performance optimizations for smooth scrolling
            willChange: 'scroll-position',
            transform: 'translateZ(0)', // Force hardware acceleration
            WebkitOverflowScrolling: 'touch', // Smooth scrolling on iOS
            scrollBehavior: 'smooth'
          }}
        >
          <div className="max-w-5xl mx-auto w-full px-6 py-10 lg:px-8 lg:py-12">
            <StepRenderer
              currentStep={currentStep}
              stepsConfig={stepsConfig}
              form={form}
              onEditStep={onEditStep}
              userClassification={userClassification}
            />
          </div>
        </div>

        {/* Sticky Footer - Simplified */}
        <div className="flex-shrink-0 border-t border-slate-200 bg-white px-6 py-4 lg:px-8 lg:py-5 z-20">
          <div className="max-w-5xl mx-auto w-full">
            <NavigationButtons
              currentStep={currentStep}
              stepsConfig={stepsConfig}
              canProceed={canProceed}
              canSubmit={canSubmit}
              onPrev={onPrev}
              onNext={onNext}
              onSubmit={onSubmit}
              isSubmitting={isSubmitting}
            />
          </div>
        </div>
      </main>

    </div>
  );
});