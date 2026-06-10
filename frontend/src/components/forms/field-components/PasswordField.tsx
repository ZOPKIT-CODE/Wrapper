import React, { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { FormControl, FormField, FormItem, FormLabel } from '@/components/ui/form';
import { FieldComponentProps, PasswordField as PasswordFieldType } from '../types';
import { cn } from '@/lib/utils';
import { ConditionalErrorMessage } from '../components/ConditionalErrorMessage';
import { Eye, EyeOff } from 'lucide-react';

/**
 * Password input field component with show/hide toggle
 */
export const PasswordField: React.FC<FieldComponentProps> = ({
  field,
  value,
  onChange,
  onBlur,
  disabled,
  className
}) => {
  const [showPassword, setShowPassword] = useState(false);
  const passwordField = field as PasswordFieldType;

  const togglePasswordVisibility = () => {
    setShowPassword(!showPassword);
  };

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
                type={showPassword ? 'text' : 'password'}
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
                placeholder={field.placeholder}
                disabled={disabled || field.disabled}
                minLength={passwordField.minLength}
                maxLength={passwordField.maxLength}
                pattern={passwordField.pattern}
                required={field.required}
                className="h-12 px-4 py-3 pr-12 text-sm border-gray-300 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
              />
            </FormControl>
            
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="absolute right-0 top-0 h-12 px-3 py-2 hover:bg-transparent"
              onClick={togglePasswordVisibility}
              disabled={disabled || field.disabled}
              tabIndex={-1}
            >
              {showPassword ? (
                <EyeOff className="h-4 w-4 text-gray-400" />
              ) : (
                <Eye className="h-4 w-4 text-gray-400" />
              )}
            </Button>
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

