import React, { useCallback, useMemo, useEffect } from 'react';
import { Form } from '@/components/ui/form';
import { UseFormReturn } from 'react-hook-form';
import { newBusinessData, existingBusinessData } from '../schemas';
import { StepConfig } from '../config/flowConfigs';
import { useStepNavigation } from '../hooks';
import { OnboardingLayout } from './OnboardingLayout';
import { UserClassification } from './FlowSelector';
import { useToast } from './Toast';
import { formatValidationErrors } from '../utils/validationHelpers';
import { onboardingLogger } from '../utils/onboardingLogger';

interface MultiStepFormProps {
  form: UseFormReturn<newBusinessData | existingBusinessData>;
  stepsConfig: StepConfig[];
  onSubmit: (data: newBusinessData | existingBusinessData) => void;
  onEditStep?: (stepNumber: number) => void;
  onStepClick?: (stepNumber: number) => void;
  currentStep?: number;
  onStepChange?: (step: number) => void;
  className?: string;
  userClassification?: UserClassification;
  isSubmitting?: boolean;
}

export const MultiStepForm: React.FC<MultiStepFormProps> = ({
  form,
  stepsConfig,
  onSubmit,
  onEditStep,
  onStepClick,
  currentStep: externalCurrentStep,
  onStepChange,
  className,
  userClassification,
  isSubmitting = false
}) => {
  const {
    currentStep: internalCurrentStep,
    nextStep,
    prevStep,
    canProceed,
    canSubmit,
    getStepStatus,
    goToStep
  } = useStepNavigation(form, stepsConfig, userClassification, externalCurrentStep); // FIXED: Pass external step as initial

  const { addToast } = useToast();
  // FIXED: Use external step if provided, otherwise use internal
  const currentStep = externalCurrentStep ?? internalCurrentStep;
  
  // FIXED: Sync internal step when external step changes
  useEffect(() => {
    if (externalCurrentStep && externalCurrentStep !== internalCurrentStep) {
      goToStep(externalCurrentStep);
    }
  }, [externalCurrentStep, internalCurrentStep, goToStep]);

  const handleEditStep = useCallback((stepNumber: number) => {
    goToStep(stepNumber);
    onStepChange?.(stepNumber);
    onEditStep?.(stepNumber);
  }, [goToStep, onStepChange, onEditStep]);

  const handleStepClick = useCallback((stepNumber: number) => {
    goToStep(stepNumber);
    onStepChange?.(stepNumber);
    onStepClick?.(stepNumber);
  }, [goToStep, onStepChange, onStepClick]);

  const handleValidationError = useCallback((errors: any, stepNumber: number) => {
    const { message, fields } = formatValidationErrors(errors);
    onboardingLogger.warn('Validation error on step', { stepNumber, message, fieldPaths: fields.map((f: any) => f.fieldPath), errors: Object.keys(errors) });

    // Show toast with clickable action to navigate to first error field
    if (fields.length > 0) {
      const firstField = fields[0];
      
      const navigateToField = () => {
        // Navigate to the step with the error
        goToStep(firstField.stepNumber);
        onStepChange?.(firstField.stepNumber);
        
        // Scroll to the field after a brief delay
        setTimeout(() => {
          // Try multiple selectors to find the field
          const selectors = [
            `[name="${firstField.fieldPath}"]`,
            `[name="${firstField.fieldPath.replace('businessDetails.', '')}"]`,
            `input[name*="${firstField.fieldPath.split('.').pop()}"]`,
          ];
          
          let fieldElement: HTMLElement | null = null;
          for (const selector of selectors) {
            fieldElement = document.querySelector(selector) as HTMLElement;
            if (fieldElement) break;
          }
          
          if (fieldElement) {
            fieldElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
            fieldElement.focus();
            // Highlight the field
            fieldElement.classList.add('ring-2', 'ring-red-500', 'border-red-500');
            setTimeout(() => {
              fieldElement?.classList.remove('ring-2', 'ring-red-500', 'border-red-500');
            }, 3000);
          }
        }, 300);
      };
      
      addToast(message, {
        type: 'error',
        duration: 6000,
        action: {
          label: 'Go to Field',
          onClick: navigateToField,
        },
      });
      
      // Auto-navigate after a short delay
      setTimeout(navigateToField, 500);
    }
  }, [goToStep, onStepChange, addToast]);

  const handleNext = useCallback(async () => {
    onboardingLogger.debug('Next clicked', { currentStep, totalSteps: stepsConfig.length });
    const success = await nextStep(handleValidationError);
    if (success) {
      onboardingLogger.info('Next step success', { from: currentStep, to: currentStep + 1 });
      window.scrollTo({ top: 0, behavior: 'smooth' });
      onStepChange?.(currentStep + 1);
    } else {
      onboardingLogger.debug('Next step blocked by validation');
    }
  }, [nextStep, handleValidationError, onStepChange, currentStep, stepsConfig.length]);

  const handlePrev = useCallback(() => {
    onboardingLogger.info('Prev clicked', { from: currentStep, to: currentStep - 1 });
    prevStep();
    window.scrollTo({ top: 0, behavior: 'smooth' });
    onStepChange?.(currentStep - 1);
  }, [prevStep, onStepChange, currentStep]);

  const handleSubmit = useCallback((data: newBusinessData | existingBusinessData) => {
    onSubmit(data);
  }, [onSubmit]);

  // Memoize the form submit handler to prevent re-renders
  const formSubmitHandler = useMemo(() => {
    return form.handleSubmit(handleSubmit);
  }, [form, handleSubmit]);

  return (
    <div className={className}>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(handleSubmit)}>
          <OnboardingLayout
            form={form}
            stepsConfig={stepsConfig}
            currentStep={currentStep}
            canProceed={canProceed}
            canSubmit={canSubmit}
            getStepStatus={getStepStatus}
            onPrev={handlePrev}
            onNext={handleNext}
            onSubmit={formSubmitHandler}
            onEditStep={handleEditStep}
            onStepClick={handleStepClick}
            userClassification={userClassification}
            isSubmitting={isSubmitting}
          />
        </form>
      </Form>
    </div>
  );
};
