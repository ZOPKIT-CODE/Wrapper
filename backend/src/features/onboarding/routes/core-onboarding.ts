/**
 * 🚀 **CLEAN ONBOARDING ROUTES**
 * Simplified routes using UnifiedOnboardingService
 * Single source of truth - only /onboard-frontend endpoint
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import UnifiedOnboardingService from '../services/unified-onboarding-service.js';
import OnboardingValidationService from '../services/onboarding-validation-service.js';
import { invalidateUserCache } from '../../../middleware/auth/auth.js';
import { db } from '../../../db/index.js';
import { tenants } from '../../../db/schema/index.js';
import { eq } from 'drizzle-orm';

export default async function coreOnboardingRoutes(
  fastify: FastifyInstance,
  _options?: Record<string, unknown>
): Promise<void> {
  // ✅ STEP-BY-STEP VALIDATION ENDPOINT
  // Allows frontend to validate each step before proceeding to next step
  fastify.post('/onboard-frontend/validate-step', {
    schema: {}
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const body = request.body as Record<string, unknown>;
      const step = body.step as number;
      const data = (body.data ?? {}) as Record<string, unknown>;
      
      console.log(`🔍 Validating onboarding step ${step}...`);

      const errors: Array<{ field: string; message: string; code?: string; redirectTo?: string }> = [];
      let isValid = true;

      // Step 1: Company Information
      if (step === 1) {
        if (!data.legalCompanyName || String(data.legalCompanyName).trim().length === 0) {
          errors.push({ field: 'legalCompanyName', message: 'Company name is required' });
          isValid = false;
        }
        if (!data.companySize) {
          errors.push({ field: 'companySize', message: 'Company size is required' });
          isValid = false;
        }
        if (!data.businessType || String(data.businessType).trim().length === 0) {
          errors.push({ field: 'businessType', message: 'Business type is required' });
          isValid = false;
        }
      }

      // Step 2: Personal/Admin Information
      if (step === 2) {
        if (!data.firstName || String(data.firstName).trim().length === 0) {
          errors.push({ field: 'firstName', message: 'First name is required' });
          isValid = false;
        }
        if (!data.lastName || String(data.lastName).trim().length === 0) {
          errors.push({ field: 'lastName', message: 'Last name is required' });
          isValid = false;
        }
        if (!data.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(data.email))) {
          errors.push({ field: 'email', message: 'Valid email address is required' });
          isValid = false;
        } else {
          // Check for duplicate email
          try {
            const duplicateCheck = await OnboardingValidationService.checkForDuplicates({ adminEmail: (data as Record<string, unknown>).email as string });
            if (!duplicateCheck.available) {
              if (duplicateCheck.alreadyOnboarded) {
                errors.push({ 
                  field: 'email', 
                  message: 'This email is already associated with an organization',
                  code: 'EMAIL_ALREADY_ONBOARDED',
                  redirectTo: '/dashboard'
                });
              } else {
                errors.push({ field: 'email', message: 'This email is already registered' });
              }
              isValid = false;
            }
          } catch (dupErr: unknown) {
            errors.push({ field: 'email', message: (dupErr as Error).message });
            isValid = false;
          }
        }

        // Validate PAN if provided (moved from Tax step)
        const taxDetails = data.taxRegistrationDetails as Record<string, unknown> | undefined;
        const panNumber = data.panNumber || taxDetails?.pan;
        if (panNumber) {
          const panStr = String(panNumber);
          const panRegex = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;
          if (!panRegex.test(panStr) || panStr.length !== 10) {
            errors.push({ field: 'panNumber', message: 'PAN must be 10 characters in valid format' });
            isValid = false;
          } else {
            // Verify PAN if provided (don't block on API/auth failures - same as full onboarding)
            try {
              const VerificationService = (await import('../services/verification-service.js')).default;
              const panVerification = await VerificationService.verifyPAN(
                panStr,
                String(data.legalCompanyName || data.companyName || '')
              );
              
              if (!panVerification.verified) {
                const skipVerificationError = panVerification.configurationError ||
                  panVerification.retryable === false ||
                  panVerification.requiresWhitelist;
                if (!skipVerificationError) {
                  errors.push({
                    field: 'panNumber',
                    message: String(panVerification.error || 'PAN verification failed'),
                    code: 'PAN_VERIFICATION_FAILED'
                  });
                  isValid = false;
                } else {
                  console.warn('⚠️ PAN verification skipped (API/config). Step validation allows proceed.');
                }
              }
            } catch (verifyErr: unknown) {
              console.warn('PAN verification error (non-blocking):', (verifyErr as Error)?.message);
            }
          }
        }
      }

      // Step 3: Tax Information - GSTIN only (PAN moved to Admin step)
      if (step === 3) {
        if (data.hasGstin && data.gstin) {
          const gstinStr = String(data.gstin);
          // Validate GSTIN format
          const gstinRegex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
          if (!gstinRegex.test(gstinStr) || gstinStr.length !== 15) {
            errors.push({ field: 'gstin', message: 'GSTIN must be 15 characters in valid format' });
            isValid = false;
          } else {
            // Verify GSTIN if provided (don't block on API/auth failures - same as full onboarding)
            try {
              const VerificationService = (await import('../services/verification-service.js')).default;
              const gstinVerification = await VerificationService.verifyGSTIN(
                gstinStr, 
                String(data.legalCompanyName || data.companyName || '')
              );
              
              if (!gstinVerification.verified) {
                const skipVerificationError = gstinVerification.configurationError ||
                  gstinVerification.retryable === false ||
                  gstinVerification.requiresWhitelist;
                if (!skipVerificationError) {
                  errors.push({
                    field: 'gstin',
                    message: String(gstinVerification.error || 'GSTIN verification failed'),
                    code: 'GSTIN_VERIFICATION_FAILED'
                  });
                  isValid = false;
                } else {
                  console.warn('⚠️ GSTIN verification skipped (API/config). Step validation allows proceed.');
                }
              }
            } catch (verifyErr: unknown) {
              console.warn('GSTIN verification error (non-blocking):', (verifyErr as Error)?.message);
            }
          }
        }
      }

      // Step 4: Preferences
      if (step === 4) {
        if (!data.country || String(data.country).trim().length === 0) {
          errors.push({ field: 'country', message: 'Country is required' });
          isValid = false;
        }
        if (!data.timezone || String(data.timezone).trim().length === 0) {
          errors.push({ field: 'timezone', message: 'Timezone is required' });
          isValid = false;
        }
        if (!data.currency || String(data.currency).trim().length === 0) {
          errors.push({ field: 'currency', message: 'Currency is required' });
          isValid = false;
        }
      }

      // Step 5: Terms & Review
      if (step === 5) {
        if (!data.termsAccepted) {
          errors.push({ field: 'termsAccepted', message: 'You must accept the terms and conditions' });
          isValid = false;
        }
      }

      if (!isValid) {
        return reply.code(400).send({
          success: false,
          valid: false,
          errors,
          message: errors.length === 1 
            ? errors[0].message 
            : `Please fix ${errors.length} validation errors`
        });
      }

      return reply.code(200).send({
        success: true,
        valid: true,
        message: `Step ${step} validation passed`
      });

    } catch (err: unknown) {
      const error = err as Error;
      console.error('❌ Step validation error:', error);
      return reply.code(500).send({
        success: false,
        valid: false,
        error: 'Validation failed',
        message: error.message || 'An error occurred during validation'
      });
    }
  });

  // 🌟 **FRONTEND ONBOARDING ENDPOINT** (Only active endpoint)
  fastify.post('/onboard-frontend', {
    preValidation: async (request: FastifyRequest, _reply: FastifyReply) => {
      // Clean up empty strings for optional fields - remove them entirely so they're not validated
      const body = (request.body as Record<string, unknown>) || {};
      const optionalFields = [
        'panNumber', 'gstin', 'einNumber', 'vatNumber', 'cinNumber',
        'companyType', 'website', 'adminEmail', 'adminMobile',
        'supportEmail', 'billingEmail', 'contactJobTitle', 'preferredContactMethod',
        'contactSalutation', 'contactMiddleName', 'contactDepartment', 'contactAuthorityLevel',
        'contactDirectPhone', 'contactMobilePhone', 'contactPreferredContactMethod',
        'state', 'billingStreet', 'billingCity', 'billingState', 'billingZip', 'billingCountry',
        'defaultLanguage', 'defaultLocale',
        'businessType', 'companySize' // optional so frontend can omit; backend will default
      ];
      
      optionalFields.forEach(field => {
        if (body[field] === '' || body[field] === null || body[field] === undefined) {
          delete body[field]; // Remove empty/null/undefined fields entirely
        }
      });
      
      // Clean taxRegistrationDetails object
      const taxReg = body.taxRegistrationDetails as Record<string, unknown> | undefined;
      if (taxReg && typeof taxReg === 'object') {
        Object.keys(taxReg).forEach(key => {
          if (taxReg[key] === '' || 
              taxReg[key] === null || 
              taxReg[key] === undefined) {
            delete taxReg[key];
          }
        });
        // If taxRegistrationDetails is now empty, remove it
        if (Object.keys(taxReg).length === 0) {
          delete body.taxRegistrationDetails;
        }
      }
    },
    schema: {}
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      console.log('🚀 === FRONTEND ONBOARDING START ===');

      const body = request.body as Record<string, unknown>;
      const {
        legalCompanyName,
        companyType,
        companySize: companySizeRaw,
        businessType,
        website,
        firstName,
        lastName,
        email,
        adminEmail,
        adminMobile,
        supportEmail,
        billingEmail,
        contactJobTitle,
        preferredContactMethod,
        contactSalutation,
        contactMiddleName,
        contactDepartment,
        contactAuthorityLevel,
        contactDirectPhone,
        contactMobilePhone,
        contactPreferredContactMethod,
        taxRegistered = false,
        vatGstRegistered = false,
        hasGstin = false,
        gstin,
        panNumber,
        einNumber,
        vatNumber,
        cinNumber,
        taxRegistrationDetails,
        country,
        state,
        billingStreet,
        billingCity,
        billingState,
        billingZip,
        billingCountry,
        timezone,
        currency,
        defaultLanguage,
        defaultLocale,
        termsAccepted
      } = body;

      const companySize = companySizeRaw && ['1-10', '11-50', '51-200', '201-1000', '1000+'].includes(String(companySizeRaw))
        ? companySizeRaw
        : '1-10';

      const businessTypeFinal = (businessType && String(businessType).trim()) || 'Other';

      // ✅ USE UNIFIED ONBOARDING SERVICE
      const result = await UnifiedOnboardingService.completeOnboardingWorkflow({
        type: 'frontend',
        companyName: legalCompanyName,
        adminEmail: adminEmail || email,
        companySize,
        businessType: businessTypeFinal,
        firstName,
        lastName,
        hasGstin,
        gstin,
        panNumber,
        taxRegistrationDetails: (taxRegistrationDetails as Record<string, unknown> | undefined) || (panNumber ? { pan: panNumber, country: (country as string) || 'IN' } : undefined),
        country,
        timezone,
        currency,
        termsAccepted,
        // Additional fields from frontend
        companyType,
        industry: businessTypeFinal || null, // Use businessType for backward compatibility
        website,
        adminMobile,
        supportEmail,
        billingEmail,
        contactJobTitle,
        preferredContactMethod,
        // Primary contact details (for tenant dashboard settings)
        contactSalutation,
        contactMiddleName,
        contactDepartment,
        contactAuthorityLevel,
        contactDirectPhone,
        contactMobilePhone,
        contactPreferredContactMethod,
        taxRegistered,
        vatGstRegistered,
        state,
        billingStreet,
        billingCity,
        billingState,
        billingZip,
        billingCountry,
        defaultLanguage,
        defaultLocale,
        selectedPlan: 'free',
        initialCredits: 1000
      }, request);

      console.log('🎉 === FRONTEND ONBOARDING COMPLETE ===');

      const res = result as { tenant: { tenantId: string; subdomain: string }; adminUser: { userId: string; kindeUserId?: string }; organization: { organizationId: string }; adminRole: { roleId: string }; redirectUrl?: string; creditAllocated?: number; onboardingType?: string };

      // Invalidate the user record cache using the kindeUserId from the result.
      // This MUST use the result — this route is public (no auth middleware), so
      // request.userContext is always undefined here. Before onboarding, the auth
      // middleware cached the user as `null` (no tenant_users row yet). Without
      // invalidation, that null entry persists for 5 minutes, causing every
      // post-onboarding request to fail with 401 ("Unauthorized") until TTL expires.
      const kindeUserIdFromResult = res.adminUser.kindeUserId;
      if (kindeUserIdFromResult) {
        invalidateUserCache(kindeUserIdFromResult);
      }
      return reply.code(201).send({
        success: true,
        message: 'Organization onboarded successfully via frontend flow',
          data: {
          tenantId: res.tenant.tenantId,
          adminUserId: res.adminUser.userId,
          organizationId: res.organization.organizationId,
          adminRoleId: res.adminRole.roleId,
          subdomain: res.tenant.subdomain,
          redirectUrl: res.redirectUrl,
          creditAllocated: res.creditAllocated,
          onboardingType: res.onboardingType
        }
      });

    } catch (err: unknown) {
      const error = err as Error;
      const errAny = error as unknown as Record<string, unknown>;
      console.error('❌ Frontend onboarding failed:', error);

      // Handle Fastify schema validation errors
      if (errAny.validation && Array.isArray(errAny.validation)) {
        const validationErrors = (errAny.validation as Array<{ instancePath?: string; params?: { missingProperty?: string; limit?: number; format?: string; allowedValues?: string[] }; message?: string; keyword?: string }>).map(v => {
          const fieldName = v.instancePath?.replace('/', '') || v.params?.missingProperty || 'unknown';
          let message = v.message || 'Invalid value';
          const params = v.params || {};
          // Make error messages more user-friendly
          if (v.keyword === 'required') {
            message = `${fieldName} is required`;
          } else if (v.keyword === 'minLength') {
            message = `${fieldName} must be at least ${params.limit} characters`;
          } else if (v.keyword === 'maxLength') {
            message = `${fieldName} must not exceed ${params.limit} characters`;
          } else if (v.keyword === 'format') {
            if (params.format === 'email') {
              message = `${fieldName} must be a valid email address`;
            } else {
              message = `${fieldName} format is invalid`;
            }
          } else if (v.keyword === 'enum') {
            message = `${fieldName} must be one of: ${(params.allowedValues || []).join(', ')}`;
          } else if (v.keyword === 'pattern') {
            message = `${fieldName} format is invalid`;
          }
          
          return {
            field: fieldName,
            message: message,
            code: (v.keyword as string)?.toUpperCase() || 'VALIDATION_ERROR'
          };
        });

        return reply.code(400).send({
          success: false,
          error: 'Validation Error',
          message: validationErrors.length === 1 
            ? validationErrors[0].message 
            : `Please fix the following errors: ${validationErrors.map(e => e.message).join(', ')}`,
          errors: validationErrors,
          statusCode: 400
        });
      }

      // Handle validation errors from OnboardingValidationService
      if (errAny.name === 'ValidationError' && errAny.errors) {
        const validationErrors = Array.isArray(errAny.errors) ? (errAny.errors as Array<{ field?: string; message?: string; code?: string }>).map(e => ({
          field: e.field || 'unknown',
          message: e.message || 'Validation failed',
          code: e.code || 'VALIDATION_ERROR'
        })) : [{
          field: 'unknown',
          message: error.message || 'Validation failed',
          code: 'VALIDATION_ERROR'
        }];

        // Check if any errors are verification-related
        const verificationErrors = validationErrors.filter(e => 
          e.code === 'PAN_VERIFICATION_FAILED' || 
          e.code === 'GSTIN_VERIFICATION_FAILED' || 
          e.code === 'GSTIN_NOT_ACTIVE'
        );

        return reply.code(400).send({
          success: false,
          error: verificationErrors.length > 0 ? 'Verification Error' : 'Validation Error',
          message: validationErrors.length === 1 
            ? validationErrors[0].message 
            : `Please fix the following errors: ${validationErrors.map(e => e.message).join(', ')}`,
          errors: validationErrors,
          statusCode: 400
        });
      }

      // Handle validation errors with message containing "Validation failed"
      if (error.message && error.message.includes('Validation failed') && errAny.errors) {
        const validationErrors = Array.isArray(errAny.errors) ? (errAny.errors as Array<{ field?: string; message?: string; code?: string }>).map(e => ({
          field: e.field || 'unknown',
          message: e.message || 'Validation failed',
          code: 'VALIDATION_ERROR'
        })) : [{
          field: 'unknown',
          message: error.message,
          code: 'VALIDATION_ERROR'
        }];

        return reply.code(400).send({
          success: false,
          error: 'Validation Error',
          message: validationErrors.length === 1 
            ? validationErrors[0].message 
            : `Please fix the following errors: ${validationErrors.map(e => e.message).join(', ')}`,
          errors: validationErrors,
          statusCode: 400
        });
      }

      // Handle already onboarded users - this is a success case, just redirect
      if (errAny.name === 'AlreadyOnboardedError') {
        return reply.code(200).send({
          success: true,
          message: 'You have already completed onboarding',
          data: {
            alreadyOnboarded: true,
            redirectTo: (errAny.redirectTo as string) || '/dashboard',
            tenantId: errAny.tenantId
          }
        });
      }

      // Handle duplicate registration errors specifically
      if (errAny.name === 'DuplicateRegistrationError' && errAny.errors && Array.isArray(errAny.errors)) {
        const duplicateError = (errAny.errors as Array<{ type?: string; message?: string }>)[0];
        return reply.code(409).send({
          success: false,
          error: duplicateError.type || 'duplicate_email',
          message: duplicateError.message || 'This email is already associated with an organization',
          code: 'EMAIL_ALREADY_ASSOCIATED',
          redirectTo: '/dashboard'
        });
      }

      // Handle validation errors with clear messages
      if (error.message?.includes('already associated') || error.message?.includes('already registered')) {
        return reply.code(409).send({
          success: false,
          error: 'duplicate_email',
          message: error.message || 'This email is already associated with an organization',
          code: 'EMAIL_ALREADY_ASSOCIATED',
          redirectTo: '/dashboard'
        });
      }

      const errCode = errAny.code as string | undefined;
      const isDbError = errCode === '23505' || errCode === '23503' || errCode === '23502';
      const userMessage = isDbError
        ? (errCode === '23505' ? 'This organization or subdomain may already exist. Try a different company name or contact support.' : 'A database constraint was not met. Please check your details and try again.')
        : (error.message || 'An unexpected error occurred during onboarding');

      return reply.code(500).send({
        success: false,
        error: 'Onboarding failed',
        message: userMessage,
        code: errCode,
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined,
        canRetry: true
      });
    }
  });

  // 📥 GET STORED ONBOARDING FORM DATA FOR RETRY
  fastify.get('/onboard-frontend/retry-data', {
    schema: {
      querystring: {
        type: 'object',
        properties: {
          email: { type: 'string', format: 'email' }
        },
        required: ['email']
      }
    }
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const query = request.query as Record<string, string>;
      const { email } = query;
      
      // Extract authentication to get kindeUserId
      const authHeader = request.headers.authorization;
      let kindeUserId = null;
      
      if (authHeader && authHeader.startsWith('Bearer ')) {
        try {
          const { kindeService } = await import('../../auth/index.js');
          const token = authHeader.substring(7);
          const user = await kindeService.validateToken(token);
          kindeUserId = user.kindeUserId || user.userId;
        } catch (authErr: unknown) {
          console.warn('Could not validate token for retry data:', (authErr as Error).message);
        }
      }

      if (!kindeUserId) {
        return reply.code(401).send({
          success: false,
          error: 'Authentication required',
          message: 'Please authenticate to retrieve your saved form data'
        });
      }

      const UnifiedOnboardingService = (await import('../services/unified-onboarding-service.js')).default;
      const storedData = await UnifiedOnboardingService.getStoredOnboardingFormData(String(kindeUserId), String(email));

      if (!storedData) {
        return reply.code(404).send({
          success: false,
          error: 'No saved data found',
          message: 'No saved onboarding data found for this email'
        });
      }

      return reply.code(200).send({
        success: true,
        data: {
          formData: storedData.formData,
          stepData: storedData.stepData,
          currentStep: storedData.currentStep,
          flowType: storedData.flowType,
          lastSaved: storedData.lastSaved
        }
      });

    } catch (err: unknown) {
      const error = err as Error;
      console.error('❌ Error retrieving retry data:', error);
      return reply.code(500).send({
        success: false,
        error: 'Failed to retrieve saved data',
        message: error.message || 'An error occurred while retrieving saved form data'
      });
    }
  });

  // 🔄 RETRY ONBOARDING WITH STORED DATA
  fastify.post('/onboard-frontend/retry', {
    schema: {
      body: {
        type: 'object',
        properties: {
          email: { type: 'string', format: 'email' },
          useStoredData: { type: 'boolean', default: true }
        },
        required: ['email']
      }
    }
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const body = request.body as Record<string, unknown>;
      const { email, useStoredData = true } = body;

      // Extract authentication
      const authHeader = request.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return reply.code(401).send({
          success: false,
          error: 'Authentication required',
          message: 'Please authenticate to retry onboarding'
        });
      }

      const { kindeService } = await import('../../auth/index.js');
      const token = authHeader.substring(7);
      const user = await kindeService.validateToken(token) as { kindeUserId?: string; userId?: string };
      const kindeUserId = user.kindeUserId || user.userId;

      const UnifiedOnboardingServiceImport = (await import('../services/unified-onboarding-service.js')).default;

      // Get stored form data if requested
      let onboardingData = (body.formData as Record<string, unknown>) || {};
      if (useStoredData) {
        const storedData = await (UnifiedOnboardingServiceImport as { getStoredOnboardingFormData: (a: string, b: string) => Promise<{ formData?: Record<string, unknown> } | null> }).getStoredOnboardingFormData(kindeUserId as string, email as string);
        if (storedData && storedData.formData) {
          // Merge stored data with any new data provided
          onboardingData = {
            ...storedData.formData,
            ...onboardingData // New data overrides stored data
          };
        }
      }

      // Retry onboarding with the data
      const result = await (UnifiedOnboardingServiceImport as unknown as { completeOnboardingWorkflow: (a: Record<string, unknown>, b: FastifyRequest) => Promise<{ tenant: { tenantId: string; subdomain: string }; adminUser: { userId: string }; organization: { organizationId: string }; adminRole: { roleId: string }; creditAllocated?: number; onboardingType?: string; redirectUrl?: string }> }).completeOnboardingWorkflow(
        {
          ...onboardingData,
          type: (onboardingData.type as string) || 'frontend'
        },
        request
      );

      // Delete stored form data after successful retry
      if (useStoredData) {
        try {
          await (UnifiedOnboardingServiceImport as { deleteStoredOnboardingFormData: (a: string, b: string) => Promise<void> }).deleteStoredOnboardingFormData(kindeUserId as string, email as string);
        } catch (deleteErr: unknown) {
          console.warn('⚠️ Failed to delete stored form data (non-critical):', (deleteErr as Error).message);
        }
      }

      return reply.code(201).send({
        success: true,
        message: 'Onboarding completed successfully via retry',
        data: {
          tenantId: result.tenant.tenantId,
          adminUserId: result.adminUser.userId,
          organizationId: result.organization.organizationId,
          adminRoleId: result.adminRole.roleId,
          subdomain: result.tenant.subdomain,
          redirectUrl: result.redirectUrl,
          creditAllocated: result.creditAllocated,
          onboardingType: result.onboardingType
        }
      });

    } catch (err: unknown) {
      const error = err as Error & { errors?: Array<{ field?: string; message?: string; code?: string }> };
      console.error('❌ Retry onboarding failed:', error);

      // Handle validation errors
      if ((error as unknown as Record<string, unknown>).name === 'ValidationError' && error.errors) {
        const validationErrors = Array.isArray(error.errors) ? error.errors.map(e => ({
          field: e.field || 'unknown',
          message: e.message || 'Validation failed',
          code: e.code || 'VALIDATION_ERROR'
        })) : [{
          field: 'unknown',
          message: error.message || 'Validation failed',
          code: 'VALIDATION_ERROR'
        }];

        return reply.code(400).send({
          success: false,
          error: 'Validation Error',
          message: validationErrors.length === 1 
            ? validationErrors[0].message 
            : `Please fix ${validationErrors.length} validation errors`,
          errors: validationErrors,
          statusCode: 400
        });
      }

      return reply.code(500).send({
        success: false,
        error: 'Retry failed',
        message: error.message || 'An unexpected error occurred during retry',
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined
      });
    }
  });
}
