import { z } from 'zod'

/**
 * Union type for all possible form field values
 */
export type FormValue =
  | string
  | number
  | boolean
  | string[]
  | number[]
  | File
  | File[]
  | null
  | undefined

/**
 * Record type for form values
 */
export type FormValues = Record<string, FormValue>

/**
 * Supported field types for the multi-step form
 */
export type FieldType =
  | 'text'
  | 'textarea'
  | 'email'
  | 'password'
  | 'number'
  | 'date'
  | 'select'
  | 'radio'
  | 'checkbox'
  | 'switch'
  | 'file'
  | 'url'
  | 'tel'
  | 'search'
  | 'color'
  | 'range'
  | 'multiSelect'
  | 'dateRange'
  | 'time'
  | 'dateTime'

/**
 * Base field configuration interface
 */
export interface BaseFormField {
  /** Unique identifier for the field */
  id: string
  /** Display label for the field */
  label: string
  /** Field type */
  type: FieldType
  /** Placeholder text */
  placeholder?: string
  /** Help text displayed below the field */
  helpText?: string
  /** Whether the field is required */
  required?: boolean
  /** Whether the field is disabled */
  disabled?: boolean
  /** Default value for the field */
  defaultValue?: FormValue
  /** Custom validation rules */
  validation?: z.ZodSchema<unknown>
  /** Conditional rendering logic */
  conditional?: {
    /** Field to watch for conditional rendering */
    watch: string
    /** Value(s) that trigger the field to show */
    value: FormValue | FormValue[]
    /** Operator for comparison (equals, not_equals, in, not_in, etc.) */
    operator?:
      | 'equals'
      | 'not_equals'
      | 'in'
      | 'not_in'
      | 'contains'
      | 'not_contains'
  }
  /** Custom CSS classes for the field */
  className?: string
}

/**
 * Text input field configuration
 */
export interface TextField extends BaseFormField {
  type: 'text' | 'email' | 'password'
  /** Minimum length validation */
  minLength?: number
  /** Maximum length validation */
  maxLength?: number
  /** Pattern for regex validation */
  pattern?: string
}

/**
 * Textarea field configuration
 */
export interface TextareaField extends BaseFormField {
  type: 'textarea'
  /** Number of rows */
  rows?: number
  /** Minimum length validation */
  minLength?: number
  /** Maximum length validation */
  maxLength?: number
}

/**
 * Number field configuration
 */
export interface NumberField extends BaseFormField {
  type: 'number'
  /** Minimum value */
  min?: number
  /** Maximum value */
  max?: number
  /** Step value for increment/decrement */
  step?: number
}

/**
 * Date field configuration
 */
export interface DateField extends BaseFormField {
  type: 'date'
  /** Minimum date */
  min?: string
  /** Maximum date */
  max?: string
}

/**
 * Select field option
 */
export interface SelectOption {
  /** Option value */
  value: string | number
  /** Option label */
  label: string
  /** Whether the option is disabled */
  disabled?: boolean
}

/**
 * Select field configuration
 */
export interface SelectField extends BaseFormField {
  type: 'select'
  /** Available options */
  options: SelectOption[]
  /** Whether multiple selections are allowed */
  multiple?: boolean
  /** Whether the select is searchable */
  searchable?: boolean
  /** Placeholder for when no option is selected */
  placeholder?: string
}

/**
 * Radio field option
 */
export interface RadioOption {
  /** Option value */
  value: string | number
  /** Option label */
  label: string
  /** Whether the option is disabled */
  disabled?: boolean
}

/**
 * Radio field configuration
 */
export interface RadioField extends BaseFormField {
  type: 'radio'
  /** Available options */
  options: RadioOption[]
  /** Layout direction */
  direction?: 'horizontal' | 'vertical'
}

/**
 * Checkbox field configuration
 */
export interface CheckboxField extends BaseFormField {
  type: 'checkbox'
  /** Text to display next to the checkbox */
  checkboxLabel?: string
}

/**
 * Switch field configuration
 */
export interface SwitchField extends BaseFormField {
  type: 'switch'
  /** Text to display next to the switch */
  switchLabel?: string
}

/**
 * File field configuration
 */
export interface FileField extends BaseFormField {
  type: 'file'
  /** Accepted file types */
  accept?: string
  /** Maximum file size in bytes */
  maxSize?: number
  /** Maximum number of files */
  maxFiles?: number
  /** Whether multiple files are allowed */
  multiple?: boolean
}

/**
 * Password field configuration
 */
export interface PasswordField extends BaseFormField {
  type: 'password'
  /** Minimum password length */
  minLength?: number
  /** Maximum password length */
  maxLength?: number
  /** Password pattern for validation */
  pattern?: string
}

/**
 * Email field configuration
 */
export interface EmailField extends BaseFormField {
  type: 'email'
  /** Minimum email length */
  minLength?: number
  /** Maximum email length */
  maxLength?: number
  /** Email pattern for validation */
  pattern?: string
}

/**
 * URL field configuration
 */
export interface UrlField extends BaseFormField {
  type: 'url'
  /** Minimum URL length */
  minLength?: number
  /** Maximum URL length */
  maxLength?: number
  /** URL pattern for validation */
  pattern?: string
}

/**
 * Telephone field configuration
 */
export interface TelField extends BaseFormField {
  type: 'tel'
  /** Minimum phone length */
  minLength?: number
  /** Maximum phone length */
  maxLength?: number
  /** Phone pattern for validation */
  pattern?: string
}

/**
 * Search field configuration
 */
export interface SearchField extends BaseFormField {
  type: 'search'
  /** Minimum search length */
  minLength?: number
  /** Maximum search length */
  maxLength?: number
  /** Search pattern for validation */
  pattern?: string
}

/**
 * Color field configuration
 */
export interface ColorField extends BaseFormField {
  type: 'color'
  /** Default color value */
  defaultValue?: string
}

/**
 * Range field configuration
 */
export interface RangeField extends BaseFormField {
  type: 'range'
  /** Minimum value */
  min?: number
  /** Maximum value */
  max?: number
  /** Step value */
  step?: number
  /** Whether to allow multiple values */
  multiple?: boolean
}

/**
 * Multi-select field configuration
 */
export interface MultiSelectField extends BaseFormField {
  type: 'multiSelect'
  /** Available options */
  options: SelectOption[]
  /** Maximum number of selections */
  maxSelections?: number
  /** Whether to allow custom values */
  allowCustom?: boolean
  /** Placeholder text for search */
  searchPlaceholder?: string
}

/**
 * Date range field configuration
 */
export interface DateRangeField extends BaseFormField {
  type: 'dateRange'
  /** Minimum date */
  min?: string
  /** Maximum date */
  max?: string
  /** Whether to allow single date selection */
  allowSingleDate?: boolean
}

/**
 * Time field configuration
 */
export interface TimeField extends BaseFormField {
  type: 'time'
  /** Minimum time */
  min?: string
  /** Maximum time */
  max?: string
  /** Time step in minutes */
  step?: number
}

/**
 * DateTime field configuration
 */
export interface DateTimeField extends BaseFormField {
  type: 'dateTime'
  /** Minimum date/time */
  min?: string
  /** Maximum date/time */
  max?: string
  /** Time step in minutes */
  step?: number
}

/**
 * Union type for all field configurations
 */
export type FormField =
  | TextField
  | TextareaField
  | NumberField
  | DateField
  | SelectField
  | RadioField
  | CheckboxField
  | SwitchField
  | FileField
  | PasswordField
  | EmailField
  | UrlField
  | TelField
  | SearchField
  | ColorField
  | RangeField
  | MultiSelectField
  | DateRangeField
  | TimeField
  | DateTimeField

/**
 * Form step configuration
 */
export interface FormStep {
  /** Unique identifier for the step */
  id: string
  /** Step title */
  title: string
  /** Step description */
  description?: string
  /** Fields in this step */
  fields: FormField[]
  /** Custom validation for the entire step */
  validation?: z.ZodSchema<unknown>
  /** Whether to show a progress indicator for this step */
  showProgress?: boolean
  /** Custom CSS classes for the step */
  className?: string
}

/**
 * Main form configuration
 */
export interface FormConfig {
  /** Form title */
  title?: string
  /** Form description */
  description?: string
  /** Form steps */
  steps: FormStep[]
  /** Global form validation schema */
  validation?: z.ZodSchema<unknown>
  /** Whether to show step numbers */
  showStepNumbers?: boolean
  /** Whether to allow going back to previous steps */
  allowBackNavigation?: boolean
  /** Whether to save form state automatically */
  autoSave?: boolean
  /** Custom CSS classes for the form */
  className?: string
}

/**
 * Multi-step form component props
 */
export interface MultiStepFormProps {
  /** Form configuration */
  config: FormConfig
  /** Submit handler */
  onSubmit: (values: FormValues) => void | Promise<void>
  /** Custom field components */
  fieldComponents?: Partial<
    Record<FieldType, React.ComponentType<FieldComponentProps>>
  >
  /** Custom progress indicator component */
  ProgressIndicator?: React.ComponentType<ProgressIndicatorProps>
  /** Custom step navigation component */
  StepNavigation?: React.ComponentType<StepNavigationProps>
  /** Initial form values */
  initialValues?: FormValues
  /** Whether to show debug information */
  debug?: boolean
  /** Custom CSS classes */
  className?: string
  /** Children components that can access form context */
  children?: React.ReactNode
  /** Form persistence options */
  persistence?: {
    type?: 'localStorage' | 'sessionStorage' | 'none'
    key?: string
    debounceMs?: number
    persistOnChange?: boolean
    persistOnStepChange?: boolean
    clearOnSubmit?: boolean
  }
  /** Animation options */
  animations?: boolean
  /** Accessibility options */
  accessibility?: boolean
}

/**
 * Progress indicator component props
 */
export interface ProgressIndicatorProps {
  /** Current step index */
  currentStep: number
  /** Total number of steps */
  totalSteps: number
  /** Step titles */
  stepTitles: string[]
  /** Step sub-steps mapping */
  stepSubSteps?: Record<number, string[]>
  /** Whether to show step numbers */
  showStepNumbers?: boolean
  /** Custom CSS classes */
  className?: string
}

/**
 * Step navigation component props
 */
export interface StepNavigationProps {
  /** Current step index */
  currentStep: number
  /** Total number of steps */
  totalSteps: number
  /** Whether the current step is valid */
  isCurrentStepValid: boolean
  /** Whether the form is being submitted */
  isSubmitting: boolean
  /** Whether to allow going back */
  allowBack: boolean
  /** Next step handler */
  onNext: () => void
  /** Previous step handler */
  onPrev: () => void
  /** Submit handler */
  onSubmit: () => void
  /** Custom CSS classes */
  className?: string
}

/**
 * Field component props
 */
export interface FieldComponentProps {
  /** Field configuration */
  field: FormField
  /** Field value */
  value: FormValue
  /** Field error */
  error?: string
  /** Change handler */
  onChange: (value: FormValue) => void
  /** Blur handler */
  onBlur?: () => void
  /** Whether the field is disabled */
  disabled?: boolean
  /** Custom CSS classes */
  className?: string
}
