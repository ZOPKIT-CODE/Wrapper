/**
 * Form Persistence Hook
 * Saves and restores onboarding form progress
 */

import { useEffect, useCallback, useRef } from 'react';
import { UseFormReturn } from 'react-hook-form';
import { onboardingAPI } from '@/lib/api';
import { useKindeAuth } from '@kinde-oss/kinde-auth-react';
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

export const useFormPersistence = ({
  form,
  flowType,
  currentStep,
  autoSave = true,
  autoRestore = true,
  clearOnSubmit = true,
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

  // Save form data to backend only (DB-only persistence)
  const saveFormData = useCallback(async () => {
    try {
      const formData = form.getValues();
      
      // Save to backend if user is authenticated
      if (user?.email) {
        try {
          await onboardingAPI.updateStep(
            `step_${currentStep}`,
            { step: currentStep, formData, flowType },
            user.email,
            formData,
            user.id
          );
        } catch (error) {
          console.warn('Failed to save progress to backend:', error);
          // Show non-blocking error but don't fall back to localStorage
        }
      }
    } catch (error) {
      console.error('Error saving form data:', error);
    }
  }, [form, flowType, currentStep, user]);

  // Restore form data from backend only (DB-only persistence)
  const restoreFormData = useCallback(async () => {
    if (hasRestoredRef.current) return 1; // Only restore once, return default step
    hasRestoredRef.current = true;

    try {
      let restoredData: any = null;
      let restoredStep = 1;

      // Restore from backend only (if authenticated)
      if (user?.email) {
        try {
          const response = await onboardingAPI.getDataByEmail(user.email);
          // Handle both response shapes: onboardingData (legacy) or savedFormData (new)
          if (response?.data?.savedFormData) {
            restoredData = response.data.savedFormData;
            restoredStep = response.data.onboardingStep 
              ? parseInt(String(response.data.onboardingStep).replace('step_', '')) || 1
              : 1;
          } else if (response?.data?.onboardingData) {
            const onboardingData = response.data.onboardingData;
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
          }
        } catch (error) {
          console.warn('Failed to restore from backend:', error);
          // Start from step 1 with empty form if API fails
          return 1;
        }
      } else {
        // User not authenticated - start from step 1
        return 1;
      }

      // Restore form data if found (only when form is still pristine to avoid overwriting user input)
      if (restoredData) {
        restoredData = normalizeRestoredData(restoredData);
        // Skip applying restored data if user has already modified the form (prevents state issues when typing/backspace)
        if (form.formState.isDirty) {
          return 1;
        }

        // Reset form first to clear any default values
        form.reset();

        // Batch all setValue calls to prevent multiple re-renders
        const updates: Array<{ key: string; value: any }> = [];

        Object.keys(restoredData).forEach((key) => {
          const value = restoredData[key];
          if (value !== null && value !== undefined && value !== '') {
            updates.push({ key, value });
          }
        });

        // Apply all updates in a single batch using setTimeout to batch React updates
        await new Promise<void>((resolve) => {
          setTimeout(() => {
            updates.forEach(({ key, value }) => {
              try {
                form.setValue(key as any, value, { shouldValidate: false, shouldDirty: false, shouldTouch: false });
              } catch (error) {
                // Ignore errors for fields that don't exist in current schema
                console.debug(`Skipping field ${key} during restore:`, error);
              }
            });
            resolve();
          }, 0);
        });

        // Return restored step for parent component to use
        return restoredStep;
      }
    } catch (error) {
      console.error('Error restoring form data:', error);
    }

    return 1; // Default to step 1 if no saved data
  }, [form, flowType, user, normalizeRestoredData]);

  // Clear saved form data (backend + cleanup localStorage keys)
  const clearFormData = useCallback(() => {
    try {
      // Clear backend data if authenticated
      if (user?.email) {
        onboardingAPI.updateStep('step_1', {}, user.email, {}, user.id).catch(console.error);
      }
      
      // Clean up any remaining localStorage keys (for cleanup, not as source of truth)
      const storageKey = `${STORAGE_KEY_PREFIX}${flowType}`;
      localStorage.removeItem(storageKey);
      localStorage.removeItem(STORAGE_KEY_FORM_DATA);
    } catch (error) {
      console.error('Error clearing form data:', error);
    }
  }, [flowType, user]);

  // Auto-save on step change or form data change
  // Use subscription pattern instead of form.watch() to prevent infinite re-renders
  useEffect(() => {
    if (!autoSave) return;

    // Subscribe to form changes with a subscription pattern
    const subscription = form.watch((value, { name, type }) => {
      // Only save when actual field values change, not on every render
      if (type === 'change' && name) {
        // Debounce saves to avoid excessive API calls
        if (saveTimeoutRef.current) {
          clearTimeout(saveTimeoutRef.current);
        }

        saveTimeoutRef.current = setTimeout(() => {
          saveFormData();
        }, 1000); // Save 1 second after last change
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

  // Auto-restore on mount - only run once
  useEffect(() => {
    if (autoRestore && !hasRestoredRef.current) {
      restoreFormData().then((restoredStep) => {
        // If step was restored and different from current, notify parent
        if (restoredStep !== currentStep && restoredStep > 1) {
          // Dispatch custom event for step restoration
          window.dispatchEvent(new CustomEvent('onboarding-step-restored', { 
            detail: { step: restoredStep } 
          }));
        }
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Only run on mount - remove currentStep dependency to prevent loops

  return {
    saveFormData,
    restoreFormData,
    clearFormData,
    // Note: hasPersistedData check removed - would require async backend call
    // Form data is now DB-only, so check backend directly if needed
    hasPersistedData: false, // Always false since we don't check localStorage anymore
  };
};
