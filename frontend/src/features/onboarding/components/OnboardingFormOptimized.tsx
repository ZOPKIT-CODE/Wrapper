import React, { useState, useCallback, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useKindeAuth } from '@kinde-oss/kinde-auth-react';
import { queryKeys } from '@/hooks/useSharedQueries';
import { useOnboardingForm } from '../hooks';
import { useFormPersistenceOptimized } from '../hooks/useFormPersistenceOptimized';
import { UserClassification } from './FlowSelector';
import { MultiStepForm } from './MultiStepForm';
import { ErrorBoundary } from './ErrorBoundary';
import { OnboardingWelcomeSuccess } from './OnboardingWelcomeSuccess';
import { toast as sonnerToast } from 'sonner';
import { useRateLimit } from '../hooks/useRateLimit';
import { sanitizeFormData } from '../utils/sanitization';
import { validateFormDataSecurity } from '../utils/securityValidations';
import { existingBusinessData, newBusinessData } from '../schemas';
import { getFlowConfig } from '../config/flowConfigs';
import { onboardingLogger } from '../utils/onboardingLogger';
// Note: getStepNumberForField and getDisplayNameForField are available for future use

/**
 * Verify if email is a domain email (not personal email provider)
 */
export const verifyEmailDomain = (email: string): { isDomainEmail: boolean; domain: string | null } => {
  const domain = email.split('@')[1]?.toLowerCase();
  if (!domain) {
    return { isDomainEmail: false, domain: null };
  }
  
  const personalDomains = [
    'gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 
    'aol.com', 'icloud.com', 'protonmail.com', 'mail.com',
    'yandex.com', 'zoho.com', 'gmx.com'
  ];
  
  const isPersonalEmail = personalDomains.some(personal => domain.includes(personal));
  
  return {
    isDomainEmail: !isPersonalEmail,
    domain: domain
  };
};

/**
 * Determine GST status from various sources
 */
const determineGSTStatus = (
  urlParams?: URLSearchParams,
  userProfile?: any,
  formData?: any
): boolean | null => {
  // 1. Check URL parameters
  if (urlParams) {
    const gstParam = urlParams.get('gst');
    if (gstParam === 'true') return true;
    if (gstParam === 'false') return false;
  }
  
  // 2. Check user profile
  if (userProfile?.hasExistingBusiness) return true;
  if (userProfile?.isRegisteredBusiness === false) return false;
  if (userProfile?.hasGST) return true;
  
  // 3. Check form data (if available)
  if (formData?.vatGstRegistered) return true;
  if (formData?.gstin) return true;
  
  return null; // Unknown
};

/**
 * Enhanced classification logic
 */
export const determineUserClassification = (
  email?: string,
  userProfile?: any,
  urlParams?: URLSearchParams,
  mobileVerified?: boolean,
  dinVerified?: boolean,
  formData?: any // Optional form data for GST detection
): UserClassification | undefined => {
  // 1. Check if mobile OTP is verified
  if (mobileVerified) {
    return 'mobileOtpVerified';
  }

  // 2. Check if DIN is verified
  if (dinVerified) {
    return 'dinVerification';
  }

  // 3. Check URL parameters for explicit classification
  if (urlParams) {
    const explicitClassification = urlParams.get('classification');
    if (explicitClassification) {
      const validClassifications: UserClassification[] = [
        'enterprise', 'freemium', 'growth', 'aspiringFounder', 
        'corporateEmployee', 'withGST', 'withoutGST', 'withDomainMail', 
        'withoutDomainMail', 'employee', 'founder'
      ];
      if (validClassifications.includes(explicitClassification as UserClassification)) {
        return explicitClassification as UserClassification;
      }
    }
  }

  // 4. Matrix Classification
  if (email) {
    const emailVerification = verifyEmailDomain(email);
    const hasGST = determineGSTStatus(urlParams, userProfile, formData);
    
    if (hasGST !== null) {
      if (hasGST === true && emailVerification.isDomainEmail) return 'corporateEmployee';
      if (hasGST === true && !emailVerification.isDomainEmail) return 'founder';
      if (hasGST === false && emailVerification.isDomainEmail) return 'corporateEmployee';
      if (hasGST === false && !emailVerification.isDomainEmail) return 'aspiringFounder';
    }
    
    return emailVerification.isDomainEmail ? 'withDomainMail' : 'withoutDomainMail';
  }

  const hasGST = determineGSTStatus(urlParams, userProfile, formData);
  if (hasGST === true) return 'withGST';
  if (hasGST === false) return 'withoutGST';

  if (userProfile) {
    if (userProfile.role === 'employee' || userProfile.isEmployee) return 'employee';
    if (userProfile.role === 'founder' || userProfile.isFounder || userProfile.isOwner) return 'founder';
  }

  if (userProfile?.tier) {
    if (userProfile.tier === 'freemium' || userProfile.plan === 'free') return 'freemium';
    if (userProfile.tier === 'growth' || userProfile.plan === 'growth') return 'growth';
    if (userProfile.tier === 'enterprise' || userProfile.plan === 'enterprise') return 'enterprise';
  }

  return 'aspiringFounder';
};

export const OnboardingFormOptimized = () => {
  const queryClient = useQueryClient();
  const { user: kindeUser } = useKindeAuth();
  const [selectedFlow] = useState<'newBusiness' | 'existingBusiness'>('newBusiness');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [redirectUrl, setRedirectUrl] = useState('/dashboard/applications');
  const [companyName, setCompanyName] = useState<string | undefined>();

  const [userClassification] = useState<UserClassification | undefined>(() => {
    const classification = determineUserClassification(
      undefined,
      undefined,
      new URLSearchParams(window.location.search)
    );
    return classification || 'aspiringFounder';
  });

  const form = useOnboardingForm(selectedFlow, userClassification, kindeUser);
  const { isRateLimited, recordAttempt, getTimeUntilReset } = useRateLimit({
    maxAttempts: 3,
    windowMs: 60000
  });

  const flowConfig = getFlowConfig(selectedFlow);

  // OPTIMIZED: Use optimized form persistence
  const { clearFormData, restoreFormData } = useFormPersistenceOptimized({
    form,
    flowType: selectedFlow,
    currentStep,
    autoSave: true,
    autoRestore: true,
    clearOnSubmit: true,
  });

  // Restore progress on mount - use ref to prevent multiple restorations
  const hasRestoredRef = React.useRef(false);

  useEffect(() => {
    onboardingLogger.info('OnboardingForm mounted', { currentStep, selectedFlow });
    // Expose logs in dev so you can run in console: copy(__ONBOARDING_LOGS_STRING__())
    if (typeof window !== 'undefined') {
      (window as any).__ONBOARDING_LOGS_STRING__ = () => onboardingLogger.getLogsAsString();
      (window as any).__ONBOARDING_LOGS__ = () => onboardingLogger.getLogs();
    }
    if (hasRestoredRef.current) return;
    hasRestoredRef.current = true;

    let isMounted = true;

    restoreFormData().then((restoredStep) => {
      if (!isMounted) return;

      if (restoredStep && restoredStep > 1 && restoredStep !== currentStep) {
        onboardingLogger.info('Form progress restored', { restoredStep, previousCurrentStep: currentStep });
        setCurrentStep(restoredStep);
        sonnerToast.info('Welcome back — we restored your progress', {
          description: `Continuing from step ${restoredStep} of 4`,
          duration: 6000,
          action: {
            label: 'Start over',
            onClick: () => {
              clearFormData();
              setCurrentStep(1);
              form.reset();
            },
          },
        });
      } else {
        onboardingLogger.debug('No restore needed or same step', { restoredStep, currentStep });
      }
    }).catch((error) => {
      if (!isMounted) return;

      onboardingLogger.warn('Failed to restore form data', { error: String(error), stack: (error as Error)?.stack });
      console.warn('Failed to restore form data:', error);
      sonnerToast.warning('Unable to restore previous progress', {
        description: 'Starting fresh onboarding process',
        duration: 4000,
      });

      // Clear corrupted data and reset to step 1
      clearFormData();
      setCurrentStep(1);
      form.reset();
    });

    return () => {
      isMounted = false;
    };
  }, []);

  // Sync Kinde profile into admin fields once the SDK resolves (it loads async).
  // Only backfill — don't overwrite values the user has already typed.
  useEffect(() => {
    if (!kindeUser) return;
    const { getValues, setValue } = form;
    if (!getValues('firstName') && kindeUser.givenName) setValue('firstName', kindeUser.givenName, { shouldValidate: false });
    if (!getValues('lastName') && kindeUser.familyName) setValue('lastName', kindeUser.familyName, { shouldValidate: false });
    if (!getValues('adminEmail') && kindeUser.email) setValue('adminEmail', kindeUser.email, { shouldValidate: false });
  }, [kindeUser, form]);

  // Listen for step restoration events
  useEffect(() => {
    const handleStepRestored = (event: CustomEvent) => {
      const { step } = event.detail;
      if (step && step > 1) {
        setCurrentStep(step);
      }
    };

    window.addEventListener('onboarding-step-restored', handleStepRestored as EventListener);
    return () => {
      window.removeEventListener('onboarding-step-restored', handleStepRestored as EventListener);
    };
  }, []);

  const handleSubmit = useCallback(async (data: newBusinessData | existingBusinessData) => {
    onboardingLogger.info('Submit started', { currentStep, hasTermsAccepted: !!data.termsAccepted });
    // FIXED: Check terms acceptance FIRST before any processing
    if (!data.termsAccepted) {
      onboardingLogger.warn('Submit blocked: terms not accepted');
      sonnerToast.error('Terms and Conditions Required', {
        description: 'Please accept the Terms and Conditions to continue',
        duration: 6000
      });
      return;
    }

    if (isRateLimited) {
      onboardingLogger.warn('Submit blocked: rate limited', { getTimeUntilReset: getTimeUntilReset() });
      const remainingTime = Math.ceil(getTimeUntilReset() / 1000);
      sonnerToast.error(`Too Many Attempts: Please wait ${remainingTime} seconds before trying again.`, {
        duration: 5000
      });
      return;
    }

    // FIXED: Validate ALL form fields before submission
    const formValidationResult = await form.trigger();
    if (!formValidationResult) {
      const formErrors = form.formState.errors;
      const firstErrorField = Object.keys(formErrors)[0];
      const firstError = formErrors[firstErrorField as keyof typeof formErrors];
      const errorMessage = (firstError as any)?.message || `Please fix the validation errors in ${firstErrorField}`;
      onboardingLogger.warn('Submit blocked: validation failed', { formErrors: Object.keys(formErrors), firstErrorField, errorMessage });
      sonnerToast.error('Validation Failed', {
        description: errorMessage,
        duration: 6000
      });
      return;
    }

    setIsSubmitting(true);
    recordAttempt();
    onboardingLogger.info('Submitting to API /onboarding/onboard-frontend', { companyName: (data as any).businessDetails?.companyName ?? (data as any).companyName });

    const loadingToastId = sonnerToast.loading('Setting up your organization...', {
      duration: Infinity,
    });

    try {
      // FIXED: Get company name BEFORE sanitization to ensure it's not lost
      const rawBusinessDetails = (data as any).businessDetails || {};
      const rawCompanyName = rawBusinessDetails.companyName || 
                            (data as any).companyName || 
                            (data as any).businessName ||
                            rawBusinessDetails.businessName ||
                            '';
      
      // Validate that company name exists BEFORE sanitization
      if (!rawCompanyName || rawCompanyName.trim() === '') {
        onboardingLogger.warn('Submit blocked: company name missing before sanitization', { rawBusinessDetails: (data as any).businessDetails });
        setIsSubmitting(false);
        sonnerToast.dismiss(loadingToastId);
        sonnerToast.error('Company Name Required', {
          description: 'Please enter your company name in the Business Details step',
          duration: 6000
        });
        return;
      }

      const sanitizedData = sanitizeFormData(data);

      // FIXED: Perform security validation - skip empty optional fields
      const securityValidation = validateFormDataSecurity(sanitizedData);
      if (!securityValidation.isValid) {
        onboardingLogger.warn('Submit blocked: security validation failed', { errors: securityValidation.errors });
        setIsSubmitting(false);
        sonnerToast.dismiss(loadingToastId);
        const firstError = Object.values(securityValidation.errors)[0];
        sonnerToast.error('Security Validation Failed', {
          description: firstError,
          duration: 6000
        });
        return;
      }

      const businessDetails = sanitizedData.businessDetails || {};

      // OPTIMIZED: Use optimized API with properly mapped data
      const { default: api } = await import('@/lib/apiOptimized');
      
      // Helper function to filter out empty/null/undefined values
      const filterEmpty = (value: any): any => {
        if (value === null || value === undefined || value === '') {
          return undefined;
        }
        return value;
      };
      
      // FIXED: Get company name from sanitized data, but fallback to raw if sanitized is empty
      // This ensures we always have a company name even if sanitization removes it
      const companyName = (businessDetails.companyName && businessDetails.companyName.trim()) || 
                         (sanitizedData.companyName && sanitizedData.companyName.trim()) || 
                         (sanitizedData.businessName && sanitizedData.businessName.trim()) ||
                         rawCompanyName.trim(); // Use raw as final fallback
      
      // Double-check that company name exists after sanitization
      if (!companyName || companyName.trim() === '') {
        onboardingLogger.warn('Submit blocked: company name empty after sanitization', { sanitizedData: { ...sanitizedData, businessDetails: sanitizedData.businessDetails } });
        setIsSubmitting(false);
        sonnerToast.dismiss(loadingToastId);
        sonnerToast.error('Company Name Required', {
          description: 'Company name was lost during sanitization. Please re-enter your company name.',
          duration: 6000
        });
        return;
      }
      
      const response = await api.post('/onboarding/onboard-frontend', {
        // Company Information - FIXED: Use companyName variable (guaranteed to exist)
        legalCompanyName: companyName.trim(),
        companyType: sanitizedData.companyType,
        companySize: businessDetails.organizationSize || sanitizedData.organizationSize,
        businessType: businessDetails.businessType || sanitizedData.businessType,
        website: filterEmpty(sanitizedData.website),
        
        // Admin/Contact Information
        firstName: sanitizedData.firstName || sanitizedData.personalDetails?.firstName,
        lastName: sanitizedData.lastName || sanitizedData.personalDetails?.lastName,
        email: sanitizedData.email || sanitizedData.personalDetails?.email || sanitizedData.adminEmail,
        adminEmail: sanitizedData.adminEmail,
        adminMobile: filterEmpty(sanitizedData.adminMobile || sanitizedData.adminPhone || sanitizedData.phone),
        supportEmail: filterEmpty(sanitizedData.supportEmail),
        billingEmail: filterEmpty(sanitizedData.billingEmail),
        
        // Contact Details
        contactJobTitle: filterEmpty(sanitizedData.contactJobTitle),
        preferredContactMethod: filterEmpty(sanitizedData.preferredContactMethod),
        
        // Tax & Compliance - FIXED: Ensure all boolean fields are actual booleans
        taxRegistered: Boolean(sanitizedData.taxRegistered) || false,
        vatGstRegistered: Boolean(sanitizedData.vatGstRegistered) || false,
        // FIXED: hasGstin should be true only if GSTIN exists OR vatGstRegistered is true
        // Ensure it's always a boolean, never an empty string
        hasGstin: Boolean(sanitizedData.gstin && sanitizedData.gstin.trim() !== '') || Boolean(sanitizedData.vatGstRegistered),
        gstin: filterEmpty(sanitizedData.gstin),
        panNumber: filterEmpty(sanitizedData.panNumber),
        einNumber: filterEmpty(sanitizedData.einNumber),
        vatNumber: filterEmpty(sanitizedData.vatNumber),
        cinNumber: filterEmpty(sanitizedData.cinNumber),
        
        // Address Information
        country: businessDetails.country || sanitizedData.country || 'IN',
        state: sanitizedData.state,
        billingStreet: sanitizedData.billingStreet,
        billingCity: sanitizedData.billingCity,
        billingState: sanitizedData.billingState || sanitizedData.state,
        billingZip: sanitizedData.billingZip,
        billingCountry: sanitizedData.billingCountry || businessDetails.country || sanitizedData.country,
        
        // Localization
        timezone: sanitizedData.defaultTimeZone || 'Asia/Kolkata',
        currency: sanitizedData.defaultCurrency || 'INR',
        defaultLanguage: sanitizedData.defaultLanguage || 'en',
        defaultLocale: sanitizedData.defaultLocale || 'en-IN',
        
        // Terms
        termsAccepted: sanitizedData.termsAccepted || false
      });

      if (response.data.success) {
        onboardingLogger.info('Onboarding submit success', { responseData: response.data });
        sonnerToast.dismiss(loadingToastId);
        clearFormData();

        // POST-ONBOARDING CACHE RESET
        // ---------------------------
        // The backend's `createCompleteOnboardingInTransaction` provisions the entire
        // tenant in a single transaction: tenant record, admin user, default admin
        // role, role assignment, plan applications (organization_applications), credit
        // allocation, and subscription. Any TanStack Query cache that ran before this
        // transaction completed will hold pre-onboarding placeholder data (typically
        // empty arrays for apps/roles or 4xx error states), and serving that on the
        // dashboard is exactly the "applications/roles missing after onboarding"
        // symptom users hit.
        //
        // We do TWO things, in order:
        //
        //   1. `removeQueries` for the tenant-scoped lists. This evicts the placeholder
        //      data entirely so the next mount can't render `[]` from cache. Without
        //      this, `placeholderData: []` on the list hooks would keep masking the
        //      refetch behind a "loaded but empty" UI for an instant.
        //
        //   2. `invalidateQueries` for the auth/identity layer, then refetch the
        //      auth-status critical path. The sidebar, permission gates, and route
        //      guards all read from `authStatus`, so it must be fresh BEFORE the
        //      dashboard mounts — otherwise PermissionGuard renders stale denials.
        //
        // We invalidate by query-key PREFIX rather than the parameterized key so we
        // catch every variant (e.g. `['roles']` covers both `useRoles()` and the
        // filtered `useRoles({ search, type })`; `['tenantApps']` covers any tenantId).
        await Promise.all([
          // 1a. Evict stale list data so list pages don't flash empty state.
          queryClient.removeQueries({ queryKey: ['tenantApps'] }),
          queryClient.removeQueries({ queryKey: ['roles'] }),
          queryClient.removeQueries({ queryKey: ['users'] }),
          queryClient.removeQueries({ queryKey: ['entities'] }),
          queryClient.removeQueries({ queryKey: ['applicationAllocations'] }),

          // 1b. Invalidate identity + tenant-state queries. These are read by
          //     route guards, sidebar, billing banner, and credit widgets.
          queryClient.invalidateQueries({ queryKey: queryKeys.authStatus }),
          queryClient.invalidateQueries({ queryKey: queryKeys.entityScope }),
          queryClient.invalidateQueries({ queryKey: queryKeys.tenant }),
          queryClient.invalidateQueries({ queryKey: queryKeys.onboardingStatus }),
          queryClient.invalidateQueries({ queryKey: queryKeys.subscriptionCurrent }),
          queryClient.invalidateQueries({ queryKey: queryKeys.creditStatus }),
          queryClient.invalidateQueries({ queryKey: queryKeys.notifications }),

          // 2. Refetch the critical path so the dashboard renders with real values
          //    (isTenantAdmin, permissions, tenantId) on first paint.
          queryClient.refetchQueries({ queryKey: queryKeys.authStatus }),
        ]);
        const baseUrl = response.data?.data?.redirectUrl || '/dashboard/applications';
        const url = baseUrl.startsWith('/dashboard') && !baseUrl.includes('onboarding=complete')
          ? (baseUrl.includes('?') ? `${baseUrl}&onboarding=complete` : `${baseUrl}?onboarding=complete`)
          : baseUrl;
        setRedirectUrl(url);
        setCompanyName(companyName); // Use the extracted companyName from above
        sonnerToast.success('🎉 Organization Created Successfully!', {
          description: 'Setting up your workspace...',
          duration: 4000,
        });
        setIsSubmitted(true);
      } else {
        const msg = response.data.message || 'Onboarding failed';
        onboardingLogger.error('Onboarding API returned success=false', { message: msg, responseData: response.data });
        throw new Error(msg);
      }

    } catch (error: any) {
      const apiMessage = error?.response?.data?.message;
      const validationMsg = Array.isArray(error?.response?.data?.errors)
        ? error.response.data.errors.map((e: { message?: string }) => e.message).filter(Boolean).join('. ')
        : null;
      const displayMessage = apiMessage || validationMsg || error?.message || 'There was an error submitting your form. Please try again.';
      onboardingLogger.error('Submission error', { message: error?.message, response: error?.response?.data, status: error?.response?.status });
      console.error('🔴 Submission error:', error);
      sonnerToast.dismiss(loadingToastId);
      setIsSubmitting(false);

      sonnerToast.error('Onboarding failed', {
        description: displayMessage,
        duration: 8000
      });
    }
  }, [selectedFlow, clearFormData, form, setIsSubmitting, isRateLimited, recordAttempt, getTimeUntilReset, setCurrentStep]);

  const handleError = useCallback((error: Error, errorInfo: any) => {
    onboardingLogger.error('Onboarding ErrorBoundary', { message: error.message, stack: error.stack, componentStack: errorInfo?.componentStack });
    console.error('Onboarding Error:', error, errorInfo);
    sonnerToast.error('An unexpected error occurred. Please refresh the page and try again.', {
      duration: 10000
    });
  }, []);

  const handleStepChange = useCallback((step: number) => {
    onboardingLogger.info('Step changed', { from: currentStep, to: step });
    setCurrentStep(step);
  }, [currentStep]);

  if (isSubmitted) {
    return <OnboardingWelcomeSuccess redirectUrl={redirectUrl} companyName={companyName} />;
  }

  if (!flowConfig) {
    return (
      <ErrorBoundary onError={handleError}>
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center">
            <h2 className="text-2xl font-bold text-red-600 mb-2">Configuration Error</h2>
            <p className="text-gray-600 mb-4">Flow configuration not found</p>
            <button
              onClick={() => {
                setCurrentStep(1);
                form.reset();
                window.location.reload();
              }}
              className="px-4 py-2 bg-[#1B2E5A] text-white rounded-lg hover:bg-[#152449]"
            >
              Reload Page
            </button>
          </div>
        </div>
      </ErrorBoundary>
    );
  }

  if (!flowConfig.steps || flowConfig.steps.length === 0) {
    return (
      <ErrorBoundary onError={handleError}>
        <div className="h-screen w-full overflow-hidden flex items-center justify-center bg-gray-50">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <h2 className="text-xl font-semibold text-[#1B2E5A] mb-2">Loading Form</h2>
            <p className="text-gray-600">Preparing your onboarding experience...</p>
          </div>
        </div>
      </ErrorBoundary>
    );
  }

  return (
    <ErrorBoundary onError={handleError}>
      <div className="h-screen w-full overflow-hidden">
        <MultiStepForm
          form={form}
          stepsConfig={flowConfig.steps || []}
          onSubmit={handleSubmit}
          currentStep={currentStep}
          onStepChange={handleStepChange}
          userClassification={userClassification}
          isSubmitting={isSubmitting}
        />
      </div>
    </ErrorBoundary>
  );
};