/**
 * Form Data Sanitization Utilities
 * Provides comprehensive data cleaning and validation
 */

/**
 * Sanitize string input - remove harmful characters and trim
 */
export const sanitizeString = (value: string | undefined | null): string => {
  if (!value || typeof value !== 'string') return ''

  // Trim whitespace
  let sanitized = value.trim()

  // Remove null bytes and other control characters. The control-char range is the
  // whole point of this sanitizer, so the no-control-regex rule is intentionally disabled.
  // eslint-disable-next-line no-control-regex
  sanitized = sanitized.replace(/[\x00-\x1F\x7F-\x9F]/g, '')

  // Basic XSS prevention - remove script tags and dangerous attributes
  sanitized = sanitized.replace(
    /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
    ''
  )
  sanitized = sanitized.replace(/javascript:/gi, '')
  sanitized = sanitized.replace(/on\w+\s*=/gi, '')

  return sanitized
}

/**
 * Sanitize email address
 */
export const sanitizeEmail = (email: string | undefined | null): string => {
  if (!email || typeof email !== 'string') return ''

  const sanitized = email.trim().toLowerCase()

  // Basic email validation regex
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  if (!emailRegex.test(sanitized)) {
    throw new Error('Invalid email format')
  }

  return sanitized
}

/**
 * Sanitize phone number - keep only digits, spaces, hyphens, plus
 */
export const sanitizePhone = (phone: string | undefined | null): string => {
  if (!phone || typeof phone !== 'string') return ''

  // Remove all characters except digits, spaces, hyphens, plus
  return phone.replace(/[^\d\s\-+()]/g, '').trim()
}

/**
 * Sanitize GSTIN/PAN/EIN numbers - remove spaces and convert to uppercase
 */
export const sanitizeTaxId = (
  taxId: string | undefined | null,
  type: 'gstin' | 'pan' | 'ein' | 'vat'
): string => {
  if (!taxId || typeof taxId !== 'string') return ''

  let sanitized = taxId.replace(/\s/g, '').toUpperCase()

  // Type-specific validation
  switch (type) {
    case 'gstin':
      if (sanitized.length !== 15) {
        throw new Error('GSTIN must be 15 characters')
      }
      break
    case 'pan':
      if (sanitized.length !== 10) {
        throw new Error('PAN must be 10 characters')
      }
      break
    case 'ein':
      sanitized = sanitized.replace(/\D/g, '')
      if (sanitized.length !== 9) {
        throw new Error('EIN must be 9 digits')
      }
      break
    case 'vat':
      // VAT numbers vary by country, basic length check
      if (sanitized.length < 8 || sanitized.length > 20) {
        throw new Error('VAT number length is invalid')
      }
      break
  }

  return sanitized
}

/**
 * Sanitize URL - ensure it has proper protocol
 */
export const sanitizeUrl = (url: string | undefined | null): string => {
  if (!url || typeof url !== 'string') return ''

  let sanitized = url.trim()

  // Add protocol if missing
  if (sanitized && !sanitized.match(/^https?:\/\//i)) {
    sanitized = 'https://' + sanitized
  }

  // Basic URL validation
  try {
    new URL(sanitized)
    return sanitized
  } catch {
    throw new Error('Invalid URL format')
  }
}

/**
 * Sanitize numeric values
 */
export const sanitizeNumber = (value: any): number | null => {
  if (value === null || value === undefined || value === '') return null

  const num = Number(value)
  if (isNaN(num)) return null

  return num
}

/**
 * Sanitize boolean values
 */
export const sanitizeBoolean = (value: any): boolean => {
  if (typeof value === 'boolean') return value
  if (typeof value === 'string') {
    return value.toLowerCase() === 'true' || value === '1'
  }
  return Boolean(value)
}

/**
 * Deep sanitize object - recursively clean all properties
 */
export const sanitizeObject = (obj: any): any => {
  if (obj === null || obj === undefined) return obj
  if (typeof obj !== 'object') return obj
  if (Array.isArray(obj)) {
    return obj.map((item) => sanitizeObject(item))
  }

  const sanitized: any = {}

  for (const [key, value] of Object.entries(obj)) {
    // Skip sensitive fields that shouldn't be sanitized
    if (
      key.includes('password') ||
      key.includes('secret') ||
      key.includes('token')
    ) {
      sanitized[key] = value
      continue
    }

    // FIXED: Sanitize boolean fields to ensure they're always booleans, never strings
    if (
      key === 'taxRegistered' ||
      key === 'vatGstRegistered' ||
      key === 'hasGstin' ||
      key === 'termsAccepted' ||
      key === 'mailingAddressSameAsRegistered'
    ) {
      sanitized[key] = sanitizeBoolean(value)
      continue
    }

    // FIXED: Preserve company name fields - don't sanitize them to empty strings
    // Company name is critical and should be preserved even if sanitization fails
    if (
      key === 'companyName' ||
      key === 'businessName' ||
      key === 'legalCompanyName'
    ) {
      if (typeof value === 'string' && value.trim()) {
        sanitized[key] = sanitizeString(value)
        // Ensure it's not empty after sanitization
        if (!sanitized[key] || sanitized[key].trim() === '') {
          sanitized[key] = value.trim() // Fallback to original if sanitization removes it
        }
      } else {
        sanitized[key] = value // Preserve non-string values
      }
      continue
    }

    // Type-specific sanitization based on field name
    if (key.includes('email') || key.includes('Email')) {
      try {
        sanitized[key] = sanitizeEmail(value as string)
      } catch {
        sanitized[key] = ''
      }
    } else if (
      key.includes('phone') ||
      key.includes('mobile') ||
      key.includes('Phone')
    ) {
      sanitized[key] = sanitizePhone(value as string)
    } else if (key.includes('gstin') || key === 'gstin') {
      try {
        sanitized[key] = sanitizeTaxId(value as string, 'gstin')
      } catch {
        sanitized[key] = ''
      }
    } else if (key.includes('pan') || key === 'panNumber') {
      try {
        sanitized[key] = sanitizeTaxId(value as string, 'pan')
      } catch {
        sanitized[key] = ''
      }
    } else if (key.includes('ein') || key === 'einNumber') {
      try {
        sanitized[key] = sanitizeTaxId(value as string, 'ein')
      } catch {
        sanitized[key] = ''
      }
    } else if (key.includes('vat') || key === 'vatNumber') {
      try {
        sanitized[key] = sanitizeTaxId(value as string, 'vat')
      } catch {
        sanitized[key] = ''
      }
    } else if (
      key.includes('website') ||
      key.includes('url') ||
      key.includes('Url')
    ) {
      try {
        sanitized[key] = sanitizeUrl(value as string)
      } catch {
        sanitized[key] = ''
      }
    } else if (typeof value === 'string') {
      sanitized[key] = sanitizeString(value)
    } else if (typeof value === 'object') {
      sanitized[key] = sanitizeObject(value)
    } else {
      sanitized[key] = value
    }
  }

  return sanitized
}

/**
 * Main sanitization function for form data
 */
export const sanitizeFormData = (data: any): any => {
  try {
    if (!data || typeof data !== 'object') {
      return data
    }

    // Deep sanitize the entire object
    const sanitized = sanitizeObject(data)

    // Additional validation for required business fields
    if (sanitized.businessDetails) {
      const businessDetails = sanitized.businessDetails

      // Ensure country is valid
      if (
        businessDetails.country &&
        typeof businessDetails.country === 'string'
      ) {
        const validCountries = [
          'IN',
          'US',
          'CA',
          'AU',
          'GB',
          'DE',
          'FR',
          'IT',
          'ES',
          'NL',
        ]
        if (!validCountries.includes(businessDetails.country.toUpperCase())) {
          businessDetails.country = 'IN' // Default to India
        } else {
          businessDetails.country = businessDetails.country.toUpperCase()
        }
      }
    }

    // Validate terms acceptance
    if (typeof sanitized.termsAccepted !== 'undefined') {
      sanitized.termsAccepted = sanitizeBoolean(sanitized.termsAccepted)
    }

    return sanitized
  } catch (error) {
    console.error('Form data sanitization failed:', error)
    // Return original data if sanitization fails
    return data
  }
}
