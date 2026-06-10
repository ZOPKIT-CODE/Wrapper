import React from 'react';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { FormControl, FormDescription, FormField, FormItem, FormLabel } from '@/components/ui/form';
import { FieldComponentProps, RadioField as RadioFieldType, RadioOption } from '../types';
import { cn } from '@/lib/utils';
import { ConditionalErrorMessage } from '../components/ConditionalErrorMessage';

/**
 * Radio field component using shadcn Form components
 */
export const RadioField: React.FC<FieldComponentProps> = ({
  field,
  value,
  onChange,
  disabled,
  className
}) => {
  const radioField = field as RadioFieldType;

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
            <RadioGroup
              value={typeof value === 'string' || typeof value === 'number' ? String(value) : ''}
              onValueChange={(newValue) => {
                formField.onChange(newValue);
                onChange(newValue);
              }}
              disabled={disabled || field.disabled}
              required={field.required}
              className={cn(
                radioField.direction === 'horizontal' ? 'flex flex-row space-x-4' : 'space-y-2'
              )}
            >
              {radioField.options?.map((option: RadioOption) => (
                <div key={option.value} className="flex items-center space-x-2">
                  <RadioGroupItem
                    value={String(option.value)}
                    id={`${field.id}-${option.value}`}
                    disabled={option.disabled}
                  />
                  <Label
                    htmlFor={`${field.id}-${option.value}`}
                    className="text-sm font-normal cursor-pointer"
                  >
                    {option.label}
                  </Label>
                </div>
              ))}
            </RadioGroup>
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
