import { useCallback } from 'react'
import { useNavigate } from '@tanstack/react-router'
import {
  isLandingPath,
  scrollToLandingContact,
} from '@/features/landing/landing-scroll'

/** Navigate or scroll to the landing contact form from any marketing page. */
export function useMarketingContactCta() {
  const navigate = useNavigate()

  return useCallback(() => {
    if (
      typeof window !== 'undefined' &&
      isLandingPath(window.location.pathname)
    ) {
      scrollToLandingContact('smooth')
      return
    }
    navigate({ to: '/', hash: 'contact' })
  }, [navigate])
}
