import { useCallback, useEffect } from 'react'
import {
  isLandingSectionId,
  readLandingHash,
  scrollToLandingContact,
  scrollToLandingSection,
  scrollToLandingSectionWhenReady,
  writeLandingHash,
} from '@/features/landing/landing-scroll'

export function useLandingSectionScroll() {
  const scrollToContact = useCallback(() => {
    scrollToLandingContact('smooth')
  }, [])

  const scrollToSection = useCallback((sectionId: string) => {
    if (scrollToLandingSection(sectionId, 'smooth')) {
      writeLandingHash(sectionId)
    }
  }, [])

  useEffect(() => {
    const hash = readLandingHash()
    if (hash && isLandingSectionId(hash)) {
      scrollToLandingSectionWhenReady(hash, 'instant')
      return
    }
    window.scrollTo({ top: 0, behavior: 'instant' })
  }, [])

  useEffect(() => {
    const onHashChange = () => {
      const hash = readLandingHash()
      if (hash && isLandingSectionId(hash)) {
        scrollToLandingSection(hash, 'smooth')
      }
    }
    window.addEventListener('hashchange', onHashChange)
    return () => window.removeEventListener('hashchange', onHashChange)
  }, [])

  return { scrollToContact, scrollToSection }
}
