import React from 'react'
import { Input } from '@/components/ui/input'
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
} from '@/components/ui/form'
import { FieldComponentProps, SearchField as SearchFieldType } from '../types'
import { cn } from '@/lib/utils'
import { ConditionalErrorMessage } from '../components/ConditionalErrorMessage'
import { Search } from 'lucide-react'

/**
 * Search input field component with search-specific styling
 */
export const SearchField: React.FC<FieldComponentProps> = ({
  field,
  value,
  onChange,
  onBlur,
  disabled,
  className,
}) => {
  const searchField = field as SearchFieldType

  return (
    <FormField
      name={field.id}
      render={({ field: formField }) => (
        <FormItem className={cn(className)}>
          <FormLabel
            className={cn(
              'mb-2 block text-sm font-medium text-gray-700',
              field.required &&
                "after:ml-0.5 after:text-red-500 after:content-['*']"
            )}
          >
            {field.label}
          </FormLabel>

          <div className="relative">
            <FormControl>
              <Input
                {...formField}
                type="search"
                value={typeof value === 'string' ? value : ''}
                onChange={(e) => {
                  formField.onChange(e)
                  onChange(e.target.value)
                }}
                onBlur={() => {
                  formField.onBlur()
                  if (onBlur) {
                    onBlur()
                  }
                }}
                placeholder={field.placeholder || 'Search...'}
                disabled={disabled || field.disabled}
                minLength={searchField.minLength}
                maxLength={searchField.maxLength}
                pattern={searchField.pattern}
                required={field.required}
                className="h-12 rounded-lg border-gray-300 px-4 py-3 pl-12 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
              />
            </FormControl>

            <div className="pointer-events-none absolute top-0 left-0 flex h-12 items-center px-4">
              <Search className="h-4 w-4 text-gray-400" />
            </div>
          </div>

          {field.helpText && (
            <div className="flex items-start gap-3 rounded-lg border border-blue-200 bg-blue-50 p-4">
              <div className="mt-0.5 h-5 w-5 flex-shrink-0 text-blue-600">
                ℹ
              </div>
              <p className="text-sm leading-relaxed text-blue-800">
                {field.helpText}
              </p>
            </div>
          )}

          <ConditionalErrorMessage fieldName={field.id} />
        </FormItem>
      )}
    />
  )
}
