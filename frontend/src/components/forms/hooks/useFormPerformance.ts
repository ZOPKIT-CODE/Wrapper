import { useMemo, useCallback, useRef, useEffect, useState } from 'react';
import { useFormContext } from '../contexts/FormContext';

/**
 * Hook for form performance optimizations
 */
export const useFormPerformance = () => {
  const { methods } = useFormContext();
  
  // Memoized form values to prevent unnecessary re-renders
  const formValues = useMemo(() => methods.getValues(), [methods.watch()]);
  
  // Memoized validation state
  const validationState = useMemo(() => ({
    isValid: methods.formState.isValid,
    isDirty: methods.formState.isDirty,
    isSubmitting: methods.formState.isSubmitting,
    errors: methods.formState.errors
  }), [methods.formState.isValid, methods.formState.isDirty, methods.formState.isSubmitting, methods.formState.errors]);

  // Debounced field updates
  const debounceRef = useRef<Record<string, NodeJS.Timeout>>({});
  
  const debouncedSetValue = useCallback((fieldId: string, value: any, delay: number = 300) => {
    // Clear existing timeout
    if (debounceRef.current[fieldId]) {
      clearTimeout(debounceRef.current[fieldId]);
    }
    
    // Set new timeout
    debounceRef.current[fieldId] = setTimeout(() => {
      methods.setValue(fieldId, value, { shouldValidate: true, shouldDirty: true });
    }, delay);
  }, [methods]);

  // Cleanup timeouts on unmount
  useEffect(() => {
    return () => {
      Object.values(debounceRef.current).forEach(clearTimeout);
    };
  }, []);

  // Memoized field validation
  const validateField = useCallback(async (fieldId: string) => {
    return methods.trigger(fieldId);
  }, [methods]);

  // Batch field updates
  const batchUpdateFields = useCallback((updates: Record<string, any>) => {
    Object.entries(updates).forEach(([fieldId, value]) => {
      methods.setValue(fieldId, value, { shouldValidate: false, shouldDirty: true });
    });
    
    // Validate all fields at once
    methods.trigger();
  }, [methods]);

  return {
    formValues,
    validationState,
    debouncedSetValue,
    validateField,
    batchUpdateFields
  };
};

/**
 * Hook for virtual scrolling in large forms
 */
export const useVirtualScrolling = (itemHeight: number = 60, containerHeight: number = 400) => {
  const [scrollTop, setScrollTop] = useState(0);
  const [containerRef, setContainerRef] = useState<HTMLDivElement | null>(null);

  const visibleItems = useMemo(() => {
    if (!containerRef) return { start: 0, end: 0 };
    
    const start = Math.floor(scrollTop / itemHeight);
    const end = Math.min(
      start + Math.ceil(containerHeight / itemHeight) + 1,
      containerRef.children.length
    );
    
    return { start, end };
  }, [scrollTop, itemHeight, containerHeight, containerRef]);

  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    setScrollTop(e.currentTarget.scrollTop);
  }, []);

  return {
    containerRef: setContainerRef,
    handleScroll,
    visibleItems,
    totalHeight: containerRef ? containerRef.children.length * itemHeight : 0,
    offsetY: visibleItems.start * itemHeight
  };
};

/**
 * Hook for lazy loading field components
 */
export const useLazyFieldComponents = () => {
  const [loadedComponents, setLoadedComponents] = useState<Set<string>>(new Set());
  
  const loadComponent = useCallback(async (fieldType: string) => {
    if (loadedComponents.has(fieldType)) return;
    
    try {
      // Dynamic import based on field type
      switch (fieldType) {
        case 'text':
        case 'email':
        case 'password':
          await import('../field-components/TextField');
          break;
        case 'select':
          await import('../field-components/SelectField');
          break;
        case 'switch':
          await import('../field-components/SwitchField');
          break;
        case 'textarea':
          await import('../field-components/TextareaField');
          break;
        case 'number':
          await import('../field-components/NumberField');
          break;
        case 'date':
          await import('../field-components/DateField');
          break;
        case 'file':
          await import('../field-components/FileField');
          break;
        case 'checkbox':
          await import('../field-components/CheckboxField');
          break;
        case 'radio':
          await import('../field-components/RadioField');
          break;
        default:
          console.warn(`Unknown field type: ${fieldType}`);
          return;
      }
      
      setLoadedComponents(prev => new Set([...prev, fieldType]));
    } catch (error) {
      console.error(`Failed to load component for field type: ${fieldType}`, error);
    }
  }, [loadedComponents]);

  return {
    loadComponent,
    isLoaded: (fieldType: string) => loadedComponents.has(fieldType)
  };
};

/**
 * Hook for form analytics and performance monitoring
 */
export const useFormAnalytics = () => {
  const { currentStep, config, methods } = useFormContext();
  const startTimeRef = useRef<number>(Date.now());
  const stepTimesRef = useRef<Record<number, number>>({});
  const fieldInteractionsRef = useRef<Record<string, number>>({});

  // Track step completion time
  useEffect(() => {
    const stepStartTime = Date.now();
    
    return () => {
      stepTimesRef.current[currentStep] = Date.now() - stepStartTime;
    };
  }, [currentStep]);

  // Track field interactions
  const trackFieldInteraction = useCallback((fieldId: string) => {
    fieldInteractionsRef.current[fieldId] = (fieldInteractionsRef.current[fieldId] || 0) + 1;
  }, []);

  // Get analytics data
  const getAnalytics = useCallback(() => {
    const totalTime = Date.now() - startTimeRef.current;
    const stepTimes = Object.entries(stepTimesRef.current).map(([step, time]) => ({
      step: parseInt(step),
      timeMs: time
    }));
    
    const fieldInteractions = Object.entries(fieldInteractionsRef.current).map(([field, count]) => ({
      fieldId: field,
      interactionCount: count
    }));

    return {
      totalTime,
      stepTimes,
      fieldInteractions,
      currentStep,
      totalSteps: config.steps.length,
      formErrors: Object.keys(methods.formState.errors).length
    };
  }, [currentStep, config.steps.length, methods.formState.errors]);

  return {
    trackFieldInteraction,
    getAnalytics
  };
};
