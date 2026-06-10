import React, { createContext, useContext, ReactNode } from 'react'
import { UseFormReturn, FieldValues } from 'react-hook-form'
import { FormConfig, FormValue } from '../types'

/**
 * Form context interface
 */
export interface FormContextValue {
  // Form configuration
  config: FormConfig

  // Current step information
  currentStep: number
  totalSteps: number
  currentStepConfig: FormConfig['steps'][0]

  // Form state
  isSubmitting: boolean
  isCurrentStepValid: boolean

  // Form methods
  methods: UseFormReturn<FieldValues>

  // Navigation functions
  nextStep: () => void
  prevStep: () => void
  goToStep: (step: number) => void

  // Field functions
  handleFieldChange: (fieldId: string, value: FormValue) => void
  handleFieldBlur: (fieldId: string) => void

  // Validation
  validateCurrentStep: () => Promise<boolean>

  // Form submission
  handleSubmit: () => Promise<void>

  // Debug mode
  debug: boolean
}

/**
 * Form context
 */
export const FormContext = createContext<FormContextValue | null>(null)

/**
 * Hook to access form context
 */
export const useFormContext = (): FormContextValue => {
  const context = useContext(FormContext)
  if (!context) {
    throw new Error('useFormContext must be used within a FormProvider')
  }
  return context
}

/**
 * Form context provider props
 */
export interface FormProviderProps {
  children: ReactNode
  value: FormContextValue
}

/**
 * Form context provider component
 */
export const FormProvider: React.FC<FormProviderProps> = ({
  children,
  value,
}) => {
  return <FormContext.Provider value={value}>{children}</FormContext.Provider>
}
