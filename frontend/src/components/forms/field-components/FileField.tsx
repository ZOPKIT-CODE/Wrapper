import React, { useRef } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { FormDescription, FormField, FormItem, FormLabel } from '@/components/ui/form';
import { FieldComponentProps, FileField as FileFieldType } from '../types';
import { cn } from '@/lib/utils';
import { ConditionalErrorMessage } from '../components/ConditionalErrorMessage';
import { Upload, X } from 'lucide-react';

/**
 * File field component using shadcn Form components
 */
export const FileField: React.FC<FieldComponentProps> = ({
  field,
  value,
  onChange,
  onBlur,
  disabled,
  className
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const fileField = field as FileFieldType;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files) {
      if (fileField.multiple) {
        const fileArray = Array.from(files);
        onChange(fileArray);
      } else {
        onChange(files[0] || null);
      }
    }
  };

  const handleRemoveFile = () => {
    onChange(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getFileDisplayName = () => {
    if (Array.isArray(value)) {
      return `${value.length} file(s) selected`;
    }
    if (value instanceof File) {
      return value.name;
    }
    return '';
  };

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
          
          <div className="space-y-2">
            <Input
              ref={fileInputRef}
              type="file"
              onChange={(e) => {
                formField.onChange(e);
                handleFileChange(e);
              }}
              onBlur={() => {
                formField.onBlur();
                onBlur?.();
              }}
              disabled={disabled || field.disabled}
              accept={fileField.accept}
              multiple={fileField.multiple}
              className="hidden"
              required={field.required}
            />
            
            <div className="flex items-center space-x-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
                disabled={disabled || field.disabled}
                className="flex items-center space-x-2"
              >
                <Upload className="h-4 w-4" />
                <span>Choose File{fileField.multiple ? 's' : ''}</span>
              </Button>
              
              {value && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleRemoveFile}
                  className="text-destructive hover:text-destructive"
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
            
            {value && (
              <div className="text-sm text-muted-foreground">
                {getFileDisplayName()}
                {value instanceof File && (
                  <span className="ml-2">({formatFileSize(value.size)})</span>
                )}
              </div>
            )}
          </div>
          
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
