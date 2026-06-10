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
  Globe, 
  Zap, 
  FileText, 
  HelpCircle, 
  ChevronUp,
  ChevronDown,
  ArrowRight
} from 'lucide-react';
import { ZopkitRoundLoader } from '@/components/common/feedback/ZopkitRoundLoader';

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
          <ZopkitRoundLoader size="lg" />
          <p className="text-muted-foreground font-medium text-sm">Initializing...</p>
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
          title: "Your region",
          subtitle: "Compliance setup",
          text: "Tax and regulatory settings are configured for your operating location.",
          icon: <Globe className="w-4 h-4 text-muted-foreground" />,
        };
      case 2: // Business Details
        return {
          title: "Business details",
          subtitle: "Company verification",
          text: "We verify your company information against official business records.",
          icon: <Zap className="w-4 h-4 text-muted-foreground" />,
        };
      case 3: // Admin Details
        return {
          title: "Admin profile",
          subtitle: "Secure handling",
          text: "Personal details are encrypted in transit and stored under your tenant controls.",
          icon: <ShieldCheck className="w-4 h-4 text-muted-foreground" />,
        };
      case 4: // Review
        return {
          title: "Review",
          subtitle: "Before you submit",
          text: "Check each section for accuracy. You can edit any step before finishing setup.",
          icon: <FileText className="w-4 h-4 text-muted-foreground" />,
        };
      default:
        return {
          title: "Setup guide",
          subtitle: "Step by step",
          text: "Complete each section to activate your workspace.",
          icon: <HelpCircle className="w-4 h-4 text-muted-foreground" />,
        };
    }
  };

  const footerContent = getFooterContent(currentStep);

  return (
    <div className="relative flex h-screen w-full flex-col overflow-hidden bg-background font-sans text-foreground antialiased lg:flex-row">
      <aside className="relative z-20 hidden w-[300px] shrink-0 overflow-hidden border-r border-border bg-secondary lg:flex xl:w-[340px]">
        <div className="relative flex h-full w-full flex-col">
          <div className="flex min-h-0 flex-1 flex-col overflow-y-auto p-8 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
            <div className="mb-8 flex flex-col gap-5">
              <div className="flex w-full justify-center px-0.5">
                <div className="flex aspect-square w-14 shrink-0 items-center justify-center overflow-hidden rounded-md border border-border bg-card p-1.5 sm:w-16">
                  <img
                    src={config.ONBOARDING_LOGO_URL}
                    alt="Zopkit"
                    className="h-full w-full object-contain object-center"
                  />
                </div>
              </div>
              <div className="h-px w-full bg-border" />
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

          <div className="flex-shrink-0 border-t border-border bg-card">
            <div className="h-1 w-full overflow-hidden bg-muted">
              <div
                className="h-full bg-primary transition-[width] duration-500 ease-out"
                style={{ width: `${progressPercent}%` }}
              />
            </div>

            <div className="p-6">
              <div
                key={currentStep}
                className="rounded-md border border-border bg-background p-4"
              >
                <div className="flex items-start gap-4">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-border bg-secondary">
                    {footerContent.icon}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="mb-1 flex items-center justify-between gap-2">
                      <h4 className="text-sm font-medium tracking-tight text-foreground">{footerContent.title}</h4>
                      <span className="rounded-full border border-border bg-secondary px-2 py-0.5 text-[10px] font-medium tabular-nums text-muted-foreground">
                        Step {currentStep}/{stepsConfig.length}
                      </span>
                    </div>
                    <p className="mb-1.5 text-xs font-medium text-muted-foreground">
                      {footerContent.subtitle}
                    </p>
                    <p className="text-xs leading-relaxed text-muted-foreground">{footerContent.text}</p>
                  </div>
                </div>
              </div>

              <div className="mt-3" id="need-assistance-section">
                <div
                  className={`overflow-hidden transition-all duration-300 ease-out ${showSupport ? 'mb-3 max-h-[300px] opacity-100' : 'max-h-0 opacity-0'}`}
                >
                  <div className="space-y-2 rounded-md border border-border bg-secondary p-2">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                      }}
                      className="group/option flex w-full cursor-pointer items-center justify-between rounded-md border border-border bg-card p-3 text-left transition-colors duration-200 hover:bg-secondary"
                    >
                      <div>
                        <div className="text-xs font-medium text-foreground">Read documentation</div>
                        <div className="text-[10px] text-muted-foreground">View guide for step {currentStep}</div>
                      </div>
                      <div className="flex h-7 w-7 items-center justify-center rounded-full bg-secondary">
                        <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
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
                  className="group/btn flex w-full items-center justify-between rounded-md border border-border px-4 py-2.5 transition-colors duration-200 hover:bg-secondary"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-7 w-7 items-center justify-center rounded-full bg-secondary">
                      <HelpCircle className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <span className="text-xs font-medium text-foreground">Need help?</span>
                  </div>
                  {showSupport ? (
                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <ChevronUp className="h-4 w-4 text-muted-foreground" />
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      </aside>

      <div className="sticky top-0 z-30 border-b border-border bg-background px-4 py-3 lg:hidden">
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
          <span className="text-xs font-medium tabular-nums text-muted-foreground">{progressPercent}%</span>
        </div>
        <div className="h-1 w-full overflow-hidden rounded-full bg-muted">
          <div className="h-full rounded-full bg-primary" style={{ width: `${progressPercent}%` }} />
        </div>
      </div>

      <main className="relative flex flex-1 flex-col overflow-hidden bg-white">
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

        <div className="z-20 flex-shrink-0 border-t border-border bg-background px-6 py-5 lg:px-8">
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
