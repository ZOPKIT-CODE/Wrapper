import React from 'react'
import { Textarea } from '@/components/ui/textarea'
import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
} from '@/components/ui/form'
import { FieldComponentProps } from '../types'
import { cn } from '@/lib/utils'
import { ConditionalErrorMessage } from '../components/ConditionalErrorMessage'

/**
 * Textarea field component using shadcn Form components
 */
export const TextareaField: React.FC<FieldComponentProps> = ({
  field,
  value,
  onChange,
  onBlur,
  disabled,
  className,
}) => {
  // Type guard to ensure field is TextareaField
  const textareaField = field.type === 'textarea' ? field : null

  // Get the display value - prioritize current value, then defaultValue
  const displayValue =
    value !== undefined && value !== null
      ? String(value)
      : field.defaultValue !== undefined && field.defaultValue !== null
        ? String(field.defaultValue)
        : ''

  return (
    <FormField
      name={field.id}
      render={({ field: formField }) => (
        <FormItem className={cn(className)}>
          <FormLabel
            className={cn(
              field.required &&
                "after:text-destructive after:ml-0.5 after:content-['*']"
            )}
          >
            {field.label}
          </FormLabel>

          <FormControl>
            <Textarea
              {...formField}
              value={displayValue}
              onChange={(e) => {
                formField.onChange(e)
                onChange(e.target.value)
              }}
              onBlur={() => {
                formField.onBlur()
                onBlur?.()
              }}
              placeholder={field.placeholder}
              disabled={disabled || field.disabled}
              rows={textareaField?.rows || 3}
              minLength={textareaField?.minLength}
              maxLength={textareaField?.maxLength}
              required={field.required}
              className={field.className}
            />
          </FormControl>

          {field.helpText && (
            <FormDescription>{field.helpText}</FormDescription>
          )}

          <ConditionalErrorMessage fieldName={field.id} />
        </FormItem>
      )}
    />
  )
}
