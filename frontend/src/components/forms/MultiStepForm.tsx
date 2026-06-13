import React, { useMemo, useState, useRef } from 'react'
import { logger } from '@/lib/logger'
import { useForm, FormProvider as RHFProvider } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { cn } from '@/lib/utils'
import {
  MultiStepFormProps,
  FormField,
  FormValue,
  FieldType,
  FieldComponentProps,
} from './types'
import { FIELD_COMPONENTS } from './field-components'
import { EnhancedValidation } from './validation/EnhancedValidation'
import { ProgressIndicator } from './components/ProgressIndicator'
import { StepNavigation } from './components/StepNavigation'
import { FormContextValue } from './contexts/FormContext'
import { FormErrorBoundary } from './components/FormErrorBoundary'
import { EnhancedFormContent } from './components/EnhancedFormContent'
import { FormProvider } from './contexts/FormContext'
import { PersistenceWrapper } from './components/PersistenceWrapper'

/**
 * Multi-step form component with config-driven design
 */
export const MultiStepForm: React.FC<MultiStepFormProps> = ({
  config,
  onSubmit,
  fieldComponents = {},
  ProgressIndicator: CustomProgressIndicator,
  StepNavigation: CustomStepNavigation,
  initialValues = {},
  debug = false,
  className,
  children,
  // Enhanced props
  persistence = { type: 'localStorage' },
  animations = true,
  accessibility = true,
}) => {
  // Local state management - no need for Zustand
  const [currentStep, setCurrentStep] = useState(0)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [transitionDirection, setTransitionDirection] = useState<
    'forward' | 'backward' | 'none'
  >('none')
  const previousStepRef = useRef(0)

  // Get current step configuration
  const currentStepConfig = config.steps[currentStep]

  // Create validation schema for current step using enhanced validation
  const currentStepSchema = useMemo(() => {
    return EnhancedValidation.createStepSchema(currentStepConfig.fields)
  }, [currentStepConfig])

  // Initialize form with react-hook-form
  const methods = useForm({
    resolver: zodResolver(currentStepSchema),
    defaultValues: initialValues,
    mode: 'onSubmit', // Only validate on submit initially
    reValidateMode: 'onChange', // Re-validate on change after first validation
    shouldFocusError: false,
    criteriaMode: 'firstError',
    // Prevent validation on initial render
    shouldUnregister: false,
    // Don't validate on mount
    shouldUseNativeValidation: false,
  })

  // Form values are managed by react-hook-form internally
  // No need for useEffect to sync values

  // Helper functions for state management
  // Values are managed by react-hook-form internally

  const nextStep = () => {
    const nextStepIndex = currentStep + 1
    setCurrentStep(nextStepIndex)
  }

  const prevStep = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1)
    }
  }

  const goToStep = (step: number) => {
    if (step >= 0 && step < config.steps.length) {
      setCurrentStep(step)
    }
  }

  // Handle field value changes
  const handleFieldChange = (fieldId: string, value: FormValue) => {
    methods.setValue(fieldId, value, {
      shouldValidate: false,
      shouldDirty: true,
    })
  }

  // Handle field blur
  const handleFieldBlur = (fieldId: string) => {
    // Trigger validation for this field when user blurs
    methods.trigger(fieldId)
  }

  // Validate current step
  const validateCurrentStep = async (): Promise<boolean> => {
    try {
      const isValid = await methods.trigger()
      return isValid
    } catch (error) {
      console.error('Step validation error:', error)
      return false
    }
  }

  // Handle next step
  const handleNext = async () => {
    const isValid = await validateCurrentStep()
    if (isValid) {
      nextStep()
    }
  }

  // Handle previous step
  const handlePrev = () => {
    prevStep()
  }

  // Handle form submission
  const handleSubmit = async () => {
    const isValid = await validateCurrentStep()
    if (isValid) {
      setIsSubmitting(true)
      try {
        const formValues = methods.getValues()
        await onSubmit(formValues)
        setIsSubmitting(false)
      } catch (error) {
        console.error('Form submission error:', error)
        setIsSubmitting(false)
      }
    }
  }

  // Check if current step is valid
  const isCurrentStepValid = useMemo(() => {
    // Only validate if the form has been touched or submitted
    const isDirty = methods.formState.isDirty
    const isSubmitted = methods.formState.isSubmitted
    const touchedFields = Object.keys(methods.formState.touchedFields).length

    // If form hasn't been touched and not submitted, consider it valid
    if (!isDirty && !isSubmitted && touchedFields === 0) {
      return true
    }

    // Use react-hook-form's built-in validation state
    const isValid = methods.formState.isValid

    return isValid
  }, [
    methods.formState.isValid,
    methods.formState.isDirty,
    methods.formState.isSubmitted,
    methods.formState.touchedFields,
  ])

  // Render field component
  const renderField = (field: FormField) => {
    const FieldComponent =
      fieldComponents[field.type] ||
      (
        FIELD_COMPONENTS as Partial<
          Record<FieldType, React.ComponentType<FieldComponentProps>>
        >
      )[field.type]

    if (!FieldComponent) {
      logger.warn(`No component found for field type: ${field.type}`)
      return null
    }

    // Check conditional rendering
    if (field.conditional) {
      const watchedValue = methods.watch(field.conditional.watch)
      const shouldShow = evaluateCondition(watchedValue, field.conditional)
      if (!shouldShow) {
        return null
      }
    }

    return (
      <FieldComponent
        key={field.id}
        field={field}
        value={methods.watch(field.id)}
        onChange={(value: FormValue) => handleFieldChange(field.id, value)}
        onBlur={() => handleFieldBlur(field.id)}
        disabled={isSubmitting}
      />
    )
  }

  // Evaluate conditional logic
  const evaluateCondition = (
    value: FormValue,
    conditional: { operator?: string; value: FormValue | FormValue[] }
  ): boolean => {
    const { operator = 'equals', value: expectedValue } = conditional

    switch (operator) {
      case 'equals':
        return value === expectedValue
      case 'not_equals':
        return value !== expectedValue
      case 'in':
        return (
          Array.isArray(expectedValue) &&
          expectedValue.some((v: FormValue) => v === value)
        )
      case 'not_in':
        return (
          Array.isArray(expectedValue) &&
          !expectedValue.some((v: FormValue) => v === value)
        )
      case 'contains':
        return (
          value !== null &&
          expectedValue !== null &&
          String(value).includes(String(expectedValue))
        )
      case 'not_contains':
        return (
          value === null ||
          expectedValue === null ||
          !String(value).includes(String(expectedValue))
        )
      default:
        return true
    }
  }

  // Get step titles for progress indicator
  const stepTitles = config.steps.map((step) => step.title)

  // Define sub-steps for each step based on actual step content
  const stepSubSteps: Record<number, string[]> = useMemo(() => {
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

  // Enhanced features will be used inside the FormProvider context

  // Enhanced navigation with animations
  const enhancedNextStep = () => {
    setTransitionDirection('forward')
    previousStepRef.current = currentStep
    nextStep()
  }

  const enhancedPrevStep = () => {
    setTransitionDirection('backward')
    previousStepRef.current = currentStep
    prevStep()
  }

  const enhancedGoToStep = (step: number) => {
    setTransitionDirection(step > currentStep ? 'forward' : 'backward')
    previousStepRef.current = currentStep
    goToStep(step)
  }

  // Create form context value
  const formContextValue: FormContextValue = {
    config,
    currentStep,
    totalSteps: config.steps.length,
    currentStepConfig,
    isSubmitting,
    isCurrentStepValid,
    methods,
    nextStep: enhancedNextStep,
    prevStep: enhancedPrevStep,
    goToStep: enhancedGoToStep,
    handleFieldChange,
    handleFieldBlur,
    validateCurrentStep,
    handleSubmit: handleSubmit, // Use original handleSubmit, will be enhanced by EnhancedFormProvider
    debug,
  }

  return (
    <FormErrorBoundary>
      <FormProvider value={formContextValue}>
        <PersistenceWrapper persistence={persistence}>
          <div
            className={cn('flex min-h-screen', className)}
            data-form-container
          >
            {/* Sidebar Progress Indicator */}
            {currentStepConfig.showProgress && (
              <div className="w-80 flex-shrink-0 border-r border-gray-200">
                {CustomProgressIndicator ? (
                  <CustomProgressIndicator
                    currentStep={currentStep}
                    totalSteps={config.steps.length}
                    stepTitles={stepTitles}
                    stepSubSteps={stepSubSteps}
                    showStepNumbers={config.showStepNumbers}
                  />
                ) : (
                  <ProgressIndicator />
                )}
              </div>
            )}

            {/* Main Form Content */}
            <div className="relative flex flex-1 flex-col">
              <RHFProvider {...methods}>
                <div className="flex-1 pb-20">
                  {/* Header */}
                  <div className="border-b border-gray-200 px-8 py-6">
                    <div className="flex items-start justify-between">
                      <div>
                        <h1 className="mb-2 text-3xl font-bold">
                          {currentStepConfig.title}
                        </h1>
                        {currentStepConfig.description && (
                          <p className="text-lg">
                            {currentStepConfig.description}
                          </p>
                        )}
                      </div>
                      <div className="text-right">
                        <p className="text-sm">Having troubles?</p>
                        <a
                          href="#"
                          className="text-sm font-medium text-blue-600 hover:text-blue-700"
                        >
                          Get Help
                        </a>
                      </div>
                    </div>
                  </div>

                  {/* Enhanced Form Content */}
                  <EnhancedFormContent
                    animations={animations}
                    accessibility={accessibility}
                    persistence={persistence}
                    debug={debug}
                    currentStep={currentStep}
                    transitionDirection={transitionDirection}
                    renderField={renderField}
                    currentStepConfig={currentStepConfig}
                    methods={methods}
                    isCurrentStepValid={isCurrentStepValid}
                  >
                    {children}
                  </EnhancedFormContent>
                </div>
              </RHFProvider>

              {/* Fixed Bottom Navigation */}
              <div className="absolute right-0 bottom-0 left-0 z-50 border-t border-gray-200 shadow-lg">
                <div className="px-8 py-6">
                  <div className="mx-auto max-w-2xl">
                    {CustomStepNavigation ? (
                      <CustomStepNavigation
                        currentStep={currentStep}
                        totalSteps={config.steps.length}
                        isCurrentStepValid={isCurrentStepValid}
                        isSubmitting={isSubmitting}
                        allowBack={config.allowBackNavigation !== false}
                        onNext={handleNext}
                        onPrev={handlePrev}
                        onSubmit={handleSubmit}
                      />
                    ) : (
                      <StepNavigation
                        currentStep={currentStep}
                        totalSteps={config.steps.length}
                        isCurrentStepValid={isCurrentStepValid}
                        isSubmitting={isSubmitting}
                        allowBack={config.allowBackNavigation !== false}
                        onNext={handleNext}
                        onPrev={handlePrev}
                        onSubmit={handleSubmit}
                      />
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </PersistenceWrapper>
      </FormProvider>
    </FormErrorBoundary>
  )
}
