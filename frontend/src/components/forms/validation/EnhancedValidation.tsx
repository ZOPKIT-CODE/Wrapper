import { z } from 'zod'
import { FormField, FormValues } from '../types'
import { CrossFieldValidation, AsyncValidation } from './CrossFieldValidation'

/**
 * Enhanced validation system for multi-step forms
 */
export class EnhancedValidation {
  /**
   * Create validation schema with cross-field validation support
   */
  static createStepSchema(
    fields: FormField[],
    crossFieldValidations?: Array<{
      fields: string[]
      validator: (values: FormValues) => z.ZodTypeAny
    }>
  ) {
    const fieldValidations: Record<string, z.ZodTypeAny> = {}

    // Create individual field validations
    fields.forEach((field) => {
      if (field.validation) {
        fieldValidations[field.id] = field.validation
      } else {
        fieldValidations[field.id] = this.createFieldSchema(field)
      }
    })

    // Add cross-field validations
    if (crossFieldValidations && crossFieldValidations.length > 0) {
      const crossFieldSchema = CrossFieldValidation.createCrossFieldSchema(
        crossFieldValidations.reduce(
          (acc, validation) => {
            validation.fields.forEach((fieldId) => {
              acc[fieldId] = validation.validator
            })
            return acc
          },
          {} as Record<string, (values: FormValues) => z.ZodTypeAny>
        )
      )

      return z.intersection(z.object(fieldValidations), crossFieldSchema)
    }

    return z.object(fieldValidations)
  }

  /**
   * Create field-specific validation schema
   */
  static createFieldSchema(field: FormField): z.ZodTypeAny {
    let schema: z.ZodTypeAny

    switch (field.type) {
      case 'email':
        schema = z.string().email('Invalid email address')
        break
      case 'password':
        schema = z.string().min(8, 'Password must be at least 8 characters')
        break
      case 'url':
        schema = z.string().url('Invalid URL')
        break
      case 'tel':
        schema = z
          .string()
          .regex(/^[+]?[1-9][\d]{0,15}$/, 'Invalid phone number')
        break
      case 'number':
        schema = z.number()
        if (field.min !== undefined) {
          schema = (schema as z.ZodNumber).min(field.min)
        }
        if (field.max !== undefined) {
          schema = (schema as z.ZodNumber).max(field.max)
        }
        break
      case 'date':
        schema = z.string().min(1, 'Date is required')
        break
      case 'select':
      case 'radio':
        schema = z.string()
        break
      case 'checkbox':
      case 'switch':
        schema = z.boolean()
        break
      case 'file':
        schema = z.any()
        break
      case 'color':
        schema = z.string().regex(/^#[0-9A-F]{6}$/i, 'Invalid color format')
        break
      case 'range':
        schema = z.number()
        break
      default:
        schema = z.string()
    }

    // Apply required validation
    if (field.required) {
      if (
        field.type === 'text' ||
        field.type === 'email' ||
        field.type === 'password' ||
        field.type === 'textarea' ||
        field.type === 'select' ||
        field.type === 'radio' ||
        field.type === 'url' ||
        field.type === 'tel' ||
        field.type === 'search'
      ) {
        schema = (schema as z.ZodString).min(1, `${field.label} is required`)
      }
    } else {
      schema = schema.optional()
    }

    return schema
  }

  /**
   * Create async validation schema
   */
  static createAsyncValidation(
    fieldId: string,
    validationFn: (value: unknown) => Promise<boolean>,
    errorMessage: string
  ) {
    return z.string().refine(
      async (value) => {
        if (!value) return true // Skip validation for empty values
        return await validationFn(value)
      },
      {
        message: errorMessage,
        path: [fieldId],
      }
    )
  }

  /**
   * Validate form step with enhanced features
   */
  static async validateStep(
    values: FormValues,
    fields: FormField[],
    crossFieldValidations?: Array<{
      fields: string[]
      validator: (values: FormValues) => z.ZodTypeAny
    }>
  ): Promise<{ isValid: boolean; errors: Record<string, string> }> {
    try {
      const schema = this.createStepSchema(fields, crossFieldValidations)
      await schema.parseAsync(values)
      return { isValid: true, errors: {} }
    } catch (error) {
      if (error instanceof z.ZodError) {
        const errors: Record<string, string> = {}
        error.errors.forEach((err) => {
          const path = err.path.join('.')
          errors[path] = err.message
        })
        return { isValid: false, errors }
      }
      return { isValid: false, errors: { root: 'Validation failed' } }
    }
  }

  /**
   * Validate individual field
   */
  static async validateField(
    field: FormField,
    value: unknown,
    _allValues: FormValues
  ): Promise<{ isValid: boolean; error?: string }> {
    try {
      const schema = this.createFieldSchema(field)
      await schema.parseAsync(value)
      return { isValid: true }
    } catch (error) {
      if (error instanceof z.ZodError) {
        return { isValid: false, error: error.errors[0]?.message }
      }
      return { isValid: false, error: 'Validation failed' }
    }
  }

  /**
   * Create debounced validation
   */
  static createDebouncedValidation(
    validationFn: (value: unknown) => Promise<boolean>,
    delay: number = 500
  ) {
    let timeoutId: NodeJS.Timeout

    return (value: unknown): Promise<boolean> => {
      return new Promise((resolve) => {
        clearTimeout(timeoutId)
        timeoutId = setTimeout(async () => {
          const result = await validationFn(value)
          resolve(result)
        }, delay)
      })
    }
  }
}

/**
 * Common validation patterns
 */
export const ValidationPatterns = {
  email: z.string().email('Invalid email address'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
      'Password must contain uppercase, lowercase, and number'
    ),
  phone: z.string().regex(/^[+]?[1-9][\d]{0,15}$/, 'Invalid phone number'),
  url: z.string().url('Invalid URL'),
  zipCode: z.string().regex(/^\d{5}(-\d{4})?$/, 'Invalid ZIP code'),
  ssn: z.string().regex(/^\d{3}-\d{2}-\d{4}$/, 'Invalid SSN format'),
  creditCard: z
    .string()
    .regex(
      /^\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}$/,
      'Invalid credit card number'
    ),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format'),
  time: z.string().regex(/^\d{2}:\d{2}$/, 'Invalid time format'),
  color: z.string().regex(/^#[0-9A-F]{6}$/i, 'Invalid color format'),
  alphanumeric: z
    .string()
    .regex(/^[a-zA-Z0-9]+$/, 'Must contain only letters and numbers'),
  noSpaces: z.string().regex(/^\S+$/, 'Cannot contain spaces'),
  minLength: (min: number) =>
    z.string().min(min, `Must be at least ${min} characters`),
  maxLength: (max: number) =>
    z.string().max(max, `Must be no more than ${max} characters`),
  range: (min: number, max: number) => z.number().min(min).max(max),
  positive: z.number().positive('Must be a positive number'),
  negative: z.number().negative('Must be a negative number'),
  integer: z.number().int('Must be an integer'),
  decimal: z.number().multipleOf(0.01, 'Must have at most 2 decimal places'),
}

/**
 * Async validation patterns
 */
export const AsyncValidationPatterns = {
  emailUnique: (email: string) => AsyncValidation.emailUnique(email),
  usernameAvailable: (username: string) =>
    AsyncValidation.usernameAvailable(username),
  custom: (value: unknown, fn: (value: unknown) => Promise<boolean>) =>
    AsyncValidation.customValidation(value, fn),
}
