import React from 'react';
import { Input } from '@/components/ui/input';
import { FormControl, FormField, FormItem, FormLabel } from '@/components/ui/form';
import { FieldComponentProps, SearchField as SearchFieldType } from '../types';
import { cn } from '@/lib/utils';
import { ConditionalErrorMessage } from '../components/ConditionalErrorMessage';
import { Search } from 'lucide-react';

/**
 * Search input field component with search-specific styling
 */
export const SearchField: React.FC<FieldComponentProps> = ({
  field,
  value,
  onChange,
  onBlur,
  disabled,
  className
}) => {
  const searchField = field as SearchFieldType;

  return (
    <FormField
      name={field.id}
      render={({ field: formField }) => (
        <FormItem className={cn(className)}>
          <FormLabel className={cn(
            'text-sm font-medium text-gray-700 mb-2 block',
            field.required && "after:content-['*'] after:ml-0.5 after:text-red-500"
          )}>
            {field.label}
          </FormLabel>
          
          <div className="relative">
            <FormControl>
              <Input
                {...formField}
                type="search"
                value={typeof value === 'string' ? value : ''}
                onChange={(e) => {
                  formField.onChange(e);
                  onChange(e.target.value);
                }}
                onBlur={() => {
                  formField.onBlur();
                  if (onBlur) {
                    onBlur();
                  }
                }}
                placeholder={field.placeholder || 'Search...'}
                disabled={disabled || field.disabled}
                minLength={searchField.minLength}
                maxLength={searchField.maxLength}
                pattern={searchField.pattern}
                required={field.required}
                className="h-12 px-4 py-3 pl-12 text-sm border-gray-300 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
              />
            </FormControl>
            
            <div className="absolute left-0 top-0 h-12 px-4 flex items-center pointer-events-none">
              <Search className="h-4 w-4 text-gray-400" />
            </div>
          </div>
          
          {field.helpText && (
            <div className="flex items-start gap-3 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5">ℹ</div>
              <p className="text-sm text-blue-800 leading-relaxed">
                {field.helpText}
              </p>
            </div>
          )}

          <ConditionalErrorMessage fieldName={field.id} />
        </FormItem>
      )}
    />
  );
};

