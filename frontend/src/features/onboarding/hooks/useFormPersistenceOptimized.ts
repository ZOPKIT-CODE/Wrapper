/**
 * OPTIMIZED Form Persistence Hook
 * Reduced auto-save frequency and improved performance with secure storage
 */

import { useEffect, useCallback, useRef } from 'react';
import { UseFormReturn } from 'react-hook-form';
import { onboardingAPIOptimized } from '@/lib/apiOptimized';
import { useKindeAuth } from '@kinde-oss/kinde-auth-react';
import { secureStore, secureRetrieve, secureClear } from '../utils/secureStorage';
import { onboardingLogger } from '../utils/onboardingLogger';
import { applyIndiaRegionalDefaultsIfMissing, resolveCountryCode } from '../config/countryConfig';

const STORAGE_KEY_PREFIX = 'onboarding_progress_';
const STORAGE_KEY_FORM_DATA = 'onboarding_form_data';

export interface UseFormPersistenceOptions {
  form: UseFormReturn<any>;
  flowType: string;
  currentStep: number;
  autoSave?: boolean;
  autoRestore?: boolean;
  clearOnSubmit?: boolean;
}

export const useFormPersistenceOptimized = ({
  form,
  flowType,
  currentStep,
  autoSave = true,
  autoRestore = true,
}: UseFormPersistenceOptions) => {
  const { user } = useKindeAuth();
  const hasRestoredRef = useRef(false);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const normalizeRestoredData = useCallback((rawData: any) => {
    if (!rawData || typeof rawData !== 'object') return rawData;

    const normalized = { ...rawData } as Record<string, any>;
    const existingBusinessDetails =
      normalized.businessDetails && typeof normalized.businessDetails === 'object'
        ? normalized.businessDetails
        : {};

    // Support legacy flat payload keys so select fields hydrate correctly.
    const mergedCountry = resolveCountryCode(
      existingBusinessDetails.country ?? normalized.country ?? normalized.businessDetails?.country
    );
    normalized.businessDetails = {
      ...existingBusinessDetails,
      companyName: existingBusinessDetails.companyName ?? normalized.companyName ?? normalized.businessName,
      businessType: existingBusinessDetails.businessType ?? normalized.businessType ?? normalized.industry,
      organizationSize:
        existingBusinessDetails.organizationSize ?? normalized.organizationSize ?? normalized.companySize,
      country: mergedCountry,
    };

    normalized.country = mergedCountry;
    normalized.defaultCurrency = normalized.defaultCurrency ?? normalized.currency;
    normalized.defaultTimeZone = normalized.defaultTimeZone ?? normalized.timezone;
    normalized.defaultLanguage = normalized.defaultLanguage ?? normalized.language;
    normalized.defaultLocale = normalized.defaultLocale ?? normalized.locale;
    applyIndiaRegionalDefaultsIfMissing(normalized);
    normalized.billingAddress = normalized.billingAddress ?? normalized.billingStreet;
    normalized.billingStreet = normalized.billingStreet ?? normalized.billingAddress;
    normalized.state = normalized.state ?? normalized.billingState ?? normalized.incorporationState;
    normalized.billingState = normalized.billingState ?? normalized.state;

    return normalized;
  }, []);

  // OPTIMIZED: Save form data with reduced frequency and secure storage
  const saveFormData = useCallback(async () => {
    try {
      // Get ALL form values including empty strings and nested objects
      const rawFormData = form.getValues();

      // Deep clone to preserve all data including empty strings and null values
      const deepClone = (obj: any): any => {
        if (obj === null || typeof obj !== 'object') return obj;
        if (obj instanceof Date) return new Date(obj);
        if (Array.isArray(obj)) return obj.map(deepClone);
        
        const cloned: any = {};
        for (const key in obj) {
          if (Object.prototype.hasOwnProperty.call(obj, key)) {
            cloned[key] = deepClone(obj[key]);
          }
        }
        return cloned;
      };

      // Clone form data to preserve all values including empty strings and null
      const clonedFormData = deepClone(rawFormData);

      // IMPORTANT: Save raw form data directly to preserve ALL fields including empty strings
      // Sanitization will be done on submission, not during persistence
      // This ensures all fields are restored correctly
      const dataToStore = clonedFormData;

      // Save to backend only (DB-only persistence)
      // This works even when user doesn't exist in database yet
      if (user?.email) {
        try {
          const response = await onboardingAPIOptimized.updateStep(
            `step_${currentStep}`,
            { 
              step: currentStep, 
              completedAt: new Date().toISOString(),
              flowType: flowType
            },
            user.email,
            dataToStore, // Send complete form data to backend for persistence
            user.id
          );
          
          if (response?.data?.success) {
            onboardingLogger.debug('Form data saved to backend', { step: currentStep });
          }
        } catch (error: any) {
          onboardingLogger.warn('Backend form data save failed', { message: error?.message, step: currentStep });
          // Show non-blocking error but don't fall back to localStorage
        }
      }
    } catch (error) {
      // Silent error handling to avoid performance impact
    }
  }, [form, flowType, currentStep, user]);

  // Restore form data from backend only (DB-only persistence)
  const restoreFormData = useCallback(async () => {
    if (hasRestoredRef.current) return 1;
    hasRestoredRef.current = true;

    try {
      let restoredData: any = null;
      let restoredStep = 1;

      // Restore from backend only (if authenticated)
      if (user?.email) {
        try {
          const backendResponse = await onboardingAPIOptimized.getDataByEmail(user.email, user.id);
          
          // Handle both response shapes: savedFormData (preferred) or onboardingData (legacy)
          if (backendResponse?.data?.success && backendResponse?.data?.data?.savedFormData) {
            const backendFormData = backendResponse.data.data.savedFormData;
            const backendStep = backendResponse.data.data.onboardingStep;
            
            restoredData = backendFormData;
            if (backendStep) {
              const stepNumber = parseInt(String(backendStep).replace('step_', '')) || 1;
              restoredStep = stepNumber;
            }
            onboardingLogger.info('Restored form data from backend', { restoredStep });
          } else if (backendResponse?.data?.data?.onboardingData) {
            const onboardingData = backendResponse.data.data.onboardingData;
            restoredStep = onboardingData.currentStep 
              ? parseInt(String(onboardingData.currentStep).replace('step_', '')) || 1
              : 1;
            
            if (onboardingData.formData) {
              restoredData = onboardingData.formData;
            } else if (onboardingData.stepData) {
              // Merge step data if formData is not available
              restoredData = {};
              Object.values(onboardingData.stepData).forEach((stepData: any) => {
                Object.assign(restoredData, stepData);
              });
            }
            onboardingLogger.info('Restored form data from backend (legacy format)', { restoredStep });
          }
        } catch (error) {
          onboardingLogger.warn('Failed to restore from backend', { error: String(error) });
          // Start from step 1 with empty form if API fails
          return 1;
        }
      } else {
        // User not authenticated - start from step 1
        return 1;
      }

      // Restore form data if found
      if (restoredData) {
        restoredData = normalizeRestoredData(restoredData);
        form.reset();

        // OPTIMIZED: Batch all setValue calls - handle nested objects properly
        // Restore ALL fields including empty strings and null values
        const setFormValue = (key: string, val: any, parentKey?: string) => {
          const fullKey = parentKey ? `${parentKey}.${key}` : key;
          
          try {
            // Handle nested objects (e.g., businessDetails)
            if (val !== null && typeof val === 'object' && !Array.isArray(val) && val.constructor === Object) {
              // For nested objects, recursively set each property
              Object.keys(val).forEach((nestedKey) => {
                setFormValue(nestedKey, val[nestedKey], fullKey);
              });
            } else {
              // For primitive values, arrays, null, undefined, and empty strings
              // Restore ALL values including empty strings and null
              form.setValue(fullKey as any, val === undefined ? '' : val, { 
                shouldValidate: false, 
                shouldDirty: false, 
                shouldTouch: false 
              });
            }
          } catch (error) {
            // Log but continue - some fields might not exist in schema
            console.debug(`Skipping field ${fullKey} during restore:`, error);
          }
        };

        // Restore all fields - use setTimeout to ensure form is ready
        setTimeout(() => {
          Object.keys(restoredData).forEach((key) => {
            setFormValue(key, restoredData[key]);
          });
        }, 0);

        return restoredStep;
      }
    } catch (error) {
      // Silent error handling
    }

    return 1;
  }, [form, flowType, normalizeRestoredData]);

  // Clear saved form data (backend + cleanup localStorage keys)
  const clearFormData = useCallback(() => {
    try {
      // Clear backend data if authenticated
      if (user?.email) {
        onboardingAPIOptimized.updateStep('step_1', {}, user.email, {}, user.id).catch(() => {});
      }
      
      // Clean up any remaining localStorage keys (for cleanup, not as source of truth)
      const storageKey = `${STORAGE_KEY_PREFIX}${flowType}`;
      secureClear(storageKey);
      secureClear(STORAGE_KEY_FORM_DATA);
      localStorage.removeItem(`${storageKey}_backend_save`);
    } catch (error) {
      // Silent error handling
    }
  }, [flowType, user]);

  // OPTIMIZED: Auto-save with longer debounce (2 seconds instead of 1)
  useEffect(() => {
    if (!autoSave) return;

    const subscription = form.watch((_value, { name, type }) => {
      if (type === 'change' && name) {
        if (saveTimeoutRef.current) {
          clearTimeout(saveTimeoutRef.current);
        }

        saveTimeoutRef.current = setTimeout(() => {
          saveFormData();
        }, 2000); // Increased from 1000ms to 2000ms
      }
    });

    return () => {
      subscription.unsubscribe();
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
        saveTimeoutRef.current = null;
        // Flush pending edits when step changes/unmount happens before debounce fires.
        void saveFormData();
      }
    };
  }, [currentStep, autoSave, saveFormData, form]);

  // Auto-restore on mount
  useEffect(() => {
    if (autoRestore && !hasRestoredRef.current) {
      restoreFormData().then((restoredStep) => {
        if (restoredStep !== currentStep && restoredStep > 1) {
          window.dispatchEvent(new CustomEvent('onboarding-step-restored', {
            detail: { step: restoredStep }
          }));
        }
      });
    }
  }, []); // Only run on mount

  return {
    saveFormData,
    restoreFormData,
    clearFormData,
    // Note: hasPersistedData check removed - would require async backend call
    // Form data is now DB-only, so check backend directly if needed
    hasPersistedData: false, // Always false since we don't check localStorage anymore
  };
};