import React from 'react';
import { Check, ChevronRight, FileText, Clock, AlertCircle, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useFormContext } from '../contexts/FormContext';

/**
 * Advanced progress indicator with enhanced features using context
 */
export const AdvancedProgressIndicator: React.FC<{ className?: string }> = ({ className }) => {
  const {
    currentStep,
    totalSteps,
    config,
    goToStep,
    isCurrentStepValid,
    methods,
    debug
  } = useFormContext();

  const stepTitles = config.steps.map(step => step.title);
  const formValues = methods.getValues();
  const formErrors = methods.formState.errors;

  // Calculate completion percentage
  const completionPercentage = ((currentStep + 1) / totalSteps) * 100;

  // Check if a step has errors
  const stepHasErrors = (stepIndex: number) => {
    const stepConfig = config.steps[stepIndex];
    return stepConfig.fields.some(field => formErrors[field.id]);
  };

  // Check if a step is completed (has all required fields filled)
  const stepIsCompleted = (stepIndex: number) => {
    if (stepIndex > currentStep) return false;
    if (stepIndex < currentStep) return true;
    
    const stepConfig = config.steps[stepIndex];
    return stepConfig.fields
      .filter(field => field.required)
      .every(field => {
        const value = formValues[field.id];
        return value !== null && value !== undefined && value !== '';
      });
  };

  // Get step status
  const getStepStatus = (stepIndex: number) => {
    if (stepIndex < currentStep) return 'completed';
    if (stepIndex === currentStep) {
      if (stepHasErrors(stepIndex)) return 'error';
      if (stepIsCompleted(stepIndex)) return 'completed';
      return 'current';
    }
    return 'upcoming';
  };

  return (
    <div className={cn('w-80 bg-white border-r border-gray-200 p-8 h-full flex flex-col', className)}>
      {/* Brand/Logo Section */}
      <div className="mb-8">
        <div className="flex items-center space-x-3 mb-4">
          <div className="w-8 h-8 bg-[#1B2E5A] rounded-lg flex items-center justify-center">
            <span className="text-white font-bold text-sm">G</span>
          </div>
          <span className="text-xl font-semibold text-[#1B2E5A]">Zopkit</span>
        </div>
        
        {/* Progress Bar */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm text-gray-600">
            <span>Step {currentStep + 1} of {totalSteps}</span>
            <span>{Math.round(completionPercentage)}% complete</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className="bg-[#1B2E5A] h-2 rounded-full transition-all duration-300"
              style={{ width: `${completionPercentage}%` }}
            />
          </div>
        </div>
      </div>

      {/* Steps Navigation */}
      <div className="flex-1 space-y-1">
        {stepTitles.map((title, index) => {
          const status = getStepStatus(index);
          const isCompleted = status === 'completed';
          const isCurrent = status === 'current';
          const isError = status === 'error';
          const isUpcoming = status === 'upcoming';

          return (
            <div key={index} className="space-y-2">
              {/* Main Step */}
              <div
                className={cn(
                  'flex items-center space-x-3 py-3 px-4 rounded-lg transition-all duration-200',
                  isCurrent && 'bg-blue-50 border border-blue-200',
                  isCompleted && 'hover:bg-gray-50 cursor-pointer',
                  isError && 'bg-red-50 border border-red-200',
                  isUpcoming && 'opacity-60'
                )}
                onClick={() => {
                  if (isCompleted || isCurrent) {
                    goToStep(index);
                  }
                }}
              >
                {/* Step Circle */}
                <div
                  className={cn(
                    'flex items-center justify-center w-8 h-8 rounded-full border-2 transition-all duration-200',
                    isCompleted && 'bg-green-500 border-green-500 text-white',
                    isCurrent && !isError && 'bg-[#1B2E5A] border-[#1B2E5A] text-white',
                    isError && 'bg-red-500 border-red-500 text-white',
                    isUpcoming && 'bg-gray-200 border-gray-300 text-gray-500'
                  )}
                >
                  {isCompleted ? (
                    <Check className="w-4 h-4" />
                  ) : isError ? (
                    <AlertCircle className="w-4 h-4" />
                  ) : (
                    <span className="text-sm font-semibold">{index + 1}</span>
                  )}
                </div>

                {/* Step Title */}
                <div className="flex-1">
                  <p
                    className={cn(
                      'text-sm font-medium transition-colors',
                      isCompleted && 'text-gray-500',
                      isCurrent && !isError && 'text-blue-700 font-semibold',
                      isError && 'text-red-700 font-semibold',
                      isUpcoming && 'text-gray-400'
                    )}
                  >
                    {title.toUpperCase()}
                  </p>
                </div>

                {/* Status Icons */}
                <div className="flex items-center space-x-1">
                  {isCurrent && (
                    <ChevronRight className="w-4 h-4 text-blue-600" />
                  )}
                  {isError && (
                    <AlertCircle className="w-4 h-4 text-red-500" />
                  )}
                  {isCompleted && (
                    <CheckCircle2 className="w-4 h-4 text-green-500" />
                  )}
                </div>
              </div>

              {/* Sub-steps for current step */}
              {isCurrent && (
                <div className="ml-11 space-y-1">
                  <div className="flex items-center space-x-2 py-1 px-3 rounded-md bg-blue-100">
                    <Clock className="w-3 h-3 text-blue-600" />
                    <span className="text-xs font-medium text-blue-700">
                      {isCurrentStepValid ? 'Ready to proceed' : 'Complete required fields'}
                    </span>
                  </div>
                </div>
              )}

              {/* Error details for error step */}
              {isError && (
                <div className="ml-11 space-y-1">
                  <div className="flex items-center space-x-2 py-1 px-3 rounded-md bg-red-100">
                    <AlertCircle className="w-3 h-3 text-red-600" />
                    <span className="text-xs font-medium text-red-700">
                      Please fix errors to continue
                    </span>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Debug Information */}
      {debug && (
        <div className="mt-6 p-3 bg-gray-100 rounded-lg">
          <h4 className="text-xs font-medium text-gray-700 mb-2">Debug Info</h4>
          <div className="space-y-1 text-xs text-gray-600">
            <div>Current: {currentStep + 1}</div>
            <div>Valid: {isCurrentStepValid ? 'Yes' : 'No'}</div>
            <div>Errors: {Object.keys(formErrors).length}</div>
          </div>
        </div>
      )}

      {/* Decorative Element */}
      <div className="mt-8 flex justify-center">
        <div className="w-16 h-16 bg-blue-100 rounded-lg flex items-center justify-center opacity-60">
          <FileText className="w-8 h-8 text-blue-400" />
        </div>
      </div>
    </div>
  );
};
