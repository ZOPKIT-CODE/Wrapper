import React from 'react';
import { Check, ChevronRight, FileText, Clock, AlertCircle, CheckCircle2, BarChart3 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useFormContext } from '../contexts/FormContext';
import { config as appConfig } from '@/lib/config';

/**
 * Custom progress indicator that can be used as children of MultiStepForm
 * This demonstrates how to create advanced progress indicators using context
 */
export const CustomProgressIndicator: React.FC<{ className?: string }> = ({ className }) => {
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

  // Calculate detailed progress metrics
  const totalFields = config.steps.reduce((acc, step) => acc + step.fields.length, 0);
  const completedFields = Object.keys(formValues).filter(key => {
    const value = formValues[key];
    return value !== null && value !== undefined && value !== '';
  }).length;
  const fieldCompletionPercentage = totalFields > 0 ? (completedFields / totalFields) * 100 : 0;

  // Check step completion status
  const getStepCompletionStatus = (stepIndex: number) => {
    const stepConfig = config.steps[stepIndex];
    const stepFields = stepConfig.fields;
    const completedFields = stepFields.filter(field => {
      const value = formValues[field.id];
      return value !== null && value !== undefined && value !== '';
    }).length;

    return {
      completed: completedFields,
      total: stepFields.length,
      percentage: stepFields.length > 0 ? (completedFields / stepFields.length) * 100 : 0
    };
  };

  return (
    <div className={cn('w-80 bg-gradient-to-b from-blue-50 to-white border-r border-gray-200 p-8 h-full flex flex-col', className)}>
      {/* Enhanced Header */}
      <div className="mb-8">
        <div className="flex items-center space-x-3 mb-4">
          <div className="w-24 h-24 rounded-xl overflow-hidden shadow-lg">
            <img
              src={appConfig.LOGO_URL}
              alt="Zopkit"
              className="w-full h-full object-fit"
            />
          </div>
          <div>
            <span className="text-xl font-bold text-[#1B2E5A]">Zopkit</span>
            <p className="text-xs text-gray-500">Business Setup</p>
          </div>
        </div>

        {/* Enhanced Progress Bar */}
        <div className="space-y-3">
          <div className="flex justify-between items-center">
            <span className="text-sm font-medium text-gray-700">Progress</span>
            <span className="text-sm font-bold text-blue-600">{Math.round(fieldCompletionPercentage)}%</span>
          </div>

          <div className="space-y-2">
            <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
              <div
                className="bg-gradient-to-r from-blue-500 to-blue-600 h-3 rounded-full transition-all duration-500 ease-out"
                style={{ width: `${fieldCompletionPercentage}%` }}
              />
            </div>

            <div className="flex justify-between text-xs text-gray-500">
              <span>Step {currentStep + 1} of {totalSteps}</span>
              <span>{completedFields} of {totalFields} fields</span>
            </div>
          </div>
        </div>
      </div>

      {/* Enhanced Steps Navigation */}
      <div className="flex-1 space-y-2">
        {stepTitles.map((title, index) => {
          const isCompleted = index < currentStep;
          const isCurrent = index === currentStep;
          const isUpcoming = index > currentStep;
          const stepStatus = getStepCompletionStatus(index);
          const hasErrors = config.steps[index].fields.some(field => formErrors[field.id]);

          return (
            <div key={index} className="space-y-2">
              {/* Main Step */}
              <div
                className={cn(
                  'group flex items-center space-x-3 py-4 px-4 rounded-xl transition-all duration-200',
                  isCurrent && 'bg-gradient-to-r from-blue-50 to-blue-100 border-2 border-blue-200 shadow-sm',
                  isCompleted && 'hover:bg-gray-50 cursor-pointer hover:shadow-sm',
                  isUpcoming && 'opacity-60',
                  hasErrors && isCurrent && 'bg-red-50 border-2 border-red-200'
                )}
                onClick={() => {
                  if (isCompleted || isCurrent) {
                    goToStep(index);
                  }
                }}
              >
                {/* Enhanced Step Circle */}
                <div className="relative">
                  <div
                    className={cn(
                      'flex items-center justify-center w-10 h-10 rounded-full border-2 transition-all duration-200',
                      isCompleted && 'bg-green-500 border-green-500 text-white shadow-lg',
                      isCurrent && !hasErrors && 'bg-[#1B2E5A] border-[#1B2E5A] text-white shadow-lg',
                      hasErrors && isCurrent && 'bg-red-500 border-red-500 text-white shadow-lg',
                      isUpcoming && 'bg-gray-200 border-gray-300 text-gray-500'
                    )}
                  >
                    {isCompleted ? (
                      <Check className="w-5 h-5" />
                    ) : hasErrors && isCurrent ? (
                      <AlertCircle className="w-5 h-5" />
                    ) : (
                      <span className="text-sm font-bold">{index + 1}</span>
                    )}
                  </div>

                  {/* Progress ring for current step */}
                  {isCurrent && !hasErrors && (
                    <div className="absolute -inset-1 rounded-full border-2 border-blue-300 animate-pulse" />
                  )}
                </div>

                {/* Step Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <p
                      className={cn(
                        'text-sm font-semibold transition-colors truncate',
                        isCompleted && 'text-gray-600',
                        isCurrent && !hasErrors && 'text-blue-800',
                        hasErrors && isCurrent && 'text-red-800',
                        isUpcoming && 'text-gray-400'
                      )}
                    >
                      {title.toUpperCase()}
                    </p>

                    {/* Status Icons */}
                    <div className="flex items-center space-x-1">
                      {isCurrent && !hasErrors && (
                        <Clock className="w-4 h-4 text-blue-600" />
                      )}
                      {hasErrors && isCurrent && (
                        <AlertCircle className="w-4 h-4 text-red-500" />
                      )}
                      {isCompleted && (
                        <CheckCircle2 className="w-4 h-4 text-green-500" />
                      )}
                    </div>
                  </div>

                  {/* Step completion details */}
                  <div className="mt-1">
                    <div className="flex items-center space-x-2">
                      <BarChart3 className="w-3 h-3 text-gray-400" />
                      <span className="text-xs text-gray-500">
                        {stepStatus.completed}/{stepStatus.total} fields
                      </span>
                      <div className="flex-1 bg-gray-200 rounded-full h-1.5 ml-2">
                        <div
                          className="bg-blue-500 h-1.5 rounded-full transition-all duration-300"
                          style={{ width: `${stepStatus.percentage}%` }}
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Navigation Arrow */}
                {(isCurrent || isCompleted) && (
                  <ChevronRight className="w-4 h-4 text-gray-400 group-hover:text-gray-600 transition-colors" />
                )}
              </div>

              {/* Enhanced Sub-steps */}
              {isCurrent && (
                <div className="ml-14 space-y-1">
                  <div className={cn(
                    'flex items-center space-x-2 py-2 px-3 rounded-lg text-xs font-medium',
                    hasErrors
                      ? 'bg-red-100 text-red-700'
                      : 'bg-blue-100 text-blue-700'
                  )}>
                    {hasErrors ? (
                      <AlertCircle className="w-3 h-3" />
                    ) : (
                      <CheckCircle2 className="w-3 h-3" />
                    )}
                    <span>
                      {hasErrors
                        ? 'Please fix errors to continue'
                        : isCurrentStepValid
                          ? 'Ready to proceed'
                          : 'Complete required fields'
                      }
                    </span>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Enhanced Debug Information */}
      {debug && (
        <div className="mt-6 p-4 bg-gray-100 rounded-lg border">
          <h4 className="text-sm font-semibold text-[#1B2E5A] mb-3 flex items-center">
            <BarChart3 className="w-4 h-4 mr-2" />
            Debug Information
          </h4>
          <div className="space-y-2 text-xs text-gray-600">
            <div className="flex justify-between">
              <span>Current Step:</span>
              <span className="font-medium">{currentStep + 1}</span>
            </div>
            <div className="flex justify-between">
              <span>Form Valid:</span>
              <span className={cn('font-medium', isCurrentStepValid ? 'text-green-600' : 'text-red-600')}>
                {isCurrentStepValid ? 'Yes' : 'No'}
              </span>
            </div>
            <div className="flex justify-between">
              <span>Field Errors:</span>
              <span className="font-medium text-red-600">{Object.keys(formErrors).length}</span>
            </div>
            <div className="flex justify-between">
              <span>Completion:</span>
              <span className="font-medium text-blue-600">{Math.round(fieldCompletionPercentage)}%</span>
            </div>
          </div>
        </div>
      )}

      {/* Enhanced Decorative Element */}
      <div className="mt-8 flex justify-center">
        <div className="w-20 h-20 bg-gradient-to-br from-blue-100 to-blue-200 rounded-2xl flex items-center justify-center opacity-60 shadow-inner">
          <FileText className="w-10 h-10 text-blue-500" />
        </div>
      </div>
    </div>
  );
};
