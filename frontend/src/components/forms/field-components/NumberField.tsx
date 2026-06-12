import React from 'react'
import { Input } from '@/components/ui/input'
import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
} from '@/components/ui/form'
import { FieldComponentProps, NumberField as NumberFieldType } from '../types'
import { cn } from '@/lib/utils'
import { ConditionalErrorMessage } from '../components/ConditionalErrorMessage'

/**
 * Number input field component using shadcn Form components
 */
export const NumberField: React.FC<FieldComponentProps> = ({
  field,
  value,
  onChange,
  onBlur,
  disabled,
  className,
}) => {
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
              type="number"
              value={
                typeof value === 'string' || typeof value === 'number'
                  ? value
                  : ''
              }
              onChange={(e) => {
                const numValue =
                  e.target.value === '' ? '' : Number(e.target.value)
                formField.onChange(e)
                onChange(numValue)
              }}
              onBlur={() => {
                formField.onBlur()
                onBlur?.()
              }}
              placeholder={field.placeholder}
              disabled={disabled || field.disabled}
              min={
                field.type === 'number'
                  ? (field as NumberFieldType).min
                  : undefined
              }
              max={
                field.type === 'number'
                  ? (field as NumberFieldType).max
                  : undefined
              }
              step={
                field.type === 'number'
                  ? (field as NumberFieldType).step
                  : undefined
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
