import React from 'react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from '@/components/ui/select'
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
} from '@/components/ui/form'
import {
  FieldComponentProps,
  SelectField as SelectFieldType,
  SelectOption,
} from '../types'
import { cn } from '@/lib/utils'
import { ConditionalErrorMessage } from '../components/ConditionalErrorMessage'

/**
 * Select field component using shadcn Form components
 */
export const SelectField: React.FC<FieldComponentProps> = ({
  field,
  value,
  onChange,
  disabled,
  className,
}) => {
  const selectField = field as SelectFieldType

  return (
    <FormField
      name={field.id}
      render={({ field: formField }) => (
        <FormItem className={cn('space-y-3', className)}>
          <FormLabel
            className={cn(
              'text-foreground text-sm font-medium',
              field.required &&
                "after:text-destructive after:ml-0.5 after:content-['*']"
            )}
          >
            {field.label}
          </FormLabel>

          <Select
            value={String(value || '')}
            onValueChange={(newValue) => {
              formField.onChange(newValue)
              onChange(newValue)
            }}
            disabled={disabled || field.disabled}
            required={field.required}
          >
            <FormControl>
              <SelectTrigger className="bg-background border-input text-foreground hover:bg-accent hover:text-accent-foreground focus:ring-ring mt-3 h-12 w-full">
                {value ? (
                  <span className="text-foreground truncate">
                    {
                      selectField.options?.find(
                        (opt) => String(opt.value) === String(value)
                      )?.label
                    }
                  </span>
                ) : (
                  <span className="text-muted-foreground">
                    {field.placeholder || 'Select an option'}
                  </span>
                )}
              </SelectTrigger>
            </FormControl>

            <SelectContent className="bg-background border-input text-foreground max-h-60">
              {selectField.options?.map((option: SelectOption) => (
                <SelectItem
                  key={option.value}
                  value={String(option.value)}
                  disabled={option.disabled}
                  className="text-foreground hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground flex h-12 items-center"
                >
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {field.helpText && (
            <p className="text-muted-foreground text-sm">{field.helpText}</p>
          )}

          <ConditionalErrorMessage fieldName={field.id} />
        </FormItem>
      )}
    />
  )
}
