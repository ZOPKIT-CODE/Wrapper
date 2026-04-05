/**
 * Navigation Buttons Component
 */

import React from 'react';
import { Button } from '@/components/ui/button';
import { StepConfig } from '../config/flowConfigs';

import { Rocket, Loader2 } from 'lucide-react';

interface NavigationButtonsProps {
  currentStep: number;
  stepsConfig: StepConfig[];
  canProceed: () => boolean;
  canSubmit: () => boolean;
  onPrev: () => void;
  onNext: () => void;
  onSubmit?: () => void;
  isSubmitting?: boolean;
  className?: string;
}

export const NavigationButtons: React.FC<NavigationButtonsProps> = ({
  currentStep,
  stepsConfig = [],
  canProceed,
  canSubmit,
  onPrev,
  onNext,
  onSubmit,
  isSubmitting = false,
  className = '',
}) => {
  const isFirstStep = currentStep === 1;
  const isLastStep = stepsConfig.length > 0 && currentStep === stepsConfig.length;
  
  // FIXED: Call functions directly - they will be reactive due to useWatch in canProceed
  // The parent component will re-render when form values change, causing this to re-evaluate
  const canProceedNow = canProceed();
  const canSubmitNow = canSubmit() && !isSubmitting;

  const pct = Math.round((currentStep / (stepsConfig.length || 1)) * 100);

  return (
    <div className={`flex items-center justify-between gap-4 ${className}`}>
      <Button
        type="button"
        variant="outline"
        onClick={onPrev}
        disabled={isFirstStep}
        className="h-11 min-w-[100px] rounded-lg border-slate-200/90 bg-white px-5 text-sm font-medium text-slate-700 shadow-sm transition-colors hover:border-blue-200 hover:bg-slate-50 hover:text-blue-950 disabled:cursor-not-allowed disabled:opacity-35"
      >
        <span className="flex items-center gap-2">
          <span className="text-base leading-none opacity-70">←</span> Previous
        </span>
      </Button>

      <div className="flex flex-col items-center gap-1 rounded-full bg-slate-100/90 px-5 py-2 ring-1 ring-slate-200/70">
        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">
          Step {currentStep} of {stepsConfig.length || 0}
        </p>
        <div className="flex items-center gap-2">
          <div className="h-1 w-16 overflow-hidden rounded-full bg-slate-200/90">
            <div
              className="h-full rounded-full bg-gradient-to-r from-blue-700 to-blue-950 transition-[width] duration-300 ease-out"
              style={{ width: `${pct}%` }}
            />
          </div>
          <p className="text-xs font-semibold tabular-nums text-slate-600">{pct}%</p>
        </div>
      </div>

      {isLastStep ? (
        <Button
          type="submit"
          onClick={onSubmit}
          disabled={!canSubmitNow}
          className="h-11 min-w-[180px] rounded-lg bg-gradient-to-b from-blue-800 to-blue-950 px-6 text-sm font-semibold text-white shadow-lg shadow-blue-950/25 transition-[transform,box-shadow] hover:from-blue-700 hover:to-blue-900 hover:shadow-blue-950/35 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50 disabled:active:scale-100"
        >
          <span className="flex items-center gap-2">
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Submitting…</span>
              </>
            ) : (
              <>
                <span>Launch workspace</span>
                <Rocket className="h-4 w-4" />
              </>
            )}
          </span>
        </Button>
      ) : (
        <Button
          type="button"
          onClick={onNext}
          disabled={!canProceedNow}
          className="h-11 min-w-[124px] rounded-lg bg-gradient-to-b from-blue-800 to-blue-950 px-6 text-sm font-semibold text-white shadow-lg shadow-blue-950/25 transition-[transform,box-shadow] hover:from-blue-700 hover:to-blue-900 hover:shadow-blue-950/35 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50 disabled:active:scale-100"
        >
          <span className="flex items-center gap-2">
            <span>Next</span>
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
            </svg>
          </span>
        </Button>
      )}
    </div>
  );
};

