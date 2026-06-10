import { useEffect, useCallback } from 'react'
import { useFormContext } from '../contexts/FormContext'

export type PersistenceType = 'localStorage' | 'sessionStorage' | 'none'

interface UseFormPersistenceOptions {
  /** Type of persistence to use */
  type?: PersistenceType
  /** Custom key for storage */
  key?: string
  /** Debounce delay for saving (ms) */
  debounceMs?: number
  /** Whether to persist on every change */
  persistOnChange?: boolean
  /** Whether to persist on step change */
  persistOnStepChange?: boolean
  /** Whether to clear on submit */
  clearOnSubmit?: boolean
}

/**
 * Hook for form state persistence
 */
export const useFormPersistence = (options: UseFormPersistenceOptions = {}) => {
  const {
    type = 'localStorage',
    key = 'multistep-form-data',
    debounceMs = 500,
    persistOnChange = true,
    persistOnStepChange = true,
    clearOnSubmit = true,
  } = options

  const {
    currentStep,
    methods,
    handleSubmit: originalHandleSubmit,
  } = useFormContext()

  // Get storage instance
  const storage =
    type === 'localStorage'
      ? localStorage
      : type === 'sessionStorage'
        ? sessionStorage
        : null

  // Save form data
  const saveFormData = useCallback(() => {
    if (!storage) return

    try {
      const formData = {
        currentStep,
        values: methods.getValues(),
        timestamp: Date.now(),
      }
      storage.setItem(key, JSON.stringify(formData))
    } catch (error) {
      console.warn('Failed to save form data:', error)
    }
  }, [storage, key, currentStep, methods])

  // Load form data
  const loadFormData = useCallback(() => {
    if (!storage) return null

    try {
      const saved = storage.getItem(key)
      if (saved) {
        const formData = JSON.parse(saved)

        // Check if data is not too old (24 hours)
        const maxAge = 24 * 60 * 60 * 1000 // 24 hours
        if (Date.now() - formData.timestamp < maxAge) {
          return formData
        } else {
          // Clear old data
          storage.removeItem(key)
        }
      }
    } catch (error) {
      console.warn('Failed to load form data:', error)
    }

    return null
  }, [storage, key])

  // Clear form data
  const clearFormData = useCallback(() => {
    if (!storage) return

    try {
      storage.removeItem(key)
    } catch (error) {
      console.warn('Failed to clear form data:', error)
    }
  }, [storage, key])

  // Restore form data
  const restoreFormData = useCallback(() => {
    const savedData = loadFormData()
    if (savedData) {
      // Restore values
      methods.reset(savedData.values)

      // Restore step (this would need to be handled by parent component)
      return {
        step: savedData.currentStep,
        values: savedData.values,
      }
    }
    return null
  }, [loadFormData, methods])

  // Debounced save
  useEffect(() => {
    if (!persistOnChange) return

    const timeoutId = setTimeout(saveFormData, debounceMs)
    return () => clearTimeout(timeoutId)
  }, [methods.watch(), persistOnChange, debounceMs, saveFormData])

  // Save on step change
  useEffect(() => {
    if (persistOnStepChange) {
      saveFormData()
    }
  }, [currentStep, persistOnStepChange, saveFormData])

  // Enhanced submit handler
  const handleSubmit = useCallback(async () => {
    await originalHandleSubmit()

    // Clear data on successful submit (skipped if the submit above threw)
    if (clearOnSubmit) {
      clearFormData()
    }
  }, [originalHandleSubmit, clearOnSubmit, clearFormData])

  return {
    saveFormData,
    loadFormData,
    clearFormData,
    restoreFormData,
    handleSubmit,
  }
}

/**
 * Hook for auto-save functionality
 */
export const useAutoSave = (intervalMs: number = 30000) => {
  const { saveFormData } = useFormPersistence({ persistOnChange: false })

  useEffect(() => {
    const interval = setInterval(saveFormData, intervalMs)
    return () => clearInterval(interval)
  }, [saveFormData, intervalMs])
}
