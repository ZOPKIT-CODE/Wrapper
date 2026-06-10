import { useEffect, useCallback } from 'react';
import { useFormContext } from '../contexts/FormContext';

/**
 * Hook for enhanced form accessibility features
 */
export const useFormAccessibility = () => {
  const {
    currentStep,
    totalSteps,
    isCurrentStepValid,
    methods,
    handleSubmit,
    nextStep,
    prevStep,
    goToStep
  } = useFormContext();

  // Announce step changes to screen readers
  useEffect(() => {
    const announcement = `Step ${currentStep + 1} of ${totalSteps}. ${isCurrentStepValid ? 'Form is valid' : 'Please complete required fields'}`;
    
    // Create or update live region for screen reader announcements
    let liveRegion = document.getElementById('form-live-region');
    if (!liveRegion) {
      liveRegion = document.createElement('div');
      liveRegion.id = 'form-live-region';
      liveRegion.setAttribute('aria-live', 'polite');
      liveRegion.setAttribute('aria-atomic', 'true');
      liveRegion.className = 'sr-only';
      document.body.appendChild(liveRegion);
    }
    
    liveRegion.textContent = announcement;
  }, [currentStep, totalSteps, isCurrentStepValid]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Only handle shortcuts when form is focused
      if (!document.activeElement?.closest('[data-form-container]')) {
        return;
      }

      // Ctrl/Cmd + Enter: Submit or go to next step
      if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
        event.preventDefault();
        if (isCurrentStepValid) {
          if (currentStep === totalSteps - 1) {
            // Submit form
            void handleSubmit();
          } else {
            nextStep();
          }
        }
      }

      // Ctrl/Cmd + Left Arrow: Previous step
      if ((event.ctrlKey || event.metaKey) && event.key === 'ArrowLeft') {
        event.preventDefault();
        if (currentStep > 0) {
          prevStep();
        }
      }

      // Ctrl/Cmd + Right Arrow: Next step
      if ((event.ctrlKey || event.metaKey) && event.key === 'ArrowRight') {
        event.preventDefault();
        if (isCurrentStepValid && currentStep < totalSteps - 1) {
          nextStep();
        }
      }

      // Number keys 1-9: Jump to step
      if (event.key >= '1' && event.key <= '9') {
        const stepNumber = parseInt(event.key) - 1;
        if (stepNumber < totalSteps) {
          event.preventDefault();
          goToStep(stepNumber);
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [currentStep, totalSteps, isCurrentStepValid, nextStep, prevStep, goToStep, methods]);

  // Focus management
  const focusFirstField = useCallback(() => {
    const firstField = document.querySelector('[data-form-container] input, [data-form-container] select, [data-form-container] textarea') as HTMLElement;
    if (firstField) {
      firstField.focus();
    }
  }, []);

  const focusNextField = useCallback(() => {
    const currentField = document.activeElement as HTMLElement;
    if (currentField) {
      const nextField = currentField.parentElement?.querySelector('input, select, textarea') as HTMLElement;
      if (nextField) {
        nextField.focus();
      }
    }
  }, []);

  return {
    focusFirstField,
    focusNextField,
    announceStepChange: (step: number) => {
      const announcement = `Now on step ${step + 1} of ${totalSteps}`;
      const liveRegion = document.getElementById('form-live-region');
      if (liveRegion) {
        liveRegion.textContent = announcement;
      }
    }
  };
};

/**
 * Hook for field-level accessibility
 */
export const useFieldAccessibility = (fieldId: string, _fieldLabel: string) => {
  const { methods } = useFormContext();
  const formErrors = methods.formState.errors;
  const hasError = !!formErrors[fieldId];

  // Generate unique IDs for accessibility
  const fieldIdWithPrefix = `field-${fieldId}`;
  const errorId = `${fieldIdWithPrefix}-error`;
  const helpId = `${fieldIdWithPrefix}-help`;

  // ARIA attributes
  const getAriaAttributes = () => ({
    id: fieldIdWithPrefix,
    'aria-invalid': hasError,
    'aria-describedby': [
      hasError ? errorId : null,
      helpId
    ].filter(Boolean).join(' ') || undefined,
    'aria-required': true
  });

  return {
    fieldIdWithPrefix,
    errorId,
    helpId,
    hasError,
    getAriaAttributes
  };
};
