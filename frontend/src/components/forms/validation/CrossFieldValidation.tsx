import { z } from 'zod';
import { FormValues } from '../types';

/**
 * Cross-field validation utilities
 */
export class CrossFieldValidation {
  /**
   * Create a validation schema that validates fields against each other
   */
  static createCrossFieldSchema(
    fieldValidations: Record<string, (values: FormValues) => z.ZodSchema<any>>
  ) {
    // Create a base schema with all fields as any type
    const baseSchema = z.object(
      Object.keys(fieldValidations).reduce((acc, fieldId) => ({
        ...acc,
        [fieldId]: z.any()
      }), {} as Record<string, z.ZodTypeAny>)
    );

    return baseSchema.refine(
      (data) => {
        // Apply cross-field validations
        return Object.entries(fieldValidations).every(([fieldId, validator]) => {
          try {
            const schema = validator(data);
            return schema.safeParse(data[fieldId]).success;
          } catch {
            return false;
          }
        });
      },
      {
        message: 'Cross-field validation failed',
        path: ['root']
      }
    );
  }

  /**
   * Password confirmation validation
   */
  static passwordConfirmation(passwordField: string, confirmField: string) {
    return z.object({
      [passwordField]: z.string(),
      [confirmField]: z.string()
    }).refine(
      (data) => data[passwordField] === data[confirmField],
      {
        message: 'Passwords do not match',
        path: [confirmField]
      }
    );
  }

  /**
   * Date range validation
   */
  static dateRange(startField: string, endField: string) {
    return z.object({
      [startField]: z.string(),
      [endField]: z.string()
    }).refine(
      (data) => {
        const startDate = new Date(data[startField]);
        const endDate = new Date(data[endField]);
        return startDate <= endDate;
      },
      {
        message: 'End date must be after start date',
        path: [endField]
      }
    );
  }

  /**
   * Number range validation
   */
  static numberRange(minField: string, maxField: string) {
    return z.object({
      [minField]: z.number(),
      [maxField]: z.number()
    }).refine(
      (data) => data[minField] <= data[maxField],
      {
        message: 'Maximum value must be greater than or equal to minimum value',
        path: [maxField]
      }
    );
  }

  /**
   * Conditional validation based on another field
   */
  static conditionalValidation(
    conditionField: string,
    conditionValue: any,
    validationSchema: z.ZodSchema<any>
  ) {
    // Create a base schema with the condition field
    const baseSchema = z.object({
      [conditionField]: z.any()
    });

    return baseSchema.refine(
      (data) => {
        if (data[conditionField] === conditionValue) {
          return validationSchema.safeParse(data).success;
        }
        return true;
      },
      {
        message: 'Conditional validation failed',
        path: ['root']
      }
    );
  }

  /**
   * Unique value validation across multiple fields
   */
  static uniqueValues(fields: string[]) {
    return z.object(
      fields.reduce((acc, field) => ({ ...acc, [field]: z.any() }), {} as Record<string, z.ZodTypeAny>)
    ).refine(
      (data) => {
        const values = fields.map(field => data[field]);
        return new Set(values).size === values.length;
      },
      {
        message: 'All values must be unique',
        path: ['root']
      }
    );
  }

  /**
   * Sum validation - sum of fields must equal target
   */
  static sumValidation(fields: string[], target: number) {
    return z.object(
      fields.reduce((acc, field) => ({ ...acc, [field]: z.number() }), {} as Record<string, z.ZodTypeAny>)
    ).refine(
      (data) => {
        const sum = fields.reduce((total, field) => total + ((data as any)[field] || 0), 0);
        return sum === target;
      },
      {
        message: `Sum of values must equal ${target}`,
        path: ['root']
      }
    );
  }
}

/**
 * Async validation utilities
 */
export class AsyncValidation {
  /**
   * Email uniqueness validation
   */
  static async emailUnique(email: string): Promise<boolean> {
    try {
      const response = await fetch(`${import.meta.env.VITE_API_BASE_URL ?? ''}/api/check-email?email=${encodeURIComponent(email)}`);
      return response.ok;
    } catch {
      return false;
    }
  }

  /**
   * Username availability validation
   */
  static async usernameAvailable(username: string): Promise<boolean> {
    try {
      const response = await fetch(`${import.meta.env.VITE_API_BASE_URL ?? ''}/api/check-username?username=${encodeURIComponent(username)}`);
      return response.ok;
    } catch {
      return false;
    }
  }

  /**
   * Custom async validation
   */
  static async customValidation(
    value: any,
    validationFn: (value: any) => Promise<boolean>
  ): Promise<boolean> {
    try {
      return await validationFn(value);
    } catch {
      return false;
    }
  }
}

/**
 * Validation error formatter
 */
export class ValidationErrorFormatter {
  /**
   * Format validation errors for display
   */
  static formatErrors(errors: z.ZodError): Record<string, string> {
    const formattedErrors: Record<string, string> = {};
    
    errors.errors.forEach((error) => {
      const path = error.path.join('.');
      formattedErrors[path] = error.message;
    });
    
    return formattedErrors;
  }

  /**
   * Get field-specific error message
   */
  static getFieldError(errors: z.ZodError, fieldPath: string): string | undefined {
    const error = errors.errors.find(err => err.path.join('.') === fieldPath);
    return error?.message;
  }

  /**
   * Check if field has error
   */
  static hasFieldError(errors: z.ZodError, fieldPath: string): boolean {
    return errors.errors.some(err => err.path.join('.') === fieldPath);
  }
}

