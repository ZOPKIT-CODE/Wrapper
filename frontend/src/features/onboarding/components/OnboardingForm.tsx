import React, { useState, useCallback, useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useOnboardingForm } from '../hooks';
import { useFormPersistence } from '../hooks/useFormPersistence';
import { queryKeys } from '@/hooks/useSharedQueries';
import { UserClassification } from './FlowSelector';
import { MultiStepForm } from './MultiStepForm';
import { ErrorBoundary } from './ErrorBoundary';
import { OnboardingWelcomeSuccess } from './OnboardingWelcomeSuccess';
import { useToast } from './Toast';
import { toast as sonnerToast } from 'sonner'; // Direct import for reliability
import { useRateLimit } from '../hooks/useRateLimit';
import { sanitizeFormData } from '../utils/sanitization';
import { existingBusinessData, newBusinessData } from '../schemas';
import { getFlowConfig } from '../config/flowConfigs';
import { getStepNumberForField, getDisplayNameForField } from '../utils/validationHelpers';

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

export const OnboardingForm = () => {
  const queryClient = useQueryClient();
  const [selectedFlow] = useState<'newBusiness' | 'existingBusiness'>('newBusiness');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [redirectUrl, setRedirectUrl] = useState('/dashboard');
  const [companyName, setCompanyName] = useState<string | undefined>();

  const [userClassification] = useState<UserClassification | undefined>(() => {
    const classification = determineUserClassification(
      undefined, 
      undefined, 
      new URLSearchParams(window.location.search) 
    );
    return classification || 'aspiringFounder';
  });

  const form = useOnboardingForm(selectedFlow, userClassification);
  const { addToast } = useToast();
  const { isRateLimited, recordAttempt, getTimeUntilReset } = useRateLimit({
    maxAttempts: 3,
    windowMs: 60000 
  });
  
  const flowConfig = getFlowConfig(selectedFlow);

  const { clearFormData, restoreFormData, hasPersistedData } = useFormPersistence({
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
    if (hasRestoredRef.current) return; // Only restore once
    hasRestoredRef.current = true;
    
    let isMounted = true;
    
    restoreFormData().then((restoredStep) => {
      if (!isMounted) return;
      
      if (restoredStep && restoredStep > 1 && restoredStep !== currentStep) {
        setCurrentStep(restoredStep);
        // Show notification that progress was restored
        sonnerToast.info('Your previous progress has been restored', {
          description: `Continuing from step ${restoredStep}`,
          duration: 3000,
        });
      }
    });

    return () => {
      isMounted = false;
    };
  }, []); // Only run on mount

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
    if (isRateLimited) {
      const remainingTime = Math.ceil(getTimeUntilReset() / 1000);
      sonnerToast.error(`Too Many Attempts: Please wait ${remainingTime} seconds before trying again.`, {
        duration: 5000
      });
      return;
    }

    setIsSubmitting(true);
    recordAttempt();
    
    // Show loading toast with animation
    const loadingToastId = sonnerToast.loading('Setting up your organization...', {
      duration: Infinity,
    });
    
    try {
      const sanitizedData = sanitizeFormData(data);
      const businessDetails = sanitizedData.businessDetails || {};
      const billingAddressStr = typeof sanitizedData.billingAddress === 'string' 
        ? sanitizedData.billingAddress 
        : '';
      
      const submissionData = {
        companyName: businessDetails.companyName || sanitizedData.companyName || sanitizedData.businessName,
        businessType: businessDetails.businessType || sanitizedData.businessType,
        companySize: businessDetails.organizationSize || sanitizedData.organizationSize,
        organizationSize: businessDetails.organizationSize || sanitizedData.organizationSize,
        country: businessDetails.country || sanitizedData.country,
        companyType: sanitizedData.companyType,
        state: sanitizedData.state,
        
        taxRegistered: sanitizedData.taxRegistered || false,
        vatGstRegistered: sanitizedData.vatGstRegistered || false,
        hasGstin: !!sanitizedData.gstin || sanitizedData.vatGstRegistered,
        gstin: sanitizedData.gstin || null,
        panNumber: sanitizedData.panNumber || null,
        einNumber: sanitizedData.einNumber || null,
        vatNumber: sanitizedData.vatNumber || null,
        cinNumber: sanitizedData.cinNumber || null,
        
        billingStreet: sanitizedData.billingStreet || billingAddressStr.split('\n')[0] || null,
        billingCity: sanitizedData.billingCity || null,
        billingState: sanitizedData.billingState || sanitizedData.state || null,
        billingZip: sanitizedData.billingZip || null,
        billingCountry: sanitizedData.billingCountry || businessDetails.country || sanitizedData.country || null,
        incorporationState: sanitizedData.state || sanitizedData.incorporationState || null,
        
        mailingAddressSameAsRegistered: sanitizedData.mailingAddressSameAsRegistered !== undefined 
          ? sanitizedData.mailingAddressSameAsRegistered 
          : true,
        mailingStreet: sanitizedData.mailingAddress || sanitizedData.mailingStreet || null,
        mailingCity: sanitizedData.mailingCity || null,
        mailingState: sanitizedData.mailingState || null,
        mailingZip: sanitizedData.mailingZip || null,
        mailingCountry: sanitizedData.mailingCountry || null,
        
        adminEmail: sanitizedData.adminEmail,
        billingEmail: sanitizedData.billingEmail || null,
        supportEmail: sanitizedData.supportEmail || null,
        contactJobTitle: sanitizedData.contactJobTitle || null,
        preferredContactMethod: sanitizedData.preferredContactMethod || sanitizedData.contactPreferredContactMethod || null,
        phone: sanitizedData.adminMobile || sanitizedData.adminPhone || sanitizedData.phone || null,
        contactDirectPhone: sanitizedData.contactDirectPhone || null,
        contactMobilePhone: sanitizedData.contactMobilePhone || null,
        
        contactSalutation: sanitizedData.contactSalutation || null,
        contactMiddleName: sanitizedData.contactMiddleName || null,
        contactDepartment: sanitizedData.contactDepartment || null,
        contactAuthorityLevel: sanitizedData.contactAuthorityLevel || null,
        
        firstName: sanitizedData.firstName || sanitizedData.personalDetails?.firstName,
        lastName: sanitizedData.lastName || sanitizedData.personalDetails?.lastName,
        email: sanitizedData.email || sanitizedData.personalDetails?.email || sanitizedData.adminEmail,
        
        defaultLanguage: sanitizedData.defaultLanguage || 'en',
        defaultLocale: sanitizedData.defaultLocale || 'en-US',
        defaultCurrency: sanitizedData.defaultCurrency || 'USD',
        defaultTimeZone: sanitizedData.defaultTimeZone || 'America/New_York',
        
        termsAccepted: sanitizedData.termsAccepted || false,
        
        website: sanitizedData.website || null,
        
        taxRegistrationDetails: {
          ...(sanitizedData.panNumber && { pan: sanitizedData.panNumber }),
          ...(sanitizedData.einNumber && { ein: sanitizedData.einNumber }),
          ...(sanitizedData.gstin && { gstin: sanitizedData.gstin }),
          ...(sanitizedData.vatNumber && { vat: sanitizedData.vatNumber }),
          ...(sanitizedData.cinNumber && { cin: sanitizedData.cinNumber }),
          country: businessDetails.country || sanitizedData.country || 'IN',
        },
      };

      // Helper function to filter out empty/null/undefined values
      const filterEmpty = (value: any): any => {
        if (value === null || value === undefined || value === '') {
          return undefined; // Don't include in request
        }
        return value;
      };
      
      // Call the /onboard-frontend endpoint with ALL fields
      const { default: api } = await import('@/lib/api');
      const response = await api.post('/onboarding/onboard-frontend', {
        // Company Information
        legalCompanyName: submissionData.companyName,
        companyType: submissionData.companyType,
        companySize: submissionData.companySize || submissionData.organizationSize,
        businessType: submissionData.businessType,
        website: filterEmpty(submissionData.website),
        
        // Admin/Contact Information
        firstName: submissionData.firstName,
        lastName: submissionData.lastName,
        email: submissionData.email || submissionData.adminEmail,
        adminEmail: submissionData.adminEmail,
        adminMobile: filterEmpty(submissionData.phone),
        supportEmail: filterEmpty(submissionData.supportEmail),
        billingEmail: filterEmpty(submissionData.billingEmail),
        
        // Contact Details
        contactSalutation: filterEmpty(submissionData.contactSalutation),
        contactMiddleName: filterEmpty(submissionData.contactMiddleName),
        contactJobTitle: filterEmpty(submissionData.contactJobTitle),
        contactDepartment: filterEmpty(submissionData.contactDepartment),
        contactAuthorityLevel: filterEmpty(submissionData.contactAuthorityLevel),
        preferredContactMethod: filterEmpty(submissionData.preferredContactMethod),
        contactDirectPhone: filterEmpty(submissionData.contactDirectPhone),
        contactMobilePhone: filterEmpty(submissionData.contactMobilePhone),
        
        // Tax & Compliance - Only include if they have values
        taxRegistered: submissionData.taxRegistered,
        vatGstRegistered: submissionData.vatGstRegistered,
        hasGstin: submissionData.hasGstin || false,
        gstin: filterEmpty(submissionData.gstin),
        panNumber: filterEmpty(submissionData.panNumber), // Only send if not empty
        einNumber: filterEmpty(submissionData.einNumber),
        vatNumber: filterEmpty(submissionData.vatNumber),
        cinNumber: filterEmpty(submissionData.cinNumber),
        taxRegistrationDetails: submissionData.taxRegistrationDetails,
        
        // Address Information
        country: submissionData.country || 'IN',
        state: submissionData.state,
        incorporationState: submissionData.incorporationState,
        billingStreet: submissionData.billingStreet,
        billingCity: submissionData.billingCity,
        billingState: submissionData.billingState,
        billingZip: submissionData.billingZip,
        billingCountry: submissionData.billingCountry,
        mailingAddressSameAsRegistered: submissionData.mailingAddressSameAsRegistered,
        mailingStreet: submissionData.mailingStreet,
        mailingCity: submissionData.mailingCity,
        mailingState: submissionData.mailingState,
        mailingZip: submissionData.mailingZip,
        mailingCountry: submissionData.mailingCountry,
        
        // Localization
        timezone: submissionData.defaultTimeZone,
        currency: submissionData.defaultCurrency,
        defaultLanguage: submissionData.defaultLanguage,
        defaultLocale: submissionData.defaultLocale,
        
        // Terms
        termsAccepted: submissionData.termsAccepted
      });

      if (response.data.success) {
        sonnerToast.dismiss(loadingToastId);
        clearFormData();
        // Invalidate auth-status so dashboard gets fresh isTenantAdmin and permissions
        queryClient.invalidateQueries({ queryKey: queryKeys.authStatus });
        const baseUrl = response.data?.data?.redirectUrl || '/dashboard';
        const url = baseUrl.startsWith('/dashboard') && !baseUrl.includes('onboarding=complete')
          ? (baseUrl.includes('?') ? `${baseUrl}&onboarding=complete` : `${baseUrl}?onboarding=complete`)
          : baseUrl;
        const extractedCompanyName = submissionData.companyName || businessDetails.companyName || sanitizedData.companyName || sanitizedData.businessName;
        setRedirectUrl(url);
        setCompanyName(extractedCompanyName);
        sonnerToast.success('🎉 Organization Created Successfully!', {
          description: 'Setting up your workspace...',
          duration: 3000,
        });
        setIsSubmitted(true);
      } else {
        throw new Error(response.data.message || 'Onboarding failed');
      }

    } catch (error: any) {
      console.error('🔴 Submission error:', error);
      console.error('🔴 Error response:', error?.response);
      console.error('🔴 Error data:', error?.response?.data);
      
      // Dismiss loading toast
      sonnerToast.dismiss(loadingToastId);
      
      // IMPORTANT: Hide loading spinner FIRST so user can see the form and error
      setIsSubmitting(false);
      
      // Handle API error responses
      let errorMessage = 'There was an error submitting your form. Please try again.';
      let errorFields: { fieldPath: string; displayName: string; stepNumber: number; backendField: string; errorMessage: string }[] = [];
      
      // Helper function to get user-friendly field name
      const getFieldDisplayName = (fieldPath: string): string => {
        const fieldName = fieldPath.replace(/^\//, ''); // Remove leading slash
        const fieldMapping: Record<string, string> = {
          'email': 'Email',
          'adminEmail': 'Admin Email',
          'legalCompanyName': 'Company Name',
          'companyName': 'Company Name',
          'firstName': 'First Name',
          'lastName': 'Last Name',
          'companySize': 'Company Size',
          'businessType': 'Business Type',
          'gstin': 'GSTIN',
          'hasGstin': 'GSTIN Status',
          'country': 'Country',
          'timezone': 'Timezone',
          'currency': 'Currency',
          'termsAccepted': 'Terms & Conditions'
        };
        return fieldMapping[fieldName] || fieldName.charAt(0).toUpperCase() + fieldName.slice(1);
      };

      // Helper function to map backend field to frontend field path
      const mapFieldToFrontendPath = (fieldPath: string): string => {
        const fieldName = fieldPath.replace(/^\//, ''); // Remove leading slash
        const fieldMapping: Record<string, string> = {
          'legalCompanyName': 'businessDetails.companyName',
          'companyName': 'businessDetails.companyName',
          'firstName': 'firstName',
          'lastName': 'lastName',
          'email': 'email',
          'adminEmail': 'adminEmail',
          'companySize': 'businessDetails.organizationSize',
          'businessType': 'businessDetails.businessType',
          'gstin': 'gstin',
          'hasGstin': 'hasGstin',
          'country': 'businessDetails.country',
          'timezone': 'timezone',
          'currency': 'currency',
          'termsAccepted': 'termsAccepted'
        };
        return fieldMapping[fieldName] || fieldName;
      };

      // Helper function to navigate to field and highlight it
      const navigateToFieldAndHighlight = (fieldPath: string, stepNumber: number, fieldErrorMessage: string) => {
        
        // Navigate to the step first
        setCurrentStep(stepNumber);
        
        // Wait for step to render, then find and highlight the field
        setTimeout(() => {
          const fieldName = fieldPath.split('.').pop() || fieldPath;
          const baseFieldName = fieldName.replace('businessDetails.', '');
          
          // Try multiple selectors to find the field (react-hook-form fields)
          const selectors = [
            // Direct name match
            `input[name="${fieldPath}"]`,
            `input[name="${baseFieldName}"]`,
            `input[name="${fieldName}"]`,
            // ID-based selectors
            `input[id="${fieldPath}"]`,
            `input[id="${baseFieldName}"]`,
            `input[id="${fieldName}"]`,
            // Partial matches
            `input[name*="${fieldName}"]`,
            `input[id*="${fieldName}"]`,
            // Try textarea and select as well
            `textarea[name="${fieldPath}"]`,
            `textarea[name="${baseFieldName}"]`,
            `select[name="${fieldPath}"]`,
            `select[name="${baseFieldName}"]`,
            // Try with form field wrapper (shadcn/ui pattern)
            `[data-field-name="${fieldPath}"] input`,
            `[data-field-name="${baseFieldName}"] input`,
          ];
          
          let fieldElement: HTMLElement | null = null;
          for (const selector of selectors) {
            fieldElement = document.querySelector(selector) as HTMLElement;
            if (fieldElement) {
              break;
            }
          }
          
          // If still not found, try finding by label text and then the associated input
          if (!fieldElement) {
            const labels = Array.from(document.querySelectorAll('label'));
            const matchingLabel = labels.find(
              (l) => l.textContent?.toLowerCase().includes(fieldName.toLowerCase())
            );
            if (matchingLabel) {
              const inputId = matchingLabel.getAttribute('for');
              if (inputId) {
                fieldElement = document.querySelector(`#${inputId}`) as HTMLElement;
              }
              if (!fieldElement) {
                const formItem = matchingLabel.closest('[class*="form-item"], [class*="FormItem"]');
                if (formItem) {
                  fieldElement = formItem.querySelector('input, textarea, select') as HTMLElement;
                }
              }
            }
          }
          
          // If still not found, try finding by closest form item
          if (!fieldElement) {
            const formItems = document.querySelectorAll('[class*="form-item"], [class*="FormItem"]');
            for (const item of Array.from(formItems)) {
              const input = item.querySelector(`input[name*="${fieldName}"], textarea[name*="${fieldName}"], select[name*="${fieldName}"]`);
              if (input) {
                fieldElement = input as HTMLElement;
                break;
              }
            }
          }
          
          if (fieldElement) {
            
            // Scroll to field with smooth animation
            fieldElement.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });
            
            // Small delay before focusing to ensure scroll completes
            setTimeout(() => {
              // Focus the field
              if (fieldElement instanceof HTMLInputElement || fieldElement instanceof HTMLTextAreaElement || fieldElement instanceof HTMLSelectElement) {
                fieldElement.focus();
                fieldElement.select?.();
              }
              
              // Add visual highlighting with animation
              fieldElement.classList.add(
                'ring-2',
                'ring-red-500',
                'ring-offset-2',
                'border-red-500',
                'border-2'
              );
              
              // Add shake animation
              fieldElement.style.animation = 'shake 0.5s ease-in-out';
              
              // Set form error state
              form.setError(fieldPath as any, {
                type: 'manual',
                message: fieldErrorMessage
              });
              
              // Remove highlight after 5 seconds but keep error state
              setTimeout(() => {
                fieldElement?.classList.remove(
                  'ring-2',
                  'ring-red-500',
                  'ring-offset-2',
                  'border-red-500',
                  'border-2'
                );
                fieldElement?.style.removeProperty('animation');
              }, 5000);
            }, 300);
          } else {
            console.warn('🔴 Could not find field:', fieldPath, '- Available fields:', 
              Array.from(document.querySelectorAll('input, textarea, select')).map(el => ({
                name: (el as HTMLInputElement).name,
                id: el.id,
                type: el.tagName
              }))
            );
          }
        }, 600); // Wait for step transition (increased for better reliability)
      };
      
      // Check if we have an error response from the API
      const errorData = error?.response?.data || error?.data;
      
      if (errorData) {
        
        // Check for details array FIRST (Fastify validation format from global error handler)
        if (errorData.details && Array.isArray(errorData.details) && errorData.details.length > 0) {
          const details = errorData.details;
          
          // Map backend field names to frontend field paths for navigation
          errorFields = details.map((d: any) => {
            const fieldPath = d.field || '';
            const cleanFieldPath = fieldPath.replace(/^\//, ''); // Remove leading slash
            const frontendPath = mapFieldToFrontendPath(cleanFieldPath);
            const stepNumber = getStepNumberForField(cleanFieldPath);
            const displayName = getDisplayNameForField(cleanFieldPath);
            const fieldMessage = d.message || 'Invalid value';
            
            return {
              fieldPath: frontendPath,
              displayName: displayName,
              stepNumber: stepNumber,
              backendField: cleanFieldPath,
              errorMessage: fieldMessage
            };
          });
          
          // Format error message for toast
          if (errorFields.length === 1) {
            // Single error - show field name and message
            const field = errorFields[0];
            errorMessage = `${field.displayName}: ${field.errorMessage}`;
          } else {
            // Multiple errors - show count and first few field names
            const fieldNames = errorFields.slice(0, 3).map(f => f.displayName).join(', ');
            const remaining = errorFields.length - 3;
            errorMessage = remaining > 0
              ? `Please fix ${errorFields.length} fields: ${fieldNames} and ${remaining} more`
              : `Please fix the following fields: ${fieldNames}`;
          }
        }
        // Check for validation errors array from backend (custom route handler format)
        else if (errorData.errors && Array.isArray(errorData.errors)) {
          // Backend sends errors in format: [{ field, message, code }]
          const validationErrors = errorData.errors;
          
          if (validationErrors.length === 1) {
            // Single error - show the exact message
            errorMessage = validationErrors[0].message || errorMessage;
          } else {
            // Multiple errors - combine messages
            errorMessage = validationErrors.map((e: any) => e.message).join(', ');
          }
          
          // Map backend field names to frontend field paths for navigation
          errorFields = validationErrors.map((e: any) => {
            const fieldPath = e.field || '';
            const cleanFieldPath = fieldPath.replace(/^\//, ''); // Remove leading slash
            const frontendPath = mapFieldToFrontendPath(cleanFieldPath);
            const stepNumber = getStepNumberForField(cleanFieldPath);
            return {
              fieldPath: frontendPath,
              displayName: getDisplayNameForField(cleanFieldPath),
              stepNumber: stepNumber,
              backendField: cleanFieldPath,
              errorMessage: e.message
            };
          });
        }
        // Check for error message (fallback)
        else if (errorData.message) {
          errorMessage = errorData.message;
        }
        // Check for error field (legacy format)
        else if (errorData.error) {
          errorMessage = typeof errorData.error === 'string' 
            ? errorData.error 
            : errorData.error.message || errorMessage;
        }
      } 
      // Handle network errors
      else if (error?.message) {
        errorMessage = error.message;
      }
      
      // Show toast with error message and navigate to field
      if (errorFields.length > 0) {
        const firstField = errorFields[0];
        const fieldErrorMessage = firstField.errorMessage || errorMessage;
        
        // Navigate to field and highlight it automatically
        navigateToFieldAndHighlight(
          firstField.fieldPath,
          firstField.stepNumber,
          fieldErrorMessage
        );
        
        // Show toast with error message - using direct sonner import for reliability
        try {
          // Use direct sonner toast for reliability
          sonnerToast.error(errorMessage, {
            duration: 8000,
            action: errorFields.length === 1 ? {
              label: 'Go to Field',
              onClick: () => {
                navigateToFieldAndHighlight(
                  firstField.fieldPath,
                  firstField.stepNumber,
                  fieldErrorMessage
                );
              },
            } : undefined,
          });
        } catch (toastError) {
          console.error('🔴 Toast error:', toastError);
          // Fallback: use alert
          alert(errorMessage);
        }
      } else {
        // No specific field errors, just show general error message
        try {
          sonnerToast.error(errorMessage, { duration: 6000 });
        } catch (toastError) {
          console.error('🔴 Toast error:', toastError);
          alert(errorMessage);
        }
      }
    }
  }, [selectedFlow, clearFormData, form, setIsSubmitting, isRateLimited, recordAttempt, getTimeUntilReset, setCurrentStep]);

  const handleError = useCallback((error: Error, errorInfo: any) => {
    console.error('Onboarding Error:', error, errorInfo);
    sonnerToast.error('An unexpected error occurred. Please refresh the page and try again.', {
      duration: 10000
    });
  }, []);

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
          onStepChange={setCurrentStep}
          userClassification={userClassification}
          isSubmitting={isSubmitting}
        />
      </div>
    </ErrorBoundary>
  );
};
