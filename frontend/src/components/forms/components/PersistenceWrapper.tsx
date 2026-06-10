import React, { useEffect } from 'react'
import { useFormPersistence } from '../hooks/useFormPersistence'

interface PersistenceWrapperProps {
  children: React.ReactNode
  persistence?: any
}

/**
 * Wrapper component that handles persistence inside the form context
 */
export const PersistenceWrapper: React.FC<PersistenceWrapperProps> = ({
  children,
  persistence = {},
}) => {
  // This hook can now be used because we're inside the FormProvider
  const { saveFormData } = useFormPersistence(persistence)

  // Auto-save on form changes
  useEffect(() => {
    if (persistence.persistOnChange) {
      saveFormData()
    }
  }, [saveFormData, persistence.persistOnChange])

  return <>{children}</>
}
