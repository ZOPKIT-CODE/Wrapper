// Main components
export { MultiStepForm } from './MultiStepForm'
export { ProgressIndicator } from './components/ProgressIndicator'
export { StepNavigation } from './components/StepNavigation'

// Enhanced components
export {
  FormErrorBoundary,
  useFormErrorBoundary,
} from './components/FormErrorBoundary'
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
export {
  useFormAccessibility,
  useFieldAccessibility,
} from './hooks/useFormAccessibility'
export { useFormPersistence, useAutoSave } from './hooks/useFormPersistence'
export {
  useFormPerformance,
  useVirtualScrolling,
  useLazyFieldComponents,
  useFormAnalytics,
} from './hooks/useFormPerformance'

// Field components
// Explicitly re-exported so the component values win over the same-named
// type interfaces in ./types (both are surfaced via `export *`, which would
// otherwise collide). The interfaces remain importable from './types'.
export {
  TextField,
  TextareaField,
  NumberField,
  DateField,
  SelectField,
  RadioField,
  CheckboxField,
  SwitchField,
  FileField,
  PasswordField,
  EmailField,
  UrlField,
  TelField,
  SearchField,
  ColorField,
  RangeField,
  FIELD_COMPONENTS,
} from './field-components'

// Types
export * from './types'

// Examples (configs & schemas only)
export { onboardingFormConfig } from './examples/onboardingConfig'
export * from './examples/validationSchemas'
