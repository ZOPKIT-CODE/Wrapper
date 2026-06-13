import React, { useState, useEffect } from 'react'

import { LandingScreenshotHero } from '@/features/landing/components/LandingScreenshotHero'
import { LandingCapabilityRow } from '@/features/landing/components/LandingCapabilityRow'
import { LandingProductScreenshotRail } from '@/features/landing/components/LandingProductScreenshotRail'
import { LandingScreenshotSpotlight } from '@/features/landing/components/LandingScreenshotSpotlight'
import { LandingWorkflowBlock } from '@/features/landing/components/LandingWorkflowBlock'
import { LandingIndustriesGrid } from '@/features/landing/components/LandingIndustriesGrid'
import { LandingTestimonial } from '@/features/landing/components/LandingTestimonial'
import { LandingContactSection } from '@/features/landing/components/LandingContactSection'
import { LandingClosingCta } from '@/features/landing/components/LandingClosingCta'
import { testimonials } from '@/data/content'
import { toast } from 'sonner'
import { consumeSessionRecoveryReason } from '@/lib/auth/session-recovery'
import { LandingFooter } from '@/components/layout/LandingFooter'
import { MarketingNavbar } from '@/components/layout/MarketingNavbar'
import { MarketingPageShell } from '@/components/layout/MarketingPageShell'
import { useLandingSectionScroll } from '@/features/landing/useLandingSectionScroll'

/** Landing v2 — screenshot-led variant (archived at /landing/v2). Production landing is `/`. */
const LandingV2: React.FC = () => {
  const [contactForm, setContactForm] = useState({
    name: '',
    email: '',
    company: '',
    phone: '',
    jobTitle: '',
    companySize: '',
    preferredTime: '',
    comments: '',
  })
  const [isSubmittingContact, setIsSubmittingContact] = useState(false)
  const { scrollToContact } = useLandingSectionScroll()

  useEffect(() => {
    const recoveryReason = consumeSessionRecoveryReason()
    if (
      recoveryReason === 'invalid_grant' ||
      recoveryReason === 'session_expired'
    ) {
      toast.error('Your session has expired. Please sign in again.', {
        id: 'session-expired',
        duration: 6000,
        position: 'top-center',
      })
    }
  }, [])

  const quote = testimonials[0]

  return (
    <MarketingPageShell>
      <MarketingNavbar minimal onBookDemo={scrollToContact} />

      <main>
        <LandingScreenshotHero onBookDemo={scrollToContact} />
        <LandingCapabilityRow />
        <LandingScreenshotSpotlight />
        <LandingProductScreenshotRail />
        <LandingWorkflowBlock />
        <LandingIndustriesGrid />
        <LandingTestimonial quotes={[quote]} />
        <LandingContactSection
          contactForm={contactForm}
          setContactForm={setContactForm}
          isSubmitting={isSubmittingContact}
          setIsSubmitting={setIsSubmittingContact}
        />
        <LandingClosingCta />
      </main>

      <LandingFooter marketing />
    </MarketingPageShell>
  )
}

export default LandingV2
