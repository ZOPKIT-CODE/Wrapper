// Main components
export { MultiStepForm } from './MultiStepForm'
export { ProgressIndicator } from './components/ProgressIndicator'
export { StepNavigation } from './components/StepNavigation'

// Enhanced components
export { FormErrorBoundary, useFormErrorBoundary } from './components/FormErrorBoundary'
export { EnhancedFormContent } from './components/EnhancedFormContent'
export { PersistenceWrapper } from './components/PersistenceWrapper'
export { ConditionalErrorMessage } from './components/ConditionalErrorMessage'
export {
  MotionAnimatedTransition,
  MotionFormFieldSkeleton,
  MotionProgressBar,
  MotionStepIndicator,
  MotionErrorMessage,
  MotionSuccessMessage,
  MotionLoadingSpinner,
} from './components/MotionAnimatedTransition'

// Context
export { FormProvider, useFormContext } from './contexts/FormContext'

// Hooks
export { useFormAccessibility, useFieldAccessibility } from './hooks/useFormAccessibility'
export { useFormPersistence, useAutoSave } from './hooks/useFormPersistence'
export {
  useFormPerformance,
  useVirtualScrolling,
  useLazyFieldComponents,
  useFormAnalytics,
} from './hooks/useFormPerformance'

// Field components
export * from './field-components'

// Types: import from './types' directly (names collide with field components in this barrel)

// Examples (configs & schemas only)
export { onboardingFormConfig } from './examples/onboardingConfig'
export * from './examples/validationSchemas'
