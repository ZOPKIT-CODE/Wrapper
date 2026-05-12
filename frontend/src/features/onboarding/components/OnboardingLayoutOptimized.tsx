import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useWatch } from 'react-hook-form';
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

  const formValues = useWatch({ control: form.control });

  const fieldCounts = useMemo(() => {
    const v = formValues ?? {};
    const isFilled = (val: unknown): boolean => {
      if (val === null || val === undefined || val === false) return false;
      if (typeof val === 'string') return val.trim().length > 0;
      if (typeof val === 'boolean') return val;
      return true;
    };
    return {
      1: {
        current: [
          v.companyType,
          (v as Record<string, unknown>).businessDetails
            ? ((v as Record<string, unknown>).businessDetails as Record<string, unknown>)?.companyName
            : v.businessName,
          (v as Record<string, unknown>).businessDetails
            ? ((v as Record<string, unknown>).businessDetails as Record<string, unknown>)?.businessType
            : v.businessType,
          (v as Record<string, unknown>).businessDetails
            ? ((v as Record<string, unknown>).businessDetails as Record<string, unknown>)?.country
            : v.country,
          (v as Record<string, unknown>).businessDetails
            ? ((v as Record<string, unknown>).businessDetails as Record<string, unknown>)?.organizationSize
            : v.organizationSize,
        ].filter(isFilled).length,
        total: 5,
      },
      2: {
        current: [
          v.billingStreet || v.billingAddress,
          v.billingCity,
          v.billingZip,
          v.state || v.billingState,
        ].filter(isFilled).length,
        total: 4,
      },
      3: {
        current: [
          v.firstName,
          v.lastName,
          v.adminEmail,
          v.adminMobile,
        ].filter(isFilled).length,
        total: 4,
      },
      4: {
        current: v.termsAccepted ? 1 : 0,
        total: 1,
      },
    } satisfies Record<number, { current: number; total: number }>;
  }, [formValues]);

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
          <Loader2 className="h-8 w-8 animate-spin text-blue-800" />
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
          icon: <Globe className="h-4 w-4 text-blue-100" />,
          color: "emerald"
        };
      case 2: // Business Details
        return {
          title: "Entity Verification",
          subtitle: "Real-time Registry Check",
          text: "We are syncing with official business registries to verify your trade name availability.",
          icon: <Zap className="h-4 w-4 text-blue-100" />,
          color: "amber"
        };
      case 3: // Owner/Personal
        return {
          title: "Secure Vault",
          subtitle: "AES-256 Encryption",
          text: "Your sensitive personal data is being encrypted before transmission. Zopkit Shield™ active.",
          icon: <ShieldCheck className="h-4 w-4 text-blue-100" />,
          color: "blue"
        };
      case 4: // Review
        return {
          title: "Compliance Audit",
          subtitle: "Final System Check",
          text: "Our AI is scanning your application for inconsistencies before submission to regulators.",
          icon: <FileText className="h-4 w-4 text-blue-100" />,
          color: "rose"
        };
      default:
        return {
          title: "Onboarding Guide",
          subtitle: "Zopkit Assistant",
          text: "Follow the steps to complete your profile. We're here to help you set up correctly.",
          icon: <Sparkles className="h-4 w-4 text-blue-100" />,
          color: "purple"
        };
    }
  };

  const footerContent = getFooterContent(currentStep);

  return (
    <div
      className="relative h-screen w-full overflow-hidden bg-white font-sans text-slate-800 antialiased selection:bg-blue-100/90 selection:text-blue-950 lg:flex lg:flex-row"
      style={{
        contain: 'layout style paint',
        willChange: 'auto'
      }}
    >
      <aside className="relative z-20 hidden w-[300px] shrink-0 overflow-hidden border-r border-white/[0.12] bg-gradient-to-b from-[#0a1628] via-blue-950 to-[#050c16] shadow-[8px_0_40px_-12px_rgba(0,0,0,0.38)] lg:flex xl:w-[320px]">
        <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
          <div className="absolute inset-x-0 top-0 h-44 bg-gradient-to-b from-blue-500/[0.12] to-transparent" />
          <div className="absolute -left-20 top-[8%] h-56 w-56 rounded-full bg-blue-500/[0.11] blur-3xl" />
          <div className="absolute -bottom-20 -right-10 h-52 w-52 rounded-full bg-blue-800/18 blur-3xl" />
        </div>
        <div
          className="pointer-events-none absolute inset-y-8 right-0 w-px bg-gradient-to-b from-transparent via-white/18 to-transparent"
          aria-hidden
        />
        <div className="flex h-full w-full flex-col">
          <div className="flex min-h-0 flex-1 flex-col overflow-y-auto p-6 xl:p-8">
            <div className="mb-8 flex flex-col gap-5">
              <div className="flex w-full justify-center px-0.5">
                <div className="flex aspect-square w-14 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-white/25 bg-white p-1.5 shadow-[0_12px_32px_-8px_rgba(0,0,0,0.45)] ring-1 ring-white/15 sm:w-16">
                  <img
                    src={config.ONBOARDING_LOGO_URL}
                    alt="Zopkit"
                    className="h-full w-full object-contain object-center"
                  />
                </div>
              </div>
              <div className="h-px w-full bg-gradient-to-r from-transparent via-white/25 to-transparent" />
            </div>

            <div className="flex-1 pl-1">
              <StepIndicator
                stepsConfig={stepsConfig}
                currentStep={currentStep}
                getStepStatus={getStepStatus}
                onStepClick={onStepClick}
                darkSidebar
                fieldCounts={fieldCounts}
              />
            </div>
          </div>

          <div className="flex-shrink-0 border-t border-white/10 bg-gradient-to-t from-black/25 to-blue-950/40">
            <div className="h-1 w-full overflow-hidden rounded-full bg-white/12 px-0.5 pt-0.5">
              <div
                className="h-0.5 rounded-full bg-gradient-to-r from-blue-100 via-white to-blue-50 shadow-[0_0_14px_rgba(255,255,255,0.35)] transition-[width] duration-500 ease-out"
                style={{ width: `${progressPercent}%` }}
              />
            </div>

            <div className="p-5">
              <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-white/[0.14] to-white/[0.04] p-4 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.14)] backdrop-blur-md">
                <div className="flex items-start gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-white/25 bg-white/12 text-blue-100 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.2)]">
                    {footerContent.icon}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="mb-1 flex items-start justify-between gap-2">
                      <h4 className="text-[13px] font-semibold leading-snug text-white">
                        {footerContent.title}
                      </h4>
                      <span className="shrink-0 rounded-full border border-white/25 bg-white/15 px-2 py-0.5 text-[10px] font-medium tabular-nums tracking-wide text-blue-50">
                        {currentStep}/{stepsConfig.length}
                      </span>
                    </div>
                    <p className="mb-1.5 text-[10px] font-medium uppercase tracking-wider text-blue-200/90">
                      {footerContent.subtitle}
                    </p>
                    <p className="text-xs leading-relaxed text-blue-100/85">
                      {footerContent.text}
                    </p>
                  </div>
                </div>
              </div>

              <div className="mt-3" id="need-assistance-section">
                <div className={`overflow-hidden transition-all duration-300 ease-out ${showSupport ? 'max-h-[300px] mb-3 opacity-100' : 'max-h-0 opacity-0'}`}>
                  <div className="space-y-2 rounded-lg border border-white/15 bg-white/5 p-3">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                      }}
                      className="w-full flex items-center justify-between p-3 rounded-lg border border-white/15 bg-white/10 hover:bg-white/[0.14] text-left cursor-pointer transition-colors duration-200"
                    >
                      <div>
                        <div className="text-sm font-medium text-white">Read Documentation</div>
                        <div className="text-xs text-blue-200/80">View guide for Step {currentStep}</div>
                      </div>
                      <div className="h-6 w-6 rounded-full bg-white/15 flex items-center justify-center">
                        <ArrowRight className="w-3 h-3 text-blue-100" />
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
                  className="w-full flex items-center justify-between px-4 py-2.5 rounded-lg border border-white/15 hover:bg-white/10 transition-colors duration-200"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-6 h-6 rounded-full bg-white/15 flex items-center justify-center">
                      <HelpCircle className="w-4 h-4 text-blue-100" />
                    </div>
                    <span className="text-sm font-medium text-blue-100">Need help?</span>
                  </div>
                  {showSupport ? (
                    <ChevronDown className="w-4 h-4 text-blue-200/70" />
                  ) : (
                    <ChevronUp className="w-4 h-4 text-blue-200/70" />
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      </aside>

      {/* MOBILE HEADER - Simplified */}
      <div className="sticky top-0 z-30 border-b border-slate-200/80 bg-white/95 px-4 py-3 shadow-sm backdrop-blur-sm lg:hidden">
        <div className="flex justify-between items-center mb-2">
           <div className="flex min-w-0 items-center gap-3">
             <div className="flex aspect-square w-8 shrink-0 items-center justify-center overflow-hidden rounded-md border border-slate-200/90 bg-white p-0.5">
               <img
                 src={config.ONBOARDING_LOGO_URL}
                 alt="Zopkit"
                 className="h-full w-full object-contain object-center"
               />
             </div>
             <div className="min-w-0">
               <span className="block text-sm font-semibold tracking-tight text-blue-950">Step {currentStep}</span>
               <span className="text-[10px] font-medium uppercase tracking-wider text-blue-800/80">
                 {stepsConfig.find(s => s.number === currentStep)?.title}
               </span>
             </div>
           </div>
           <span className="text-sm font-medium tabular-nums text-blue-900">{progressPercent}%</span>
        </div>
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-blue-100">
          <div
            className="h-full rounded-full bg-gradient-to-r from-blue-800 to-blue-950 transition-all duration-300"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

      {/* RIGHT CONTENT: Main Area - Optimized for smooth scrolling */}
      <main
        className="relative flex flex-1 flex-col overflow-hidden bg-white"
        style={{
          contain: 'layout style',
          willChange: 'auto'
        }}
      >
        <div
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_100%_55%_at_50%_-8%,rgb(248_250_252_/_0.92),transparent_58%)]"
          aria-hidden
        />

        <div
          ref={contentRef}
          className="relative z-10 flex-1 overflow-y-auto"
          style={{
            // Performance optimizations for smooth scrolling
            willChange: 'scroll-position',
            transform: 'translateZ(0)', // Force hardware acceleration
            WebkitOverflowScrolling: 'touch', // Smooth scrolling on iOS
            scrollBehavior: 'smooth'
          }}
        >
          <div className="mx-auto w-full max-w-3xl px-5 py-8 sm:px-8 sm:py-10 lg:px-10 lg:py-14">
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
        <div className="z-20 flex-shrink-0 border-t border-slate-200/80 bg-white/95 px-5 py-5 shadow-[0_-20px_50px_-24px_rgba(15,23,42,0.1)] backdrop-blur-[2px] sm:px-8">
          <div className="mx-auto w-full max-w-3xl lg:px-2">
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