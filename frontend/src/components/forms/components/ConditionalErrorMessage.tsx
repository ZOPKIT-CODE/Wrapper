import React from 'react'
import { useFormContext } from 'react-hook-form'

interface ConditionalErrorMessageProps {
  fieldName: string
  className?: string
}

/**
 * Error message component that only shows errors when field has been touched
 */
export const ConditionalErrorMessage: React.FC<
  ConditionalErrorMessageProps
> = ({ fieldName, className = 'text-xs text-red-600' }) => {
  const { formState } = useFormContext()
  const fieldState = formState.touchedFields[fieldName]
  const error = formState.errors[fieldName]

  // Only show error if field has been touched by user interaction and there's an error
  // Check if the field has been actually touched (not just initialized)
  // Also check if the form has been submitted to show errors on submit
  const hasBeenTouched = fieldState === true
  const hasBeenSubmitted = formState.isSubmitted

  if ((!hasBeenTouched && !hasBeenSubmitted) || !error) {
    return null
  }

  const errorMessage = typeof error === 'string' ? error : error.message

  return (
    <p className={className}>
      {typeof errorMessage === 'string' ? errorMessage : null}
    </p>
  )
}
