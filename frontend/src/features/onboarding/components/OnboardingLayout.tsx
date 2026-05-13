import React, { useState, useEffect, useRef } from 'react';
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

export const OnboardingLayout = React.memo(({
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
  const termsAccepted = useWatch({ control: form.control, name: 'termsAccepted' }) as boolean;

  // Scroll to top when step changes (without smooth behavior to prevent lag)
  useEffect(() => {
    if (contentRef.current) {
      contentRef.current.scrollTo({ top: 0, behavior: 'auto' });
    }
  }, [currentStep]);

  if (!stepsConfig || stepsConfig.length === 0) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-white">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 text-blue-800 animate-spin" />
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
          icon: <Globe className="w-4 h-4 text-blue-100" />,
          color: "emerald"
        };
      case 2: // Business Details
        return {
          title: "Entity Verification",
          subtitle: "Real-time Registry Check",
          text: "We are syncing with official business registries to verify your trade name availability.",
          icon: <Zap className="w-4 h-4 text-blue-100" />,
          color: "amber"
        };
      case 3: // Admin Details
        return {
          title: "Secure Vault",
          subtitle: "AES-256 Encryption",
          text: "Your sensitive personal data is being encrypted before transmission. Zopkit Shield™ active.",
          icon: <ShieldCheck className="w-4 h-4 text-blue-100" />,
          color: "blue"
        };
      case 4: // Review
        return {
          title: "Compliance Audit",
          subtitle: "Final System Check",
          text: "Our AI is scanning your application for inconsistencies before submission to regulators.",
          icon: <FileText className="w-4 h-4 text-blue-100" />,
          color: "rose"
        };
      default:
        return {
          title: "Onboarding Guide",
          subtitle: "Zopkit Assistant",
          text: "Follow the steps to complete your profile. We're here to help you set up correctly.",
          icon: <Sparkles className="w-4 h-4 text-blue-100" />,
          color: "purple"
        };
    }
  };

  const footerContent = getFooterContent(currentStep);

  return (
    <div className="relative flex h-screen w-full flex-col overflow-hidden bg-white font-sans text-slate-900 antialiased selection:bg-blue-100 selection:text-slate-900 lg:flex-row">
      <aside className="relative z-20 hidden w-[300px] shrink-0 overflow-hidden border-r border-white/[0.12] bg-gradient-to-b from-[#0a1628] via-blue-950 to-[#050c16] shadow-[8px_0_40px_-12px_rgba(0,0,0,0.38)] lg:flex xl:w-[340px]">
        <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
          <div className="absolute inset-x-0 top-0 h-44 bg-gradient-to-b from-blue-500/[0.12] to-transparent" />
          <div className="absolute -left-20 top-[8%] h-56 w-56 rounded-full bg-blue-500/[0.11] blur-3xl" />
          <div className="absolute -bottom-20 -right-10 h-52 w-52 rounded-full bg-blue-800/18 blur-3xl" />
        </div>
        <div
          className="pointer-events-none absolute inset-y-8 right-0 w-px bg-gradient-to-b from-transparent via-white/18 to-transparent"
          aria-hidden
        />
        <div className="relative flex h-full w-full flex-col">
          <div className="flex min-h-0 flex-1 flex-col overflow-y-auto p-8 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
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

            <div className="p-6">
              <div
                key={currentStep}
                className="rounded-2xl border border-white/10 bg-gradient-to-br from-white/[0.14] to-white/[0.04] p-4 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.14)] backdrop-blur-md"
              >
                <div className="flex items-start gap-4">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/25 bg-white/12 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.2)]">
                    {footerContent.icon}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="mb-1 flex items-center justify-between gap-2">
                      <h4 className="text-sm font-semibold tracking-tight text-white">{footerContent.title}</h4>
                      <span className="rounded-full border border-white/25 bg-white/15 px-2 py-0.5 text-[9px] font-bold tabular-nums tracking-wide text-blue-50">
                        STEP {currentStep}/{stepsConfig.length}
                      </span>
                    </div>
                    <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-blue-200/90">
                      {footerContent.subtitle}
                    </p>
                    <p className="text-xs font-medium leading-relaxed text-blue-100/85">{footerContent.text}</p>
                  </div>
                </div>
              </div>

              <div className="mt-3" id="need-assistance-section">
                <div
                  className={`overflow-hidden transition-all duration-300 ease-out ${showSupport ? 'mb-3 max-h-[300px] opacity-100' : 'max-h-0 opacity-0'}`}
                >
                  <div className="space-y-2 rounded-xl border border-white/15 bg-white/5 p-2">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                      }}
                      className="group/option flex w-full cursor-pointer items-center justify-between rounded-lg border border-white/15 bg-white/10 p-3 text-left transition-colors duration-200 hover:bg-white/[0.14]"
                    >
                      <div>
                        <div className="text-xs font-bold text-white">Read Documentation</div>
                        <div className="text-[10px] text-blue-200/80">View guide for Step {currentStep}</div>
                      </div>
                      <div className="flex h-7 w-7 items-center justify-center rounded-full bg-white/15">
                        <ArrowRight className="h-3.5 w-3.5 text-blue-100" />
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
                  className="group/btn flex w-full items-center justify-between rounded-xl border border-white/15 px-4 py-2.5 transition-colors duration-200 hover:bg-white/10"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-7 w-7 items-center justify-center rounded-full bg-white/15 ring-1 ring-white/10">
                      <HelpCircle className="h-4 w-4 text-blue-100" />
                    </div>
                    <span className="text-xs font-bold text-blue-100">Need help?</span>
                  </div>
                  {showSupport ? (
                    <ChevronDown className="h-4 w-4 text-blue-200/70" />
                  ) : (
                    <ChevronUp className="h-4 w-4 text-blue-200/70" />
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      </aside>

      <div className="sticky top-0 z-30 border-b border-slate-200/80 bg-white/95 px-4 py-3 shadow-sm backdrop-blur-sm lg:hidden">
        <div className="mb-2 flex items-center justify-between">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex aspect-square w-8 shrink-0 items-center justify-center overflow-hidden rounded-md border border-slate-200/90 bg-white p-0.5">
              <img
                src={config.ONBOARDING_LOGO_URL}
                alt="Zopkit"
                className="h-full w-full object-contain object-center"
              />
            </div>
            <div className="min-w-0">
              <span className="block text-sm font-semibold tracking-tight text-slate-900">Step {currentStep}</span>
              <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-600">
                {stepsConfig.find((s) => s.number === currentStep)?.title}
              </span>
            </div>
          </div>
          <span className="text-xs font-semibold tabular-nums text-blue-900">{progressPercent}%</span>
        </div>
        <div className="h-1 w-full overflow-hidden rounded-full bg-blue-100">
          <div className="h-full rounded-full bg-blue-950" style={{ width: `${progressPercent}%` }} />
        </div>
      </div>

      <main className="relative flex flex-1 flex-col overflow-hidden bg-white">
        <div
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_100%_55%_at_50%_-8%,rgb(248_250_252_/_0.92),transparent_58%)]"
          aria-hidden
        />
        <div
          ref={contentRef}
          className="custom-scrollbar relative z-10 flex-1 overflow-y-auto scroll-smooth [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]"
        >
          <div className="mx-auto w-full max-w-5xl px-6 py-10 lg:px-8 lg:py-14">
            <StepRenderer
              currentStep={currentStep}
              stepsConfig={stepsConfig}
              form={form}
              onEditStep={onEditStep}
              userClassification={userClassification}
            />
          </div>
        </div>

        <div className="z-20 flex-shrink-0 border-t border-slate-200/80 bg-white/95 px-6 py-5 shadow-[0_-20px_50px_-24px_rgba(15,23,42,0.1)] backdrop-blur-[2px] lg:px-8">
          <div className="mx-auto w-full max-w-5xl">
            <NavigationButtons
              currentStep={currentStep}
              stepsConfig={stepsConfig}
              canProceed={canProceed}
              canSubmit={canSubmit}
              termsAccepted={!!termsAccepted}
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
