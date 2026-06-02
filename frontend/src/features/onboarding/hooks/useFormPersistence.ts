/**
 * Form Persistence Hook
 * Saves and restores onboarding form progress with local draft fallback
 */

import { useEffect, useCallback, useRef } from 'react';
import { UseFormReturn } from 'react-hook-form';
import { onboardingAPIOptimized } from '@/lib/api/client';
import { useKindeAuth } from '@/lib/auth/cognito-auth';
import { secureStore, secureRetrieve, secureClear } from '../utils/secureStorage';
import { onboardingLogger } from '../utils/onboardingLogger';
import { applyIndiaRegionalDefaultsIfMissing, resolveCountryCode } from '../config/countryConfig';

const STORAGE_KEY_PREFIX = 'onboarding_progress_';
const STORAGE_KEY_FORM_DATA = 'onboarding_form_data';
const DRAFT_MAX_AGE_MS = 24 * 60 * 60 * 1000;

const getDraftKey = (userId: string) => `onboarding_draft_${userId}`;

interface LocalDraft {
  data: Record<string, unknown>;
  step: number;
  savedAt: number;
}

const saveDraftToLocalStorage = (userId: string, data: Record<string, unknown>, step: number): void => {
  try {
    const draft: LocalDraft = { data, step, savedAt: Date.now() };
    sessionStorage.setItem(getDraftKey(userId), JSON.stringify(draft));
  } catch {
    // Quota exceeded or private browsing — silently skip
  }
};

const loadDraftFromLocalStorage = (userId: string): LocalDraft | null => {
  try {
    const raw = sessionStorage.getItem(getDraftKey(userId));
    if (!raw) return null;
    const draft = JSON.parse(raw) as LocalDraft;
    if (Date.now() - draft.savedAt > DRAFT_MAX_AGE_MS) {
      sessionStorage.removeItem(getDraftKey(userId));
      return null;
    }
    return draft;
  } catch {
    return null;
  }
};

const clearDraftFromLocalStorage = (userId: string): void => {
  try {
    sessionStorage.removeItem(getDraftKey(userId));
  } catch {
    // ignore
  }
};

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

  // Save form data with reduced frequency and secure storage
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

      // Save raw form data directly to preserve ALL fields including empty strings.
      // Sanitization will be done on submission, not during persistence.
      const dataToStore = clonedFormData;

      // Always persist to localStorage first (synchronous, survives page reload)
      if (user?.id) {
        saveDraftToLocalStorage(user.id, dataToStore as Record<string, unknown>, currentStep);
      }

      // Also save to backend (async, best-effort)
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
            dataToStore,
            user.id
          );

          if (response?.data?.success) {
            onboardingLogger.debug('Form data saved to backend', { step: currentStep });
          }
        } catch (error: unknown) {
          onboardingLogger.warn('Backend form data save failed', { message: (error as Error)?.message, step: currentStep });
        }
      }
    } catch (error) {
      // Silent error handling to avoid performance impact
    }
  }, [form, flowType, currentStep, user]);

  // Restore form data — tries backend first, falls back to localStorage draft
  const restoreFormData = useCallback(async () => {
    if (hasRestoredRef.current) return 1;
    hasRestoredRef.current = true;

    try {
      let restoredData: Record<string, unknown> | null = null;
      let restoredStep = 1;

      if (user?.email) {
        try {
          const backendResponse = await onboardingAPIOptimized.getDataByEmail(user.email, user.id);

          if (backendResponse?.data?.success && backendResponse?.data?.data?.savedFormData) {
            restoredData = backendResponse.data.data.savedFormData;
            const backendStep = backendResponse.data.data.onboardingStep;
            if (backendStep) {
              restoredStep = parseInt(String(backendStep).replace('step_', '')) || 1;
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
              restoredData = {};
              Object.values(onboardingData.stepData).forEach((stepData: unknown) => {
                Object.assign(restoredData!, stepData as Record<string, unknown>);
              });
            }
            onboardingLogger.info('Restored form data from backend (legacy format)', { restoredStep });
          }
        } catch (error) {
          onboardingLogger.warn('Failed to restore from backend — falling back to localStorage draft', { error: String(error) });
        }
      }

      // Fallback to localStorage draft when backend has nothing or failed
      if (!restoredData && user?.id) {
        const draft = loadDraftFromLocalStorage(user.id);
        if (draft) {
          restoredData = draft.data;
          restoredStep = draft.step;
          onboardingLogger.info('Restored form data from localStorage draft', { restoredStep });
        }
      }

      if (!restoredData) {
        return 1;
      }

      restoredData = normalizeRestoredData(restoredData) as Record<string, unknown>;

      form.reset();

      const setFormValue = (key: string, val: unknown, parentKey?: string) => {
        const fullKey = parentKey ? `${parentKey}.${key}` : key;
        try {
          if (val !== null && typeof val === 'object' && !Array.isArray(val) && val.constructor === Object) {
            Object.keys(val as Record<string, unknown>).forEach((nestedKey) => {
              setFormValue(nestedKey, (val as Record<string, unknown>)[nestedKey], fullKey);
            });
          } else {
            form.setValue(fullKey as Parameters<typeof form.setValue>[0], val === undefined ? '' : val, {
              shouldValidate: false,
              shouldDirty: false,
              shouldTouch: false,
            });
          }
        } catch {
          // field not in schema — skip
        }
      };

      setTimeout(() => {
        Object.keys(restoredData!).forEach((key) => {
          setFormValue(key, restoredData![key]);
        });
      }, 0);

      return restoredStep;
    } catch (error) {
      // Silent error handling
    }

    return 1;
  }, [form, flowType, normalizeRestoredData]);

  // Clear saved form data (backend + localStorage draft)
  const clearFormData = useCallback(() => {
    try {
      if (user?.email) {
        onboardingAPIOptimized.updateStep('step_1', {}, user.email, {}, user.id).catch(() => {});
      }
      if (user?.id) {
        clearDraftFromLocalStorage(user.id);
      }
      const storageKey = `${STORAGE_KEY_PREFIX}${flowType}`;
      secureClear(storageKey);
      secureClear(STORAGE_KEY_FORM_DATA);
      sessionStorage.removeItem(`${storageKey}_backend_save`);
    } catch {
      // Silent error handling
    }
  }, [flowType, user]);

  // Auto-save with debounce (2 seconds)
  useEffect(() => {
    if (!autoSave) return;

    const subscription = form.watch((_value, { name, type }) => {
      if (type === 'change' && name) {
        if (saveTimeoutRef.current) {
          clearTimeout(saveTimeoutRef.current);
        }

        saveTimeoutRef.current = setTimeout(() => {
          saveFormData();
        }, 2000);
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
