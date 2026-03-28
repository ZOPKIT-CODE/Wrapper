import React, { useEffect, useRef } from 'react';
import { Check, ChevronRight, FileText } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useFormContext } from '../contexts/FormContext';

/**
 * Enhanced progress indicator component with sidebar layout using context
 */
export const ProgressIndicator: React.FC<{ className?: string }> = ({ className }) => {
  const {
    currentStep,
    config,
    goToStep
  } = useFormContext();

  const stepTitles = config.steps.map(step => step.title);
  const indicatorRef = useRef<HTMLDivElement>(null);
  
  // Animate progress indicator on step change
  useEffect(() => {
    if (!indicatorRef.current) return;

    const stepItems = Array.from(indicatorRef.current.querySelectorAll('.step-item'));
    
    stepItems.forEach((item, index) => {
      const element = item as HTMLElement;
      element.style.opacity = '0.7';
      element.style.transition = 'opacity 0.3s ease-out';
      
      setTimeout(() => {
        element.style.opacity = '1';
      }, index * 100);
    });
  }, [currentStep]);
  
  // Define sub-steps for each step based on actual step content
  const stepSubSteps: Record<number, string[]> = React.useMemo(() => {
    const subSteps: Record<number, string[]> = {};
    
    config.steps.forEach((step, index) => {
      // Generate sub-steps based on field types or step content
      if (step.fields.some(field => field.type === 'select')) {
        subSteps[index] = ['Selection', 'Details'];
      } else if (step.fields.some(field => field.type === 'switch' || field.type === 'checkbox')) {
        subSteps[index] = ['Preferences', 'Settings'];
      } else if (step.fields.some(field => field.id.includes('address') || field.id.includes('street'))) {
        subSteps[index] = ['Address', 'Location'];
      } else {
        subSteps[index] = ['Basic Info', 'Details'];
      }
    });
    
    return subSteps;
  }, [config.steps]);

  // Function to get sub-steps for a specific step
  const getSubStepsForStep = (stepIndex: number): string[] | null => {
    return stepSubSteps[stepIndex] || null;
  };
  return (
    <div ref={indicatorRef} className={cn('w-80 border-r border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-8 h-full', className)}>
      {/* Brand/Logo Section */}
      <div className="mb-12">
        <div className="flex items-center space-x-3 mb-2">
          <div className="w-8 h-8 bg-blue-600 dark:bg-blue-500 rounded-lg flex items-center justify-center">
            <span className="text-white font-bold text-sm">G</span>
          </div>
          <span className="text-xl font-semibold text-[#1B2E5A] dark:text-gray-100">Zopkit</span>
        </div>
      </div>

      {/* Steps Navigation */}
      <div className="space-y-1">
        {stepTitles.map((title, index) => {
          const isCompleted = index < currentStep;
          const isCurrent = index === currentStep;
          const isUpcoming = index > currentStep;

          return (
            <div key={index} className="space-y-2">
              {/* Main Step */}
              <div
                className={cn(
                  'step-item flex items-center space-x-3 py-3 px-4 rounded-lg transition-all duration-200',
                  isCurrent && 'bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700',
                  isCompleted && 'hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer',
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
                    isCompleted && 'bg-green-500 dark:bg-green-400 border-green-500 dark:border-green-400 text-white',
                    isCurrent && 'bg-blue-600 dark:bg-blue-500 border-blue-600 dark:border-blue-500 text-white',
                    isUpcoming && 'bg-gray-200 dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-500 dark:text-gray-400'
                  )}
                >
                  {isCompleted ? (
                    <Check className="w-4 h-4" />
                  ) : (
                    <span className="text-sm font-semibold">{index + 1}</span>
                  )}
                </div>

                {/* Step Title */}
                <div className="flex-1">
                  <p
                    className={cn(
                      'text-sm font-medium transition-colors',
                      isCompleted && 'text-gray-500 dark:text-gray-400',
                      isCurrent && 'text-blue-700 dark:text-blue-300 font-semibold',
                      isUpcoming && 'text-gray-400 dark:text-gray-500'
                    )}
                  >
                    {title.toUpperCase()}
                  </p>
                </div>

                {/* Current Step Indicator */}
                {isCurrent && (
                  <ChevronRight className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                )}
              </div>

              {/* Sub-steps for current step (if any) */}
              {isCurrent && getSubStepsForStep(index) && (
                <div className="ml-11 space-y-1">
                  {getSubStepsForStep(index)!.map((subStep, subIndex) => (
                    <div 
                      key={subIndex}
                      className={cn(
                        'flex items-center space-x-2 py-1 px-3 rounded-md',
                        subIndex === 0 ? 'bg-blue-100 dark:bg-blue-900/30' : ''
                      )}
                    >
                      <span className={cn(
                        'text-xs',
                        subIndex === 0 ? 'font-medium text-blue-700 dark:text-blue-300' : 'text-gray-500 dark:text-gray-400'
                      )}>
                        {subStep}
                      </span>
                      {subIndex === 0 && <ChevronRight className="w-3 h-3 text-blue-600 dark:text-blue-400" />}
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Decorative Element */}
      <div className="mt-16 flex justify-center">
        <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center opacity-60">
          <FileText className="w-8 h-8 text-blue-400 dark:text-blue-500" />
        </div>
      </div>
    </div>
  );
};
