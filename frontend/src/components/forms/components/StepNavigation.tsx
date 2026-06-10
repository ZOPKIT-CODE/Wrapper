import React from 'react';
import { PearlButton } from '@/components/ui/pearl-button';
import { StepNavigationProps } from '../types';
import { cn } from '@/lib/utils';
import { ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';

/**
 * Enhanced step navigation component matching reference design
 */
export const StepNavigation: React.FC<StepNavigationProps> = ({
  currentStep,
  totalSteps,
  isCurrentStepValid,
  isSubmitting,
  allowBack,
  onNext,
  onPrev,
  onSubmit,
  className
}) => {
  const isLastStep = currentStep === totalSteps - 1;
  const isFirstStep = currentStep === 0;

  return (
    <div className={cn('flex items-center justify-between', className)}>
      {/* Back button */}
      <div>
        {!isFirstStep && allowBack && (
          <PearlButton
            type="button"
            onClick={onPrev}
            disabled={isSubmitting}
            variant="outline"
            className="px-4 py-2"
          >
            <ChevronLeft className="w-4 h-4" />
            <span>PREVIOUS</span>
          </PearlButton>
        )}
      </div>

      {/* Next/Submit button */}
      <div>
        {isLastStep ? (
          <PearlButton
            type="button"
            onClick={onSubmit}
            disabled={!isCurrentStepValid || isSubmitting}
            className="px-6 py-3"
          >
            {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
            <span>{isSubmitting ? 'Submitting...' : 'Submit'}</span>
          </PearlButton>
        ) : (
          <PearlButton
            type="button"
            onClick={onNext}
            disabled={!isCurrentStepValid || isSubmitting}
            className="px-6 py-3"
          >
            <span>NEXT</span>
            <ChevronRight className="w-4 h-4" />
          </PearlButton>
        )}
      </div>
    </div>
  );
};
