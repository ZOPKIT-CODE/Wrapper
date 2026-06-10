/**
 * Enhanced Security Validations for Onboarding Form
 * Provides additional security checks beyond basic validation
 */

import {
  sanitizeString,
  sanitizeEmail,
  sanitizePhone,
  sanitizeTaxId,
} from './sanitization'

/**
 * Security validation for email with enhanced checks
 */
export const validateEmailSecurity = (
  email: string | undefined
): { isValid: boolean; error?: string } => {
  if (!email) return { isValid: false, error: 'Email is required' }

  try {
    const sanitized = sanitizeEmail(email)

    // Additional security checks
    const lowerEmail = sanitized.toLowerCase()

    // Prevent common attack vectors
    if (
      lowerEmail.includes('<script') ||
      lowerEmail.includes('javascript:') ||
      lowerEmail.includes('data:') ||
      lowerEmail.includes('vbscript:') ||
      lowerEmail.includes('onload=') ||
      lowerEmail.includes('onerror=')
    ) {
      return { isValid: false, error: 'Invalid email format' }
    }

    // Check for suspicious patterns
    if (
      lowerEmail.includes('..') ||
      lowerEmail.startsWith('.') ||
      lowerEmail.endsWith('.')
    ) {
      return { isValid: false, error: 'Invalid email format' }
    }

    // Domain validation - prevent personal email for business contexts
    const domain = sanitized.split('@')[1]
    if (domain) {
      const suspiciousDomains = [
        '10minutemail.com',
        'guerrillamail.com',
        'temp-mail.org',
      ]
      if (suspiciousDomains.some((d) => domain.includes(d))) {
        return { isValid: false, error: 'Please use a business email address' }
      }
    }

    return { isValid: true }
  } catch (error) {
    return {
      isValid: false,
      error: error instanceof Error ? error.message : 'Invalid email',
    }
  }
}

/**
 * Security validation for phone numbers
 */
export const validatePhoneSecurity = (
  phone: string | undefined,
  required: boolean = false
): { isValid: boolean; error?: string } => {
  // FIXED: Only require if explicitly requested, otherwise just validate format if provided
  if (!phone || phone.trim() === '') {
    if (required) {
      return { isValid: false, error: 'Phone number is required' }
    }
    return { isValid: true } // Empty is valid if not required
  }

  try {
    const sanitized = sanitizePhone(phone)

    // Length validation
    const digitsOnly = sanitized.replace(/\D/g, '')
    if (digitsOnly.length < 10 || digitsOnly.length > 15) {
      return { isValid: false, error: 'Phone number must be 10-15 digits' }
    }

    // Prevent suspicious patterns
    if (/(.)\1{6,}/.test(digitsOnly)) {
      // Repeated digits
      return { isValid: false, error: 'Invalid phone number format' }
    }

    return { isValid: true }
  } catch (error) {
    return {
      isValid: false,
      error: error instanceof Error ? error.message : 'Invalid phone number',
    }
  }
}

/**
 * Security validation for tax IDs with enhanced checks
 */
export const validateTaxIdSecurity = (
  taxId: string | undefined,
  type: 'gstin' | 'pan' | 'ein' | 'vat'
): { isValid: boolean; error?: string } => {
  if (!taxId)
    return { isValid: false, error: `${type.toUpperCase()} is required` }

  try {
    const sanitized = sanitizeTaxId(taxId, type)

    // Additional security checks based on type
    switch (type) {
      case 'gstin':
        // GSTIN has specific format: 2 digits + 10 chars + 1 digit + 1 char + 1 digit
        if (!/^\d{2}[A-Z]{5}\d{4}[A-Z]\d[A-Z]\d$/.test(sanitized)) {
          return { isValid: false, error: 'Invalid GSTIN format' }
        }
        break

      case 'pan':
        // PAN format: 5 letters + 4 digits + 1 letter
        if (!/^[A-Z]{5}\d{4}[A-Z]$/.test(sanitized)) {
          return { isValid: false, error: 'Invalid PAN format' }
        }
        break

      case 'ein':
        // EIN format: XX-XXXXXXX
        if (!/^\d{2}-\d{7}$/.test(taxId)) {
          // Check original format
          return { isValid: false, error: 'Invalid EIN format (XX-XXXXXXX)' }
        }
        break
    }

    return { isValid: true }
  } catch (error) {
    return {
      isValid: false,
      error:
        error instanceof Error
          ? error.message
          : `Invalid ${type.toUpperCase()}`,
    }
  }
}

/**
 * Security validation for company names
 */
export const validateCompanyNameSecurity = (
  name: string | undefined
): { isValid: boolean; error?: string } => {
  if (!name) return { isValid: false, error: 'Company name is required' }

  try {
    const sanitized = sanitizeString(name)

    // Length checks
    if (sanitized.length < 2) {
      return { isValid: false, error: 'Company name too short' }
    }
    if (sanitized.length > 100) {
      return { isValid: false, error: 'Company name too long' }
    }

    // Prevent suspicious patterns
    const lowerName = sanitized.toLowerCase()
    if (
      lowerName.includes('<script') ||
      lowerName.includes('javascript:') ||
      lowerName.includes('data:') ||
      /(.)\1{10,}/.test(lowerName)
    ) {
      // Repeated characters
      return { isValid: false, error: 'Invalid company name' }
    }

    return { isValid: true }
  } catch (error) {
    return { isValid: false, error: 'Invalid company name' }
  }
}

/**
 * Security validation for addresses
 */
export const validateAddressSecurity = (
  address: string | undefined
): { isValid: boolean; error?: string } => {
  if (!address) return { isValid: false, error: 'Address is required' }

  try {
    const sanitized = sanitizeString(address)

    // Length checks
    if (sanitized.length < 10) {
      return { isValid: false, error: 'Address too short' }
    }
    if (sanitized.length > 200) {
      return { isValid: false, error: 'Address too long' }
    }

    // Prevent suspicious patterns
    const lowerAddress = sanitized.toLowerCase()
    if (
      lowerAddress.includes('<script') ||
      lowerAddress.includes('javascript:') ||
      lowerAddress.includes('data:')
    ) {
      return { isValid: false, error: 'Invalid address format' }
    }

    return { isValid: true }
  } catch (error) {
    return { isValid: false, error: 'Invalid address' }
  }
}

/**
 * Subset of onboarding form fields inspected during security validation.
 * All fields are optional because validation only runs format checks on the
 * values that are present.
 */
export interface FormDataSecurityInput {
  adminEmail?: string
  supportEmail?: string
  adminMobile?: string
  vatGstRegistered?: boolean
  gstin?: string
  taxRegistered?: boolean
  panNumber?: string
  einNumber?: string
  businessDetails?: {
    companyName?: string
  }
  billingStreet?: string
}

/**
 * Comprehensive security validation for form data
 */
export const validateFormDataSecurity = (
  data: FormDataSecurityInput
): { isValid: boolean; errors: Record<string, string> } => {
  const errors: Record<string, string> = {}

  // Validate emails
  if (data.adminEmail) {
    const emailValidation = validateEmailSecurity(data.adminEmail)
    if (!emailValidation.isValid) {
      errors.adminEmail = emailValidation.error || 'Invalid email'
    }
  }

  if (data.supportEmail) {
    const emailValidation = validateEmailSecurity(data.supportEmail)
    if (!emailValidation.isValid) {
      errors.supportEmail = emailValidation.error || 'Invalid email'
    }
  }

  // Validate phone - FIXED: Only validate format if provided, don't require it here
  // Requirement is handled by canProceed() based on user classification
  if (data.adminMobile && data.adminMobile.trim() !== '') {
    const phoneValidation = validatePhoneSecurity(data.adminMobile)
    if (!phoneValidation.isValid) {
      errors.adminMobile = phoneValidation.error || 'Invalid phone'
    }
  }
  // If adminMobile is empty/not provided, don't validate (requirement check is in canProceed)

  // Validate tax IDs - ONLY if the corresponding toggle is enabled
  // FIXED: Only validate GSTIN format if VAT/GST Registered toggle is ON and GSTIN is provided
  // Note: Requirement check is handled by canProceed() - this only validates format
  if (data.vatGstRegistered && data.gstin) {
    const gstinValidation = validateTaxIdSecurity(data.gstin, 'gstin')
    if (!gstinValidation.isValid) {
      errors.gstin = gstinValidation.error || 'Invalid GSTIN'
    }
  }
  // If toggle is OFF, don't validate GSTIN even if it exists (user may have entered it before)

  // FIXED: Only validate PAN format if Tax Registered toggle is ON and PAN is provided
  // Note: Requirement check is handled by canProceed() - this only validates format
  if (data.taxRegistered && data.panNumber) {
    const panValidation = validateTaxIdSecurity(data.panNumber, 'pan')
    if (!panValidation.isValid) {
      errors.panNumber = panValidation.error || 'Invalid PAN'
    }
  }
  // If toggle is OFF, don't validate PAN even if it exists (user may have entered it before)

  // FIXED: Only validate EIN format if Tax Registered toggle is ON and EIN is provided
  if (data.taxRegistered && data.einNumber) {
    const einValidation = validateTaxIdSecurity(data.einNumber, 'ein')
    if (!einValidation.isValid) {
      errors.einNumber = einValidation.error || 'Invalid EIN'
    }
  }
  // If toggle is OFF, don't validate EIN even if it exists

  // Validate company name
  if (data.businessDetails?.companyName) {
    const companyValidation = validateCompanyNameSecurity(
      data.businessDetails.companyName
    )
    if (!companyValidation.isValid) {
      errors['businessDetails.companyName'] =
        companyValidation.error || 'Invalid company name'
    }
  }

  // Validate addresses
  if (data.billingStreet) {
    const addressValidation = validateAddressSecurity(data.billingStreet)
    if (!addressValidation.isValid) {
      errors.billingStreet = addressValidation.error || 'Invalid address'
    }
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  }
}
