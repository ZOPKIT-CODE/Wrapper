/**
 * Zod Validation Schemas for Onboarding Form
 * Comprehensive step-by-step validation with user-friendly error messages
 */

import { z } from 'zod';
import { validateEmailSecurity, validatePhoneSecurity, validateTaxIdSecurity } from '../utils/securityValidations';

// Helper to get country from form data
const getCountry = (data: any): string => {
  return data?.businessDetails?.country || data?.country || 'IN';
};

// Helper to check if state is required for country
const requiresState = (country: string): boolean => {
  return ['IN', 'US', 'CA', 'AU'].includes(country);
};

// Email validation with security checks
const emailSchema = z
  .string()
  .min(1, 'Email is required')
  .email('Please enter a valid email address')
  .refine(
    (email) => {
      const validation = validateEmailSecurity(email);
      return validation.isValid;
    },
    (email) => {
      const validation = validateEmailSecurity(email);
      return { message: validation.error || 'Invalid email format' };
    }
  );

// Phone validation with security checks
const phoneSchema = (required: boolean = false) => {
  if (required) {
    return z
      .string()
      .min(1, 'Phone number is required')
      .refine(
        (val) => {
          if (!val || val.trim() === '') return false;
          const validation = validatePhoneSecurity(val, true);
          return validation.isValid;
        },
        (val) => {
          if (!val || val.trim() === '') return { message: 'Phone number is required' };
          const validation = validatePhoneSecurity(val, true);
          return { message: validation.error || 'Invalid phone number format' };
        }
      );
  }
  return z
    .string()
    .optional()
    .refine(
      (val) => {
        if (!val || val.trim() === '') return true; // Optional
        const validation = validatePhoneSecurity(val, false);
        return validation.isValid;
      },
      (val) => {
        const validation = validatePhoneSecurity(val || '', false);
        return { message: validation.error || 'Invalid phone number format' };
      }
    );
};

// GSTIN validation (India)
const gstinSchema = z
  .string()
  .min(1, 'GSTIN is required')
  .length(15, 'GSTIN must be exactly 15 characters')
  .regex(/^\d{2}[A-Z]{5}\d{4}[A-Z]\d[A-Z]\d$/, 'Invalid GSTIN format (e.g., 22AAAAA0000A1Z5)')
  .refine(
    (val) => {
      const validation = validateTaxIdSecurity(val, 'gstin');
      return validation.isValid;
    },
    (val) => {
      const validation = validateTaxIdSecurity(val, 'gstin');
      return { message: validation.error || 'Invalid GSTIN format' };
    }
  );

// PAN validation (India)
const panSchema = z
  .string()
  .min(1, 'PAN is required')
  .length(10, 'PAN must be exactly 10 characters')
  .regex(/^[A-Z]{5}\d{4}[A-Z]$/, 'Invalid PAN format (e.g., ABCDE1234F)')
  .refine(
    (val) => {
      const validation = validateTaxIdSecurity(val, 'pan');
      return validation.isValid;
    },
    (val) => {
      const validation = validateTaxIdSecurity(val, 'pan');
      return { message: validation.error || 'Invalid PAN format' };
    }
  );

// EIN validation (US)
const einSchema = z
  .string()
  .min(1, 'EIN is required')
  .regex(/^\d{2}-\d{7}$/, 'Invalid EIN format (e.g., 12-3456789)')
  .refine(
    (val) => {
      const validation = validateTaxIdSecurity(val, 'ein');
      return validation.isValid;
    },
    (val) => {
      const validation = validateTaxIdSecurity(val, 'ein');
      return { message: validation.error || 'Invalid EIN format' };
    }
  );

// URL validation
const urlSchema = z
  .string()
  .optional()
  .refine(
    (val) => {
      if (!val || val.trim() === '') return true; // Optional
      try {
        new URL(val.startsWith('http') ? val : `https://${val}`);
        return true;
      } catch {
        return false;
      }
    },
    { message: 'Please enter a valid website URL' }
  );

// Business Details Schema (Step 1)
const businessDetailsSchema = z.object({
  companyName: z
    .string()
    .min(1, 'Company name is required')
    .min(2, 'Company name must be at least 2 characters')
    .max(200, 'Company name must be less than 200 characters')
    .refine((val) => val.trim().length > 0, 'Company name cannot be only whitespace'),
  businessType: z.string().min(1, 'Business type is required'),
  organizationSize: z.string().optional(),
  country: z.string().min(1, 'Country is required'),
  description: z.string().max(1000, 'Description must be less than 1000 characters').optional(),
});

// Main Onboarding Form Schema
export const onboardingFormSchema = z
  .object({
    // Step 1: Business Details
    companyType: z.string().min(1, 'Company type is required'),
    businessDetails: businessDetailsSchema,
    country: z.string().optional(),
    website: urlSchema,

    // Step 2: Tax Details
    taxRegistered: z.boolean().default(false),
    vatGstRegistered: z.boolean().default(false),
    gstin: z.string().optional(),
    panNumber: z.string().optional(),
    einNumber: z.string().optional(),
    vatNumber: z.string().max(50, 'VAT number must be less than 50 characters').optional(),
    cinNumber: z.string().max(50, 'CIN number must be less than 50 characters').optional(),
    incorporationState: z.string().optional(),
    state: z.string().optional(),

    // Billing Address - either billingAddress or billingStreet is required (handled in superRefine)
    billingAddress: z.string().optional(),
    billingStreet: z
      .string()
      .optional()
      .refine(
        (val) => {
          // Will be validated in superRefine along with billingAddress
          if (!val || val.trim() === '') return true; // Optional at schema level
          return val.length >= 10 && val.length <= 200 && val.trim().length > 0;
        },
        { message: 'Address must be 10-200 characters and not only whitespace' }
      ),
    billingCity: z
      .string()
      .min(1, 'Billing city is required')
      .min(2, 'City name must be at least 2 characters')
      .max(100, 'City name must be less than 100 characters')
      .refine((val) => val.trim().length > 0, 'Billing city cannot be only whitespace'),
    billingZip: z
      .string()
      .min(1, 'Billing zip/postal code is required')
      .min(3, 'Zip code must be at least 3 characters')
      .max(20, 'Zip code must be less than 20 characters')
      .refine((val) => val.trim().length > 0, 'Billing zip code cannot be only whitespace'),
    billingState: z.string().optional(),
    billingCountry: z.string().optional(),

    // Mailing Address
    mailingAddressSameAsRegistered: z.boolean().default(true),
    mailingAddress: z.string().optional(),
    mailingStreet: z.string().optional(),
    mailingCity: z.string().optional(),
    mailingZip: z.string().optional(),
    mailingState: z.string().optional(),
    mailingCountry: z.string().optional(),

    // Step 3: Admin Details
    firstName: z
      .string()
      .min(1, 'First name is required')
      .min(2, 'First name must be at least 2 characters')
      .max(50, 'First name must be less than 50 characters')
      .refine((val) => val.trim().length > 0, 'First name cannot be only whitespace'),
    lastName: z
      .string()
      .min(1, 'Last name is required')
      .min(2, 'Last name must be at least 2 characters')
      .max(50, 'Last name must be less than 50 characters')
      .refine((val) => val.trim().length > 0, 'Last name cannot be only whitespace'),
    adminEmail: emailSchema,
    supportEmail: z.optional(z.union([z.literal(''), z.string().email()])),
    adminMobile: phoneSchema(false), // Will be refined based on userClassification
    billingEmail: z
      .string()
      .optional()
      .refine(
        (val) => {
          if (!val || val.trim() === '') return true; // Optional
          // Basic email format check
          const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
          if (!emailRegex.test(val)) {
            return false;
          }
          // Security validation
          const validation = validateEmailSecurity(val);
          return validation.isValid;
        },
        (val) => {
          if (!val || val.trim() === '') return { message: '' };
          const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
          if (!emailRegex.test(val)) {
            return { message: 'Please enter a valid email address' };
          }
          const validation = validateEmailSecurity(val);
          return { message: validation.error || 'Please enter a valid email address' };
        }
      ),

    // Contact Details (Optional)
    contactJobTitle: z.string().max(100, 'Job title must be less than 100 characters').optional(),
    preferredContactMethod: z.string().optional(),
    contactSalutation: z.string().optional(),
    contactMiddleName: z.string().max(50, 'Middle name must be less than 50 characters').optional(),
    contactDepartment: z.string().max(100, 'Department must be less than 100 characters').optional(),
    contactAuthorityLevel: z.string().optional(),
    contactDirectPhone: phoneSchema(false).optional(),
    contactMobilePhone: phoneSchema(false).optional(),

    // Step 4: Review
    termsAccepted: z.boolean().refine((val) => val === true, {
      message: 'You must accept the Terms and Conditions to continue',
    }),

    // Localization (Optional)
    defaultLanguage: z.string().optional(),
    defaultLocale: z.string().optional(),
    defaultCurrency: z.string().optional(),
    defaultTimeZone: z.string().optional(),

    // Other fields
    teamMembers: z.array(z.any()).optional(),
    email: z.string().optional(),
    phone: z.string().optional(),
    adminPhone: z.string().optional(),
    businessName: z.string().optional(),
    businessType: z.string().optional(),
    organizationSize: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    const country = getCountry(data);
    const needsState = requiresState(country);

    // Step 2: Tax Details - Conditional validations

    // State required for certain countries
    if (needsState) {
      const hasState = !!(data.state || data.billingState || data.incorporationState);
      if (!hasState) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'State/Province is required for this country',
          path: ['state'],
        });
      }
    }

    // GSTIN required when VAT/GST Registered is ON
    if (data.vatGstRegistered) {
      if (country === 'IN') {
        if (!data.gstin || data.gstin.trim() === '') {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'GSTIN is required when VAT/GST Registered is enabled',
            path: ['gstin'],
          });
        } else {
          // Validate GSTIN format
          const gstinResult = gstinSchema.safeParse(data.gstin);
          if (!gstinResult.success) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              message: gstinResult.error.errors[0]?.message || 'Invalid GSTIN format',
              path: ['gstin'],
            });
          }
        }
      } else {
        // For other countries, VAT number is required
        if (!data.vatNumber || data.vatNumber.trim() === '') {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'VAT number is required when VAT/GST Registered is enabled',
            path: ['vatNumber'],
          });
        }
      }
    }

    // PAN/EIN required when Tax Registered is ON
    if (data.taxRegistered) {
      if (country === 'IN') {
        if (!data.panNumber || data.panNumber.trim() === '') {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'PAN is required when Tax Registered is enabled',
            path: ['panNumber'],
          });
        } else {
          // Validate PAN format
          const panResult = panSchema.safeParse(data.panNumber);
          if (!panResult.success) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              message: panResult.error.errors[0]?.message || 'Invalid PAN format',
              path: ['panNumber'],
            });
          }
        }
      } else if (country === 'US') {
        if (!data.einNumber || data.einNumber.trim() === '') {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'EIN is required when Tax Registered is enabled',
            path: ['einNumber'],
          });
        } else {
          // Validate EIN format
          const einResult = einSchema.safeParse(data.einNumber);
          if (!einResult.success) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              message: einResult.error.errors[0]?.message || 'Invalid EIN format',
              path: ['einNumber'],
            });
          }
        }
      }
    }

    // Mailing address required when different from registered address
    if (!data.mailingAddressSameAsRegistered) {
      if (!data.mailingStreet || data.mailingStreet.trim() === '') {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Mailing street address is required',
          path: ['mailingStreet'],
        });
      }
      if (!data.mailingCity || data.mailingCity.trim() === '') {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Mailing city is required',
          path: ['mailingCity'],
        });
      }
      if (!data.mailingZip || data.mailingZip.trim() === '') {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Mailing zip/postal code is required',
          path: ['mailingZip'],
        });
      }
      if (needsState && (!data.mailingState || data.mailingState.trim() === '')) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Mailing state/province is required',
          path: ['mailingState'],
        });
      }
    }

    // Billing address can be either billingAddress or billingStreet
    const hasBillingAddress = !!(data.billingAddress && data.billingAddress.trim() !== '');
    const hasBillingStreet = !!(data.billingStreet && data.billingStreet.trim() !== '');
    
    if (!hasBillingAddress && !hasBillingStreet) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Billing street address is required',
        path: ['billingStreet'],
      });
    } else if (hasBillingStreet && data.billingStreet) {
      // Validate billingStreet format if provided
      if (data.billingStreet.length < 10) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Address must be at least 10 characters',
          path: ['billingStreet'],
        });
      }
      if (data.billingStreet.length > 200) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Address must be less than 200 characters',
          path: ['billingStreet'],
        });
      }
      if (data.billingStreet.trim().length === 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Billing street address cannot be only whitespace',
          path: ['billingStreet'],
        });
      }
    }
  });

// Export type for TypeScript inference
export type OnboardingFormData = z.infer<typeof onboardingFormSchema>;

// Helper function to create schema with user classification for adminMobile requirement
export const createOnboardingSchemaWithClassification = (userClassification?: string) => {
  return onboardingFormSchema.superRefine((data, ctx) => {
    // Admin mobile required for certain classifications
    const requiresMobile = userClassification === 'withGST' || userClassification === 'enterprise';
    
    if (requiresMobile) {
      if (!data.adminMobile || data.adminMobile.trim() === '') {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Admin mobile number is required for your account type',
          path: ['adminMobile'],
        });
      } else {
        // Validate phone format
        const phoneValidation = validatePhoneSecurity(data.adminMobile, true);
        if (!phoneValidation.isValid) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: phoneValidation.error || 'Invalid phone number format',
            path: ['adminMobile'],
          });
        }
      }
    }
  });
};
