import React, { useEffect } from 'react'
import { UseFormReturn, FieldValues } from 'react-hook-form'
import { useFormAccessibility } from '../hooks/useFormAccessibility'
import { useFormPerformance } from '../hooks/useFormPerformance'
import { MotionAnimatedTransition } from './MotionAnimatedTransition'
import { FormConfig, FormField, MultiStepFormProps } from '../types'

interface EnhancedFormContentProps {
  children: React.ReactNode
  animations?: boolean
  accessibility?: boolean
  persistence?: MultiStepFormProps['persistence']
  debug?: boolean
  currentStep: number
  transitionDirection: 'forward' | 'backward' | 'none'
  renderField: (field: FormField) => React.ReactNode
  currentStepConfig: FormConfig['steps'][0]
  methods: UseFormReturn<FieldValues>
  isCurrentStepValid: boolean
}

/**
 * Enhanced form content component that uses context hooks
 */
export const EnhancedFormContent: React.FC<EnhancedFormContentProps> = ({
  children,
  animations = false, // Disabled by default to prevent lag
  accessibility = true,
  persistence = {},
  debug = false,
  currentStep,
  transitionDirection,
  renderField,
  currentStepConfig,
  methods,
  isCurrentStepValid,
}) => {
  // Enhanced features using context
  const { focusFirstField } = useFormAccessibility()
  // const { saveFormData, handleSubmit: persistentHandleSubmit } = useFormPersistence(persistence);
  const { formValues, validationState } = useFormPerformance()

  // Focus first field on step change (accessibility)
  useEffect(() => {
    if (accessibility) {
      focusFirstField()
    }
  }, [currentStep, accessibility, focusFirstField])

  // Use performance data in debug info
  const debugInfo = {
    formValues,
    validationState,
    accessibilityEnabled: accessibility,
  }

  return (
    <>
      {/* Form Content */}
      <div className="px-8 py-8">
        <div className="max-w-2xl">
          {animations ? (
            <MotionAnimatedTransition direction={transitionDirection}>
              <div className="space-y-6">
                {currentStepConfig.fields.map((field) => (
                  <div key={field.id} data-animate>
                    {renderField(field)}
                  </div>
                ))}
              </div>
            </MotionAnimatedTransition>
          ) : (
            <div className="space-y-6">
              {currentStepConfig.fields.map(renderField)}
            </div>
          )}

          {/* Debug Information */}
          {debug && (
            <div className="mt-8 rounded-lg p-4">
              <h4 className="mb-2 font-medium">Enhanced Debug Information</h4>
              <div className="space-y-2 text-sm">
                <div>Current Step: {currentStep + 1}</div>
                <div>
                  Values: {JSON.stringify(methods.getValues(), null, 2)}
                </div>
                <div>Is Valid: {isCurrentStepValid ? 'Yes' : 'No'}</div>
                <div>
                  Required Fields:{' '}
                  {JSON.stringify(
                    currentStepConfig.fields
                      .filter((f) => f.required)
                      .map((f) => f.id),
                    null,
                    2
                  )}
                </div>
                <div>
                  Form State Valid: {methods.formState.isValid ? 'Yes' : 'No'}
                </div>
                <div>
                  Form Errors:{' '}
                  {JSON.stringify(methods.formState.errors, null, 2)}
                </div>
                <div>
                  Accessibility: {accessibility ? 'Enabled' : 'Disabled'}
                </div>
                <div>Animations: {animations ? 'Enabled' : 'Disabled'}</div>
                <div>Persistence: {persistence?.type || 'None'}</div>
                <div>
                  Performance Data: {JSON.stringify(debugInfo, null, 2)}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Children components with form context access */}
      {children && <div className="px-8 pb-8">{children}</div>}
    </>
  )
}
