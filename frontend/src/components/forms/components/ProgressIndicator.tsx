import React, { useEffect, useRef } from 'react'
import { Check, ChevronRight, FileText } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useFormContext } from '../contexts/FormContext'

/**
 * Enhanced progress indicator component with sidebar layout using context
 */
export const ProgressIndicator: React.FC<{ className?: string }> = ({
  className,
}) => {
  const { currentStep, config, goToStep } = useFormContext()

  const stepTitles = config.steps.map((step) => step.title)
  const indicatorRef = useRef<HTMLDivElement>(null)

  // Animate progress indicator on step change
  useEffect(() => {
    if (!indicatorRef.current) return

    const stepItems = Array.from(
      indicatorRef.current.querySelectorAll('.step-item')
    )

    stepItems.forEach((item, index) => {
      const element = item as HTMLElement
      element.style.opacity = '0.7'
      element.style.transition = 'opacity 0.3s ease-out'

      setTimeout(() => {
        element.style.opacity = '1'
      }, index * 100)
    })
  }, [currentStep])

  // Define sub-steps for each step based on actual step content
  const stepSubSteps: Record<number, string[]> = React.useMemo(() => {
    const subSteps: Record<number, string[]> = {}

    config.steps.forEach((step, index) => {
      // Generate sub-steps based on field types or step content
      if (step.fields.some((field) => field.type === 'select')) {
        subSteps[index] = ['Selection', 'Details']
      } else if (
        step.fields.some(
          (field) => field.type === 'switch' || field.type === 'checkbox'
        )
      ) {
        subSteps[index] = ['Preferences', 'Settings']
      } else if (
        step.fields.some(
          (field) => field.id.includes('address') || field.id.includes('street')
        )
      ) {
        subSteps[index] = ['Address', 'Location']
      } else {
        subSteps[index] = ['Basic Info', 'Details']
      }
    })

    return subSteps
  }, [config.steps])

  // Function to get sub-steps for a specific step
  const getSubStepsForStep = (stepIndex: number): string[] | null => {
    return stepSubSteps[stepIndex] || null
  }
  return (
    <div
      ref={indicatorRef}
      className={cn(
        'h-full w-80 border-r border-gray-200 bg-white p-8',
        className
      )}
    >
      {/* Brand/Logo Section */}
      <div className="mb-12">
        <div className="mb-2 flex items-center space-x-3">
          <div className="bg-primary flex h-8 w-8 items-center justify-center rounded-lg">
            <span className="text-sm font-bold text-white">G</span>
          </div>
          <span className="text-primary text-xl font-semibold">Zopkit</span>
        </div>
      </div>

      {/* Steps Navigation */}
      <div className="space-y-1">
        {stepTitles.map((title, index) => {
          const isCompleted = index < currentStep
          const isCurrent = index === currentStep
          const isUpcoming = index > currentStep

          return (
            <div key={index} className="space-y-2">
              {/* Main Step */}
              <div
                className={cn(
                  'step-item flex items-center space-x-3 rounded-lg px-4 py-3 transition-all duration-200',
                  isCurrent && 'border border-blue-200 bg-blue-50',
                  isCompleted && 'cursor-pointer hover:bg-gray-50',
                  isUpcoming && 'opacity-60'
                )}
                onClick={() => {
                  if (isCompleted || isCurrent) {
                    goToStep(index)
                  }
                }}
              >
                {/* Step Circle */}
                <div
                  className={cn(
                    'flex h-8 w-8 items-center justify-center rounded-full border-2 transition-all duration-200',
                    isCompleted && 'border-green-500 bg-green-500 text-white',
                    isCurrent && 'bg-primary border-primary text-white',
                    isUpcoming && 'border-gray-300 bg-gray-200 text-gray-500'
                  )}
                >
                  {isCompleted ? (
                    <Check className="h-4 w-4" />
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
                      isCurrent && 'font-semibold text-blue-700',
                      isUpcoming && 'text-gray-400'
                    )}
                  >
                    {title.toUpperCase()}
                  </p>
                </div>

                {/* Current Step Indicator */}
                {isCurrent && (
                  <ChevronRight className="h-4 w-4 text-blue-600" />
                )}
              </div>

              {/* Sub-steps for current step (if any) */}
              {isCurrent && getSubStepsForStep(index) && (
                <div className="ml-11 space-y-1">
                  {getSubStepsForStep(index)!.map((subStep, subIndex) => (
                    <div
                      key={subIndex}
                      className={cn(
                        'flex items-center space-x-2 rounded-md px-3 py-1',
                        subIndex === 0 ? 'bg-blue-100' : ''
                      )}
                    >
                      <span
                        className={cn(
                          'text-xs',
                          subIndex === 0
                            ? 'font-medium text-blue-700'
                            : 'text-gray-500'
                        )}
                      >
                        {subStep}
                      </span>
                      {subIndex === 0 && (
                        <ChevronRight className="h-3 w-3 text-blue-600" />
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Decorative Element */}
      <div className="mt-16 flex justify-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-lg bg-blue-100 opacity-60">
          <FileText className="h-8 w-8 text-blue-400" />
        </div>
      </div>
    </div>
  )
}
