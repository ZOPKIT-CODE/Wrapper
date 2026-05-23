/**
 * 🚀 **ONBOARDING VALIDATION SERVICE**
 * Handles validation checks during onboarding process
 * Ensures no duplicate emails or other conflicts exist
 * Verifies PAN and GSTIN using verification APIs before onboarding
 */

import { systemDbConnection } from '../../../db/index.js';
import { tenants, tenantUsers } from '../../../db/schema/index.js';
import { eq } from 'drizzle-orm';
import VerificationService from './verification-service.js';
import Logger from '../../../utils/logger.js';

class OnboardingValidationService {

  /**
   * Check for duplicate emails during onboarding
   * @param {Object} data - Validation data
   * @param {string} data.adminEmail - Admin email to check
   * @returns {Object} Result with available status and onboarding status
   * @throws {Error} If duplicate email is found (only for non-onboarded users)
   */
  static async checkForDuplicates(data: { adminEmail?: string }): Promise<{ available: boolean; alreadyOnboarded?: boolean; tenantId?: string; companyName?: string; userId?: string }> {
    const { adminEmail } = data;

    if (!adminEmail) {
      throw new Error('Email is required for duplicate checking');
    }

    Logger.log('info', 'general', 'checkForDuplicates', 'Checking for duplicate email', { adminEmail });

    // Check if email already exists as adminEmail in tenants table
    const existingTenant = await systemDbConnection
      .select({ 
        tenantId: tenants.tenantId,
        onboardingCompleted: tenants.onboardingCompleted,
        companyName: tenants.companyName
      })
      .from(tenants)
      .where(eq(tenants.adminEmail, adminEmail))
      .limit(1);

    if (existingTenant.length > 0) {
      const tenant = existingTenant[0];
      // If onboarding is already completed, this is not an error - user should be redirected
      if (tenant.onboardingCompleted === true) {
        Logger.log('info', 'general', 'checkForDuplicates', 'Email found with completed onboarding - user should be redirected to dashboard');
        return { 
          available: false, 
          alreadyOnboarded: true,
          tenantId: tenant.tenantId,
          companyName: tenant.companyName
        };
      }
      // If onboarding is not completed, treat as duplicate
      Logger.log('warning', 'general', 'checkForDuplicates', 'Duplicate email found in tenants table with incomplete onboarding', { adminEmail });
      throw new Error('This email is already associated with an organization');
    }

    // Also check if email exists in tenantUsers table (as a user)
    const existingUser = await systemDbConnection
      .select({ 
        userId: tenantUsers.userId, 
        tenantId: tenantUsers.tenantId,
        onboardingCompleted: tenantUsers.onboardingCompleted
      })
      .from(tenantUsers)
      .where(eq(tenantUsers.email, adminEmail))
      .limit(1);

    if (existingUser.length > 0) {
      const user = existingUser[0];
      // If user is already onboarded, this is not an error - user should be redirected
      if (user.onboardingCompleted === true) {
        Logger.log('info', 'general', 'checkForDuplicates', 'Email found as user with completed onboarding - user should be redirected to dashboard');
        return { 
          available: false, 
          alreadyOnboarded: true,
          tenantId: user.tenantId,
          userId: user.userId
        };
      }
      // If onboarding is not completed, treat as duplicate
      Logger.log('warning', 'general', 'checkForDuplicates', 'Duplicate email found in tenantUsers table with incomplete onboarding', { adminEmail });
      throw new Error('This email is already registered as a user');
    }

    Logger.log('info', 'general', 'checkForDuplicates', 'No duplicates found for email', { adminEmail });
    return { available: true };
  }

  /**
   * Check if subdomain is available
   * @param {string} subdomain - Subdomain to check
   * @returns {boolean} True if available, false otherwise
   */
  static async checkSubdomainAvailability(subdomain: string): Promise<boolean> {
    if (!subdomain) {
      throw new Error('Subdomain is required');
    }

    Logger.log('info', 'general', 'checkSubdomainAvailability', 'Checking subdomain availability', { subdomain });

    const existingTenant = await systemDbConnection
      .select({ tenantId: tenants.tenantId })
      .from(tenants)
      .where(eq(tenants.subdomain, subdomain))
      .limit(1);

    const isAvailable = existingTenant.length === 0;
    Logger.log('info', 'general', 'checkSubdomainAvailability', isAvailable ? 'Subdomain available' : 'Subdomain taken', { subdomain });

    return isAvailable;
  }

  /**
   * Validate complete onboarding data
   * @param {Object} data - Onboarding data to validate
   * @param {string} type - Type of onboarding ('frontend' or 'enhanced')
   * @returns {Object} Validation result with success status and data
   */
  static async validateCompleteOnboarding(data: Record<string, unknown>, type: string): Promise<Record<string, unknown>> {
    Logger.log('info', 'general', 'validateCompleteOnboarding', 'Validating complete onboarding data', { type });

    const errors = [];

    // Common validations
    if (!data.email && !data.adminEmail) {
      errors.push({ field: 'email', message: 'Email is required' });
    }

    const email = (data.email ?? data.adminEmail) as string | undefined;

    // Email format validation
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email))) {
      errors.push({ field: 'email', message: 'Invalid email format' });
    }

    // Type-specific validations
    if (type === 'frontend') {
      if (!data.legalCompanyName) {
        errors.push({ field: 'legalCompanyName', message: 'Company name is required' });
      }
      if (!data.firstName) {
        errors.push({ field: 'firstName', message: 'First name is required' });
      }
      if (!data.lastName) {
        errors.push({ field: 'lastName', message: 'Last name is required' });
      }
      if (data.termsAccepted !== true) {
        errors.push({ field: 'termsAccepted', message: 'You must accept the terms and conditions' });
      }
      if (data.hasGstin && !data.gstin) {
        errors.push({ field: 'gstin', message: 'GSTIN is required when hasGstin is true' });
      }

      // New field validations
      if (data.billingEmail != null && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(data.billingEmail))) {
        errors.push({ field: 'billingEmail', message: 'Invalid billing email format' });
      }
      if (data.supportEmail != null && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(data.supportEmail))) {
        errors.push({ field: 'supportEmail', message: 'Invalid support email format' });
      }
      if (data.contactDirectPhone != null && !/^\+?[\d\s\-\(\)]+$/.test(String(data.contactDirectPhone))) {
        errors.push({ field: 'contactDirectPhone', message: 'Invalid phone number format' });
      }
      if (data.contactMobilePhone != null && !/^\+?[\d\s\-\(\)]+$/.test(String(data.contactMobilePhone))) {
        errors.push({ field: 'contactMobilePhone', message: 'Invalid mobile phone number format' });
      }
      if (data.preferredContactMethod != null && !['email', 'phone', 'sms'].includes(String(data.preferredContactMethod))) {
        errors.push({ field: 'preferredContactMethod', message: 'Preferred contact method must be email, phone, or sms' });
      }
      if (data.contactPreferredContactMethod != null && !['email', 'phone', 'sms'].includes(String(data.contactPreferredContactMethod))) {
        errors.push({ field: 'contactPreferredContactMethod', message: 'Contact preferred contact method must be email, phone, or sms' });
      }
    } else if (type === 'enhanced') {
      if (!data.companyName) {
        errors.push({ field: 'companyName', message: 'Company name is required' });
      }
      if (!data.subdomain) {
        errors.push({ field: 'subdomain', message: 'Subdomain is required' });
      }
    }

    // Check for duplicate email
    if (email && errors.length === 0) {
      try {
        const duplicateCheck = await this.checkForDuplicates({ adminEmail: String(email) });
        // If user is already onboarded, return success with redirect flag
        if (duplicateCheck.alreadyOnboarded) {
          return {
            success: true,
            data: {
              generatedSubdomain: null,
              alreadyOnboarded: true,
              tenantId: duplicateCheck.tenantId,
              redirectTo: '/dashboard'
            }
          };
        }
      } catch (err: unknown) {
        const duplicateError = err as Error;
        errors.push({ field: 'email', message: duplicateError.message });
      }
    }

    // Verify PAN and GSTIN using verification APIs before proceeding
    // Skip verification errors if service is not configured or API returns auth/network errors
    if (errors.length === 0) {
      // Verify PAN if provided
      const taxDetails = data.taxRegistrationDetails as Record<string, unknown> | undefined;
      if (data.panNumber || taxDetails?.pan) {
        const pan = (data.panNumber ?? taxDetails?.pan) as string;
        const companyName = String(data.legalCompanyName ?? data.companyName ?? '');
        
        Logger.log('info', 'general', 'validateCompleteOnboarding', 'Verifying PAN', { pan, companyName });
        try {
          const panVerification = await VerificationService.verifyPAN(pan, companyName);
          
          // Skip verification error if service is not configured (configurationError: true)
          // or if API returned auth/network errors (retryable: false, requiresWhitelist: true)
          if (!panVerification.verified) {
            const shouldSkip = panVerification.configurationError || 
                              panVerification.retryable === false ||
                              panVerification.requiresWhitelist;
            
            if (shouldSkip) {
              Logger.log('warning', 'general', 'validateCompleteOnboarding', 'PAN verification skipped (service not configured or API error). PAN will be stored without verification', { reason: panVerification.error || 'Verification service unavailable' });
            } else {
              // Only add error if verification failed for actual validation reasons (invalid/inactive PAN)
              errors.push({ 
                field: 'panNumber', 
                message: panVerification.error || 'PAN verification failed. Please check the PAN number.',
                code: 'PAN_VERIFICATION_FAILED'
              });
            }
          } else {
            Logger.log('info', 'general', 'validateCompleteOnboarding', 'PAN verified successfully', { pan });
            // Optionally store verification details for later use
            const details = panVerification.details as Record<string, unknown> | undefined;
            if (details) {
              Logger.log('info', 'general', 'validateCompleteOnboarding', 'PAN details', { nameMatchScore: details.nameMatchScore, type: details.type });
            }
          }
        } catch (err: unknown) {
          const verifyError = err as Error;
          // Network errors or unexpected exceptions: log but don't block onboarding
          Logger.log('warning', 'general', 'validateCompleteOnboarding', 'PAN verification error (non-blocking). PAN will be stored without verification', { error: verifyError.message });
        }
      }

      // Verify GSTIN if provided
      if (data.hasGstin && data.gstin) {
        const gstin = String(data.gstin);
        const companyName = String(data.legalCompanyName ?? data.companyName ?? '');
        
        Logger.log('info', 'general', 'validateCompleteOnboarding', 'Verifying GSTIN', { gstin, companyName });
        try {
          const gstinVerification = await VerificationService.verifyGSTIN(gstin, companyName);
          
          // Skip verification error if service is not configured (configurationError: true)
          // or if API returned auth/network errors (retryable: false, requiresWhitelist: true)
          if (!gstinVerification.verified) {
            const shouldSkip = gstinVerification.configurationError || 
                              gstinVerification.retryable === false ||
                              gstinVerification.requiresWhitelist;
            
            if (shouldSkip) {
              Logger.log('warning', 'general', 'validateCompleteOnboarding', 'GSTIN verification skipped (service not configured or API error). GSTIN will be stored without verification', { reason: gstinVerification.error || 'Verification service unavailable' });
            } else {
              // Only add error if verification failed for actual validation reasons (invalid/inactive GSTIN)
              errors.push({ 
                field: 'gstin', 
                message: gstinVerification.error || 'GSTIN verification failed. Please check the GSTIN number.',
                code: 'GSTIN_VERIFICATION_FAILED'
              });
            }
          } else {
            Logger.log('info', 'general', 'validateCompleteOnboarding', 'GSTIN verified successfully', { gstin });
            // Check if GSTIN status is active
            const gstinDetails = gstinVerification.details as Record<string, unknown> | undefined;
            const status = gstinDetails?.status as string | undefined;
            const isActive = gstinDetails?.isActive as boolean | undefined;
            
            if (status && String(status).toLowerCase() !== 'active' && !isActive) {
              errors.push({ 
                field: 'gstin', 
                message: `GSTIN status is ${status}. Only active GSTINs are allowed.`,
                code: 'GSTIN_NOT_ACTIVE'
              });
            } else if (gstinDetails) {
              Logger.log('info', 'general', 'validateCompleteOnboarding', 'GSTIN details', { status, legalBusinessName: gstinDetails.legalBusinessName });
            }
          }
        } catch (err: unknown) {
          const verifyError = err as Error;
          // Network errors or unexpected exceptions: log but don't block onboarding
          Logger.log('warning', 'general', 'validateCompleteOnboarding', 'GSTIN verification error (non-blocking). GSTIN will be stored without verification', { error: verifyError.message });
        }
      }
    }

    // Generate subdomain if needed (for frontend type)
    let generatedSubdomain = null;
    if (type === 'frontend' && data.legalCompanyName && errors.length === 0) {
      generatedSubdomain = await this.generateUniqueSubdomain(String(data.legalCompanyName));
    }

    if (errors.length > 0) {
      Logger.log('warning', 'general', 'validateCompleteOnboarding', 'Validation failed', { errors });
      return {
        success: false,
        errors
      };
    }

    Logger.log('info', 'general', 'validateCompleteOnboarding', 'Validation successful');
    return {
      success: true,
      data: {
        generatedSubdomain
      }
    };
  }

  /**
   * Generate a unique subdomain from company name
   * @param {string} companyName - Company name to generate subdomain from
   * @returns {string} Unique subdomain
   */
  static async generateUniqueSubdomain(companyName: string): Promise<string> {
    if (!companyName) {
      throw new Error('Company name is required to generate subdomain');
    }

    Logger.log('info', 'general', 'generateUniqueSubdomain', 'Generating unique subdomain', { companyName });

    // Convert company name to subdomain-friendly format
    let baseSubdomain = companyName
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '-') // Replace non-alphanumeric with hyphens
      .replace(/-+/g, '-') // Replace multiple hyphens with single hyphen
      .replace(/^-|-$/g, '') // Remove leading/trailing hyphens
      .substring(0, 30); // Limit length

    // Ensure it doesn't start with a number
    if (/^\d/.test(baseSubdomain)) {
      baseSubdomain = 'org-' + baseSubdomain;
    }

    // Check availability and add suffix if needed
    let subdomain = baseSubdomain;
    let suffix = 1;
    let isAvailable = await this.checkSubdomainAvailability(subdomain);

    while (!isAvailable) {
      subdomain = `${baseSubdomain}-${suffix}`;
      isAvailable = await this.checkSubdomainAvailability(subdomain);
      suffix++;

      // Safety check to prevent infinite loop
      if (suffix > 100) {
        subdomain = `${baseSubdomain}-${Date.now()}`;
        break;
      }
    }

    Logger.log('info', 'general', 'generateUniqueSubdomain', 'Generated unique subdomain', { subdomain });
    return subdomain;
  }
}

export default OnboardingValidationService;



