/**
 * Onboarding Hooks
 */

import { useState, useCallback, useEffect } from 'react'
import {
  useForm,
  UseFormReturn,
  useFormState,
  useWatch,
  type Resolver,
} from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { newBusinessData, existingBusinessData } from '../schemas'
import { StepConfig } from '../config/flowConfigs'
import {
  onboardingFormSchema,
  createOnboardingSchemaWithClassification,
} from '../schemas/onboardingValidation'

interface IdpUserProfile {
  givenName?: string | null
  familyName?: string | null
  email?: string | null
}

export const useOnboardingForm = (
  _flowType: 'newBusiness' | 'existingBusiness',
  userClassification?: string,
  idpUser?: IdpUserProfile | null
) => {
  // Create schema with user classification if provided
  const schema = userClassification
    ? createOnboardingSchemaWithClassification(userClassification)
    : onboardingFormSchema

  // The zod schema infers a structurally-equivalent shape, but TS can't prove it matches
  // the hand-written newBusinessData | existingBusinessData interfaces; retype the resolver
  // to the form's value type (runtime validation is unchanged).
  const resolver = zodResolver(schema) as Resolver<
    newBusinessData | existingBusinessData
  >

  return useForm<newBusinessData | existingBusinessData>({
    resolver,
    mode: 'onChange',
    reValidateMode: 'onChange',
    shouldUnregister: false,
    shouldFocusError: true,
    defaultValues: {
      firstName: idpUser?.givenName ?? '',
      lastName: idpUser?.familyName ?? '',
      adminEmail: idpUser?.email ?? '',
      teamMembers: [],
      taxRegistered: false,
      vatGstRegistered: false,
      mailingAddressSameAsRegistered: true,
      termsAccepted: false,
      country: 'IN',
      businessDetails: {
        country: 'IN',
      },
      billingCountry: 'IN',
      defaultLanguage: 'en',
      defaultLocale: 'en-IN',
      defaultCurrency: 'INR',
      defaultTimeZone: 'Asia/Kolkata',
    },
  })
}

export const useStepNavigation = (
  form: UseFormReturn<newBusinessData | existingBusinessData>,
  stepsConfig: StepConfig[],
  userClassification?: string,
  initialStep?: number // FIXED: Accept initial step from parent
) => {
  const [currentStep, setCurrentStep] = useState(initialStep || 1)

  // FIXED: Sync with external step changes
  useEffect(() => {
    if (initialStep !== undefined && initialStep !== currentStep) {
      setCurrentStep(initialStep)
    }
  }, [initialStep, currentStep])

  // Subscribe to form state changes to prevent unnecessary re-renders
  const { errors, isValid } = useFormState({
    control: form.control,
    // Only subscribe to errors and isValid, not all form state
  })

  // FIXED: Use useWatch to make canProceed reactive to form value changes
  // Watch key fields for each step to trigger re-renders when values change
  const watchedValues = useWatch({
    control: form.control,
    // Watch all form values to trigger re-renders
  })

  // Helper to check if field has error
  const hasError = useCallback((fieldPath: string, errors: any): boolean => {
    const parts = fieldPath.split('.')
    let errorObj: any = errors
    for (const part of parts) {
      if (!errorObj || typeof errorObj !== 'object') return false
      errorObj = errorObj[part]
    }
    return !!errorObj
  }, [])

  // Helper to validate email format
  const isValidEmail = useCallback((email: string | undefined): boolean => {
    if (!email) return false
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    return emailRegex.test(email)
  }, [])

  // Helper to validate GSTIN format (India)
  const isValidGSTIN = useCallback((gstin: string | undefined): boolean => {
    if (!gstin) return false
    const gstinRegex =
      /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/
    return gstin.length === 15 && gstinRegex.test(gstin)
  }, [])

  // Helper to validate PAN format (India)
  const isValidPAN = useCallback((pan: string | undefined): boolean => {
    if (!pan) return false
    const panRegex = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/
    return pan.length === 10 && panRegex.test(pan)
  }, [])

  // Helper to validate EIN format (US)
  const isValidEIN = useCallback((ein: string | undefined): boolean => {
    if (!ein) return false
    // EIN format: XX-XXXXXXX (9 digits)
    const einRegex = /^\d{2}-?\d{7}$/
    return einRegex.test(ein.replace(/\D/g, ''))
  }, [])

  const canProceed = useCallback((): boolean => {
    // Check if current step is valid
    const currentStepId = stepsConfig[currentStep - 1]?.id
    if (!currentStepId) return false

    // FIXED: Use watched values to ensure reactivity
    const values = watchedValues || form.getValues()

    // Step-specific validation - Updated for new 5-step structure
    switch (currentStepId) {
      case 'businessDetails': {
        const businessDetails = values.businessDetails
        return !!(
          values.companyType &&
          (businessDetails?.companyName || values.businessName) &&
          (businessDetails?.businessType || values.businessType) &&
          (businessDetails?.country || values.country) &&
          !hasError('companyType', errors) &&
          !hasError('businessDetails.companyName', errors) &&
          !hasError('businessDetails.businessType', errors) &&
          !hasError('businessDetails.country', errors)
        )
      }
      case 'taxDetails': {
        // Required: billing address fields (street, city, zip)
        const hasBillingStreet = !!(
          values.billingAddress || values.billingStreet
        )
        const hasBillingCity = !!values.billingCity
        const hasBillingZip = !!values.billingZip
        const hasBillingAddress =
          hasBillingStreet && hasBillingCity && hasBillingZip

        // Conditional: State required for countries with states
        const country =
          values.businessDetails?.country || values.country || 'IN'
        const needsState = ['IN', 'US', 'CA', 'AU'].includes(country)
        const hasState =
          !needsState ||
          !!values.state ||
          !!values.billingState ||
          !!values.incorporationState

        // ENHANCED: Validate GST/PAN when toggles are enabled with format validation
        // If VAT/GST Registered toggle is ON, GSTIN must be provided and valid
        if (values.vatGstRegistered) {
          if (country === 'IN') {
            // For India: GSTIN is mandatory when VAT/GST Registered is ON
            const hasValidGstin =
              !!values.gstin &&
              isValidGSTIN(values.gstin) &&
              !hasError('gstin', errors)
            if (!hasValidGstin) {
              return false // Block progression if GSTIN is missing or invalid format
            }
          } else {
            // For other countries: VAT number is mandatory when VAT/GST Registered is ON
            const hasValidVat =
              !!values.vatNumber && !hasError('vatNumber', errors)
            if (!hasValidVat) {
              return false // Block progression if VAT number is missing or invalid
            }
          }
        }

        // If Tax Registered toggle is ON, tax ID must be provided and valid
        if (values.taxRegistered) {
          if (country === 'IN') {
            // For India: PAN is mandatory when Tax Registered is ON
            const hasValidPan =
              !!values.panNumber &&
              isValidPAN(values.panNumber) &&
              !hasError('panNumber', errors)
            if (!hasValidPan) {
              return false // Block progression if PAN is missing or invalid format
            }
          } else if (country === 'US') {
            // For US: EIN is mandatory when Tax Registered is ON
            const hasValidEin =
              !!values.einNumber &&
              isValidEIN(values.einNumber) &&
              !hasError('einNumber', errors)
            if (!hasValidEin) {
              return false // Block progression if EIN is missing or invalid format
            }
          }
        }

        // Basic address validation - always required
        if (!hasBillingAddress || !hasState) {
          return false
        }

        // Check only editable address field errors.
        // `billingAddress` can be a backend alias/manual error key that doesn't clear on input change.
        if (
          hasError('billingStreet', errors) ||
          hasError('billingCity', errors) ||
          hasError('billingZip', errors) ||
          (needsState && hasError('state', errors))
        ) {
          return false
        }

        return true // All validations passed
      }
      case 'adminDetails': {
        // Validate all mandatory fields are present
        const hasFirstName =
          !!values.firstName && !hasError('firstName', errors)
        const hasLastName = !!values.lastName && !hasError('lastName', errors)
        const hasAdminEmail =
          !!values.adminEmail &&
          isValidEmail(values.adminEmail) &&
          !hasError('adminEmail', errors)

        // FIXED: Mobile validation - required for certain classifications, but always validate format if provided
        const needsMobile =
          userClassification === 'withGST' ||
          userClassification === 'enterprise'
        let hasMobile = true

        if (needsMobile) {
          // Required for these classifications
          hasMobile = !!values.adminMobile && !hasError('adminMobile', errors)
        } else if (values.adminMobile) {
          // Optional but validate format if provided
          // Check if there's a validation error (format validation)
          hasMobile = !hasError('adminMobile', errors)
        }

        return hasFirstName && hasLastName && hasAdminEmail && hasMobile
      }
      case 'review':
        // On review step, canProceed should always return true
        // The submit button will be controlled by canSubmit which checks termsAccepted
        return true
      default:
        // For unknown steps, allow proceeding
        return true
    }
  }, [
    form,
    currentStep,
    stepsConfig,
    hasError,
    errors,
    isValidEmail,
    isValidGSTIN,
    isValidPAN,
    isValidEIN,
    watchedValues,
    userClassification,
  ])

  const nextStep = useCallback(
    async (
      onValidationError?: (errors: any, stepNumber: number) => void
    ): Promise<boolean> => {
      const currentStepId = stepsConfig[currentStep - 1]?.id
      const isLastStep = currentStep >= stepsConfig.length

      // Never submit on nextStep - only allow navigation
      if (isLastStep) {
        return false // Don't do anything on last step
      }

      if (!currentStepId || currentStep >= stepsConfig.length) {
        return false
      }

      // STRICT VALIDATION: Get ALL step-specific fields to validate
      const stepFields: string[] = []

      switch (currentStepId) {
        case 'businessDetails':
          stepFields.push(
            'companyType',
            'businessDetails.companyName',
            'businessDetails.businessType',
            'businessDetails.country',
            'businessDetails.organizationSize' // Include all business detail fields
          )
          break
        case 'taxDetails': {
          // Always required fields
          stepFields.push('billingStreet', 'billingCity', 'billingZip')

          const country =
            form.getValues('businessDetails.country' as any) ||
            form.getValues('country') ||
            'IN'
          const needsState = ['IN', 'US', 'CA', 'AU'].includes(country)

          if (needsState) {
            stepFields.push('state')
          }

          // Conditional fields based on VAT/GST toggle
          if (form.getValues('vatGstRegistered')) {
            if (country === 'IN') {
              stepFields.push('gstin')
            } else {
              stepFields.push('vatNumber')
            }
          }

          // Mailing address fields if different from registered
          if (!form.getValues('mailingAddressSameAsRegistered')) {
            stepFields.push('mailingStreet', 'mailingCity', 'mailingZip')
            if (needsState) {
              stepFields.push('mailingState')
            }
          }
          break
        }
        case 'adminDetails': {
          stepFields.push('firstName', 'lastName', 'adminEmail')

          // FIXED: Always validate adminMobile format if provided, but only require it for certain classifications
          // This ensures format validation happens before moving to next step, not just on submission
          const currentValues = form.getValues()
          if (currentValues.adminMobile) {
            stepFields.push('adminMobile') // Validate format even if optional
          } else if (
            userClassification === 'withGST' ||
            userClassification === 'enterprise'
          ) {
            stepFields.push('adminMobile') // Required for these classifications
          }

          // Conditional fields based on tax registration toggle
          if (form.getValues('taxRegistered')) {
            const country =
              form.getValues('businessDetails.country' as any) ||
              form.getValues('country') ||
              'IN'
            if (country === 'IN') {
              stepFields.push('panNumber')
            } else if (country === 'US') {
              stepFields.push('einNumber')
            }
          }

          // Optional but validate if present
          stepFields.push(
            'contactJobTitle',
            'preferredContactMethod',
            'billingEmail'
          )
          break
        }
      }

      // STRICT VALIDATION: Trigger validation for ALL step-specific fields
      // Only if stepFields array has items (skip for informational steps)
      if (stepFields.length === 0) {
        // No fields to validate, proceed
        setCurrentStep((prev) => prev + 1)
        return true
      }

      const validationResults = await Promise.all(
        stepFields.map((field) => form.trigger(field as any))
      )

      // Check if ALL validations passed
      const allValid = validationResults.every((result) => result === true)

      // Also check canProceed which does additional business logic validation
      const canProceedNow = canProceed()

      // STRICT: Only proceed if ALL validations pass AND canProceed returns true
      // Do NOT trigger full form validation here - that would validate future steps (e.g. billingCity, termsAccepted)
      // and block the user incorrectly. Only step-specific fields were validated above.
      if (allValid && canProceedNow) {
        setCurrentStep((prev) => prev + 1)
        return true // Successfully moved to next step
      } else {
        // Show validation errors for current step only (errors already set by step-specific trigger above)
        if (onValidationError) {
          onValidationError(form.formState.errors, currentStep)
        }
        return false // Validation failed, did not proceed
      }
    },
    [form, currentStep, stepsConfig, canProceed, userClassification]
  )

  const prevStep = useCallback(() => {
    if (currentStep > 1) {
      setCurrentStep((prev) => prev - 1)
    }
  }, [currentStep])

  const goToStep = useCallback(
    (stepNumber: number) => {
      if (stepNumber >= 1 && stepNumber <= stepsConfig.length) {
        setCurrentStep(stepNumber)
      }
    },
    [stepsConfig.length]
  )

  const canSubmit = useCallback(() => {
    // FIXED: Check if all steps are valid AND terms are accepted
    const values = watchedValues || form.getValues()

    // Must be on last step
    const isLastStep = currentStep >= stepsConfig.length
    if (!isLastStep) {
      return false // Can't submit if not on last step
    }

    // Must accept terms
    if (!values.termsAccepted) {
      return false
    }

    // Check if form is valid (all validations pass)
    // On review step, canProceed always returns true, so we rely on isValid
    return isValid
  }, [form, isValid, watchedValues, currentStep, stepsConfig.length])

  const getStepStatus = useCallback(
    (stepNumber: number): 'completed' | 'active' | 'error' | 'upcoming' => {
      if (stepNumber < currentStep) {
        return 'completed'
      } else if (stepNumber === currentStep) {
        // Check if current step has errors
        return Object.keys(errors).length > 0 ? 'error' : 'active'
      } else {
        return 'upcoming'
      }
    },
    [currentStep, errors]
  )

  return {
    currentStep,
    nextStep,
    prevStep,
    goToStep,
    canProceed,
    canSubmit,
    getStepStatus,
  }
}

export const useTeamManagement = (
  form: UseFormReturn<newBusinessData | existingBusinessData>
) => {
  const addTeamMember = useCallback(() => {
    const currentMembers = form.getValues('teamMembers') || []
    const newMember = {
      id: Date.now(),
      name: '',
      email: '',
      role: '',
      phone: '',
    }
    form.setValue('teamMembers', [...currentMembers, newMember], {
      shouldValidate: false,
    })
  }, [form])

  const updateTeamMember = useCallback(
    (
      id: number,
      field: keyof import('../schemas').TeamMember,
      value: string
    ) => {
      const currentMembers = form.getValues('teamMembers') || []
      const updatedMembers = currentMembers.map((member) =>
        member.id === id ? { ...member, [field]: value } : member
      )
      form.setValue('teamMembers', updatedMembers, { shouldValidate: false })
    },
    [form]
  )

  const removeTeamMember = useCallback(
    (id: number) => {
      const currentMembers = form.getValues('teamMembers') || []
      const updatedMembers = currentMembers.filter((member) => member.id !== id)
      form.setValue('teamMembers', updatedMembers, { shouldValidate: false })
    },
    [form]
  )

  return {
    addTeamMember,
    updateTeamMember,
    removeTeamMember,
  }
}

export { useFormPersistence } from './useFormPersistence'
