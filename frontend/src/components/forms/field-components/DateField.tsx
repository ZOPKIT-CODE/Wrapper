import React from 'react'
import { Input } from '@/components/ui/input'
import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
} from '@/components/ui/form'
import { FieldComponentProps, DateField as DateFieldType } from '../types'
import { cn } from '@/lib/utils'
import { ConditionalErrorMessage } from '../components/ConditionalErrorMessage'

/**
 * Date input field component using shadcn Form components
 */
export const DateField: React.FC<FieldComponentProps> = ({
  field,
  value,
  onChange,
  onBlur,
  disabled,
  className,
}) => {
  const dateField = field as DateFieldType;
  const inputValue = typeof value === 'string' || typeof value === 'number' ? String(value) : '';

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
            <Input
              {...formField}
              type="date"
              value={typeof value === 'string' ? value : ''}
              onChange={(e) => {
                formField.onChange(e)
                onChange(e.target.value)
              }}
              onBlur={() => {
                formField.onBlur()
                onBlur?.()
              }}
              disabled={disabled || field.disabled}
              min={
                field.type === 'date' ? (field as DateFieldType).min : undefined
              }
              max={
                field.type === 'date' ? (field as DateFieldType).max : undefined
              }
              required={field.required}
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
