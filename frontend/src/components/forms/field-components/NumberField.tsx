import React from 'react';
import { Input } from '@/components/ui/input';
import { FormControl, FormDescription, FormField, FormItem, FormLabel } from '@/components/ui/form';
import { FieldComponentProps, NumberField as NumberFieldType } from '../types';
import { cn } from '@/lib/utils';
import { ConditionalErrorMessage } from '../components/ConditionalErrorMessage';

/**
 * Number input field component using shadcn Form components
 */
export const NumberField: React.FC<FieldComponentProps> = ({
  field,
  value,
  onChange,
  onBlur,
  disabled,
  className
}) => {
  const numberField = field as NumberFieldType;
  const inputValue =
    typeof value === 'string' || typeof value === 'number' ? value : '';

  return (
    <FormField
      name={field.id}
      render={({ field: formField }) => (
        <FormItem className={cn(className)}>
          <FormLabel className={cn(
            field.required && "after:content-['*'] after:ml-0.5 after:text-destructive"
          )}>
            {field.label}
          </FormLabel>
          
          <FormControl>
            <Input
              {...formField}
              type="number"
              value={inputValue}
              onChange={(e) => {
                const numValue = e.target.value === '' ? '' : Number(e.target.value);
                formField.onChange(e);
                onChange(numValue);
              }}
              onBlur={() => {
                formField.onBlur();
                onBlur?.();
              }}
              placeholder={field.placeholder}
              disabled={disabled || field.disabled}
              min={numberField.min}
              max={numberField.max}
              step={numberField.step}
              required={field.required}
            />
          </FormControl>
          
          {field.helpText && (
            <FormDescription>
              {field.helpText}
            </FormDescription>
          )}
          
          <ConditionalErrorMessage fieldName={field.id} />
        </FormItem>
      )}
    />
  );
};
